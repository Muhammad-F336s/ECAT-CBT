import bcrypt from "bcrypt";
import prisma from "../db.js";
import { DEMO_ACCOUNT_EMAIL } from "./adminController.js";

const generateSecret = () =>
  `ADM-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
const MAIN_ADMIN_EMAIL = "muhammad.f336s@gmail.com";

export const getMe = async (req, res) => {
  try {
    const userId = req.auth.id;
    if (!userId) return res.status(401).json({ error: "No user ID found in token." });

    // Handle synthetic demo student tokens (id starts with "demo-")
    if (userId.startsWith("demo-") && req.auth.isDemo) {
      return res.status(200).json({
        id: userId,
        name: "Demo Student",
        email: req.auth.email || "demo@cbt.com",
        role: "student",
        isApproved: true,
        packageType: "PREMIUM",
        testAttemptsLimit: -1,
        createdAt: new Date().toISOString(),
      });
    }

    // 1. Try to find in User table first
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        isDemoAccount: true,
        packageType: true,
        testAttemptsLimit: true,
        createdAt: true,
      },
    });

    // 2. If not found, check Admin table
    if (!user) {
      const admin = await prisma.admin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          rank: true,
          createdAt: true,
        },
      });

      if (admin) {
        user = {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: "admin",
          isApproved: true,
          packageType: "PREMIUM",
          testAttemptsLimit: -1,
          createdAt: admin.createdAt,
          rank: admin.rank,
        };
      }
    }

    if (!user) {
      return res.status(404).json({ error: "User not found in system." });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Internal server error while fetching profile." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { name, password } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    const updateData = { name: name.trim() };
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
    } else if (password && password.length > 0 && password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isApproved: true, packageType: true, testAttemptsLimit: true },
    });
    res.status(200).json({ message: "Profile updated successfully.", user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile." });
  }
};

export const getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "User ID parameter is required." });

    const attempts = await prisma.testAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (attempts.length === 0) {
      return res.status(200).json({
        message: "No tests taken yet.",
        totalTests: 0,
        averagePercentage: 0,
        history: [],
        subjectAnalytics: {},
      });
    }

    const totalTests = attempts.length;
    let totalScoreObtained = 0;
    let totalPossibleMarks = 0;

    const analytics = {};

    const history = attempts.map((attempt) => {
      totalScoreObtained += attempt.score;
      totalPossibleMarks += attempt.totalMarks;

      const breakdown = attempt.breakdown?.breakdown || [];
      const subjectName = attempt.breakdown?.subjectName || "Unknown";

      if (!analytics[subjectName]) {
        analytics[subjectName] = { total: 0, correct: 0, chapters: {} };
      }

      breakdown.forEach((q) => {
        analytics[subjectName].total++;
        if (q.isCorrect) analytics[subjectName].correct++;

        const cid = q.chapterId || "Unknown";
        if (!analytics[subjectName].chapters[cid]) {
          analytics[subjectName].chapters[cid] = { total: 0, correct: 0 };
        }
        analytics[subjectName].chapters[cid].total++;
        if (q.isCorrect) analytics[subjectName].chapters[cid].correct++;
      });

      return {
        attemptId: attempt.id,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        percentage: parseFloat(((attempt.score / attempt.totalMarks) * 100).toFixed(2)),
        date: attempt.createdAt,
      };
    });

    const averagePercentage = parseFloat(((totalScoreObtained / totalPossibleMarks) * 100).toFixed(2));

    res.status(200).json({
      userId,
      totalTests,
      averagePercentage,
      totalScoreObtained,
      totalPossibleMarks,
      history,
      subjectAnalytics: analytics,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to compile metrics." });
  }
};

export const listPendingUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["student", "admin"] }, isApproved: false, testAttemptsLimit: 0 },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isApproved: true, packageType: true, testAttemptsLimit: true, createdAt: true },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("List pending users error:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
};

export const listApprovedUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "student", OR: [{ isApproved: true }, { testAttemptsLimit: { not: 0 } }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isApproved: true, packageType: true, testAttemptsLimit: true, createdAt: true, _count: { select: { attempts: true } } },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("List approved users error:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
};

export const listStudents = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "student" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true, isApproved: true, packageType: true,
        testAttemptsLimit: true, createdAt: true,
        attempts: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, score: true, totalMarks: true, createdAt: true } },
        _count: { select: { attempts: true } },
      },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("List students error:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
};

export const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { approve, attemptsLimit, adminSecretCode } = req.body;
    const pendingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, password: true, role: true, createdAt: true },
    });
    if (!pendingUser) return res.status(404).json({ error: "User not found." });
    if (pendingUser.role === "admin") {
      if (req.adminAuth?.email !== MAIN_ADMIN_EMAIL) return res.status(403).json({ error: "Only root owner can approve admins." });
      const secretCode = String(adminSecretCode || generateSecret()).trim().toUpperCase();
      const secretHash = await bcrypt.hash(secretCode, 10);
      const admin = await prisma.admin.create({
        data: { name: pendingUser.name, email: pendingUser.email, password: pendingUser.password, secretHash, secretCode, rank: "Admin" },
        select: { id: true, name: true, email: true, rank: true, secretCode: true, createdAt: true },
      });
      await prisma.user.delete({ where: { id: userId } });
      return res.status(200).json({ message: "Admin approved", user: { ...admin, role: "admin", isApproved: true, testAttemptsLimit: -1, _count: { attempts: 0 } } });
    }
    const normalizedLimit = attemptsLimit === "unlimited" || attemptsLimit === -1 ? -1 : Number(attemptsLimit ?? -1);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: approve ?? true, testAttemptsLimit: normalizedLimit },
      select: { id: true, name: true, email: true, role: true, isApproved: true, packageType: true, testAttemptsLimit: true, createdAt: true, _count: { select: { attempts: true } } },
    });
    res.status(200).json({ message: "User updated", user });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({ error: "Failed to update user." });
  }
};

export const rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Guard: prevent deletion of the protected demo account
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (targetUser && targetUser.email.toLowerCase() === DEMO_ACCOUNT_EMAIL) {
      return res.status(403).json({ error: "The Demo Student account is a protected root account and cannot be deleted." });
    }

    const user = await prisma.user.delete({ where: { id: userId }, select: { id: true, name: true, email: true } });
    res.status(200).json({ message: "User rejected", user });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({ error: "Failed to reject user." });
  }
};

export const createTicket = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { title, category, description } = req.body;
    if (!title || !category || !description) {
      return res.status(400).json({ error: "All fields are required." });
    }
    const ticket = await prisma.supportTicket.create({
      data: { userId, title, category, description },
    });
    res.status(201).json({ message: "Ticket submitted successfully.", ticket });
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Failed to submit support ticket." });
  }
};

export const getUserTickets = async (req, res) => {
  try {
    const userId = req.auth.id;
    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(tickets);
  } catch (error) {
    console.error("Get user tickets error:", error);
    res.status(500).json({ error: "Failed to retrieve tickets." });
  }
};

export const replyToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    const userId = req.auth.id;

    if (!reply) return res.status(400).json({ error: "Reply content is required." });

    const ticket = await prisma.supportTicket.findUnique({ where: { id, userId } });
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });

    let currentThread = ticket.thread ? (typeof ticket.thread === "string" ? JSON.parse(ticket.thread) : ticket.thread) : [];
    if (!Array.isArray(currentThread)) currentThread = [];

    currentThread.push({ sender: "student", message: reply, timestamp: new Date().toISOString() });

    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: { thread: currentThread, status: "Pending" },
    });

    res.status(200).json({ message: "Reply sent successfully.", ticket: updatedTicket });
  } catch (error) {
    console.error("Reply to ticket error:", error);
    res.status(500).json({ error: "Failed to send reply." });
  }
};
