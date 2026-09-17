import bcrypt from "bcrypt";
import prisma from "../db.js";
import {
  sendPaymentVerifiedEmail,
  sendPaymentRejectedEmail,
} from "../services/emailService.js";

/**
 * BLOCK 6 — Admin Payments & Access Control Controller
 *
 * All routes require requireAdminAuth (sets req.adminAuth).
 * Verify/Reject require admin secret code for safety.
 */

// ─── Helper: verify admin secret ─────────────────────────────────────────────
const verifyAdminSecret = async (adminId, secretCode) => {
  if (!secretCode || String(secretCode).trim().length < 4) return false;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { secretHash: true, isFrozen: true },
  });
  if (!admin || admin.isFrozen || !admin.secretHash) return false;
  return bcrypt.compare(String(secretCode).trim().toUpperCase(), admin.secretHash);
};

// ─── 1. GET /api/admin/payments ───────────────────────────────────────────────
/**
 * List all payment orders with optional filters.
 * Query params: status, packageCode, search (name/email), page, limit
 */
export const listPaymentOrders = async (req, res) => {
  try {
    const { status, packageCode, search, page = 1, limit = 30 } = req.query;

    const where = {};

    if (status) {
      const validStatuses = [
        "DRAFT", "PENDING_PAYMENT", "RECEIPT_SUBMITTED",
        "UNDER_REVIEW", "VERIFIED", "REJECTED", "EXPIRED", "CANCELLED",
      ];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ error: `Invalid status filter: ${status}` });
      }
      where.status = status.toUpperCase();
    }

    if (packageCode) {
      where.packageCode = packageCode.toUpperCase();
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.paymentOrder.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, cnic: true, packageType: true },
          },
          package: { select: { name: true, code: true, price: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.paymentOrder.count({ where }),
    ]);

    res.status(200).json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[AdminPayments] listPaymentOrders error:", error.message);
    res.status(500).json({ error: "Failed to load payment orders." });
  }
};

// ─── 2. GET /api/admin/payments/pending-count ─────────────────────────────────
/**
 * Returns counts for admin notification bell:
 * - receiptsAwaitingReview: RECEIPT_SUBMITTED + UNDER_REVIEW
 * - pendingChallans: PENDING_PAYMENT (student hasn't paid yet)
 */
export const getPaymentPendingCounts = async (req, res) => {
  try {
    const [awaitingReview, pendingPayment] = await Promise.all([
      prisma.paymentOrder.count({
        where: { status: { in: ["RECEIPT_SUBMITTED", "UNDER_REVIEW"] } },
      }),
      prisma.paymentOrder.count({ where: { status: "PENDING_PAYMENT" } }),
    ]);

    res.status(200).json({ awaitingReview, pendingPayment });
  } catch (error) {
    console.error("[AdminPayments] getPaymentPendingCounts error:", error.message);
    res.status(500).json({ error: "Failed to load payment counts." });
  }
};

// ─── 3. GET /api/admin/payments/:orderId ──────────────────────────────────────
/**
 * Single order detail with full immutable audit trail.
 */
export const getPaymentOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, cnic: true,
            packageType: true, packageExpiresAt: true, remainingTestAttempts: true,
          },
        },
        package: true,
        audits: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("[AdminPayments] getPaymentOrderDetail error:", error.message);
    res.status(500).json({ error: "Failed to load order detail." });
  }
};

// ─── 4. POST /api/admin/payments/:orderId/mark-under-review ──────────────────
/**
 * Move order from RECEIPT_SUBMITTED → UNDER_REVIEW.
 * Signals to student that admin has started reviewing.
 */
export const markUnderReview = async (req, res) => {
  try {
    const { orderId } = req.params;
    const adminId = req.adminAuth.id;
    const adminEmail = req.adminAuth.email;

    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, referenceCode: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    if (order.status !== "RECEIPT_SUBMITTED") {
      return res.status(400).json({
        error: `Order must be in RECEIPT_SUBMITTED status to mark under review. Current: ${order.status}`,
      });
    }

    const updated = await prisma.paymentOrder.update({
      where: { id: orderId },
      data: {
        status: "UNDER_REVIEW",
        audits: {
          create: {
            action: "MARKED_UNDER_REVIEW",
            oldStatus: "RECEIPT_SUBMITTED",
            newStatus: "UNDER_REVIEW",
            adminId,
            adminName: adminEmail,
            note: "Admin started reviewing this payment.",
          },
        },
      },
    });

    console.log(`[AdminPayments] ${order.referenceCode} marked UNDER_REVIEW by ${adminEmail}`);
    res.status(200).json({ message: "Order marked as Under Review.", order: updated });
  } catch (error) {
    console.error("[AdminPayments] markUnderReview error:", error.message);
    res.status(500).json({ error: "Failed to update order status." });
  }
};

