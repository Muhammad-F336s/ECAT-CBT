import crypto from "crypto";
import bcrypt from "bcrypt";
import prisma from "../db.js";
import { invalidatePaymentConfigCache, getDynamicPaymentConfig } from "../config/paymentConfig.js";
import {
  sendBankChangeAuthorizationEmail,
  sendBankChangeAppliedEmail,
} from "../services/emailService.js";

const MAIN_ADMIN_EMAIL = "muhammad.f336s@gmail.com";

/**
 * 1. GET /api/admin/bank-settings
 * Returns current active bank configuration and any pending change request.
 */
export const getBankSettings = async (req, res) => {
  try {
    const config = await getDynamicPaymentConfig();

    const pendingRequest = await prisma.bankChangeRequest.findFirst({
      where: {
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestedByAdminId: true,
        requestedByAdminName: true,
        requestedByAdminEmail: true,
        proposedBankName: true,
        proposedAccountTitle: true,
        proposedIban: true,
        proposedRaastId: true,
        proposedSupportContact: true,
        status: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    res.status(200).json({
      activeBank: config,
      pendingRequest: pendingRequest || null,
    });
  } catch (error) {
    console.error("[BankSettings] Get bank settings error:", error.message);
    res.status(500).json({ error: "Failed to load bank settings." });
  }
};

/**
 * 2. POST /api/admin/bank-settings/request-change
 * An administrator proposes new bank details.
 * Requires calling admin's secret code.
 * Generates Root Secret Code and emails it to the Root Admin.
 */
export const requestBankChange = async (req, res) => {
  try {
    const adminId = req.adminAuth?.id;
    const {
      proposedBankName,
      proposedAccountTitle,
      proposedIban,
      proposedRaastId,
      proposedSupportContact,
      adminSecretCode,
    } = req.body;

    if (!proposedBankName?.trim() || !proposedAccountTitle?.trim() || !proposedIban?.trim()) {
      return res.status(400).json({
        error: "Bank Name, Account Title, and IBAN are required fields.",
      });
    }

    const cleanSecret = String(adminSecretCode || "").trim().toUpperCase();
    if (!cleanSecret) {
      return res.status(400).json({ error: "Admin Secret Code is required." });
    }

    // 1. Verify calling admin's secret code
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true, secretHash: true, isFrozen: true },
    });

    if (!admin || admin.isFrozen || !admin.secretHash) {
      return res.status(403).json({ error: "Admin authentication failure or account frozen." });
    }

    const isSecretValid = await bcrypt.compare(cleanSecret, admin.secretHash);
    if (!isSecretValid) {
      return res.status(403).json({ error: "Invalid Admin Secret Code." });
    }

    // 2. Check if an active pending request already exists
    const existingPending = await prisma.bankChangeRequest.findFirst({
      where: {
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      return res.status(409).json({
        error: "A bank change request is already pending approval by the Root Owner.",
        existingRequestId: existingPending.id,
      });
    }

    // 3. Generate high-entropy 8-character Root Authorization Code
    const rawSecretCode = "BANK-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const secretCodeHash = await bcrypt.hash(rawSecretCode, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const newRequest = await prisma.bankChangeRequest.create({
      data: {
        requestedByAdminId: admin.id,
        requestedByAdminName: admin.name,
        requestedByAdminEmail: admin.email,
        proposedBankName: proposedBankName.trim(),
        proposedAccountTitle: proposedAccountTitle.trim(),
        proposedIban: proposedIban.trim().replace(/\s+/g, "").toUpperCase(),
        proposedRaastId: proposedRaastId?.trim() || null,
        proposedSupportContact: proposedSupportContact?.trim() || null,
        secretCodeHash,
        status: "PENDING",
        expiresAt,
      },
    });

    // 4. Send high-priority email to Root Owner with the authorization secret code
    await sendBankChangeAuthorizationEmail({
      to: MAIN_ADMIN_EMAIL,
      adminName: admin.name,
      adminEmail: admin.email,
      proposedBankName: newRequest.proposedBankName,
      proposedAccountTitle: newRequest.proposedAccountTitle,
      proposedIban: newRequest.proposedIban,
      proposedRaastId: newRequest.proposedRaastId,
      proposedSupportContact: newRequest.proposedSupportContact,
      secretCode: rawSecretCode,
      expiresAt,
    }).catch((err) => console.error("[BankSettings] Auth email send failed:", err.message));

    res.status(201).json({
      message:
        "Bank change request submitted successfully. A root authorization code has been dispatched to the Root Owner's registered email.",
      requestId: newRequest.id,
      expiresAt,
    });
  } catch (error) {
    console.error("[BankSettings] Request change error:", error.message);
    res.status(500).json({ error: "Failed to submit bank change request." });
  }
};

/**
 * 3. POST /api/admin/bank-settings/approve-change
 * Finalizes the bank change using the Root Secret Code received via email.
 */
