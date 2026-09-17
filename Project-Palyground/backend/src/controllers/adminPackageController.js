import bcrypt from "bcrypt";
import prisma from "../db.js";

/**
 * BLOCK 5 — Admin Package Catalog Management Controller
 *
 * All routes require requireAdminAuth (sets req.adminAuth).
 * Sensitive mutations (price change, toggle recommended) require admin secret code.
 */

// ─── Helper: verify admin secret code ─────────────────────────────────────────
const verifyAdminSecret = async (adminId, secretCode) => {
  if (!secretCode || String(secretCode).trim().length < 4) return false;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { secretHash: true, isFrozen: true },
  });
  if (!admin || admin.isFrozen || !admin.secretHash) return false;
  return bcrypt.compare(String(secretCode).trim().toUpperCase(), admin.secretHash);
};

// ─── 1. GET /api/admin/packages ───────────────────────────────────────────────
/**
 * List all packages (including inactive/internal ones) with order & revenue stats.
 */
export const listPackages = async (req, res) => {
  try {
    const packages = await prisma.package.findMany({
      orderBy: { displayOrder: "asc" },
    });

    // Attach stats: total orders, verified revenue, pending count
    const enriched = await Promise.all(
      packages.map(async (pkg) => {
        const [totalOrders, verifiedOrders, pendingOrders] = await Promise.all([
          prisma.paymentOrder.count({ where: { packageCode: pkg.code } }),
          prisma.paymentOrder.count({ where: { packageCode: pkg.code, status: "VERIFIED" } }),
          prisma.paymentOrder.count({
            where: {
              packageCode: pkg.code,
              status: { in: ["PENDING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] },
            },
          }),
        ]);

        const verifiedRevenue = verifiedOrders * Number(pkg.price);

        return {
          ...pkg,
          stats: {
            totalOrders,
            verifiedOrders,
            pendingOrders,
            verifiedRevenue,
          },
        };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error("[AdminPackages] listPackages error:", error.message);
    res.status(500).json({ error: "Failed to load package catalog." });
  }
};

// ─── 2. GET /api/admin/packages/:code ─────────────────────────────────────────
/**
 * Get single package details with full order history breakdown.
 */
export const getPackageDetails = async (req, res) => {
  try {
    const { code } = req.params;

    const pkg = await prisma.package.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!pkg) {
      return res.status(404).json({ error: `Package '${code}' not found.` });
    }

    const orders = await prisma.paymentOrder.findMany({
      where: { packageCode: pkg.code },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const statsByStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({ package: pkg, statsByStatus, recentOrders: orders });
  } catch (error) {
    console.error("[AdminPackages] getPackageDetails error:", error.message);
    res.status(500).json({ error: "Failed to load package details." });
  }
};

// ─── 3. PUT /api/admin/packages/:code ─────────────────────────────────────────
/**
 * Full package edit: name, features, badgeText, colorTheme, displayOrder.
 * Does NOT allow changing price or validity via this route (use /price endpoint).
 * Requires admin secret code.
 */
export const updatePackageDetails = async (req, res) => {
  try {
    const { code } = req.params;
    const { secretCode, name, features, badgeText, colorTheme, displayOrder } = req.body;

    const isValid = await verifyAdminSecret(req.adminAuth.id, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const pkg = await prisma.package.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!pkg) {
      return res.status(404).json({ error: `Package '${code}' not found.` });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (features !== undefined) {
      if (!Array.isArray(features)) {
        return res.status(400).json({ error: "features must be an array of strings." });
      }
      updateData.features = features.map((f) => String(f).trim()).filter(Boolean);
    }
    if (badgeText !== undefined) updateData.badgeText = badgeText ? String(badgeText).trim() : null;
    if (colorTheme !== undefined) updateData.colorTheme = String(colorTheme).trim();
    if (displayOrder !== undefined) {
      const ord = parseInt(displayOrder, 10);
      if (isNaN(ord) || ord < 0) {
        return res.status(400).json({ error: "displayOrder must be a non-negative integer." });
      }
      updateData.displayOrder = ord;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields provided to update." });
    }

    const updated = await prisma.package.update({
      where: { code: code.toUpperCase() },
      data: updateData,
    });

    console.log(`[AdminPackages] Package '${code}' updated by admin ${req.adminAuth.email}`);
    res.status(200).json({ message: `Package '${code}' updated successfully.`, package: updated });
  } catch (error) {
    console.error("[AdminPackages] updatePackageDetails error:", error.message);
    res.status(500).json({ error: "Failed to update package details." });
  }
};

// ─── 4. PATCH /api/admin/packages/:code/price ─────────────────────────────────
/**
 * Update package price and/or validity days and/or testAttempts.
 * HIGH-SECURITY: requires admin secret code.
 * Does NOT retroactively change existing verified orders.
 */
export const updatePackagePrice = async (req, res) => {
  try {
    const { code } = req.params;
    const { secretCode, price, validityDays, testAttempts } = req.body;

    const isValid = await verifyAdminSecret(req.adminAuth.id, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const pkg = await prisma.package.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!pkg) {
      return res.status(404).json({ error: `Package '${code}' not found.` });
    }

    // Prevent changing Starter price away from 0
    if (code.toUpperCase() === "STARTER" && price !== undefined && Number(price) !== 0) {
      return res.status(400).json({ error: "Starter package price must remain PKR 0 (free trial)." });
    }

    const updateData = {};

    if (price !== undefined) {
      const p = Number(price);
      if (isNaN(p) || p < 0) {
        return res.status(400).json({ error: "price must be a non-negative number." });
      }
      updateData.price = p;
    }

    if (validityDays !== undefined) {
      const v = parseInt(validityDays, 10);
      if (isNaN(v) || v < 0) {
        return res.status(400).json({ error: "validityDays must be a non-negative integer." });
      }
      updateData.validityDays = v;
    }

    if (testAttempts !== undefined) {
      const t = parseInt(testAttempts, 10);
      if (isNaN(t) || t < 0) {
        return res.status(400).json({ error: "testAttempts must be a non-negative integer." });
      }
      updateData.testAttempts = t;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Provide at least one of: price, validityDays, testAttempts." });
    }

    const updated = await prisma.package.update({
      where: { code: code.toUpperCase() },
      data: updateData,
    });

    console.log(
      `[AdminPackages] Package '${code}' pricing updated by ${req.adminAuth.email}: ${JSON.stringify(updateData)}`
    );

    res.status(200).json({
      message: `Package '${code}' pricing updated. Existing verified orders are NOT affected.`,
      package: updated,
    });
  } catch (error) {
    console.error("[AdminPackages] updatePackagePrice error:", error.message);
    res.status(500).json({ error: "Failed to update package pricing." });
  }
};

// ─── 5. PATCH /api/admin/packages/:code/toggle ────────────────────────────────
/**
 * Enable or disable a package (isActive toggle).
 * PROFILE_CHANGE package CANNOT be toggled via this route (internal only).
 * Requires admin secret code.
 */
export const togglePackageActive = async (req, res) => {
  try {
    const { code } = req.params;
    const { secretCode } = req.body;

    const isValid = await verifyAdminSecret(req.adminAuth.id, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const upperCode = code.toUpperCase();

    if (upperCode === "PROFILE_CHANGE") {
      return res.status(400).json({
        error: "PROFILE_CHANGE is an internal package and cannot be toggled via this endpoint.",
      });
    }

    const pkg = await prisma.package.findUnique({
      where: { code: upperCode },
    });
    if (!pkg) {
      return res.status(404).json({ error: `Package '${code}' not found.` });
    }

    // Prevent disabling Starter (it must always be available for new students)
    if (upperCode === "STARTER" && pkg.isActive) {
      return res.status(400).json({
        error: "The Starter trial package cannot be deactivated. It must remain available for new students.",
      });
    }

    const updated = await prisma.package.update({
      where: { code: upperCode },
      data: { isActive: !pkg.isActive },
    });

    console.log(
      `[AdminPackages] Package '${upperCode}' toggled to isActive=${updated.isActive} by ${req.adminAuth.email}`
    );

    res.status(200).json({
      message: `Package '${upperCode}' is now ${updated.isActive ? "ACTIVE ✅" : "DISABLED ❌"}.`,
      package: updated,
    });
  } catch (error) {
    console.error("[AdminPackages] togglePackageActive error:", error.message);
    res.status(500).json({ error: "Failed to toggle package status." });
  }
};

// ─── 6. PATCH /api/admin/packages/:code/recommended ──────────────────────────
/**
 * Set which package is marked as "Recommended" (isRecommended badge).
 * Enforces ONE-AT-A-TIME rule: clears all others first, then sets the new one.
 * Requires admin secret code.
 */
export const setRecommendedPackage = async (req, res) => {
  try {
    const { code } = req.params;
    const { secretCode } = req.body;

    const isValid = await verifyAdminSecret(req.adminAuth.id, secretCode);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid admin secret code." });
    }

    const upperCode = code.toUpperCase();

    const pkg = await prisma.package.findUnique({
      where: { code: upperCode },
    });
    if (!pkg) {
      return res.status(404).json({ error: `Package '${code}' not found.` });
    }

    if (!pkg.isActive) {
      return res.status(400).json({ error: "Cannot mark an inactive package as Recommended." });
    }

    // TRANSACTION: Clear all → set new one
    await prisma.$transaction([
      prisma.package.updateMany({
        where: { isRecommended: true },
        data: { isRecommended: false },
      }),
      prisma.package.update({
        where: { code: upperCode },
        data: { isRecommended: true },
      }),
    ]);

    console.log(`[AdminPackages] Recommended badge set to '${upperCode}' by ${req.adminAuth.email}`);

    res.status(200).json({
      message: `Package '${upperCode}' is now marked as Recommended. All others have been cleared.`,
    });
  } catch (error) {
    console.error("[AdminPackages] setRecommendedPackage error:", error.message);
    res.status(500).json({ error: "Failed to update recommended package." });
  }
};
