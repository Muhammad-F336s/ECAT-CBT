import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import prisma from "../db.js";
import { signup, login, googleAuth, forgotPassword, resetPassword } from "../controllers/authController.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_fallback_key_123";
const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const getSafeFrontendUrl = (url) => {
  if (!url) return DEFAULT_FRONTEND_URL;

  try {
    const parsed = new URL(url);
    const isLocalDev =
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");

    return isLocalDev ? parsed.origin : DEFAULT_FRONTEND_URL;
  } catch {
    return DEFAULT_FRONTEND_URL;
  }
};

// Helper: Secure JWT generator wrapper
const generateTokenAndRedirect = (user, res, frontendUrl) => {
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });

  // Token aur user payload ko safe base64/URL query parameter ke zariye frontend par throw karo
  const userData = encodeURIComponent(
    JSON.stringify({ id: user.id, name: user.name, email: user.email }),
  );

  const frontend = getSafeFrontendUrl(frontendUrl);
  return res.redirect(`${frontend}/auth?token=${token}&user=${userData}`);
};

/* --- GOOGLE OAUTH FLOW --- */
router.get("/google", (req, res) => {
  const frontend = getSafeFrontendUrl(req.query.returnTo);
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || "http://localhost:8787/api/auth/google/callback")}&response_type=code&scope=openid%20email%20profile&access_type=offline&state=${encodeURIComponent(frontend)}`;
  res.redirect(googleAuthUrl);
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Google auth code missing");

    // 1. Exchange code for access token
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:
        process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:8787/api/auth/google/callback",
      grant_type: "authorization_code",
    });

    const { access_token } = tokenRes.data;

    // 2. Fetch user profile via Google Identity API
    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      },
    );

    const { email, name } = userRes.data;

    // 3. Sync profile into database table
    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);

    if (existingAdmin) {
      return res.status(400).send("This email is already registered with an admin account.");
    }

    let user = existingUser;
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, password: "" }, // Social auth checks match explicit passwords null
      });
    }

    return generateTokenAndRedirect(user, res, req.query.state);
  } catch (error) {
    console.error(
      "Google callback error:",
      error.response?.data || error.message,
    );
    res.status(500).send("Google callback failed");
  }
});

/* --- GITHUB OAUTH FLOW --- */
router.get("/github", (req, res) => {
  const frontend = getSafeFrontendUrl(req.query.returnTo);
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_REDIRECT_URI || "http://localhost:8787/api/auth/github/callback")}&scope=user:email&state=${encodeURIComponent(frontend)}`;
  res.redirect(githubAuthUrl);
});

router.get("/github/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("GitHub auth code missing");

    // 1. Exchange temporary token parameter code
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:
          process.env.GITHUB_REDIRECT_URI ||
          "http://localhost:8787/api/auth/github/callback",
      },
      {
        headers: { Accept: "application/json" },
      },
    );

    const { access_token } = tokenRes.data;

    // 2. Query GitHub for primary user info
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${access_token}` },
    });

    // GitHub privacy settings may require fetching email separately
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

    // 3. User verification schema mapping
    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);

    if (existingAdmin) {
      return res.status(400).send("This email is already registered with an admin account.");
    }

    let user = existingUser;
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, password: "" },
      });
    }

    return generateTokenAndRedirect(user, res, req.query.state);
  } catch (error) {
    console.error(
      "GitHub callback error:",
      error.response?.data || error.message,
    );
    res.status(500).send("GitHub callback failed");
  }
});

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
