import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import prisma from "../db.js";
import { JWT_SECRET } from "../jwtSecret.js";
import {
  signup,
  login,
  googleAuth,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendOtp,
} from "../controllers/authController.js";

const router = express.Router();

const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Only allow the configured FRONTEND_URL as a redirect target — no user-controlled URLs
const getSafeFrontendUrl = () => DEFAULT_FRONTEND_URL;

// VULN-07 FIX: Use a short-lived, single-use exchange code instead of JWT in URL.
// The JWT is stored server-side keyed by a random code. The frontend exchanges
// the code for the real token via POST /auth/exchange-code.
const pendingCodes = new Map(); // code -> { token, user, expiresAt }

const generateTokenAndRedirect = (user, res) => {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role || "student" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  // One-time exchange code — expires in 2 minutes
  const code = crypto.randomBytes(24).toString("hex");
  pendingCodes.set(code, {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role || "student" },
    expiresAt: Date.now() + 2 * 60 * 1000,
  });

  // Clean up stale codes periodically
  for (const [k, v] of pendingCodes) {
    if (Date.now() > v.expiresAt) pendingCodes.delete(k);
  }

  const frontend = getSafeFrontendUrl();
  // Only a short-lived opaque code is in the URL — NOT the JWT
  return res.redirect(`${frontend}/auth?code=${code}`);
};

// Exchange endpoint: frontend posts the code, receives the real JWT
router.post("/exchange-code", (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required." });

  const entry = pendingCodes.get(code);
  if (!entry) return res.status(400).json({ error: "Invalid or expired code." });
  if (Date.now() > entry.expiresAt) {
    pendingCodes.delete(code);
    return res.status(400).json({ error: "Code has expired. Please sign in again." });
  }

  // Single-use: delete immediately after retrieval
  pendingCodes.delete(code);
  return res.status(200).json({ token: entry.token, user: entry.user });
});

/* --- GOOGLE OAUTH FLOW --- */
router.get("/google", (req, res) => {
  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || "http://localhost:8787/api/auth/google/callback")}` +
    `&response_type=code&scope=openid%20email%20profile&access_type=offline`;
  res.redirect(googleAuthUrl);
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Google auth code missing");

    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:8787/api/auth/google/callback",
      grant_type: "authorization_code",
    });
    const { access_token } = tokenRes.data;

    const userRes = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { email, name } = userRes.data;

    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);
    if (existingAdmin) {
      return res.status(400).send("This email is already registered with an admin account.");
    }

    let user = existingUser;
    if (!user) {
      // VULN-04 FIX: Random hashed password, not empty string
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: { name, email, password: hashedPassword, role: "student" },
      });
    }

    return generateTokenAndRedirect(user, res);
  } catch (error) {
    console.error("Google callback error:", error.response?.data || error.message);
    res.status(500).send("Google callback failed");
  }
});

/* --- GITHUB OAUTH FLOW --- */
router.get("/github", (req, res) => {
  const githubAuthUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.GITHUB_REDIRECT_URI || "http://localhost:8787/api/auth/github/callback")}` +
    `&scope=user:email`;
  res.redirect(githubAuthUrl);
});

router.get("/github/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("GitHub auth code missing");

    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI || "http://localhost:8787/api/auth/github/callback",
      },
      { headers: { Accept: "application/json" } }
    );
    const { access_token } = tokenRes.data;

    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${access_token}` },
    });

    let email = userRes.data.email;
    if (!email) {
      const emailsRes = await axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `token ${access_token}` },
      });
      email =
        emailsRes.data.find((e) => e.primary && e.verified)?.email ||
        emailsRes.data[0]?.email;
    }
    const name = userRes.data.name || userRes.data.login;

    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);
    if (existingAdmin) {
      return res.status(400).send("This email is already registered with an admin account.");
    }

    let user = existingUser;
    if (!user) {
      // VULN-04 FIX: Random hashed password, not empty string
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: { name, email, password: hashedPassword, role: "student" },
      });
    }

    return generateTokenAndRedirect(user, res);
  } catch (error) {
    console.error("GitHub callback error:", error.response?.data || error.message);
    res.status(500).send("GitHub callback failed");
  }
});

// Strict Rate Limiting for Auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Too many login/signup attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleAuth);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/verify-email", authLimiter, verifyEmail);
router.post("/resend-otp", authLimiter, resendOtp);

export default router;
