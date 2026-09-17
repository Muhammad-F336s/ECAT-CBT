import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import prisma from "../db.js";
import { getPublicPaymentDetails, getDynamicPaymentConfig } from "../config/paymentConfig.js";
import { generateReferenceCode } from "../utils/referenceGenerator.js";
import { generateChallanPdf } from "../services/pdfService.js";
import {
  sendChallanGeneratedEmail,
  sendReceiptSubmittedEmail,
  sendPaymentVerifiedEmail,
} from "../services/emailService.js";

/**
 * 1. GET /api/payment/packages
 * Returns public active packages catalog and whether student claimed Starter.
 */
export const getPackages = async (req, res) => {
  try {
    const userId = req.auth?.id;
    let hasClaimedStarter = false;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { starterClaimedAt: true, packageType: true, packageExpiresAt: true, remainingTestAttempts: true },
      });
      hasClaimedStarter = !!user?.starterClaimedAt;
    }

    const packages = await prisma.package.findMany({
      where: {
        isActive: true,
        code: { not: "PROFILE_CHANGE" },
      },
      orderBy: { displayOrder: "asc" },
    });

    res.status(200).json({
      packages,
      hasClaimedStarter,
    });
  } catch (error) {
    console.error("[Payment] Get packages error:", error.message);
    res.status(500).json({ error: "Failed to load package catalog." });
  }
};

/**
 * 2. GET /api/payment/bank-details
 * Returns safe public payment instructions (Meezan Bank, IBAN, Raast ID, etc.).
 */
