import bcrypt from "bcrypt";
import prisma from "../db.js";
import { generateReferenceCode } from "../utils/referenceGenerator.js";
import {
  sendProfileChangePaymentVerifiedEmail,
  sendProfileChangeAppliedEmail,
} from "../services/emailService.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const TRACKS = new Set(["Pre-Engineering", "Pre-Medical", "ICS", "ICom", "FA", "Other / Gap-year"]);
const ALLOWED_SUBJECTS = {
  "Pre-Engineering": new Set(["math", "physics", "chemistry", "english"]),
  "Pre-Medical": new Set(["biology", "physics", "chemistry", "english"]),
  ICS: new Set(["computer", "math", "physics", "english"]),
  ICom: new Set(["math", "english"]),
  FA: new Set(["english"]),
  "Other / Gap-year": new Set(["math", "physics", "chemistry", "biology", "english", "computer"]),
};

const validSubjects = (track, items) =>
  Array.isArray(items) &&
  items.length > 0 &&
  items.length <= 5 &&
  items.every((item) => ALLOWED_SUBJECTS[track]?.has(item));

const PROFILE_CHANGE_PRICE = 299; // PKR — must match PROFILE_CHANGE package

// ─── 1. POST /api/user/profile-change-requests ────────────────────────────────
/**
 * Create a profile change request.
 * Payment Flow:
 *  - If student has no verified PROFILE_CHANGE payment → generate challan automatically
 *    and return it for student to pay before submitting.
 *  - If student has an active verified PROFILE_CHANGE payment (not yet used) → allow submission.
 *  - If student already has a pending/submitted change request → block duplicates.
 */