// ─── 5. POST /api/admin/payments/:orderId/verify ──────────────────────────────
/**
 * VERIFY payment — activates the student's package.
 * HIGH SECURITY: requires admin secret code.
 *
 * Business logic:
 *  - Calculates packageExpiresAt = now + pkg.validityDays
 *  - Sets remainingTestAttempts = pkg.testAttempts
 *  - Sets packageType, packageStartedAt, packageExpiresAt on User
 *  - For PROFILE_CHANGE orders: does NOT set package — that's handled in Block 7
 *  - Sends success email to student
 *  - Records immutable audit with admin name
 */
export const verifyPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { secretCode, note } = req.body;
    const adminId = req.adminAuth.id;
    const adminEmail = req.adminAuth.email;

    // Admin secret check
    const isValid = await verifyAdminSecret(adminId, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    // Fetch order with all needed data
    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true, name: true, email: true,
            packageExpiresAt: true, remainingTestAttempts: true,
          },
        },
        package: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    // Must be in a reviewable state
    const reviewableStatuses = ["RECEIPT_SUBMITTED", "UNDER_REVIEW"];
    if (!reviewableStatuses.includes(order.status)) {
      return res.status(400).json({
        error: `Order cannot be verified from status '${order.status}'. Must be RECEIPT_SUBMITTED or UNDER_REVIEW.`,
      });
    }

    const now = new Date();
    let packageUpdateData = {};
    let expiresAt = null;
    let attempts = 0;

    // ── Package Activation Logic ────────────────────────────────────────────
    if (order.purpose === "PACKAGE_PURCHASE") {
      const pkg = order.package;
      if (!pkg) {
        return res.status(400).json({ error: "Package data missing on this order." });
      }

      const validityMs = (pkg.validityDays || 0) * 24 * 60 * 60 * 1000;
      expiresAt = new Date(now.getTime() + validityMs);
      attempts = pkg.testAttempts || 0;

      packageUpdateData = {
        packageType: pkg.code,
        packageStartedAt: now,
        packageExpiresAt: expiresAt,
        remainingTestAttempts: attempts,
      };

      // STARTER special: mark starterClaimedAt if not already set
      if (pkg.code === "STARTER" && !order.user.starterClaimedAt) {
        packageUpdateData.starterClaimedAt = now;
      }
    }
    // PROFILE_CHANGE purpose — package not changed here (Block 7 handles that)

    // ── DB Transaction ──────────────────────────────────────────────────────
    const [updatedOrder] = await prisma.$transaction([
      // 1. Update order status to VERIFIED
      prisma.paymentOrder.update({
        where: { id: orderId },
        data: {
          status: "VERIFIED",
          verifiedAt: now,
          verifiedByAdminId: adminId,
          verifiedByName: adminEmail,
        },
      }),
      // 2. Activate package on user (if PACKAGE_PURCHASE)
      ...(Object.keys(packageUpdateData).length > 0
        ? [prisma.user.update({ where: { id: order.userId }, data: packageUpdateData })]
        : []),
      // 3. Immutable audit record
      prisma.paymentAudit.create({
        data: {
          paymentOrder: { connect: { id: orderId } },
          action: "VERIFIED",
          oldStatus: order.status,
          newStatus: "VERIFIED",
          adminId,
          adminName: adminEmail,
          note: note || "Payment verified and package activated.",
        },
      }),
    ]);

    // ── Email notification (async, non-blocking) ────────────────────────────
    sendPaymentVerifiedEmail({
      to: order.user.email,
      name: order.user.name,
      order: updatedOrder,
      packageDetails: order.package,
      expiresAt,
      attempts,
    }).catch((e) => console.error("[AdminPayments] Verify email error:", e.message));

    console.log(
      `[AdminPayments] ✅ ${order.referenceCode} VERIFIED by ${adminEmail}. Student: ${order.user.email}`
    );

    res.status(200).json({
      message: `Payment verified. ${order.purpose === "PACKAGE_PURCHASE" ? "Student package activated." : "Profile change payment confirmed."}`,
      order: updatedOrder,
      packageActivated: order.purpose === "PACKAGE_PURCHASE",
      expiresAt,
      remainingTestAttempts: attempts,
    });
  } catch (error) {
    console.error("[AdminPayments] verifyPaymentOrder error:", error.message);
    res.status(500).json({ error: "Failed to verify payment order." });
  }
};

// ─── 6. POST /api/admin/payments/:orderId/reject ──────────────────────────────
/**
 * REJECT payment — mandatory reason required.
 * HIGH SECURITY: requires admin secret code.
 * Sends rejection email to student with reason.
 */
