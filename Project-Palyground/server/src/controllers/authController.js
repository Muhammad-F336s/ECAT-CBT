import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import prisma from "../db.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Data input verification
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // 2. Email duplication check using Prisma
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "This email is already registered." });
    }

    // 3. Salt hashing password processing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Secure DB row insertion
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // 5. Stateful JWT generation
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "super_secret_fallback_key",
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (error) {
    console.error("Signup Endpoint Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error. Runtime processing failure." });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: "Google credential is required." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name;
    const emailVerified = payload?.email_verified;

    if (!email || !name || !emailVerified) {
      return res
        .status(400)
        .json({ error: "Google authentication failed: invalid profile data." });
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "super_secret_fallback_key_123",
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: "Google sign-in successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ error: "Failed to authenticate with Google." });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    // 2. Find user in Neon DB
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // If admin login credentials are used and admin does not exist yet, create admin user
    if (!user && email === "malik@cbt.com" && password === "admin123") {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          name: "Admin",
          email,
          password: hashedPassword,
          role: "admin",
        },
      });
    }

    if (!user) {
      return res
        .status(401)
        .json({ error: "Invalid credentials: user not found." });
    }

    // 3. Verify Hashed Password via bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ error: "Invalid credentials: incorrect password." });
    }

    // 4. Generate JWT Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "super_secret_fallback_key_123",
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: "Login successful!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Engine Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error. Processing failed." });
  }
};