export const createProfileChangeRequest = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { requestedTrack, requestedSubjects, reason } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!TRACKS.has(requestedTrack)) {
      return res.status(400).json({ error: "Invalid academic track selected." });
    }
    if (!validSubjects(requestedTrack, requestedSubjects)) {
      return res.status(400).json({
        error: "Invalid subjects for the selected track. Please select valid subjects.",
      });
    }
    if (!String(reason || "").trim()) {
      return res.status(400).json({ error: "A reason for the profile change is required." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { academicTrack: true, academicSubjects: true, name: true, email: true, cnic: true },
    });

    if (!user?.academicTrack) {
      return res.status(400).json({
        error: "Please set up your academic profile first before requesting a change.",
      });
    }

    // ── Block duplicate pending requests ──────────────────────────────────────
    const existingPending = await prisma.profileChangeRequest.findFirst({
      where: {
        userId,
        status: {
          in: [
            "Pending payment verification",
            "Payment verified",
            "Pending",
            "Under review",
          ],
        },
      },
    });

    if (existingPending) {
      return res.status(409).json({
        error: "You already have a pending profile change request. Please wait for it to be reviewed.",
        existingRequestId: existingPending.id,
        existingStatus: existingPending.status,
      });
    }

    // ── Check for a verified unused PROFILE_CHANGE payment order ─────────────
    const verifiedPayment = await prisma.paymentOrder.findFirst({
      where: {
        userId,
        purpose: "PROFILE_CHANGE",
        status: "VERIFIED",
        // Not already linked to a profile change request
        profileChangeRequest: null,
      },
      orderBy: { verifiedAt: "desc" },
    });

    const now = new Date();

    if (verifiedPayment) {
      // ── Payment already done → create the request immediately ────────────
      const profilePkg = await prisma.package.findUnique({
        where: { code: "PROFILE_CHANGE" },
      });

      const request = await prisma.profileChangeRequest.create({
        data: {
          userId,
          currentTrack: user.academicTrack,
          currentSubjects: user.academicSubjects || [],
          requestedTrack,
          requestedSubjects: [...new Set(requestedSubjects)],
          reason: reason.trim(),
          status: "Payment verified",
          paymentOrderId: verifiedPayment.id,
          audits: {
            create: {
              action: "SUBMITTED",
              note: `Profile change request submitted. Payment ref: ${verifiedPayment.referenceCode}`,
              adminName: "SYSTEM",
            },
          },
        },
      });

      // Notify student via email
      sendProfileChangePaymentVerifiedEmail({
        to: user.email,
        name: user.name,
        order: verifiedPayment,
      }).catch((e) => console.error("[ProfileChange] Email error:", e.message));

      return res.status(201).json({
        message: "Profile change request submitted successfully. Our team will review it shortly.",
        request,
        paymentRequired: false,
      });
    }

    // ── No verified payment → generate a challan for PKR 299 ─────────────────
    const profilePkg = await prisma.package.findUnique({
      where: { code: "PROFILE_CHANGE" },
    });

    // Check if there's already an active pending challan for this purpose
    const existingChallan = await prisma.paymentOrder.findFirst({
      where: {
        userId,
        purpose: "PROFILE_CHANGE",
        status: { in: ["PENDING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] },
      },
    });

    if (existingChallan) {
      // Check if expired
      if (new Date(existingChallan.expiresAt) < now && existingChallan.status === "PENDING_PAYMENT") {
        await prisma.paymentOrder.update({
          where: { id: existingChallan.id },
          data: { status: "EXPIRED" },
        });
      } else {
        return res.status(200).json({
          message: "You have a pending payment for the profile change fee. Please complete the payment first.",
          paymentRequired: true,
          challan: existingChallan,
        });
      }
    }

    // Generate new challan
    const referenceCode = await generateReferenceCode();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const challan = await prisma.paymentOrder.create({
      data: {
        referenceCode,
        userId,
        purpose: "PROFILE_CHANGE",
        packageCode: "PROFILE_CHANGE",
        packageId: profilePkg?.id,
        expectedAmount: PROFILE_CHANGE_PRICE,
        currency: "PKR",
        status: "PENDING_PAYMENT",
        issuedAt: now,
        expiresAt,
        metadata: {
          requestedTrack,
          requestedSubjects: [...new Set(requestedSubjects)],
          reason: reason.trim(),
          studentName: user.name,
          studentEmail: user.email,
          cnic: user.cnic,
        },
        audits: {
          create: {
            action: "CHALLAN_GENERATED",
            newStatus: "PENDING_PAYMENT",
            note: `Profile change challan for ${requestedTrack}`,
          },
        },
      },
    });

    return res.status(200).json({
      message: `A payment challan of PKR ${PROFILE_CHANGE_PRICE} has been generated for the profile change fee. Please complete payment and submit your receipt.`,
      paymentRequired: true,
      challan,
      requestedDetails: {
        requestedTrack,
        requestedSubjects: [...new Set(requestedSubjects)],
        reason: reason.trim(),
      },
    });
  } catch (error) {
    console.error("[ProfileChange] createProfileChangeRequest error:", error.message);
    res.status(500).json({ error: "Unable to process your profile change request." });
  }
};

// ─── 1b. GET /api/user/profile-change-challan ─────────────────────────────────
/**
 * Returns an existing active PROFILE_CHANGE challan or creates a new one.
 * Lets the student download the real PDF challan before filling the full form.
 */
export const getOrCreateProfileChangeChallan = async (req, res) => {
  try {
    const userId = req.auth.id;
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, cnic: true, academicTrack: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Return an existing non-expired pending challan if available
    const existing = await prisma.paymentOrder.findFirst({
      where: {
        userId,
        purpose: "PROFILE_CHANGE",
        status: { in: ["PENDING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] },
        expiresAt: { gt: now },
      },
      orderBy: { issuedAt: "desc" },
    });

    if (existing) {
      return res.status(200).json({ challan: existing });
    }

    // Expire any stale pending challans
    await prisma.paymentOrder.updateMany({
      where: {
        userId,
        purpose: "PROFILE_CHANGE",
        status: "PENDING_PAYMENT",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    // Create a fresh challan
    const profilePkg = await prisma.package.findUnique({ where: { code: "PROFILE_CHANGE" } });
    const referenceCode = await generateReferenceCode();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const challan = await prisma.paymentOrder.create({
      data: {
        referenceCode,
        userId,
        purpose: "PROFILE_CHANGE",
        packageCode: "PROFILE_CHANGE",
        packageId: profilePkg?.id,
        expectedAmount: PROFILE_CHANGE_PRICE,
        currency: "PKR",
        status: "PENDING_PAYMENT",
        issuedAt: now,
        expiresAt,
        metadata: {
          studentName: user.name,
          studentEmail: user.email,
          cnic: user.cnic,
        },
        audits: {
          create: {
            action: "CHALLAN_GENERATED",
            newStatus: "PENDING_PAYMENT",
            note: "Profile change challan generated for preview/download.",
          },
        },
      },
    });

    return res.status(201).json({ challan });
  } catch (error) {
    console.error("[ProfileChange] getOrCreateProfileChangeChallan error:", error.message);
    res.status(500).json({ error: "Unable to generate the profile change challan." });
  }
};

// ─── 2. GET /api/user/profile-change-requests ─────────────────────────────────
export const getMyProfileChangeRequests = async (req, res) => {
  try {
    const requests = await prisma.profileChangeRequest.findMany({
      where: { userId: req.auth.id },
      include: {
        audits: { orderBy: { createdAt: "desc" } },
        paymentOrder: {
          select: {
            referenceCode: true,
            status: true,
            expectedAmount: true,
            verifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (error) {
    console.error("[ProfileChange] getMyProfileChangeRequests error:", error.message);
    res.status(500).json({ error: "Failed to load profile change requests." });
  }
};

// ─── 3. GET /api/admin/profile-change-requests (admin only) ───────────────────
export const listProfileChangeRequests = async (_req, res) => {
  try {
    const requests = await prisma.profileChangeRequest.findMany({
      include: {
        user: {
          select: {
            id: true, name: true, email: true, cnic: true,
            academicTrack: true, academicSubjects: true,
          },
        },
        audits: { orderBy: { createdAt: "desc" } },
        paymentOrder: {
          select: {
            referenceCode: true,
            status: true,
            expectedAmount: true,
            transactionId: true,
            verifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (error) {
    console.error("[ProfileChange] listProfileChangeRequests error:", error.message);
    res.status(500).json({ error: "Failed to load profile change requests." });
  }
};

// ─── 4. PATCH /api/admin/profile-change-requests/:requestId (admin only) ──────
/**
 * Admin reviews a profile change request.
 * Status flow: Payment verified → Under review → Approved → Applied
 *              Payment verified → Under review → Rejected
 *
 * When Applied:
 *   - Updates user's academicTrack and academicSubjects
 *   - Sends confirmation email via centralized emailService
 *   - Creates login inbox message
 */
export const reviewProfileChangeRequest = async (req, res) => {
  try {
    const { status, adminReason, adminSecretCode } = req.body;
    const { requestId } = req.params;

    const validStatuses = ["Under review", "Approved", "Rejected", "Applied"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }
    if (status === "Rejected" && !String(adminReason || "").trim()) {
      return res.status(400).json({ error: "A rejection reason is required." });
    }

    // Verify admin secret
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminAuth.id },
      select: { id: true, name: true, email: true, secretHash: true, isFrozen: true },
    });
    if (!admin || admin.isFrozen) {
      return res.status(403).json({ error: "Administrator account not authorized." });
    }
    if (
      !adminSecretCode ||
      !(await bcrypt.compare(String(adminSecretCode).trim().toUpperCase(), admin.secretHash))
    ) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const request = await prisma.profileChangeRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });
    if (!request) {
      return res.status(404).json({ error: "Profile change request not found." });
    }
    if (request.status === "Applied") {
      return res.status(409).json({ error: "This request has already been applied and cannot be changed." });
    }
    if (status === "Applied" && request.status !== "Approved") {
      return res.status(409).json({ error: "The request must be 'Approved' before it can be Applied." });
    }

    const now = new Date();
    const updateData = {
      status,
      adminReason: adminReason?.trim() || null,
      reviewedByAdminId: admin.id,
      reviewedByName: admin.name,
      reviewedAt: now,
    };

    // ── Apply the profile change ──────────────────────────────────────────────
    if (status === "Applied") {
      // Update student's academic profile
      await prisma.user.update({
        where: { id: request.userId },
        data: {
          academicTrack: request.requestedTrack,
          academicSubjects: request.requestedSubjects,
        },
      });
      updateData.appliedAt = now;

      // Send applied email via centralized email service
      sendProfileChangeAppliedEmail({
        to: request.user.email,
        name: request.user.name,
        newTrack: request.requestedTrack,
        newSubjects: request.requestedSubjects,
      }).catch((e) => console.error("[ProfileChange] Apply email error:", e.message));

      // Create login inbox message for student
      await prisma.loginMessage.create({
        data: {
          recipientEmail: request.user.email,
          recipientRole: "User",
          body: `Your academic profile has been updated to ${request.requestedTrack}. You can now access content for your new track.`,
          senderEmail: admin.email,
        },
      });
    }

    // Update request + create audit record
    const updated = await prisma.profileChangeRequest.update({
      where: { id: request.id },
      data: updateData,
    });

    await prisma.profileChangeRequestAudit.create({
      data: {
        requestId: request.id,
        action: status,
        note: adminReason?.trim() || null,
        adminId: admin.id,
        adminName: admin.name,
      },
    });

    console.log(
      `[ProfileChange] Request ${requestId} → '${status}' by ${admin.email}`
    );

    res.json({
      message:
        status === "Applied"
          ? "Profile change applied. Student has been notified via email."
          : `Request marked as '${status}'.`,
      request: updated,
    });
  } catch (error) {
    console.error("[ProfileChange] reviewProfileChangeRequest error:", error.message);
    res.status(500).json({ error: "Unable to review this request." });
  }
};
