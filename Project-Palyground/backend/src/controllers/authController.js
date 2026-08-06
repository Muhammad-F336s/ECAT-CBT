import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import prisma from "../db.js";
import { getConfig } from "../configHelpers.js";
import { JWT_SECRET } from "../jwtSecret.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    // Dev-only: log OTP to console when email is not configured
    console.warn("[Email] EMAIL_USER/PASS not configured — OTP for dev:", otp);
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

// ---- Pull unread login messages on login ----
export const pullLoginMessages = async (email, role) => {
  const recipientRole = role === "admin" ? "Admin" : "User";
  try {
    const loginMessages = await prisma.loginMessage.findMany({
      where: { recipientEmail: email, recipientRole, isRead: false },
      orderBy: { createdAt: "desc" },
    });
    if (loginMessages.length) {
      await prisma.loginMessage.updateMany({
        where: { id: { in: loginMessages.map((m) => m.id) } },
        data: { isRead: true },
      });
    }
    return loginMessages;
  } catch {
    return [];
  }
};

const findAdminForLogin = async (email) => {
  try {
    return await prisma.admin.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true, secretHash: true, rank: true, isFrozen: true },
    });
  } catch {
    return prisma.admin.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true, secretHash: true },
    });
  }
};

export const signup = async (req, res) => {
  try {
    const { name, email, password, role, domain, cnic } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (role !== "admin" && !domain) {
      return res.status(400).json({ error: "Please select your domain (Engineering, Medical, or Computer Science)." });
    }
    if (role !== "admin" && !cnic) {
      return res.status(400).json({ error: "CNIC is required." });
    }
    if (role !== "admin" && cnic) {
      const cleanCnic = cnic.replace(/-/g, "");
      if (!/^\d{13}$/.test(cleanCnic)) {
        return res.status(400).json({ error: "Invalid CNIC format. Use: 12345-1234567-1" });
      }
    }

    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);
    if (existingUser || existingAdmin) {
      return res.status(400).json({ error: "This email is already registered." });
    }

    if (role !== "admin" && cnic) {
      const cleanCnic = cnic.replace(/-/g, "");
      const existingCnic = await prisma.user.findUnique({ where: { cnic: cleanCnic } });
      if (existingCnic) {
        return res.status(400).json({ error: "An account is already registered with this CNIC." });
      }
    }

    const config = await getConfig();
    if (config.registrationMode === "Invite") {
      const { inviteCode } = req.body;
      if (!inviteCode || inviteCode !== process.env.PLATFORM_INVITE_CODE) {
        return res.status(403).json({ error: "Registration is invite-only. A valid invite code is required." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // VULN-09 FIX: Use crypto.randomInt instead of Math.random for OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const cleanCnic = role !== "admin" && cnic ? cnic.replace(/-/g, "") : null;
    const isApproved = role !== "admin" ? Boolean(config.autoApproveStudents) : false;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "student",
        domain: role !== "admin" ? domain : null,
        cnic: cleanCnic,
        isApproved,
        isEmailVerified: false,
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
        packageType: config.defaultPackage,
        testAttemptsLimit: 0,
      },
      select: { id: true, name: true, email: true, role: true, domain: true, isApproved: true, isEmailVerified: true, testAttemptsLimit: true, createdAt: true },
    });

    await sendOtpEmail(email, name, otp);

    res.status(201).json({
      message: role === "admin"
        ? "Admin registration submitted. Main admin will approve and allocate your secret key."
        : "Registration submitted! Please check your email for a verification code.",
      user,
      requiresOtp: role !== "admin",
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(500).json({ error: "Internal Server Error." });
  }
};

// ---- Verify Email OTP ----
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Account not found." });
    if (user.isEmailVerified) return res.status(200).json({ message: "Email already verified." });

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
    console.error("Email verify error:", error.message);
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

    // VULN-09 FIX: crypto.randomInt for OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({ where: { email }, data: { emailOtp: otp, emailOtpExpiry: otpExpiry } });
    await sendOtpEmail(email, user.name, otp);
    res.status(200).json({ message: "A new OTP has been sent to your email." });
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    res.status(500).json({ error: "Failed to resend OTP." });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Google credential is required." });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name;
    const emailVerified = payload?.email_verified;

    if (!email || !name || !emailVerified) {
      return res.status(400).json({ error: "Google authentication failed: invalid profile data." });
    }

    const [existingUser, existingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.admin.findUnique({ where: { email } }),
    ]);
    if (existingAdmin) {
      return res.status(400).json({ error: "This email is already registered with an admin account." });
    }

    let user = existingUser;
    if (!user) {
      // VULN-04 FIX: Store a hashed random password, not an empty string
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const oauthConfig = await getConfig();
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "student",
          isApproved: Boolean(oauthConfig.autoApproveStudents),
          packageType: oauthConfig.defaultPackage,
          testAttemptsLimit: 0,
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(200).json({
      message: "Google sign-in successful.",
      token,
      user: { id: user.id, name: user.name, email: user.email, isDemoAccount: user.isDemoAccount || false },
    });
  } catch (error) {
    console.error("Google auth error:", error.message);
    res.status(500).json({ error: "Google authentication engine unavailable." });
  }
};

