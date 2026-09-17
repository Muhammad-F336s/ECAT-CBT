/**
 * adminPackageChangeController.js
 *
 * BLOCK 6 — Package Change Request Approval Flow
 *
 * Flow:
 *  1. Admin edits package → Submits change request (PackageChangeRequest, status: PENDING)
 *     → Email sent to Root Admin (muhammad.f336s@gmail.com)
 *  2. Root Admin reviews request (can edit if needed)
 *  3. Root Admin approves → Package live in DB updated
 *  4. Or Root Admin rejects with reason
 */

import bcrypt from "bcrypt";
import prisma from "../db.js";
import { sendEmail } from "../services/emailService.js";

const MAIN_ADMIN_EMAIL = "muhammad.f336s@gmail.com";
const REQUEST_EXPIRY_DAYS = 7;

export const ALL_PACKAGE_FEATURES = [
  "Full ECAT CBT Test Attempts",
  "Days Access Validity",
  "Basic Result & Performance Review",
  "Content Library Access",
  "Selected Academic Subjects Practice",
  "Standard CBT Mode Simulation",
  "Basic Analytics & Topic Breakdown",
  "Full Multi-Subject CBT Simulator",
  "Detailed Analytics & Speed Insights",
  "Advanced Predictive Analytics",
  "Historical Attempt Breakdown & Review",
  "Full Resources & Past Papers Access",
  "Vector Bot AI Mentor Access",
  "Priority Support Response",
  "One-time account activation",
];

// ─── Helper: verify admin secret ────────────────────────────────────────────
const verifyAdminSecret = async (adminId, secretCode) => {
  if (!secretCode || String(secretCode).trim().length < 4) return false;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { secretHash: true, isFrozen: true },
  });
  if (!admin || admin.isFrozen || !admin.secretHash) return false;
  return bcrypt.compare(String(secretCode).trim().toUpperCase(), admin.secretHash);
};

// ─── 1. GET /api/admin/package-changes/features-list ───────────────────────
export const getFeaturesList = async (req, res) => {
  res.status(200).json({ features: ALL_PACKAGE_FEATURES });
};