export const getBankDetails = async (req, res) => {
  try {
    const details = await getPublicPaymentDetails();
    let qrCode = null;
    try {
      const cleanIban = (details.iban || "").replace(/\s+/g, "");
      // QR encodes plain Raast ID (universally accepted by NayaPay, JazzCash, SadaPay etc.)
      // Fallback: plain IBAN for manual entry apps
      const qrData = details.raastId
        ? details.raastId.trim()
        : cleanIban;
      qrCode = await QRCode.toDataURL(qrData, {
        width: 320,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    } catch (qrErr) {
      console.warn("[Payment] QR generation warning:", qrErr.message);
    }
    res.status(200).json({ ...details, qrCode });
  } catch (error) {
    console.error("[Payment] Get bank details error:", error.message);
    res.status(500).json({ error: "Failed to load bank transfer details." });
  }
};

/**
 * 3. POST /api/payment/generate-challan
 * Creates a payment order with fixed server-side pricing and generates challan reference.
 */
export const generateChallan = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { packageCode, purpose = "PACKAGE_PURCHASE" } = req.body;

    if (!packageCode) {
      return res.status(400).json({ error: "packageCode is required." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, cnic: true, starterClaimedAt: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Student not found." });
    }

    const normalizedCode = String(packageCode).trim().toUpperCase();

    // -------------------------------------------------------------
    // RULE 1: STARTER TRIAL PACKAGE (PKR 0, One-time lifetime per student)
    // -------------------------------------------------------------
    if (normalizedCode === "STARTER") {
      if (user.starterClaimedAt) {
        return res.status(400).json({
          error: "The Starter trial package can only be claimed once per student account for its entire lifetime.",
        });
      }

      const starterPkg = await prisma.package.findUnique({
        where: { code: "STARTER" },
      });

      const validityDays = starterPkg?.validityDays || 5;
      const testAttempts = starterPkg?.testAttempts || 2;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
      const referenceCode = await generateReferenceCode();

      // Activate immediately on user
      await prisma.user.update({
        where: { id: userId },
        data: {
          packageType: "STARTER",
          packageStartedAt: now,
          packageExpiresAt: expiresAt,
          remainingTestAttempts: testAttempts,
          starterClaimedAt: now,
        },
      });

      // Record verified 0 PKR payment order for permanent audit trail
      const order = await prisma.paymentOrder.create({
        data: {
          referenceCode,
          userId,
          purpose: "PACKAGE_PURCHASE",
          packageCode: "STARTER",
          packageId: starterPkg?.id,
          expectedAmount: 0,
          currency: "PKR",
          status: "VERIFIED",
          issuedAt: now,
          expiresAt: now,
          submittedAt: now,
          verifiedAt: now,
          verifiedByName: "SYSTEM_AUTO_ACTIVATION",
          metadata: {
            packageName: starterPkg?.name || "Starter",
            price: 0,
            validityDays,
            testAttempts,
            features: starterPkg?.features || ["Basic result review", "2 Full CBT Tests", "Valid for 5 days"],
            studentName: user.name,
            studentEmail: user.email,
            cnic: user.cnic,
          },
          audits: {
            create: {
              action: "STARTER_CLAIMED",
              oldStatus: "DRAFT",
              newStatus: "VERIFIED",
              note: "Free Starter trial package activated automatically.",
              adminName: "SYSTEM",
            },
          },
        },
      });

      // Send confirmation email
      sendPaymentVerifiedEmail({
        to: user.email,
        name: user.name,
        order,
        packageDetails: starterPkg || { name: "Starter" },
        expiresAt,
        attempts: testAttempts,
      }).catch((e) => console.error("[Payment] Async email error:", e.message));

      return res.status(200).json({
        message: "Starter trial package activated successfully! You can now start practicing.",
        activated: true,
        order,
        packageType: "STARTER",
        remainingAttempts: testAttempts,
        expiresAt,
      });
    }

    // -------------------------------------------------------------
    // RULE 2: PAID PACKAGES (Basic, Standard, Premium, Profile Change)
    // -------------------------------------------------------------
    const pkg = await prisma.package.findUnique({
      where: { code: normalizedCode },
    });

    if (!pkg) {
      return res.status(404).json({ error: `Package with code '${normalizedCode}' not found.` });
    }

    if (purpose === "PACKAGE_PURCHASE" && !pkg.isActive) {
      return res.status(400).json({ error: "This package is currently not available for purchase." });
    }

    // Single active pending challan check
    const existingActive = await prisma.paymentOrder.findFirst({
      where: {
        userId,
        purpose,
        status: { in: ["PENDING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] },
      },
      include: { package: true },
    });

    const now = new Date();

    if (existingActive) {
      // Check if it has expired
      if (new Date(existingActive.expiresAt) < now) {
        // Mark as EXPIRED and record audit
        await prisma.paymentOrder.update({
          where: { id: existingActive.id },
          data: {
            status: "EXPIRED",
            audits: {
              create: {
                action: "EXPIRED",
                oldStatus: existingActive.status,
                newStatus: "EXPIRED",
                note: "Challan expired after 24 hours without payment verification.",
              },
            },
          },
        });
      } else {
        // Active challan still valid
        return res.status(200).json({
          message: "You already have an active pending challan. Please complete payment or download your existing challan.",
          order: existingActive,
          isExisting: true,
        });
      }
    }

    // Create a new PaymentOrder with server-side snapshot
    const referenceCode = await generateReferenceCode();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours validity

    const newOrder = await prisma.paymentOrder.create({
      data: {
        referenceCode,
        userId,
        purpose,
        packageCode: pkg.code,
        packageId: pkg.id,
        expectedAmount: pkg.price, // STRICT: server-controlled price only!
        currency: "PKR",
        status: "PENDING_PAYMENT",
        issuedAt: now,
        expiresAt,
        metadata: {
          packageName: pkg.name,
          price: pkg.price,
          validityDays: pkg.validityDays,
          testAttempts: pkg.testAttempts,
          features: pkg.features,
          studentName: user.name,
          studentEmail: user.email,
          cnic: user.cnic,
        },
        audits: {
          create: {
            action: "CHALLAN_GENERATED",
            newStatus: "PENDING_PAYMENT",
            note: `Challan generated for ${pkg.name} (PKR ${pkg.price})`,
          },
        },
      },
      include: { package: true },
    });

    // Send challan generated email
    sendChallanGeneratedEmail({
      to: user.email,
      name: user.name,
      order: newOrder,
      packageDetails: pkg,
    }).catch((e) => console.error("[Payment] Async email error:", e.message));

    res.status(201).json({
      message: "Payment challan generated successfully.",
      order: newOrder,
      activated: false,
    });
  } catch (error) {
    console.error("[Payment] Generate challan error:", error.message);
    res.status(500).json({ error: "Failed to generate payment challan." });
  }
};

/**
 * 4. GET /api/payment/challan/:orderId/pdf
 * Generates and streams downloadable PDF challan matching the reference design.
 */
export const downloadChallanPdf = async (req, res) => {
  try {
    const userId = req.auth.id;
    const userRole = req.auth.role;
    const { orderId } = req.params;

    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { package: true, user: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    // Permission check: must belong to student or requester must be admin
    if (order.userId !== userId && userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized access to challan." });
    }

    const pdfBuffer = await generateChallanPdf({
      order,
      student: order.user,
      packageDetails: order.package || {
        name: order.metadata?.packageName || order.packageCode,
        testAttempts: order.metadata?.testAttempts,
        validityDays: order.metadata?.validityDays,
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Entrace-Challan-${order.referenceCode}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[Payment] Download challan PDF error:", error.message);
    res.status(500).json({ error: "Failed to generate PDF challan." });
  }
};

/**
 * 5. GET /api/payment/active-challan
 * Returns current active pending challan for the logged-in student (or null if expired/none).
 */
export const getActiveChallan = async (req, res) => {
  try {
    const userId = req.auth.id;
    const now = new Date();

    const order = await prisma.paymentOrder.findFirst({
      where: {
        userId,
        status: { in: ["PENDING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] },
      },
      include: { package: true },
      orderBy: { createdAt: "desc" },
    });

    if (!order) {
      return res.status(200).json({ activeChallan: null });
    }

    // Check expiry
    if (new Date(order.expiresAt) < now) {
      if (order.status === "PENDING_PAYMENT") {
        await prisma.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: "EXPIRED",
            audits: {
              create: {
                action: "EXPIRED",
                oldStatus: order.status,
                newStatus: "EXPIRED",
                note: "Challan expired after 24 hours.",
              },
            },
          },
        });
        return res.status(200).json({ activeChallan: null, expiredChallan: order });
      }
    }

    // Generate order-specific QR code
    let qrCode = null;
    try {
      const config = await getDynamicPaymentConfig();
      const cleanIban = (config.iban || "").replace(/\s+/g, "");
      // Plain Raast ID or IBAN — universally scannable by Pakistani banking apps
      const qrData = config.raastId
        ? config.raastId.trim()
        : cleanIban;
      qrCode = await QRCode.toDataURL(qrData, {
        width: 320,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    } catch (qrErr) {
      console.warn("[Payment] Challan QR generation warning:", qrErr.message);
    }

    res.status(200).json({ activeChallan: { ...order, qrCode } });
  } catch (error) {
    console.error("[Payment] Get active challan error:", error.message);
    res.status(500).json({ error: "Failed to fetch active challan." });
  }
};

/**
 * 6. POST /api/payment/submit-receipt
 * Accepts transaction ID and receipt image/PDF upload. Transitions order to RECEIPT_SUBMITTED.
 * STRICT: Does NOT activate the package!
 */
export const submitReceipt = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { orderId, transactionId } = req.body;

    if (!transactionId || String(transactionId).trim().length < 4) {
      // Clean up uploaded file if validation fails
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "A valid Bank Transaction ID / Reference number (at least 4 characters) is required." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Payment receipt proof (Image or PDF, max 2MB) is required." });
    }

    const cleanTrxId = String(transactionId).trim();

    // Find order
    const order = await prisma.paymentOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: { package: true, user: true },
    });

    if (!order) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Challan order not found." });
    }

    // Must be in PENDING_PAYMENT or allow replacement in RECEIPT_SUBMITTED
    if (!["PENDING_PAYMENT", "RECEIPT_SUBMITTED"].includes(order.status)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: `Receipt cannot be submitted because this challan is already ${order.status.toLowerCase()}.`,
      });
    }

    // Check expiry
    if (new Date(order.expiresAt) < new Date() && order.status === "PENDING_PAYMENT") {
      if (req.file) fs.unlinkSync(req.file.path);
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      });
      return res.status(400).json({ error: "This challan has expired (24-hour limit exceeded). Please generate a new challan." });
    }

    // RULE: Transaction ID cannot be reused across active or verified orders
    const duplicateTrx = await prisma.paymentOrder.findFirst({
      where: {
        transactionId: cleanTrxId,
        status: { in: ["RECEIPT_SUBMITTED", "UNDER_REVIEW", "VERIFIED"] },
        id: { not: order.id },
      },
    });

    if (duplicateTrx) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: "This Transaction ID has already been submitted for another payment order. Please verify and enter your unique bank transaction ID.",
      });
    }

    const relativeReceiptPath = `/uploads/receipts/${req.file.filename}`;

    // Update order state
    const updatedOrder = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        transactionId: cleanTrxId,
        receiptProof: relativeReceiptPath,
        submittedAt: new Date(),
        status: "RECEIPT_SUBMITTED",
        audits: {
          create: {
            action: "RECEIPT_SUBMITTED",
            oldStatus: order.status,
            newStatus: "RECEIPT_SUBMITTED",
            note: `Student submitted receipt with Transaction ID: ${cleanTrxId}`,
          },
        },
      },
      include: { package: true },
    });

    // Send email alert to student
    sendReceiptSubmittedEmail({
      to: order.user.email,
      name: order.user.name,
      order: updatedOrder,
    }).catch((e) => console.error("[Payment] Async email error:", e.message));

    res.status(200).json({
      message: "Payment receipt submitted successfully! Our team will verify it shortly.",
      order: updatedOrder,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    console.error("[Payment] Submit receipt error:", error.message);
    res.status(500).json({ error: "Failed to submit payment receipt." });
  }
};

