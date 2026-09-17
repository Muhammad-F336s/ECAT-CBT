import prisma from "../db.js";

/**
 * STRICT ENTITLEMENT MIDDLEWARE — Block 4
 *
 * Applies to all paid feature endpoints (CBT tests, Content Library,
 * Chapter Practice, Analytics, AI Vector Bot).
 *
 * Rules enforced:
 *  1. Student must be approved (isApproved = true) — else 403
 *  2. Student must have an active, non-expired package (packageExpiresAt > now) — else 403
 *  3. For test-consuming endpoints, student must have remainingTestAttempts > 0 — else 403
 *
 * Admins bypass all these checks automatically.
 *
 * Usage:
 *   router.post("/generate", requireAuth, requireActivePackage, generateTest)
 *   router.get("/content-library", requireAuth, requireActivePackage, getContentLibrary)
 *
 * For endpoints that consume test attempts (generate, generate-chapter-practice):
 *   router.post("/generate", requireAuth, requireActivePackage, requireTestAttempts, generateTest)
 *
 * Attempt DEDUCTION is handled inside submitTest via deductTestAttempt() — NOT in middleware.
 * This way refresh / abort NEVER double-deducts.
 */

// ─── 1. Require active (non-expired) package ─────────────────────────────────
export const requireActivePackage = async (req, res, next) => {
  try {
    const auth = req.auth;
    if (!auth) return res.status(401).json({ error: "Authorization required." });

    // Admins bypass package checks
    if (auth.role === "admin") return next();

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: {
        id: true,
        isApproved: true,
        packageType: true,
        packageExpiresAt: true,
        remainingTestAttempts: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Student account not found." });
    }

    if (!user.isApproved) {
      return res.status(403).json({
        error: "Your account is pending admin approval.",
        code: "ACCOUNT_PENDING",
      });
    }

    // No package ever assigned
    if (!user.packageExpiresAt) {
      return res.status(403).json({
        error: "You have no active package. Please purchase a plan to access this feature.",
        code: "NO_PACKAGE",
      });
    }

    // Package expired
    const now = new Date();
    if (new Date(user.packageExpiresAt) < now) {
      return res.status(403).json({
        error: "Your package has expired. Please renew your plan to continue.",
        code: "PACKAGE_EXPIRED",
        expiredAt: user.packageExpiresAt,
      });
    }

    // All good — attach entitlement info for downstream controllers
    req.entitlement = {
      packageType: user.packageType,
      packageExpiresAt: user.packageExpiresAt,
      remainingTestAttempts: user.remainingTestAttempts,
    };

    return next();
  } catch (err) {
    console.error("[requireActivePackage] Error:", err.message);
    return res.status(500).json({ error: "Entitlement check failed. Please try again." });
  }
};

// ─── 2. Additionally require remaining test attempts ─────────────────────────
export const requireTestAttempts = (req, res, next) => {
  // Admins bypass
  if (req.auth?.role === "admin") return next();

  const entitlement = req.entitlement;
  if (!entitlement) {
    return res.status(403).json({ error: "Package entitlement not loaded." });
  }

  if (entitlement.remainingTestAttempts <= 0) {
    return res.status(403).json({
      error: "You have used all your test attempts for this package. Please renew to continue.",
      code: "NO_ATTEMPTS_LEFT",
      remainingTestAttempts: 0,
    });
  }

  return next();
};

/**
 * Idempotent test attempt deduction.
 *
 * Called AFTER a TestAttempt record is successfully saved in DB.
 * Uses a single atomic DB update — safe against concurrent requests.
 * If remainingTestAttempts is already 0, it leaves it at 0 (no negative).
 *
 * @param {string} userId
 */
export const deductTestAttempt = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { remainingTestAttempts: true },
    });

    if (!user) return;

    const current = user.remainingTestAttempts ?? 0;
    if (current <= 0) return; // Already at 0, don't go negative

    await prisma.user.update({
      where: { id: userId },
      data: {
        remainingTestAttempts: {
          decrement: 1,
        },
      },
    });

    console.log(`[Entitlement] ✅ Attempt deducted for user ${userId}. Remaining: ${current - 1}`);
  } catch (err) {
    // Non-fatal: log and continue. The attempt record is already saved.
    console.error(`[Entitlement] ⚠️ Failed to deduct attempt for ${userId}:`, err.message);
  }
};
