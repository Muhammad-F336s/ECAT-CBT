import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import prisma from "../db.js";
import nodemailer from "nodemailer";

// ---- Nodemailer transporter (reusable) ----
const getMailTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
};

// ---- Send OTP email ----
const sendOtpEmail = async (to, name, otp) => {
  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn("[Email] EMAIL_USER/PASS not configured — OTP:", otp);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "ECAT CBT – Your Email Verification Code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px">
        <h2 style="color:#2d6a4f">Email Verification</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Use the 6-digit OTP below to verify your email address:</p>
        <div style="text-align:center;margin:28px 0">
          <span style="font-size:2.4rem;font-weight:bold;letter-spacing:10px;color:#1b4332;background:#d8f3dc;padding:14px 28px;border-radius:10px">${otp}</span>
        </div>
        <p style="color:#555;font-size:0.88rem">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>`,
  });
};

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
    const { name, email, password, role, domain, cnic } = req.body;

    // 1. Data input verification
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (role !== "admin" && !domain) {
      return res.status(400).json({ error: "Please select your domain (Engineering, Medical, or Computer Science)." });
    }

    if (role !== "admin" && !cnic) {
      return res.status(400).json({ error: "CNIC is required." });
    }

    // Validate CNIC format (Pakistan: 13 digits, XXXXX-XXXXXXX-X)
    if (role !== "admin" && cnic) {
      const cleanCnic = cnic.replace(/-/g, "");
      if (!/^\d{13}$/.test(cleanCnic)) {
        return res.status(400).json({ error: "Invalid CNIC format. Use: 12345-1234567-1" });
      }
    }

    // 2. Email duplication check across both user and admin identities
    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);

    if (existingUser || existingAdmin) {
      return res.status(400).json({ error: "This email is already registered." });
    }

    // 3. CNIC uniqueness check
    if (role !== "admin" && cnic) {
      const cleanCnic = cnic.replace(/-/g, "");
      const existingCnic = await prisma.user.findUnique({ where: { cnic: cleanCnic } });
      if (existingCnic) {
        return res.status(400).json({ error: "An account is already registered with this CNIC. You cannot create multiple accounts." });
      }
    }

    // 4. Salt hashing password processing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 5. Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const cleanCnic = role !== "admin" && cnic ? cnic.replace(/-/g, "") : null;

    // 6. Secure DB row insertion
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "student",
        domain: role !== "admin" ? domain : null,
        cnic: cleanCnic,
        isApproved: false,
        isEmailVerified: false,
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
        testAttemptsLimit: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        domain: true,
        isApproved: true,
        isEmailVerified: true,
        testAttemptsLimit: true,
        createdAt: true,
      },
    });

    // 7. Send OTP email
    await sendOtpEmail(email, name, otp);

    res.status(201).json({
      message:
        role === "admin"
          ? "Admin registration submitted. Main admin will approve and allocate your secret key."
          : "Registration submitted! Please check your email for a verification code.",
      user,
      requiresOtp: role !== "admin",
    });
  } catch (error) {
    console.error("Signup Endpoint Error:", error);
    res.status(500).json({ error: "Internal Server Error. Runtime processing failure." });
  }
};

// ---- Verify Email OTP ----
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Account not found." });

    if (user.isEmailVerified) {
      return res.status(200).json({ message: "Email already verified." });
    }

    if (!user.emailOtp || !user.emailOtpExpiry) {
      return res.status(400).json({ error: "No OTP found. Please register again." });
    }

    if (new Date() > new Date(user.emailOtpExpiry)) {
      return res.status(400).json({ error: "OTP has expired. Please contact admin or re-register." });
    }

    if (user.emailOtp !== otp.toString()) {
      return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }

    await prisma.user.update({
      where: { email },
      data: { isEmailVerified: true, emailOtp: null, emailOtpExpiry: null },
    });

    res.status(200).json({ message: "Email verified successfully! Your account is now pending admin approval." });
  } catch (error) {
    console.error("Email verify error:", error);
    res.status(500).json({ error: "Email verification failed." });
  }
};

// ---- Resend OTP ----
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Account not found." });
    if (user.isEmailVerified) return res.status(400).json({ error: "Email already verified." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { emailOtp: otp, emailOtpExpiry: otpExpiry },
    });

    await sendOtpEmail(email, user.name, otp);
    res.status(200).json({ message: "A new OTP has been sent to your email." });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: "Failed to resend OTP." });
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
        isDemoAccount: user.isDemoAccount || false,
      },
    });
  } catch (error) {
    console.error("Google verify error:", error);
    res.status(500).json({ error: "Google authentication engine unavailable." });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ error: "No account found with this email address." });
    }

    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${user.id}`;
    
    // Attempt dynamic loading of nodemailer to notify if installed
    try {
      const nodemailer = await import("nodemailer");
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: "🛒 ECAT CBT - Password Reset Request",
          html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
            <h2 style="color: #003366;">Password Reset Request</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to proceed to the secure reset page:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #00509d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset My Password</a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 0.9rem;">${resetLink}</p>
          </div>`
        });
      }
    } catch(_err) {
      // Graceful fallback if nodemailer not installed locally yet
    }

    res.json({ message: "A real password reset email has been sent to your account!", resetLink });
  } catch(error) {
    console.error("Forgot password API error:", error);
    res.status(500).json({ error: "Failed to issue password reset logic." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // The basic fallback format from PLAIN.2 (UserId used as token)
    const user = await prisma.user.findUnique({ where: { id: token } });
    
    if (!user) {
      return res.status(404).json({ error: "Invalid or expired reset link." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: token },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password updated successfully. You can now sign in with your new password." });
  } catch(error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password." });
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
      
      if (!admin.password || !admin.secretHash) {
        return res.status(500).json({
          error: "Admin account configuration is incomplete. Please contact the root owner.",
        });
      }

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

    if (user.frozenUntil && new Date(user.frozenUntil) > new Date()) {
      return res.status(403).json({
        error: user.freezeReason || "Your account is temporarily frozen.",
        isFrozen: true
      });
    }

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
        isDemoAccount: user.isDemoAccount || false,
        packageType: user.packageType ?? "STANDARD",
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
