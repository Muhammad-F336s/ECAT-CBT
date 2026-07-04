import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import prisma from "../db.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const pullLoginMessages = async (email, role) => {
  const recipientRole = role === "admin" ? "Admin" : "User";
  try {
    const loginMessages = await prisma.loginMessage.findMany({
      where: {
        recipientEmail: email,
        recipientRole,
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (loginMessages.length) {
      await prisma.loginMessage.updateMany({
        where: {
          id: { in: loginMessages.map((message) => message.id) },
        },
        data: { isRead: true },
      });
    }

    return loginMessages;
  } catch (error) {
    console.error("Login message fallback:", error);
    return [];
  }
};

const findAdminForLogin = async (email) => {
  try {
    return await prisma.admin.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        secretHash: true,
        rank: true,
        isFrozen: true,
      },
    });
  } catch (error) {
    console.error("Admin login extended fields fallback:", error);
    return prisma.admin.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        secretHash: true,
      },
    });
  }
};

export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Data input verification
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // 2. Email duplication check across both user and admin identities
    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);

    if (existingUser || existingAdmin) {
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
        role: role || "student",
        isApproved: false,
        testAttemptsLimit: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        testAttemptsLimit: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message:
        role === "admin"
          ? "Admin registration submitted. Main admin will approve and allocate your secret key."
          : "Registration submitted successfully. Your account is pending approval by admin.",
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

    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);

    if (existingAdmin) {
      return res.status(400).json({
        error: "This email is already registered with an admin account.",
      });
    }

    let user = existingUser;

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "student",
          isApproved: false,
          testAttemptsLimit: 0,
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
    const { email, password, role, secretCode } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const requestedRole = role || "student";

    if (requestedRole === "admin") {
      const admin = await findAdminForLogin(email);

      if (!admin) {
        return res.status(401).json({ error: "Invalid admin credentials." });
      }

      const normalizedSecretCode = String(secretCode || "").trim().toUpperCase();
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      const isSecretValid = await bcrypt.compare(normalizedSecretCode, admin.secretHash);

      if (!isPasswordValid || !isSecretValid) {
        return res.status(403).json({
          error: "Invalid admin credentials or secret code.",
        });
      }

      if (admin.isFrozen) {
        return res.status(403).json({
          error: "Your admin account is frozen by the main admin.",
        });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: "admin" },
        process.env.JWT_SECRET || "super_secret_fallback_key_123",
        { expiresIn: "7d" },
      );
      const loginMessages = await pullLoginMessages(admin.email, "admin");

      return res.status(200).json({
        message: "Admin login successful!",
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: "admin",
          rank:
            admin.email === "muhammad.f336s@gmail.com"
              ? "Root Owner"
              : admin.rank || "Standard Admin",
          isApproved: true,
          testAttemptsLimit: -1,
          loginMessages,
        },
      });
    }

    // 2. Find regular user in Neon DB
    const user = await prisma.user.findUnique({
      where: { email },
    });

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

    const attemptsUsed = await prisma.testAttempt.count({
      where: { userId: user.id },
    });

    if (!user.isApproved) {
      return res
        .status(403)
        .json({ error: "Your account is pending approval by admin." });
    }

    if (
      user.testAttemptsLimit >= 0 &&
      attemptsUsed >= user.testAttemptsLimit
    ) {
      return res.status(403).json({
        error: "Your test attempts have been completed. Renew your package or contact admin.",
      });
    }

    // 4. Generate JWT Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "super_secret_fallback_key_123",
      { expiresIn: "7d" },
    );
    const loginMessages = await pullLoginMessages(user.email, "student");

    res.status(200).json({
      message: "Login successful!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        testAttemptsLimit: user.testAttemptsLimit,
        loginMessages,
      },
    });
  } catch (error) {
    console.error("Login Engine Error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error. Processing failed." });
  }
};
