import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { sendOtpEmail as sendOtpEmailCentral, sendPasswordResetEmail as sendPasswordResetEmailCentral } from "../services/emailService.js";
import prisma from "../db.js";
import { getConfig } from "../configHelpers.js";
import { JWT_SECRET } from "../jwtSecret.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Store pending signups in memory so they are not saved in DB until verified
const pendingSignups = new Map();


// ---- Send OTP email via Centralized Email Service ----
const sendOtpEmail = async (to, name, otp) => {
  return sendOtpEmailCentral({ to, name, otp });
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

    // Store in memory instead of DB
    pendingSignups.set(email, {
      name,
      email,
      password: hashedPassword,
      role: role || "student",
      domain: role !== "admin" ? domain : null,
      cnic: cleanCnic,
      isApproved,
      isEmailVerified: false,
      otp,
      otpExpiry,
      packageType: config.defaultPackage,
      testAttemptsLimit: 0,
      secretHash: role === "admin" ? await bcrypt.hash(adminSecretCode, 10) : undefined // if admin
    });

    // Send email without awaiting to speed up response
    sendOtpEmail(email, name, otp).catch(err => console.error("Async OTP Email Failed:", err.message));

    res.status(201).json({
      message: role === "admin"
        ? "Admin registration submitted. Main admin will approve and allocate your secret key."
        : "Registration submitted! Please check your email for a verification code.",
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

    const pendingUser = pendingSignups.get(email);
    if (!pendingUser) return res.status(404).json({ error: "No pending signup found for this email. Please register again." });

    if (new Date() > new Date(pendingUser.otpExpiry)) {
      pendingSignups.delete(email);
      return res.status(400).json({ error: "OTP has expired. Please re-register." });
    }
    if (pendingUser.otp !== otp.toString()) {
      return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }

    // OTP is valid. Now save to database
    if (pendingUser.role === "admin") {
      await prisma.admin.create({
        data: {
          name: pendingUser.name,
          email: pendingUser.email,
          password: pendingUser.password,
          secretHash: pendingUser.secretHash || "",
          rank: "Admin",
          isFrozen: false
        }
      });
    } else {
      const now = new Date();
      const starterExpiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      await prisma.user.create({
        data: {
          name: pendingUser.name,
          email: pendingUser.email,
          password: pendingUser.password,
          role: pendingUser.role,
          domain: pendingUser.domain,
          cnic: pendingUser.cnic,
          isApproved: pendingUser.isApproved,
          isEmailVerified: true,
          packageType: "STARTER",
          packageStartedAt: now,
          packageExpiresAt: starterExpiresAt,
          remainingTestAttempts: 2,
          testAttemptsLimit: 2,
          starterClaimedAt: now,
        }
      });
    }

    pendingSignups.delete(email);
    res.status(200).json({ message: "Email verified successfully! You can now log in." });
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

    const pendingUser = pendingSignups.get(email);
    if (!pendingUser) return res.status(404).json({ error: "No pending signup found. Please register again." });

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    pendingUser.otp = otp;
    pendingUser.otpExpiry = otpExpiry;
    pendingSignups.set(email, pendingUser);

    sendOtpEmail(email, pendingUser.name, otp).catch(err => console.error("Async OTP Resend Failed:", err.message));
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isDemoAccount: user.isDemoAccount || false,
        packageType: user.packageType,
        packageExpiresAt: user.packageExpiresAt,
        packageStartedAt: user.packageStartedAt,
        remainingTestAttempts: user.remainingTestAttempts,
        testAttemptsLimit: user.testAttemptsLimit,
        starterClaimedAt: user.starterClaimedAt,
        academicProfileCompleted: user.academicProfileCompleted ?? false,
      },
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

    // ✅ Case-insensitive: always compare lowercase
    const normalizedEmail = email.trim().toLowerCase();

    const frontendBase = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.replace(/\/$/, "")
      : "http://localhost:5173";

    const generateResetToken = async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      return { rawToken, tokenHash, expiry };
    };

    const sendResetEmail = async (toEmail, toName, resetLink) => {
      const transporter = getMailTransporter();
      if (transporter) {
        try {
          await transporter.sendMail({
            from: `"ECAT CBT Platform" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: "ECAT CBT – Password Reset Request",
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;padding:30px;border:1px solid #eee;border-radius:10px">
                <h2 style="color:#003366">Password Reset Request</h2>
                <p>Hi <strong>${toName}</strong>,</p>
                <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
                <div style="text-align:center;margin:30px 0">
                  <a href="${resetLink}" style="background:#00509d;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold">Reset My Password</a>
                </div>
                <p style="color:#555;font-size:0.88rem">Or copy this link into your browser:</p>
                <p style="word-break:break-all;font-size:0.82rem;color:#888">${resetLink}</p>
                <p style="color:#888;font-size:0.85rem">If you did not request this, ignore this email. Your password will not change.</p>
              </div>`,
          });
        } catch (mailErr) {
          // SMTP rejected the address (e.g. 550 no such user)
          console.error("[Email] Delivery failed to:", toEmail, mailErr.message);
          // Re-throw with a user-friendly message so caller can respond with 400
          const err = new Error("EMAIL_DELIVERY_FAILED");
          err.recipientEmail = toEmail;
          throw err;
        }
      } else {
        console.warn("[Dev] Password reset link:", resetLink);
      }
    };

    // 1. Check User table (case-insensitive)
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (user) {
      const { rawToken, tokenHash, expiry } = await generateResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
      });
      const resetLink = `${frontendBase}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
      try {
        await sendResetEmail(user.email, user.name, resetLink);
      } catch (mailErr) {
        if (mailErr.message === "EMAIL_DELIVERY_FAILED") {
          // Clear the token — it's useless if email never arrived
          await prisma.user.update({ where: { id: user.id }, data: { passwordResetToken: null, passwordResetExpiry: null } });
          return res.status(400).json({ error: `❌ Email delivery failed. The address "${user.email}" could not receive mail. Please contact ECAT-CBT support.` });
        }
        throw mailErr;
      }
      return res.status(200).json({ message: "✅ Password reset link has been sent to your email." });
    }

    // 2. Check Admin table (case-insensitive)
    const admin = await prisma.admin.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, name: true, email: true },
    });

    if (admin) {
      const { rawToken, tokenHash, expiry } = await generateResetToken();
      await prisma.admin.update({
        where: { id: admin.id },
        data: { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
      });
      const resetLink = `${frontendBase}/reset-password?token=${rawToken}&email=${encodeURIComponent(admin.email)}&role=admin`;
      try {
        await sendResetEmail(admin.email, admin.name, resetLink);
      } catch (mailErr) {
        if (mailErr.message === "EMAIL_DELIVERY_FAILED") {
          await prisma.admin.update({ where: { id: admin.id }, data: { passwordResetToken: null, passwordResetExpiry: null } });
          return res.status(400).json({ error: `❌ Email delivery failed. The address "${admin.email}" could not receive mail. Please contact ECAT-CBT support.` });
        }
        throw mailErr;
      }
      return res.status(200).json({ message: "✅ Password reset link has been sent to your email." });
    }

    // Email not found in either table
    return res.status(404).json({ error: "❌ No account found with this email address. Please check and try again." });

  } catch (error) {
    if (error.message === "EMAIL_DELIVERY_FAILED") {
      return res.status(400).json({ error: `❌ Email delivery failed. The address could not receive mail. Please contact ECAT-CBT support.` });
    }
    console.error("Forgot password error:", error.message);
    res.status(500).json({ error: "Failed to process password reset request." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, email, newPassword, role } = req.body;
    if (!token || !email || !newPassword) {
      return res.status(400).json({ error: "Token, email, and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Admin reset flow
    if (role === "admin") {
      const admin = await prisma.admin.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      });
      if (!admin || !admin.passwordResetToken || !admin.passwordResetExpiry) {
        return res.status(400).json({ error: "Invalid or expired reset link." });
      }
      if (new Date() > new Date(admin.passwordResetExpiry)) {
        return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
      }
      const isValid = await bcrypt.compare(token, admin.passwordResetToken);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid or expired reset link." });
      }
      await prisma.admin.update({
        where: { id: admin.id },
        data: { password: hashedPassword, passwordResetToken: null, passwordResetExpiry: null },
      });
      return res.status(200).json({ message: "Password updated successfully. You can now sign in." });
    }

    // Student/user reset flow
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }
    if (new Date() > new Date(user.passwordResetExpiry)) {
      return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
    }
    const isValid = await bcrypt.compare(token, user.passwordResetToken);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }
    await prisma.user.update({
      where: { id: user.id },
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
    const { email: rawEmail, password, role, secretCode } = req.body;
    const email = (rawEmail || "").toLowerCase().trim();
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
        packageExpiresAt: user.packageExpiresAt,
        packageStartedAt: user.packageStartedAt,
        remainingTestAttempts: user.remainingTestAttempts,
        starterClaimedAt: user.starterClaimedAt,
        hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
        academicTrack: user.academicTrack,
        academicSubjects: user.academicSubjects,
        academicProfileCompleted: user.academicProfileCompleted ?? false,
        academicProfileEditExpiresAt: user.academicProfileEditExpiresAt,
        loginMessages,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Internal Server Error." });
  }
};