// ---- VULN-01 & VULN-02 FIX: Secure password reset ----
// Token = crypto.randomBytes(32) raw value (sent via email only)
// DB stores = bcrypt hash of that token + expiry
// API response = NEVER leaks token or resetLink
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return a generic message to prevent email enumeration
    if (!user) {
      return res.status(200).json({ message: "If that email is registered, a password reset link has been sent." });
    }

    // Generate a cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { email },
      data: { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
    });

    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    const transporter = getMailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "ECAT CBT – Password Reset Request",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;padding:30px;border:1px solid #eee;border-radius:10px">
            <h2 style="color:#003366">Password Reset Request</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
            <div style="text-align:center;margin:30px 0">
              <a href="${resetLink}" style="background:#00509d;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold">Reset My Password</a>
            </div>
            <p style="color:#888;font-size:0.85rem">If you did not request this, ignore this email. Your password will not change.</p>
          </div>`,
      });
    } else {
      // Dev fallback: print to console, never to API response
      console.warn("[Dev] Password reset link (email not configured):", resetLink);
    }

    // VULN-02 FIX: Never return resetLink or token in the API response
    res.status(200).json({ message: "If that email is registered, a password reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ error: "Failed to process password reset request." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword) {
      return res.status(400).json({ error: "Token, email, and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }
    if (new Date() > new Date(user.passwordResetExpiry)) {
      return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
    }

    // VULN-01 FIX: Compare raw token against stored bcrypt hash
    const isValid = await bcrypt.compare(token, user.passwordResetToken);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, passwordResetToken: null, passwordResetExpiry: null },
    });
    res.status(200).json({ message: "Password updated successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ error: "Failed to reset password." });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, role, secretCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const requestedRole = role || "student";

    if (requestedRole === "admin") {
      const admin = await findAdminForLogin(email);
      if (!admin) return res.status(401).json({ error: "Invalid admin credentials." });

      const normalizedSecretCode = String(secretCode || "").trim().toUpperCase();
      if (!admin.password || !admin.secretHash) {
        return res.status(500).json({ error: "Admin account configuration is incomplete." });
      }

      const [isPasswordValid, isSecretValid] = await Promise.all([
        bcrypt.compare(password, admin.password),
        bcrypt.compare(normalizedSecretCode, admin.secretHash),
      ]);
      if (!isPasswordValid || !isSecretValid) {
        return res.status(403).json({ error: "Invalid admin credentials or secret code." });
      }
      if (admin.isFrozen) {
        return res.status(403).json({ error: "Your admin account is frozen by the main admin." });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: "admin" },
        JWT_SECRET,
        { expiresIn: "7d" }
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
          rank: admin.email === "muhammad.f336s@gmail.com" ? "Root Owner" : admin.rank || "Standard Admin",
          isApproved: true,
          testAttemptsLimit: -1,
          loginMessages,
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials: user not found." });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials: incorrect password." });

    const loginConfig = await getConfig();
    if (loginConfig.emailVerificationRequired && !user.isEmailVerified) {
      return res.status(403).json({
        error: "Email verification required. Please verify your email before logging in.",
        needsVerification: true,
      });
    }

    if (user.frozenUntil && new Date(user.frozenUntil) > new Date()) {
      return res.status(403).json({ error: user.freezeReason || "Your account is temporarily frozen.", isFrozen: true });
    }
    if (!user.isApproved) {
      return res.status(403).json({ error: "Your account is pending approval by admin." });
    }

    const attemptsUsed = await prisma.testAttempt.count({ where: { userId: user.id } });
    if (user.testAttemptsLimit >= 0 && attemptsUsed >= user.testAttemptsLimit) {
      return res.status(403).json({ error: "Your test attempts have been completed. Renew your package or contact admin." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
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
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Internal Server Error." });
  }
};