// ─── 2. POST /api/admin/package-changes/submit ─────────────────────────────
export const submitPackageChangeRequest = async (req, res) => {
  try {
    const { secretCode, packageCode, proposedChanges, adminNote } = req.body;
    const admin = req.adminAuth;

    if (!packageCode || !proposedChanges) {
      return res.status(400).json({ error: "packageCode and proposedChanges are required." });
    }

    const isValid = await verifyAdminSecret(admin.id, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const pkg = await prisma.package.findUnique({
      where: { code: packageCode.toUpperCase() },
    });
    if (!pkg) {
      return res.status(404).json({ error: `Package '${packageCode}' not found.` });
    }

    // Check if there is already a PENDING request for this package
    const existing = await prisma.packageChangeRequest.findFirst({
      where: { packageCode: packageCode.toUpperCase(), status: "PENDING" },
    });
    if (existing) {
      return res.status(409).json({
        error: "There is already a pending change request for this package awaiting Root Admin approval.",
        existingRequestId: existing.id,
      });
    }

    const hasPricing = "price" in proposedChanges || "validityDays" in proposedChanges || "testAttempts" in proposedChanges;
    const hasFeatures = "features" in proposedChanges || "name" in proposedChanges || "badgeText" in proposedChanges;
    const changeType = hasPricing && hasFeatures ? "FULL" : hasPricing ? "PRICING" : "FEATURES";

    const expiresAt = new Date(Date.now() + REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const request = await prisma.packageChangeRequest.create({
      data: {
        packageCode: packageCode.toUpperCase(),
        packageName: pkg.name,
        submittedByAdminId: admin.id,
        submittedByAdminName: admin.name,
        submittedByAdminEmail: admin.email,
        currentSnapshot: {
          name: pkg.name,
          features: pkg.features,
          badgeText: pkg.badgeText,
          price: Number(pkg.price),
          validityDays: pkg.validityDays,
          testAttempts: pkg.testAttempts,
          displayOrder: pkg.displayOrder,
        },
        proposedChanges,
        changeType,
        adminNote: adminNote?.trim() || null,
        expiresAt,
      },
    });

    // Send email to Root Admin
    try {
      const diffLines = [];
      if (proposedChanges.name && proposedChanges.name !== pkg.name) {
        diffLines.push(`Name: "${pkg.name}" → "${proposedChanges.name}"`);
      }
      if (proposedChanges.price !== undefined && proposedChanges.price !== Number(pkg.price)) {
        diffLines.push(`Price: PKR ${pkg.price} → PKR ${proposedChanges.price}`);
      }
      if (proposedChanges.validityDays !== undefined && proposedChanges.validityDays !== pkg.validityDays) {
        diffLines.push(`Validity: ${pkg.validityDays} days → ${proposedChanges.validityDays} days`);
      }
      if (proposedChanges.testAttempts !== undefined && proposedChanges.testAttempts !== pkg.testAttempts) {
        diffLines.push(`Attempts: ${pkg.testAttempts} → ${proposedChanges.testAttempts}`);
      }
      if (proposedChanges.features) {
        const added = (proposedChanges.features || []).filter(f => !pkg.features.includes(f));
        const removed = (pkg.features || []).filter(f => !proposedChanges.features.includes(f));
        if (added.length) diffLines.push(`Features Added (+): ${added.join(", ")}`);
        if (removed.length) diffLines.push(`Features Removed (-): ${removed.join(", ")}`);
      }

      await sendEmail({
        to: MAIN_ADMIN_EMAIL,
        subject: `🔐 Package Change Request: ${pkg.name} (${packageCode}) - Root Approval Required`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:20px;color:#0f172a">
            <h2 style="color:#2563eb;margin-top:0">Package Change Request Submitted</h2>
            <p>Admin <strong>${admin.name}</strong> (<code>${adminEmail(admin)}</code>) has requested changes to the <strong>${pkg.name}</strong> package.</p>
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px;margin:16px 0">
              <h4 style="margin:0 0 10px 0;color:#334155">Summary of Proposed Changes:</h4>
              <ul style="margin:0;padding-left:20px;color:#0f172a">
                ${diffLines.map(l => `<li style="margin:4px 0">${l}</li>`).join("") || "<li>Updated package attributes</li>"}
              </ul>
            </div>
            ${adminNote ? `<p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:10px;margin:16px 0"><strong>Admin Note:</strong> ${adminNote}</p>` : ""}
            <p>Please log in to the <strong>Admin Panel &rarr; Package Catalog</strong> to review, adjust, and approve or reject this request.</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error("[PackageChange] Root admin notification failed (non-fatal):", mailErr.message);
    }

    res.status(201).json({
      message: `Package change request submitted successfully. Root Admin will review and approve it.`,
      requestId: request.id,
    });
  } catch (error) {
    console.error("[PackageChange] submitPackageChangeRequest error:", error.message);
    res.status(500).json({ error: "Failed to submit package change request." });
  }
};

function adminEmail(admin) {
  return admin?.email || "admin";
}

// ─── 3. GET /api/admin/package-changes/requests ────────────────────────────
export const listChangeRequests = async (req, res) => {
  try {
    const requests = await prisma.packageChangeRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.status(200).json({ requests });
  } catch (error) {
    console.error("[PackageChange] listChangeRequests error:", error.message);
    res.status(500).json({ error: "Failed to load change requests." });
  }
};

// ─── 4. POST /api/admin/package-changes/:id/approve ────────────────────────
export const approvePackageChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { finalChanges, rootAdminNote } = req.body;
    const admin = req.adminAuth;

    // Strict security check: ONLY Root Admin can approve
    if (admin.email !== MAIN_ADMIN_EMAIL) {
      return res.status(403).json({
        error: "Only the Root Owner Administrator (muhammad.f336s@gmail.com) can approve package changes.",
      });
    }

    const request = await prisma.packageChangeRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Change request not found." });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: `This request is already ${request.status.toLowerCase()}.` });
    }

    const changesToApply = finalChanges || request.proposedChanges;
    const updateData = {};

    if (changesToApply.name !== undefined) updateData.name = String(changesToApply.name).trim();
    if (changesToApply.features !== undefined) {
      updateData.features = Array.isArray(changesToApply.features)
        ? changesToApply.features.map(f => String(f).trim()).filter(Boolean)
        : [];
    }
    if (changesToApply.badgeText !== undefined) updateData.badgeText = changesToApply.badgeText ? String(changesToApply.badgeText).trim() : null;
    if (changesToApply.price !== undefined) updateData.price = Number(changesToApply.price);
    if (changesToApply.validityDays !== undefined) updateData.validityDays = parseInt(changesToApply.validityDays, 10);
    if (changesToApply.testAttempts !== undefined) updateData.testAttempts = parseInt(changesToApply.testAttempts, 10);
    if (changesToApply.displayOrder !== undefined) updateData.displayOrder = parseInt(changesToApply.displayOrder, 10);

    // Apply atomically to package and mark request as APPROVED
    await prisma.$transaction([
      prisma.package.update({
        where: { code: request.packageCode },
        data: updateData,
      }),
      prisma.packageChangeRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          rootAdminNote: rootAdminNote?.trim() || null,
          resolvedAt: new Date(),
          resolvedByEmail: admin.email,
          proposedChanges: changesToApply,
        },
      }),
    ]);

    // Send confirmation email to submitting admin
    try {
      await sendEmail({
        to: request.submittedByAdminEmail,
        subject: `✅ Package Change Approved: ${request.packageName}`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:20px;color:#0f172a">
            <h2 style="color:#16a34a;margin-top:0">Package Change Approved</h2>
            <p>Your proposed changes for <strong>${request.packageName} (${request.packageCode})</strong> have been approved by Root Admin.</p>
            ${rootAdminNote ? `<p style="background:#f1f5f9;border-left:3px solid #16a34a;padding:10px;margin:16px 0"><strong>Root Admin Note:</strong> ${rootAdminNote}</p>` : ""}
            <p>The changes are now active in the student package catalog.</p>
          </div>
        `,
      });
    } catch (e) { /* non-fatal */ }

    res.status(200).json({
      message: `Package '${request.packageCode}' updated successfully! Changes are now live.`,
    });
  } catch (error) {
    console.error("[PackageChange] approvePackageChange error:", error.message);
    res.status(500).json({ error: "Failed to approve package change request." });
  }
};

// ─── 5. POST /api/admin/package-changes/:id/reject ─────────────────────────
export const rejectPackageChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { rootAdminNote } = req.body;
    const admin = req.adminAuth;

    if (admin.email !== MAIN_ADMIN_EMAIL) {
      return res.status(403).json({
        error: "Only the Root Owner Administrator can reject package changes.",
      });
    }

    const request = await prisma.packageChangeRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: "Change request not found." });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: `This request is already ${request.status.toLowerCase()}.` });
    }

    await prisma.packageChangeRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rootAdminNote: rootAdminNote?.trim() || "Rejected by Root Admin.",
        resolvedAt: new Date(),
        resolvedByEmail: admin.email,
      },
    });

    try {
      await sendEmail({
        to: request.submittedByAdminEmail,
        subject: `❌ Package Change Request Declined: ${request.packageName}`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:20px;color:#0f172a">
            <h2 style="color:#dc2626;margin-top:0">Package Change Request Declined</h2>
            <p>Your proposed changes for <strong>${request.packageName} (${request.packageCode})</strong> were not approved by Root Admin.</p>
            <p style="background:#fef2f2;border-left:3px solid #dc2626;padding:10px;margin:16px 0"><strong>Feedback:</strong> ${rootAdminNote || "No note provided."}</p>
            <p>The package remains unchanged in the catalog.</p>
          </div>
        `,
      });
    } catch (e) { /* non-fatal */ }

    res.status(200).json({ message: "Package change request rejected." });
  } catch (error) {
    console.error("[PackageChange] rejectPackageChange error:", error.message);
    res.status(500).json({ error: "Failed to reject package change request." });
  }
};
