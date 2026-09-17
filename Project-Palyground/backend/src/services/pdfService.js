import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getPaymentConfig } from "../config/paymentConfig.js";

/**
 * Mask CNIC for privacy and security.
 * Example: "35201-1234567-1" -> "35201-*******-1"
 */
export function maskCnic(cnic) {
  if (!cnic || typeof cnic !== "string") return "Not Provided";
  const cleaned = cnic.trim();
  if (cleaned.length === 15 && cleaned[5] === "-" && cleaned[13] === "-") {
    return `${cleaned.slice(0, 6)}*******${cleaned.slice(13)}`;
  }
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 3)}*****${cleaned.slice(-2)}`;
  }
  return cleaned;
}

/**
 * Format a Date object into human-readable Pakistani Standard Date & Time.
 */
function formatDateTime(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleString("en-PK", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateOnly(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Centralized PDF generator for payment challans matching Entrace.pk design standards.
 * Returns a Promise<Buffer> of the generated PDF document.
 */
export async function generateChallanPdf({ order, student, packageDetails, bankDetails }) {
  const config = bankDetails || getPaymentConfig();
  const bankName = config.bankName;
  const accountTitle = config.accountTitle;
  const iban = config.iban;
  const raastId = config.raastId;
  const supportEmail = config.supportContact;

  const studentName = student?.name || order.metadata?.studentName || "Student";
  const studentEmail = student?.email || order.metadata?.studentEmail || "student@email.com";
  const studentId = student?.id ? `ENT-STU-${student.id.slice(0, 6).toUpperCase()}` : "ENT-STU-0001";
  const studentCnic = maskCnic(student?.cnic || order.metadata?.cnic);

  const packageName = packageDetails?.name || order.packageCode || "Practice Package";
  const attemptsCount = packageDetails?.testAttempts ?? order.metadata?.testAttempts ?? "N/A";
  const validityDays = packageDetails?.validityDays ? `${packageDetails.validityDays} days` : "N/A";
  const amount = Number(order.expectedAmount || 0).toLocaleString("en-PK");

  const issueDate = formatDateTime(order.issuedAt || order.createdAt || new Date());
  const dueDate = formatDateTime(order.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000));
  const dueDateShort = formatDateOnly(order.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000));

  // Plain Raast ID is universally accepted by NayaPay, JazzCash, SadaPay etc.
  // Fallback: plain IBAN for apps that don't support Raast
  // raastId is already extracted from config at line 56 above
  const qrData = raastId ? raastId.trim() : iban.replace(/\s+/g, "");
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 240,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.warn("[PDF Service] Failed to generate QR code, proceeding without QR:", err.message);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 32, bottom: 32, left: 36, right: 36 },
        info: {
          Title: `Payment Challan - ${order.referenceCode}`,
          Author: "Entrace.pk",
          Subject: "ECAT CBT Payment Challan",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const startX = 36;
      const pageWidth = 595.28;
      const contentWidth = pageWidth - startX * 2; // ~523.28pt

      // ==========================================
      // 1. TOP HEADER (Logo + PAYMENT CHALLAN)
      // ==========================================
      let currentY = 32;

      // Draw stylized isometric cube logo mark
      const logoX = startX;
      const logoY = currentY + 2;

      doc.save();
      // Top diamond of cube
      doc.polygon(
        [logoX + 10, logoY],
        [logoX + 18, logoY + 4],
        [logoX + 10, logoY + 8],
        [logoX + 2, logoY + 4]
      ).fill("#1e3a8a");

      // Left face
      doc.polygon(
        [logoX + 2, logoY + 5],
        [logoX + 10, logoY + 9],
        [logoX + 10, logoY + 18],
        [logoX + 2, logoY + 14]
      ).fill("#0f172a");

      // Right face
      doc.polygon(
        [logoX + 10, logoY + 9],
        [logoX + 18, logoY + 5],
        [logoX + 18, logoY + 14],
        [logoX + 10, logoY + 18]
      ).fill("#2d6a4f");
      doc.restore();

      // Brand text
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(18).text("Entrace.pk", logoX + 24, currentY);

      // Top right header text
      doc.fillColor("#475569").font("Helvetica-Bold").fontSize(10)
        .text("PAYMENT CHALLAN", startX, currentY + 5, { align: "right", width: contentWidth });

      currentY += 28;

      // Horizontal top divider
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
      currentY += 16;

      // ==========================================
      // 2. TITLE, STATUS BADGE & REFERENCE CODE
      // ==========================================
      const titleY = currentY;
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(22).text("Payment Challan", startX, titleY);

      // UNPAID Badge pill next to title
      const titleWidth = doc.widthOfString("Payment Challan", { font: "Helvetica-Bold", size: 22 });
      const badgeX = startX + titleWidth + 14;
      const badgeY = titleY + 3;
      const badgeWidth = 62;
      const badgeHeight = 18;

      doc.save();
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 4)
        .fillColor("#fff7ed")
        .strokeColor("#ea580c")
        .lineWidth(1)
        .fillAndStroke();
      doc.fillColor("#ea580c").font("Helvetica-Bold").fontSize(9)
        .text("UNPAID", badgeX, badgeY + 4, { width: badgeWidth, align: "center" });
      doc.restore();

      // Reference Code on top right
      doc.fillColor("#334155").font("Helvetica-Bold").fontSize(11)
        .text(order.referenceCode, startX, titleY + 6, { align: "right", width: contentWidth });

      // Subtitle below title
      doc.fillColor("#475569").font("Helvetica").fontSize(11)
        .text(order.purpose === "PROFILE_CHANGE" ? "Academic Profile Change Fee" : "ECAT CBT Practice Package", startX, titleY + 28);

      currentY = titleY + 48;

      // ==========================================
      // 3. TWO-COLUMN DETAILS GRID
      // ==========================================
      const col1X = startX;
      const col1Width = 250;
      const col2X = startX + 270;
      const col2Width = contentWidth - 270;

      let col1Y = currentY;
      let col2Y = currentY;

      // ----- LEFT COLUMN: STUDENT & PACKAGE -----
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text("STUDENT", col1X, col1Y);
      col1Y += 16;

      const studentFields = [
        { label: "Student Name:", value: studentName },
        { label: "Student ID:", value: studentId },
        { label: "Email Address:", value: studentEmail },
        { label: "CNIC:", value: studentCnic },
      ];

      for (const field of studentFields) {
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9.5).text(field.label, col1X, col1Y);
        col1Y += 12;
        doc.fillColor("#334155").font("Helvetica").fontSize(9.5).text(field.value, col1X, col1Y);
        col1Y += 14;
      }

      col1Y += 8;
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text("PACKAGE", col1X, col1Y);
      col1Y += 16;

      const packageFields = [
        { label: "Package Name:", value: packageName },
        { label: "Test Attempts:", value: attemptsCount.toString() },
        { label: "Access Validity:", value: validityDays },
        { label: "Issue Date:", value: issueDate },
        { label: "Payment Due Date:", value: dueDate },
      ];

      for (const field of packageFields) {
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9.5).text(field.label, col1X, col1Y);
        col1Y += 12;
        doc.fillColor("#334155").font("Helvetica").fontSize(9.5).text(field.value, col1X, col1Y);
        col1Y += 14;
      }

      // ----- RIGHT COLUMN: PAYMENT SUMMARY & BANK DETAILS -----
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text("PAYMENT SUMMARY", col2X, col2Y);
      col2Y += 16;

      // Big Bold Amount
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(26).text(`PKR ${amount}`, col2X, col2Y);
      col2Y += 32;

      doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("Pay the exact amount before the due date.", col2X, col2Y);
      col2Y += 22;

      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text("BANK TRANSFER DETAILS", col2X, col2Y);
      col2Y += 16;

      const bankFields = [
        { label: "Bank Name:", value: bankName },
        { label: "Account Title:", value: accountTitle },
        { label: "IBAN:", value: iban },
        { label: "Raast ID:", value: raastId || "Not Configured" },
      ];

      for (const field of bankFields) {
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9.5).text(field.label, col2X, col2Y);
        col2Y += 12;
        doc.fillColor("#1e293b").font(field.label === "IBAN:" ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).text(field.value, col2X, col2Y);
        col2Y += 14;
      }

      col2Y += 6;

      // Embed QR Code
      if (qrBuffer) {
        const qrSize = 95;
        const qrX = col2X + 35;
        doc.image(qrBuffer, qrX, col2Y, { width: qrSize, height: qrSize });
        col2Y += qrSize + 5;
        doc.fillColor("#475569").font("Helvetica").fontSize(8.5)
          .text("Scan to pay via Raast", qrX - 20, col2Y, { width: qrSize + 40, align: "center" });
        col2Y += 16;
      }

      currentY = Math.max(col1Y, col2Y) + 12;

      // ==========================================
      // 4. INSTRUCTIONS ROUNDED BOX
      // ==========================================
      const boxY = currentY;
      const boxHeight = 78;

      doc.save();
      doc.roundedRect(startX, boxY, contentWidth, boxHeight, 8)
        .fillColor("#f1f5f9")
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .fillAndStroke();
      doc.restore();

      const instructions = [
        "1. Transfer the exact amount to the stated IBAN.",
        `2. Use ${order.referenceCode} as transfer reference.`,
        "3. Log in and click 'I Have Paid' to upload receipt.",
        "4. Access activates after payment verification.",
      ];

      let instY = boxY + 10;
      for (const inst of instructions) {
        doc.fillColor("#1e293b").font("Helvetica").fontSize(9.5).text(inst, startX + 16, instY);
        instY += 15;
      }

      currentY = boxY + boxHeight + 10;

      // ==========================================
      // 5. SYSTEM FOOTER / SUPPORT
      // ==========================================
      doc.fillColor("#475569").font("Helvetica").fontSize(8.5)
        .text(`Support: ${supportEmail}`, startX, currentY);

      doc.fillColor("#475569").font("Helvetica").fontSize(8.5)
        .text("This is a system-generated payment challan.", startX, currentY, { align: "right", width: contentWidth });

      currentY += 24;

      // ==========================================
      // 6. PERFORATED TEAR-OFF SLIP (KAATNE WALI RECEIPT)
      // ==========================================
      const tearY = currentY;

      // Scissors symbol
      doc.fillColor("#0f172a").font("Helvetica").fontSize(13).text("✂", startX - 2, tearY - 7);

      // Dashed cutting line
      doc.save();
      doc.strokeColor("#94a3b8").lineWidth(1).dash(4, { space: 3 })
        .moveTo(startX + 14, tearY).lineTo(startX + contentWidth, tearY).stroke();
      doc.restore();

      const slipY = tearY + 12;

      // Mini slip columns
      const colWidth = contentWidth / 6;

      // Slip Brand
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Entrace.pk", startX, slipY + 4);

      // Vertical mini divider
      doc.strokeColor("#cbd5e1").lineWidth(1)
        .moveTo(startX + colWidth - 6, slipY).lineTo(startX + colWidth - 6, slipY + 28).stroke();

      const slipData = [
        { label: "Challan ID", value: order.referenceCode },
        { label: "Student Name", value: studentName.length > 16 ? studentName.slice(0, 14) + "..." : studentName },
        { label: "Package", value: packageName },
        { label: "PKR Amount", value: `PKR ${amount}`, isBold: true },
        { label: "Due Date", value: dueDateShort },
      ];

      slipData.forEach((item, idx) => {
        const itemX = startX + colWidth + idx * (colWidth * 0.98);
        doc.fillColor("#475569").font("Helvetica").fontSize(8).text(item.label, itemX, slipY);
        doc.fillColor("#0f172a").font(item.isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
          .text(item.value, itemX, slipY + 12, { width: colWidth * 0.95 });
      });

      // Bottom instruction note
      doc.fillColor("#475569").font("Helvetica-Oblique").fontSize(8.5)
        .text("Keep this receipt for your record", startX, slipY + 34, { width: contentWidth, align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
