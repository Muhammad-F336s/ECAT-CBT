import bcrypt from "bcrypt";
import prisma from "../db.js";

const generateSecret = () =>
  `ADM-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
const MAIN_ADMIN_EMAIL = "muhammad.f336s@gmail.com";

export const getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({ error: "User ID parameter is required." });
    }

    // 1. Fetch all user attempts sorted by creation date
    const attempts = await prisma.testAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (attempts.length === 0) {
      return res.status(200).json({
        message: "This user has not taken any tests yet.",
        totalTests: 0,
        averagePercentage: 0,
        history: [],
      });
    }

    // 2. Metrics Mathematical Aggregations
    const totalTests = attempts.length;
    let totalScoreObtained = 0;
    let totalPossibleMarks = 0;

    const history = attempts.map((attempt) => {
      totalScoreObtained += attempt.score;
      totalPossibleMarks += attempt.totalMarks;

      return {
        attemptId: attempt.id,
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        percentage:
          ((attempt.score / attempt.totalMarks) * 100).toFixed(2) + "%",
        date: attempt.createdAt,
      };
    });

    const averagePercentage =
      ((totalScoreObtained / totalPossibleMarks) * 100).toFixed(2) + "%";

    // 3. Structured Data response output
    res.status(200).json({
      userId,
      totalTests,
      averagePercentage,
      totalScoreObtained,
      totalPossibleMarks,
      history,
    });
  } catch (error) {
    console.error("Analytics Engine Crash:", error);
    res
      .status(500)
      .json({ error: "Failed to compile user metrics calculation layers." });
  }
};

export const listPendingUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["student", "admin"] },
        isApproved: false,
        testAttemptsLimit: 0,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        packageType: true,
        testAttemptsLimit: true,
        createdAt: true,
      },
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
      where: {
        role: "student",
        OR: [
          { isApproved: true },
          { testAttemptsLimit: { not: 0 } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        packageType: true,
        testAttemptsLimit: true,
        createdAt: true,
        _count: {
          select: { attempts: true },
        },
      },
    });

    res.status(200).json(users);
  } catch (error) {
    console.error("List approved users error:", error);
    res.status(500).json({ error: "Failed to fetch approved users." });
  }
};

export const listStudents = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "student" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        packageType: true,
        testAttemptsLimit: true,
        createdAt: true,
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            score: true,
            totalMarks: true,
            createdAt: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });

    res.status(200).json(users);
  } catch (error) {
    console.error("List students error:", error);
    res.status(500).json({ error: "Failed to fetch students." });
  }
};

export const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { approve, attemptsLimit, adminSecretCode } = req.body;

    const pendingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        createdAt: true,
      },
    });

    if (!pendingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (pendingUser.role === "admin") {
      if (req.adminAuth?.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({
          error: "Only the protected root owner can approve admin accounts.",
        });
      }

      const secretCode = String(adminSecretCode || generateSecret()).trim().toUpperCase();

      if (!secretCode) {
        return res.status(400).json({ error: "Admin secret code is required." });
      }

      const secretHash = await bcrypt.hash(secretCode, 10);
      const admin = await prisma.admin.create({
        data: {
          name: pendingUser.name,
          email: pendingUser.email,
          password: pendingUser.password,
          secretHash,
          secretCode,
          rank: "Admin",
        },
        select: {
          id: true,
          name: true,
          email: true,
          rank: true,
          secretCode: true,
          createdAt: true,
        },
      });

      await prisma.user.delete({ where: { id: userId } });

      return res.status(200).json({
        message: "Admin approved and secret allocated",
        user: {
          ...admin,
          role: "admin",
          isApproved: true,
          testAttemptsLimit: -1,
          _count: { attempts: 0 },
        },
      });
    }

    const normalizedLimit =
      attemptsLimit === "unlimited" || attemptsLimit === -1
        ? -1
        : Number(attemptsLimit ?? -1);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isApproved: approve ?? true,
        testAttemptsLimit: normalizedLimit,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        packageType: true,
        packageType: true,
        testAttemptsLimit: true,
        createdAt: true,
        _count: {
          select: { attempts: true },
        },
      },
    });

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({ error: "Failed to update user." });
  }
};

export const rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.delete({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    res.status(200).json({ message: "User rejected and removed", user });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({ error: "Failed to reject user." });
  }
};

export const updateUserPackage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { attemptsLimit, packageType, isApproved } = req.body;
    const normalizedLimit =
      attemptsLimit === "unlimited" || attemptsLimit === -1
        ? -1
        : Number(attemptsLimit);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        testAttemptsLimit: normalizedLimit,
        ...(packageType ? { packageType } : {}),
        ...(typeof isApproved === "boolean" ? { isApproved } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        packageType: true,
        testAttemptsLimit: true,
        isApproved: true,
        createdAt: true,
        _count: {
          select: { attempts: true },
        },
      },
    });

    res.status(200).json({ message: "Package updated", user });
  } catch (error) {
    console.error("Update package error:", error);
    res.status(500).json({ error: "Failed to update package." });
  }
};