export const rejectPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { secretCode, reason } = req.body;
    const adminId = req.adminAuth.id;
    const adminEmail = req.adminAuth.email;

    if (!reason || String(reason).trim().length < 10) {
      return res.status(400).json({
        error: "A rejection reason (at least 10 characters) is mandatory.",
      });
    }

    const isValid = await verifyAdminSecret(adminId, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    const rejectableStatuses = ["RECEIPT_SUBMITTED", "UNDER_REVIEW"];
    if (!rejectableStatuses.includes(order.status)) {
      return res.status(400).json({
        error: `Order cannot be rejected from status '${order.status}'.`,
      });
    }

    const cleanReason = String(reason).trim();
    const now = new Date();

    const [updatedOrder] = await prisma.$transaction([
      prisma.paymentOrder.update({
        where: { id: orderId },
        data: {
          status: "REJECTED",
          rejectionReason: cleanReason,
          verifiedByAdminId: adminId,
          verifiedByName: adminEmail,
        },
      }),
      prisma.paymentAudit.create({
        data: {
          paymentOrder: { connect: { id: orderId } },
          action: "REJECTED",
          oldStatus: order.status,
          newStatus: "REJECTED",
          adminId,
          adminName: adminEmail,
          note: cleanReason,
        },
      }),
    ]);

    // Send rejection email to student (async)
    sendPaymentRejectedEmail({
      to: order.user.email,
      name: order.user.name,
      order: updatedOrder,
      reason: cleanReason,
    }).catch((e) => console.error("[AdminPayments] Reject email error:", e.message));

    console.log(
      `[AdminPayments] ❌ ${order.referenceCode} REJECTED by ${adminEmail}. Reason: ${cleanReason}`
    );

    res.status(200).json({
      message: "Payment rejected. Student has been notified via email.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("[AdminPayments] rejectPaymentOrder error:", error.message);
    res.status(500).json({ error: "Failed to reject payment order." });
  }
};

// ─── 7. PATCH /api/admin/students/:userId/package ─────────────────────────────
/**
 * Manual package grant/revoke for support cases (without payment).
 * HIGH SECURITY: requires admin secret code.
 *
 * Use cases:
 *  - Grant free/demo access to a student
 *  - Extend a student's package manually
 *  - Revoke access (set expiresAt to past)
 *  - Top up test attempts
 */
export const manualPackageGrant = async (req, res) => {
  try {
    const { userId } = req.params;
    const { secretCode, packageCode, validityDays, testAttempts, note } = req.body;
    const adminId = req.adminAuth.id;
    const adminEmail = req.adminAuth.email;

    const isValid = await verifyAdminSecret(adminId, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, packageType: true, packageExpiresAt: true, remainingTestAttempts: true },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    // Resolve package details from catalog (if code provided)
    let pkg = null;
    if (packageCode) {
      pkg = await prisma.package.findUnique({
        where: { code: packageCode.toUpperCase() },
      });
      if (!pkg) {
        return res.status(404).json({ error: `Package '${packageCode}' not found in catalog.` });
      }
    }

    const now = new Date();
    const days = validityDays !== undefined ? parseInt(validityDays, 10) : (pkg?.validityDays ?? 30);
    const attempts = testAttempts !== undefined ? parseInt(testAttempts, 10) : (pkg?.testAttempts ?? 10);

    if (isNaN(days) || days < 0) {
      return res.status(400).json({ error: "validityDays must be a non-negative integer." });
    }
    if (isNaN(attempts) || attempts < 0) {
      return res.status(400).json({ error: "testAttempts must be a non-negative integer." });
    }

    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const resolvedPackageCode = (packageCode || pkg?.code || "STANDARD").toUpperCase();

    // Update student
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        packageType: resolvedPackageCode,
        packageStartedAt: now,
        packageExpiresAt: expiresAt,
        remainingTestAttempts: attempts,
      },
      select: { id: true, name: true, email: true, packageType: true, packageExpiresAt: true, remainingTestAttempts: true },
    });

    // Create a VERIFIED audit-trail order for record keeping (zero amount)
    const referenceCode = `ENT-MANUAL-${Date.now().toString().slice(-8)}`;
    await prisma.paymentOrder.create({
      data: {
        referenceCode,
        userId,
        purpose: "PACKAGE_PURCHASE",
        packageCode: resolvedPackageCode,
        packageId: pkg?.id,
        expectedAmount: 0,
        currency: "PKR",
        status: "VERIFIED",
        issuedAt: now,
        expiresAt: now,
        verifiedAt: now,
        verifiedByAdminId: adminId,
        verifiedByName: adminEmail,
        metadata: {
          manualGrant: true,
          grantedBy: adminEmail,
          reason: note || "Manual admin package grant",
          validityDays: days,
          testAttempts: attempts,
        },
        audits: {
          create: {
            action: "MANUAL_GRANT",
            newStatus: "VERIFIED",
            adminId,
            adminName: adminEmail,
            note: note || `Manual package grant: ${resolvedPackageCode} for ${days} days, ${attempts} attempts`,
          },
        },
      },
    });

    console.log(
      `[AdminPayments] 🎁 Manual package grant: ${resolvedPackageCode} to ${student.email} by ${adminEmail}`
    );

    res.status(200).json({
      message: `Package '${resolvedPackageCode}' manually granted to ${student.name} for ${days} days with ${attempts} attempts.`,
      student: updatedUser,
      expiresAt,
    });
  } catch (error) {
    console.error("[AdminPayments] manualPackageGrant error:", error.message);
    res.status(500).json({ error: "Failed to apply manual package grant." });
  }
};

