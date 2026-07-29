import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../db.js";

const MAIN_ADMIN_EMAIL = "muhammad.f336s@gmail.com";
const ROOT_OWNER_RANK = "Root Owner";
const MAIN_ADMIN_RANK = "Main Admin";
const STANDARD_ADMIN_RANK = "Standard Admin";

// ── Protected Demo Account ─────────────────────────────────────────
export const DEMO_ACCOUNT_EMAIL = "demo@cbt.com";

const generateSecret = () =>
  `ADM-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

const adminSelect = {
  id: true,
  name: true,
  email: true,
  rank: true,
  isFrozen: true,
  secretCode: true,
  createdAt: true,
};

const basicAdminSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
};

const decorateAdmin = (admin) => ({
  ...admin,
  rank:
    admin.email === MAIN_ADMIN_EMAIL
      ? ROOT_OWNER_RANK
      : admin.rank || STANDARD_ADMIN_RANK,
  isFrozen: admin.isFrozen || false,
  secretCode:
    admin.email === MAIN_ADMIN_EMAIL ? null : admin.secretCode || null,
  isRootOwner: admin.email === MAIN_ADMIN_EMAIL,
});

const requesterEmail = (req) => req.adminAuth?.email;
const isRootRequester = (req) => requesterEmail(req) === MAIN_ADMIN_EMAIL;

const requireRootOwner = (req, res) => {
  if (isRootRequester(req)) return true;
  res.status(403).json({
    error: "Only the protected root owner can manage admin accounts.",
  });
  return false;
};

export const listAdmins = async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: adminSelect,
    });
    res.status(200).json(admins.map(decorateAdmin));
  } catch (error) {
    console.error("List admins error:", error);
    try {
      const admins = await prisma.admin.findMany({
        orderBy: { createdAt: "desc" },
        select: basicAdminSelect,
      });
      return res.status(200).json(admins.map(decorateAdmin));
    } catch (fallbackError) {
      console.error("List admins fallback error:", fallbackError);
      return res.status(500).json({ error: "Failed to fetch admins." });
    }
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { rank, isFrozen } = req.body;

    if (!requireRootOwner(req, res)) return;

    const existing = await prisma.admin.findUnique({ where: { id: adminId } });

    if (!existing) return res.status(404).json({ error: "Admin not found." });
    if (existing.email === MAIN_ADMIN_EMAIL) {
      return res.status(403).json({
        error:
          "Root owner account cannot be frozen, demoted, or modified by admin controls.",
      });
    }

    const normalizedRank =
      rank === MAIN_ADMIN_RANK || rank === STANDARD_ADMIN_RANK
        ? rank
        : undefined;

    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(normalizedRank ? { rank: normalizedRank } : {}),
        ...(typeof isFrozen === "boolean" ? { isFrozen } : {}),
      },
      select: adminSelect,
    });

    res
      .status(200)
      .json({ message: "Admin updated", admin: decorateAdmin(admin) });
  } catch (error) {
    console.error("Update admin error:", error);
    res.status(500).json({ error: "Failed to update admin." });
  }
};

export const regenerateAdminSecret = async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!requireRootOwner(req, res)) return;

    const existing = await prisma.admin.findUnique({ where: { id: adminId } });

    if (!existing) return res.status(404).json({ error: "Admin not found." });
    if (existing.email === MAIN_ADMIN_EMAIL) {
      return res.status(403).json({ error: "Main admin secret is protected." });
    }

    const secretCode = generateSecret();
    const secretHash = await bcrypt.hash(secretCode, 10);
    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: { secretCode, secretHash },
      select: adminSelect,
    });

    res
      .status(200)
      .json({
        message: "Secret regenerated",
        admin: decorateAdmin(admin),
        secretCode,
      });
  } catch (error) {
    console.error("Regenerate admin secret error:", error);
    res.status(500).json({ error: "Failed to regenerate secret." });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!requireRootOwner(req, res)) return;

    const existing = await prisma.admin.findUnique({ where: { id: adminId } });

    if (!existing) return res.status(404).json({ error: "Admin not found." });
    if (
      existing.email === MAIN_ADMIN_EMAIL &&
      requesterEmail(req) !== MAIN_ADMIN_EMAIL
    ) {
      return res
        .status(403)
        .json({ error: "Root owner cannot be deleted by another admin." });
    }

    const admin = await prisma.admin.delete({
      where: { id: adminId },
      select: adminSelect,
    });
    res
      .status(200)
      .json({ message: "Admin deleted", admin: decorateAdmin(admin) });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({ error: "Failed to delete admin." });
  }
};

export const listRecipients = async (req, res) => {
  try {
    const [users, admins] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true },
      }),
      prisma.admin.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true },
      }),
    ]);

    res.status(200).json({
      users: users.map((user) => ({ ...user, type: "User" })),
      admins: admins.map((admin) => ({ ...admin, type: "Admin" })),
    });
  } catch (error) {
    console.error("List recipients error:", error);
    res.status(500).json({ error: "Failed to fetch recipients." });
  }
};

export const createLoginMessage = async (req, res) => {
  try {
    const {
      recipientEmail,
      recipientRole,
      body,
      senderEmail,
      showSenderEmail = true,
    } = req.body;

    if (!recipientEmail || !recipientRole || !body) {
      return res
        .status(400)
        .json({ error: "Recipient and message are required." });
    }

    const message = await prisma.loginMessage.create({
      data: {
        recipientEmail,
        recipientRole,
        body,
        senderEmail: showSenderEmail ? senderEmail : null,
        showSenderEmail,
      },
    });

    res.status(201).json({ message: "Message queued", loginMessage: message });
  } catch (error) {
    console.error("Create login message error:", error);
    res.status(500).json({ error: "Failed to queue message." });
  }
};

export const listLoginMessages = async (req, res) => {
  try {
    const messages = await prisma.loginMessage.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(messages);
  } catch (error) {
    console.error("List login messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages." });
  }
};

export const getInboxMessages = async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    const role = String(req.query.role || "").trim();

    if (!email || !role) {
      return res.status(400).json({ error: "email and role are required." });
    }

    const messages = await prisma.loginMessage.findMany({
      where: {
        recipientEmail: email,
        recipientRole: role === "admin" ? "Admin" : "User",
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Inbox messages error:", error);
    res.status(500).json({ error: "Failed to fetch inbox messages." });
  }
};

export const getPlatformAnalytics = async (req, res) => {
  try {
    const [totalStudents, totalAdmins, totalQuestions, totalAttempts] =
      await Promise.all([
        prisma.user.count(),
        prisma.admin.count(),
        prisma.question.count(),
        prisma.testAttempt.count(),
      ]);

    // Subject Performance Analytics
    const subjects = await prisma.subject.findMany({
      include: {
        chapters: {
          include: {
            questions: {
              select: { id: true },
            },
          },
        },
      },
    });

    const attempts = await prisma.testAttempt.findMany({
      select: { score: true, breakdown: true, createdAt: true },
      take: 1000,
      orderBy: { createdAt: "desc" },
    });

    const subjectPerformance = subjects.map((sub) => {
      const chapterIds = sub.chapters.map((c) => c.id);
      // Basic heuristic: check breakdown for questions in these chapters
      let subTotal = 0;
      let subCorrect = 0;

      attempts.forEach((att) => {
        if (att.breakdown && Array.isArray(att.breakdown)) {
          att.breakdown.forEach((item) => {
            if (chapterIds.includes(item.chapterId)) {
              subTotal++;
              if (item.isCorrect) subCorrect++;
            }
          });
        }
      });

      return {
        name: sub.name,
        averageScore:
          subTotal > 0 ? Math.round((subCorrect / subTotal) * 100) : 0,
        questionCount: sub.chapters.reduce(
          (acc, c) => acc + c.questions.length,
          0,
        ),
      };
    });

    // Recent Activity (Daily test attempts for the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await prisma.testAttempt.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
    });

    // Grouping by actual date string for chart
    const dailyStats = {};
    recentActivity.forEach((item) => {
      const d = item.createdAt.toISOString().split("T")[0];
      dailyStats[d] = (dailyStats[d] || 0) + item._count.id;
    });

    res.status(200).json({
      summary: {
        totalStudents,
        totalAdmins,
        totalQuestions,
        totalAttempts,
      },
      subjectPerformance,
      activityTrends: Object.entries(dailyStats)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error("Platform analytics error:", error);
    res.status(500).json({ error: "Failed to fetch platform analytics." });
  }
};

export const getSettings = async (req, res) => {
  try {
    let config = await prisma.platformConfig.findFirst();
    if (!config) {
      config = await prisma.platformConfig.create({
        data: {
          defaultTimePerQ: 60,
          negativeMarking: false,
          maintenanceMode: false,
          vectorBotEnabled: true,
          supportEmail: "support@ecat-cbt.com",
        },
      });
    }
    res.status(200).json(config);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { defaultTimePerQ, negativeMarking, maintenanceMode, supportEmail, vectorBotEnabled } =
      req.body;
    const config = await prisma.platformConfig.update({
      where: { id: 1 },
      data: { defaultTimePerQ, negativeMarking, maintenanceMode, supportEmail, vectorBotEnabled },
    });
    res.status(200).json(config);
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ error: "Failed to update settings." });
  }
};

export const getPlatformTickets = async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(tickets);
  } catch (error) {
    console.error("Get platform tickets error:", error);
    res.status(500).json({ error: "Failed to retrieve tickets." });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });

    res.status(200).json({ message: "Ticket status updated", ticket });
  } catch (error) {
    console.error("Update ticket status error:", error);
    res.status(500).json({ error: "Failed to update ticket status." });
  }
};

export const impersonateUser = async (req, res) => {
  try {
    const adminId = req.adminAuth.id;
    const { secretCode } = req.body;

    // 1. Verify admin secret code
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !secretCode || !(await bcrypt.compare(String(secretCode).trim().toUpperCase(), admin.secretHash))) {
      return res.status(403).json({ error: "Invalid Admin Secret Code." });
    }

    // 2. Always use the protected Demo@CBT.com account — auto-create if absent
    let demoStudent = await prisma.user.findUnique({
      where: { email: DEMO_ACCOUNT_EMAIL },
    });

    if (!demoStudent) {
      const demoPasswordHash = await bcrypt.hash("DemoCBT@2026", 10);
      demoStudent = await prisma.user.create({
        data: {
          name: "Demo Student",
          email: DEMO_ACCOUNT_EMAIL,
          password: demoPasswordHash,
          role: "student",
          isApproved: true,
          packageType: "PREMIUM",
          testAttemptsLimit: -1,
        },
      });
      console.log("[Demo] Auto-created protected demo account:", demoStudent.id);
    }

    // 3. Log the impersonation
    try {
      await prisma.impersonationLog.create({
        data: { adminId, studentId: demoStudent.id },
      });
    } catch (logErr) {
      console.warn("Impersonation log warning:", logErr.message);
    }

    // 4. Issue temporary student JWT (2-hour session)
    const token = jwt.sign(
      { id: demoStudent.id, email: demoStudent.email, role: "student", isDemo: true },
      process.env.JWT_SECRET || "super_secret_fallback_key_123",
      { expiresIn: "2h" }
    );

    res.status(200).json({
      token,
      student: {
        id: demoStudent.id,
        name: demoStudent.name,
        email: demoStudent.email,
        role: "student",
        isApproved: demoStudent.isApproved,
        packageType: demoStudent.packageType,
        testAttemptsLimit: demoStudent.testAttemptsLimit,
        createdAt: demoStudent.createdAt,
      },
    });
  } catch (error) {
    console.error("Impersonation error:", error);
    res.status(500).json({ error: "Failed to initiate impersonation." });
  }
};