/**
 * 7. GET /api/payment/history
 * Returns the student's full payment history with audits.
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.auth.id;

    const orders = await prisma.paymentOrder.findMany({
      where: { userId },
      include: {
        package: true,
        audits: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error("[Payment] Get payment history error:", error.message);
    res.status(500).json({ error: "Failed to load payment history." });
  }
};

/**
 * 8. GET /api/payment/receipt-file/:orderId
 * Securely streams receipt file (JPEG/PNG/PDF) to authenticated owner or admin.
 */
export const getReceiptFile = async (req, res) => {
  try {
    const userId = req.auth.id;
    const userRole = req.auth.role;
    const { orderId } = req.params;

    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { userId: true, receiptProof: true, referenceCode: true },
    });

    if (!order || !order.receiptProof) {
      return res.status(404).json({ error: "Receipt file not found." });
    }

    if (order.userId !== userId && userRole !== "admin") {
      return res.status(403).json({ error: "Unauthorized access to receipt file." });
    }

    const filename = path.basename(order.receiptProof);
    const fullPath = path.resolve("uploads/receipts", filename);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "Receipt file does not exist on server disk." });
    }

    res.sendFile(fullPath);
  } catch (error) {
    console.error("[Payment] Get receipt file error:", error.message);
    res.status(500).json({ error: "Failed to retrieve receipt file." });
  }
};