// ─── 8. POST /api/admin/payments/discard ──────────────────────────────────────
/**
 * Discard / Delete one or more payment challans.
 * Supports:
 *  - Single order (orderId)
 *  - Multiple selected orders (orderIds array)
 *  - All unverified challans for a student (userId)
 *  - All pending challans across all students (allPending: true)
 *
 * Optionally sends a customizable notification message to each affected student via Message Center (LoginMessage).
 * HIGH SECURITY: requires admin secret code.
 */
export const discardPaymentOrders = async (req, res) => {
  try {
    const {
      orderId,
      orderIds,
      userId,
      allPending,
      secretCode,
      sendMessage = true,
      messageBody,
    } = req.body;
    const adminId = req.adminAuth.id;
    const adminEmail = req.adminAuth.email;

    // Verify admin secret code
    const isValid = await verifyAdminSecret(adminId, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    // Determine target orders
    const where = {};
    if (orderId) {
      where.id = orderId;
    } else if (Array.isArray(orderIds) && orderIds.length > 0) {
      where.id = { in: orderIds };
    } else if (userId) {
      where.userId = userId;
      where.status = { in: ["PENDING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "DRAFT", "EXPIRED", "REJECTED"] };
    } else if (allPending) {
      where.status = "PENDING_PAYMENT";
    } else {
      return res.status(400).json({ error: "No target challans specified for discard." });
    }

    // Fetch target orders with student details
    const targetOrders = await prisma.paymentOrder.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (targetOrders.length === 0) {
      return res.status(404).json({ error: "No matching payment challans found to discard." });
    }

    // Collect unique students affected
    const studentsMap = new Map();
    for (const order of targetOrders) {
      if (order.user && !studentsMap.has(order.user.id)) {
        studentsMap.set(order.user.id, order.user);
      }
    }

    // Send notifications if requested
    let notifiedCount = 0;
    if (sendMessage && studentsMap.size > 0) {
      const defaultTemplate =
        "Dear {student_name} (ID: {student_id}), this is to inform you that our payment receiving credentials have been updated. Kindly generate a new challan for your request as we are discarding your previous challan.";
      const rawTemplate = (messageBody && String(messageBody).trim()) || defaultTemplate;

      for (const [sId, student] of studentsMap.entries()) {
        const shortId = student.id.slice(0, 8).toUpperCase();
        const personalizedBody = rawTemplate
          .replace(/\{student_name\}/gi, student.name || "Student")
          .replace(/\{student_id\}/gi, shortId)
          .replace(/\{student_email\}/gi, student.email);

        try {
          await prisma.loginMessage.create({
            data: {
              recipientEmail: student.email,
              recipientRole: "student",
              body: personalizedBody,
              senderEmail: adminEmail,
              showSenderEmail: true,
            },
          });
          notifiedCount++;
        } catch (msgErr) {
          console.error(
            `[AdminPayments] Failed to create discard notification for ${student.email}:`,
            msgErr.message
          );
        }
      }
    }

    // Delete the target orders (cascades audits and unlinks profileChangeRequests)
    const targetIds = targetOrders.map((o) => o.id);
    const deleteResult = await prisma.paymentOrder.deleteMany({
      where: { id: { in: targetIds } },
    });

    console.log(
      `[AdminPayments] 🗑️ Discarded ${deleteResult.count} challan(s) by ${adminEmail}. Notified ${notifiedCount} student(s).`
    );

    res.status(200).json({
      message: `Successfully discarded ${deleteResult.count} challan(s). ${
        sendMessage ? `Notified ${notifiedCount} student(s) via Message Center.` : ""
      }`,
      deletedCount: deleteResult.count,
      notifiedCount,
    });
  } catch (error) {
    console.error("[AdminPayments] discardPaymentOrders error:", error.message);
    res.status(500).json({ error: "Failed to discard payment challans." });
  }
};

