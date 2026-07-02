import bcrypt from "bcrypt";
import prisma from "../db.js";

const MAIN_ADMIN_EMAIL = "muhammad.f336s@gmail.com";
const ROOT_OWNER_RANK = "Root Owner";
const MAIN_ADMIN_RANK = "Main Admin";
const STANDARD_ADMIN_RANK = "Standard Admin";

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
  rank: admin.email === MAIN_ADMIN_EMAIL ? ROOT_OWNER_RANK : admin.rank || STANDARD_ADMIN_RANK,
  isFrozen: admin.isFrozen || false,
  secretCode: admin.email === MAIN_ADMIN_EMAIL ? null : admin.secretCode || null,
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
        error: "Root owner account cannot be frozen, demoted, or modified by admin controls.",
      });
    }

    const normalizedRank =
      rank === MAIN_ADMIN_RANK || rank === STANDARD_ADMIN_RANK ? rank : undefined;

    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(normalizedRank ? { rank: normalizedRank } : {}),
        ...(typeof isFrozen === "boolean" ? { isFrozen } : {}),
      },
      select: adminSelect,
    });

    res.status(200).json({ message: "Admin updated", admin: decorateAdmin(admin) });
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

    res.status(200).json({ message: "Secret regenerated", admin: decorateAdmin(admin), secretCode });
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
    if (existing.email === MAIN_ADMIN_EMAIL && requesterEmail(req) !== MAIN_ADMIN_EMAIL) {
      return res.status(403).json({ error: "Root owner cannot be deleted by another admin." });
    }

    const admin = await prisma.admin.delete({
      where: { id: adminId },
      select: adminSelect,
    });
    res.status(200).json({ message: "Admin deleted", admin: decorateAdmin(admin) });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({ error: "Failed to delete admin." });
  }
};

export const listRecipients = async (req, res) => {
  try {
    if (!requireRootOwner(req, res)) return;

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
    if (!requireRootOwner(req, res)) return;

    const {
      recipientEmail,
      recipientRole,
      body,
      senderEmail,
      showSenderEmail = true,
    } = req.body;

    if (!recipientEmail || !recipientRole || !body) {
      return res.status(400).json({ error: "Recipient and message are required." });
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
    if (!requireRootOwner(req, res)) return;

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