export const approveBankChange = async (req, res) => {
  try {
    const adminEmail = req.adminAuth?.email;
    const { requestId, rootSecretCode } = req.body;

    if (!requestId || !rootSecretCode?.trim()) {
      return res.status(400).json({
        error: "Request ID and Root Authorization Secret Code are required.",
      });
    }

    const changeRequest = await prisma.bankChangeRequest.findUnique({
      where: { id: requestId },
    });

    if (!changeRequest) {
      return res.status(404).json({ error: "Bank change request not found." });
    }

    if (changeRequest.status !== "PENDING") {
      return res.status(400).json({
        error: `This request has already been ${changeRequest.status.toLowerCase()}.`,
      });
    }

    if (new Date() > new Date(changeRequest.expiresAt)) {
      await prisma.bankChangeRequest.update({
        where: { id: requestId },
        data: { status: "EXPIRED" },
      });
      return res.status(400).json({
        error: "This authorization code has expired. Please submit a new change request.",
      });
    }

    // Verify secret code against hash
    const cleanCode = String(rootSecretCode).trim().toUpperCase();
    const isCodeValid = await bcrypt.compare(cleanCode, changeRequest.secretCodeHash);

    if (!isCodeValid) {
      return res.status(403).json({
        error: "Invalid Root Authorization Secret Code. Please verify the code from the email.",
      });
    }

    // 1. Update PlatformConfig with approved bank details
    await prisma.platformConfig.update({
      where: { id: 1 },
      data: {
        bankName: changeRequest.proposedBankName,
        accountTitle: changeRequest.proposedAccountTitle,
        iban: changeRequest.proposedIban,
        raastId: changeRequest.proposedRaastId,
        supportContact: changeRequest.proposedSupportContact,
      },
    });

    // 2. Mark request as APPROVED
    await prisma.bankChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolvedByAdminEmail: adminEmail || MAIN_ADMIN_EMAIL,
      },
    });

    // 3. Invalidate memory cache so all subsequent requests get fresh details
    invalidatePaymentConfigCache();

    // 4. Send confirmation alert email
    await sendBankChangeAppliedEmail({
      to: MAIN_ADMIN_EMAIL,
      resolvedByEmail: adminEmail || MAIN_ADMIN_EMAIL,
      newBankName: changeRequest.proposedBankName,
      newAccountTitle: changeRequest.proposedAccountTitle,
      newIban: changeRequest.proposedIban,
    }).catch((err) => console.error("[BankSettings] Confirmation email failed:", err.message));

    const updatedConfig = await getDynamicPaymentConfig();

    res.status(200).json({
      message: "✅ Bank account and IBAN details successfully updated across the entire platform.",
      activeBank: updatedConfig,
    });
  } catch (error) {
    console.error("[BankSettings] Approve change error:", error.message);
    res.status(500).json({ error: "Failed to approve bank change request." });
  }
};

/**
 * 4. POST /api/admin/bank-settings/cancel-change
 * Cancels a pending bank change request.
 */
export const cancelBankChange = async (req, res) => {
  try {
    const { requestId, adminSecretCode } = req.body;
    const adminId = req.adminAuth?.id;

    if (!requestId) {
      return res.status(400).json({ error: "Request ID is required." });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { secretHash: true, isFrozen: true },
    });

    if (!admin || admin.isFrozen || !admin.secretHash) {
      return res.status(403).json({ error: "Admin authentication failure." });
    }

    const cleanSecret = String(adminSecretCode || "").trim().toUpperCase();
    const isSecretValid = await bcrypt.compare(cleanSecret, admin.secretHash);
    if (!isSecretValid) {
      return res.status(403).json({ error: "Invalid Admin Secret Code." });
    }

    await prisma.bankChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
        resolvedAt: new Date(),
        resolvedByAdminEmail: req.adminAuth?.email,
      },
    });

    res.status(200).json({ message: "Bank change request has been cancelled." });
  } catch (error) {
    console.error("[BankSettings] Cancel change error:", error.message);
    res.status(500).json({ error: "Failed to cancel change request." });
  }
};

/**
 * 5. POST /api/admin/bank-settings/cancel-all
 * Cancels ALL pending bank change requests at once (Root Owner or any admin with secret code).
 */
export const cancelAllPendingBankRequests = async (req, res) => {
  try {
    const { adminSecretCode } = req.body;
    const adminId = req.adminAuth?.id;

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { secretHash: true, isFrozen: true, email: true },
    });

    if (!admin || admin.isFrozen || !admin.secretHash) {
      return res.status(403).json({ error: "Admin authentication failure." });
    }

    const cleanSecret = String(adminSecretCode || "").trim().toUpperCase();
    const isSecretValid = await bcrypt.compare(cleanSecret, admin.secretHash);
    if (!isSecretValid) {
      return res.status(403).json({ error: "Invalid Admin Secret Code." });
    }

    const result = await prisma.bankChangeRequest.updateMany({
      where: { status: "PENDING" },
      data: {
        status: "CANCELLED",
        resolvedAt: new Date(),
        resolvedByAdminEmail: admin.email,
      },
    });

    res.status(200).json({
      message: `All pending bank change requests cancelled. (${result.count} request(s) cleared)`,
      cancelledCount: result.count,
    });
  } catch (error) {
    console.error("[BankSettings] Cancel all error:", error.message);
    res.status(500).json({ error: "Failed to cancel pending requests." });
  }
};