/**
 * 9. POST /api/payment/cancel-challan/:orderId
 * Allows a student to cancel their own pending payment order.
 * Deletes the pending order so the student is immediately free to generate a new challan or choose another package.
 */
export const cancelChallan = async (req, res) => {
  try {
    const userId = req.auth.id;
    const { orderId } = req.params;

    const order = await prisma.paymentOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Payment challan order not found." });
    }

    if (order.status === "VERIFIED") {
      return res.status(400).json({ error: "Verified payment orders cannot be cancelled." });
    }

    // Clean up uploaded receipt file if present
    if (order.receiptProof) {
      try {
        const fullReceiptPath = path.resolve(order.receiptProof.replace(/^\//, ""));
        if (fs.existsSync(fullReceiptPath)) {
          fs.unlinkSync(fullReceiptPath);
        }
      } catch (fErr) {
        console.warn("[Payment] Could not delete receipt file on cancel:", fErr.message);
      }
    }

    // Delete the order (cascades payment audits and unlinks profileChangeRequest)
    await prisma.paymentOrder.delete({
      where: { id: order.id },
    });

    console.log(`[Payment] ❌ Student ${req.auth.email} cancelled challan ${order.referenceCode}`);

    res.status(200).json({
      message: `Challan ${order.referenceCode} has been cancelled. You can now choose any package or generate a new challan.`,
      cancelledOrderId: order.id,
    });
  } catch (error) {
    console.error("[Payment] cancelChallan error:", error.message);
    res.status(500).json({ error: "Failed to cancel payment challan." });
  }
};

