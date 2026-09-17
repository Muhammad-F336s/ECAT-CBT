import prisma from "../db.js";

/**
 * Generates a unique, sequential, human-readable reference code for payment challans.
 * Format: ENT-YYYY-000001
 * Example: ENT-2026-000001
 */
export async function generateReferenceCode() {
  const year = new Date().getFullYear();
  const prefix = `ENT-${year}-`;

  // Find latest order for the current year
  const latestOrder = await prisma.paymentOrder.findFirst({
    where: {
      referenceCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      referenceCode: "desc",
    },
    select: {
      referenceCode: true,
    },
  });

  let nextSequence = 1;
  if (latestOrder && latestOrder.referenceCode) {
    const parts = latestOrder.referenceCode.split("-");
    if (parts.length === 3) {
      const currentSeq = parseInt(parts[2], 10);
      if (!isNaN(currentSeq)) {
        nextSequence = currentSeq + 1;
      }
    }
  }

  // Ensure uniqueness in case of race condition
  let candidate = `${prefix}${String(nextSequence).padStart(6, "0")}`;
  let existing = await prisma.paymentOrder.findUnique({
    where: { referenceCode: candidate },
  });

  while (existing) {
    nextSequence++;
    candidate = `${prefix}${String(nextSequence).padStart(6, "0")}`;
    existing = await prisma.paymentOrder.findUnique({
      where: { referenceCode: candidate },
    });
  }

  return candidate;
}
