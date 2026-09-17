import nodemailer from "nodemailer";

// ---- Centralized Mail Transporter ----
const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
};

const FROM_ADDRESS = () =>
  process.env.EMAIL_USER
    ? `"Entrace.pk" <${process.env.EMAIL_USER}>`
    : null;

const SUPPORT_EMAIL =
  process.env.PAYMENT_SUPPORT_CONTACT || "support@entrace.pk";

const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Universal branded HTML wrapper.
 * Every email from Entrace.pk uses this consistent layout.
 */
const wrapHtml = (title, bodyHtml) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <!-- Header -->
    <div style="background:#0f172a;padding:18px 28px">
      <table style="width:100%;border-collapse:collapse" role="presentation">
        <tr>
          <td style="vertical-align:middle">
            <a href="${APP_URL}" target="_blank" style="text-decoration:none !important;color:#ffffff !important;font-size:22px;font-weight:900;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif;display:inline-block">
              <span style="color:#ffffff !important">Entrace</span><span style="color:#22c55e !important">.pk</span>
            </a>
          </td>
          <td style="text-align:right;vertical-align:middle">
            <a href="${APP_URL}" target="_blank" style="display:inline-block;background:#22c55e;color:#0f172a !important;text-decoration:none !important;font-size:12px;font-weight:800;padding:7px 16px;border-radius:20px;font-family:Arial,Helvetica,sans-serif">
              Open App &rarr;
            </a>
          </td>
        </tr>
      </table>
    </div>
    <!-- Body -->
    <div style="padding:30px">
      <h2 style="color:#0f172a;margin:0 0 16px 0;font-size:20px">${title}</h2>
      ${bodyHtml}
    </div>
    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 30px;text-align:center">
      <p style="margin:0;color:#64748b;font-size:12px">
        Entrace.pk &mdash; ECAT CBT Practice Platform<br>
        Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#2d6a4f">${SUPPORT_EMAIL}</a>
      </p>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:11px">
        This is an automated email. Please do not reply directly to this message.
      </p>
    </div>
  </div>
</body>
</html>`;

/**
 * Core low-level send function.
 * Falls back to console.warn in dev if SMTP is not configured.
 */
export const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();
  const from = FROM_ADDRESS();

  if (!transporter || !from) {
    console.warn(`[EmailService] SMTP not configured. Skipping email to ${to}: ${subject}`);
    return { sent: false, reason: "SMTP not configured" };
  }

  try {
    await transporter.sendMail({ from, to, subject, html });
    console.log(`[EmailService] ✅ Sent "${subject}" → ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[EmailService] ❌ Failed to send "${subject}" → ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
};

// =====================================================
// 1. OTP / EMAIL VERIFICATION
// =====================================================
export const sendOtpEmail = async ({ to, name, otp }) => {
  const html = wrapHtml(
    "Email Verification",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Use the 6-digit OTP below to verify your email address:</p>
     <div style="text-align:center;margin:28px 0">
       <span style="font-size:2.4rem;font-weight:bold;letter-spacing:10px;color:#1b4332;background:#d8f3dc;padding:14px 28px;border-radius:10px;display:inline-block">${otp}</span>
     </div>
     <p style="color:#64748b;font-size:0.88rem">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
     <p style="color:#dc2626;font-size:0.85rem"><strong>Note:</strong> If you did not request this, please ignore it.</p>`
  );
  return sendEmail({ to, subject: "Entrace.pk – Your Email Verification Code", html });
};

// =====================================================
// 2. PASSWORD RESET
// =====================================================
export const sendPasswordResetEmail = async ({ to, name, otp }) => {
  const html = wrapHtml(
    "Password Reset Request",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">You requested a password reset. Use this code to proceed:</p>
     <div style="text-align:center;margin:28px 0">
       <span style="font-size:2.4rem;font-weight:bold;letter-spacing:10px;color:#7c3aed;background:#ede9fe;padding:14px 28px;border-radius:10px;display:inline-block">${otp}</span>
     </div>
     <p style="color:#64748b;font-size:0.88rem">This code expires in <strong>10 minutes</strong>.</p>
     <p style="color:#dc2626;font-size:0.85rem">If you did not request a password reset, please ignore this email and secure your account.</p>`
  );
  return sendEmail({ to, subject: "Entrace.pk – Password Reset Code", html });
};

// =====================================================
// 3. CHALLAN GENERATED
// =====================================================
export const sendChallanGeneratedEmail = async ({ to, name, order, packageDetails }) => {
  const amount = Number(order.expectedAmount || 0).toLocaleString("en-PK");
  const expiryStr = order.expiresAt
    ? new Date(order.expiresAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })
    : "24 hours";

  const html = wrapHtml(
    "Your Payment Challan is Ready",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Your payment challan for the <strong>${packageDetails?.name || order.packageCode || "Practice"}</strong> package has been generated.</p>

     <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0">
       <table style="width:100%;border-collapse:collapse">
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Challan Reference ID</td><td style="font-weight:bold;color:#0f172a;font-size:13px;text-align:right">${order.referenceCode}</td></tr>
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Package</td><td style="color:#0f172a;font-size:13px;text-align:right">${packageDetails?.name || order.packageCode}</td></tr>
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Amount Due</td><td style="font-weight:bold;color:#2d6a4f;font-size:16px;text-align:right">PKR ${amount}</td></tr>
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Challan Expires</td><td style="color:#dc2626;font-size:13px;text-align:right">${expiryStr}</td></tr>
       </table>
     </div>

     <p style="color:#475569;font-size:14px">✅ <strong>Next Steps:</strong></p>
     <ol style="color:#475569;font-size:13px;line-height:1.8">
       <li>Transfer <strong>PKR ${amount}</strong> using the bank details in your downloaded challan.</li>
       <li>Use <strong>${order.referenceCode}</strong> as your payment reference.</li>
       <li>Log in and click <strong>"I Have Paid"</strong> to upload your receipt.</li>
       <li>Your package will be activated after verification.</li>
     </ol>
     <p style="color:#94a3b8;font-size:12px">The challan PDF was attached to your download. Please log in to retrieve it again if needed.</p>`
  );
  return sendEmail({ to, subject: `Entrace.pk – Challan Generated (${order.referenceCode})`, html });
};

// =====================================================
// 4. RECEIPT SUBMITTED
// =====================================================
export const sendReceiptSubmittedEmail = async ({ to, name, order }) => {
  const html = wrapHtml(
    "Payment Receipt Received – Under Review",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">We have received your payment receipt for challan <strong>${order.referenceCode}</strong>. Our team will verify it shortly.</p>

     <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px;margin:20px 0">
       <p style="margin:0;color:#92400e;font-size:13px">⏳ <strong>Please Note:</strong> Your package will <u>not</u> be activated until our team verifies your payment. This typically takes a few hours during business hours.</p>
     </div>

     <p style="color:#475569;font-size:13px">Challan Reference: <strong>${order.referenceCode}</strong></p>
     <p style="color:#94a3b8;font-size:12px">If you believe there is an error, please contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#2d6a4f">${SUPPORT_EMAIL}</a>.</p>`
  );
  return sendEmail({ to, subject: `Entrace.pk – Receipt Received (${order.referenceCode})`, html });
};

// =====================================================
// 5. PAYMENT VERIFIED & PACKAGE ACTIVATED
// =====================================================
export const sendPaymentVerifiedEmail = async ({ to, name, order, packageDetails, expiresAt, attempts }) => {
  const expStr = expiresAt
    ? new Date(expiresAt).toLocaleString("en-PK", { dateStyle: "long", timeStyle: "short" })
    : "N/A";

  const html = wrapHtml(
    "🎉 Payment Verified – Package Activated!",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Great news! Your payment has been verified and your package is now <strong style="color:#16a34a">active</strong>.</p>

     <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;margin:20px 0">
       <table style="width:100%;border-collapse:collapse">
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Package Activated</td><td style="font-weight:bold;color:#16a34a;font-size:13px;text-align:right">${packageDetails?.name || order.packageCode}</td></tr>
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Test Attempts</td><td style="font-weight:bold;color:#0f172a;font-size:13px;text-align:right">${attempts}</td></tr>
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Access Valid Until</td><td style="font-weight:bold;color:#0f172a;font-size:13px;text-align:right">${expStr}</td></tr>
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Reference</td><td style="color:#0f172a;font-size:13px;text-align:right">${order.referenceCode}</td></tr>
       </table>
     </div>

     <p style="color:#475569;font-size:14px">You can now log in and start practicing. Best of luck in your ECAT preparation! 🚀</p>`
  );
  return sendEmail({ to, subject: "Entrace.pk – Package Activated Successfully!", html });
};

// =====================================================
// 6. PAYMENT REJECTED
// =====================================================
export const sendPaymentRejectedEmail = async ({ to, name, order, reason }) => {
  const html = wrapHtml(
    "Payment Verification Failed",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Unfortunately, we were unable to verify your payment for challan <strong>${order.referenceCode}</strong>.</p>

     <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px;margin:20px 0">
       <p style="margin:0;color:#991b1b;font-size:13px"><strong>Reason:</strong> ${reason || "The payment could not be confirmed. Please re-check the details."}</p>
     </div>

     <p style="color:#475569;font-size:13px">You can generate a new challan and try again from the Packages page.</p>
     <p style="color:#475569;font-size:13px">If you believe this is an error, contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#2d6a4f">${SUPPORT_EMAIL}</a> with your challan reference <strong>${order.referenceCode}</strong>.</p>`
  );
  return sendEmail({ to, subject: `Entrace.pk – Payment Verification Failed (${order.referenceCode})`, html });
};

// =====================================================
// 7. PACKAGE EXPIRING SOON (3 days)
// =====================================================
export const sendPackageExpiringSoonEmail = async ({ to, name, packageName, expiresAt }) => {
  const expStr = expiresAt
    ? new Date(expiresAt).toLocaleString("en-PK", { dateStyle: "long", timeStyle: "short" })
    : "soon";

  const html = wrapHtml(
    "⚠️ Your Package Expires in 3 Days",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Your <strong>${packageName}</strong> package will expire on <strong style="color:#ea580c">${expStr}</strong>.</p>
     <p style="color:#475569">To continue accessing practice tests and content, please renew your package before it expires.</p>

     <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:16px;margin:20px 0">
       <p style="margin:0;color:#9a3412;font-size:13px">⏰ Once expired, you will lose access to CBT tests, Content Library, Analytics, and AI features until you renew.</p>
     </div>

     <p style="color:#475569;font-size:13px">Log in to the Packages page to select and generate a new challan.</p>`
  );
  return sendEmail({ to, subject: "Entrace.pk – Your Package Expires in 3 Days", html });
};

// =====================================================
// 8. PACKAGE EXPIRED
// =====================================================
export const sendPackageExpiredEmail = async ({ to, name, packageName }) => {
  const html = wrapHtml(
    "Your Package Has Expired",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Your <strong>${packageName}</strong> package has expired. Your access to ECAT practice tests and premium features has been suspended.</p>
     <p style="color:#475569">You can still log in, view your account, contact support, and renew your package at any time.</p>

     <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px;margin:20px 0">
       <p style="margin:0;color:#991b1b;font-size:13px">🔒 Access to: CBT Tests, Content Library, Analytics, and AI features is currently suspended.</p>
     </div>

     <p style="color:#475569;font-size:13px">Visit the Packages page to choose a plan and continue your ECAT preparation.</p>`
  );
  return sendEmail({ to, subject: "Entrace.pk – Your Package Has Expired", html });
};

// =====================================================
// 9. PROFILE CHANGE – PAYMENT VERIFIED
// =====================================================
export const sendProfileChangePaymentVerifiedEmail = async ({ to, name, order }) => {
  const html = wrapHtml(
    "Profile Change – Payment Verified",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Your payment for the Academic Profile Change request has been verified (Ref: <strong>${order.referenceCode}</strong>).</p>
     <p style="color:#475569">Your request is now <strong>Under Review</strong>. Our admin team will review your requested academic track and subject changes.</p>

     <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin:20px 0">
       <p style="margin:0;color:#15803d;font-size:13px">✅ You will receive another email once your profile change has been applied.</p>
     </div>

     <p style="color:#94a3b8;font-size:12px">If you have questions, contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#2d6a4f">${SUPPORT_EMAIL}</a>.</p>`
  );
  return sendEmail({ to, subject: "Entrace.pk – Profile Change Payment Verified", html });
};

// =====================================================
// 10. PROFILE CHANGE – APPLIED / FULFILLED
// =====================================================
export const sendProfileChangeAppliedEmail = async ({ to, name, newTrack, newSubjects }) => {
  const subjectList = Array.isArray(newSubjects) ? newSubjects.join(", ") : newSubjects || "N/A";

  const html = wrapHtml(
    "✅ Academic Profile Change Applied",
    `<p style="color:#334155">Hi <strong>${name}</strong>,</p>
     <p style="color:#475569">Your academic profile has been successfully updated.</p>

     <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;margin:20px 0">
       <table style="width:100%;border-collapse:collapse">
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">New Academic Track</td><td style="font-weight:bold;color:#16a34a;font-size:13px;text-align:right">${newTrack}</td></tr>
         <tr><td style="color:#64748b;font-size:13px;padding:5px 0">Subjects</td><td style="color:#0f172a;font-size:13px;text-align:right">${subjectList}</td></tr>
       </table>
     </div>

     <p style="color:#475569;font-size:13px">Your dashboard and practice content has been updated accordingly. Log in to continue.</p>
     <p style="color:#94a3b8;font-size:12px">If there is a discrepancy, contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#2d6a4f">${SUPPORT_EMAIL}</a>.</p>`
  );
  return sendEmail({ to, subject: "Entrace.pk – Academic Profile Change Applied", html });
};

// =====================================================
// 11. SECURITY ALERT (Admin)
// =====================================================
export const sendAdminSecurityAlertEmail = async ({ to, subject: alertSubject, bodyHtml }) => {
  const html = wrapHtml(alertSubject, bodyHtml);
  return sendEmail({ to, subject: `Entrace.pk Security Alert: ${alertSubject}`, html });
};

// =====================================================
// 12. ROOT ADMIN BANK CHANGE AUTHORIZATION CODE
// =====================================================
export const sendBankChangeAuthorizationEmail = async ({
  to,
  adminName,
  adminEmail,
  proposedBankName,
  proposedAccountTitle,
  proposedIban,
  proposedRaastId,
  proposedSupportContact,
  secretCode,
  expiresAt,
}) => {
  const formattedExpiry = new Date(expiresAt).toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
  });

  const bodyHtml = `
    <div style="background:#fee2e2;border:1.5px solid #ef4444;border-radius:10px;padding:16px;margin-bottom:20px">
      <p style="margin:0;color:#991b1b;font-weight:bold;font-size:14px">🚨 CRITICAL FINANCIAL SECURITY ACTION</p>
      <p style="margin:4px 0 0;color:#7f1d1d;font-size:13px">
        An administrator has requested to update the platform's official payment receiving account (IBAN / Bank).
      </p>
    </div>

    <p style="color:#334155;font-size:14px">Requested by: <strong>${adminName}</strong> (<code>${adminEmail}</code>)</p>

    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:16px;margin:20px 0">
      <h4 style="margin:0 0 12px 0;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Proposed New Account Details:</h4>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="color:#64748b;padding:4px 0">Bank Name:</td><td style="color:#0f172a;font-weight:bold;text-align:right">${proposedBankName}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Account Title:</td><td style="color:#0f172a;font-weight:bold;text-align:right">${proposedAccountTitle}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">New IBAN:</td><td style="color:#2563eb;font-weight:bold;font-family:monospace;text-align:right">${proposedIban}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Raast ID:</td><td style="color:#0f172a;font-weight:bold;text-align:right">${proposedRaastId || "None"}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Support Contact:</td><td style="color:#0f172a;font-weight:bold;text-align:right">${proposedSupportContact || "None"}</td></tr>
      </table>
    </div>

    <p style="color:#0f172a;font-weight:bold;margin:16px 0 8px">Your Secret Authorization Code:</p>
    <div style="text-align:center;margin:20px 0">
      <span style="font-size:2rem;font-weight:900;letter-spacing:6px;color:#991b1b;background:#fef2f2;border:2px dashed #ef4444;padding:14px 28px;border-radius:10px;display:inline-block">${secretCode}</span>
    </div>

    <p style="color:#64748b;font-size:12px;text-align:center">
      Expires at <strong>${formattedExpiry} PKT</strong>. If you did not authorize this change, DO NOT share this code and immediately freeze the requesting admin's account.
    </p>
  `;

  const html = wrapHtml("⚠️ Authorize Bank Details Change", bodyHtml);
  return sendEmail({
    to,
    subject: "🚨 [ACTION REQUIRED] Root Authorization Code: Change Bank / IBAN Details",
    html,
  });
};

// =====================================================
// 13. BANK DETAILS CHANGED CONFIRMATION
// =====================================================
export const sendBankChangeAppliedEmail = async ({
  to,
  resolvedByEmail,
  newBankName,
  newAccountTitle,
  newIban,
}) => {
  const bodyHtml = `
    <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:16px;margin-bottom:20px">
      <p style="margin:0;color:#065f46;font-weight:bold;font-size:14px">✅ Payment Receiving Details Updated</p>
      <p style="margin:4px 0 0;color:#047857;font-size:13px">
        The official payment receiving bank account for student payments has been updated across Entrace.pk.
      </p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
      <tr><td style="color:#64748b;padding:4px 0">Approved By:</td><td style="color:#0f172a;font-weight:bold;text-align:right">${resolvedByEmail}</td></tr>
      <tr><td style="color:#64748b;padding:4px 0">Active Bank:</td><td style="color:#0f172a;font-weight:bold;text-align:right">${newBankName}</td></tr>
      <tr><td style="color:#64748b;padding:4px 0">Account Title:</td><td style="color:#0f172a;font-weight:bold;text-align:right">${newAccountTitle}</td></tr>
      <tr><td style="color:#64748b;padding:4px 0">Active IBAN:</td><td style="color:#2563eb;font-weight:bold;font-family:monospace;text-align:right">${newIban}</td></tr>
    </table>

    <p style="color:#64748b;font-size:12px">All subsequent student challans, PDF downloads, and student portal screens will use these updated details.</p>
  `;

  const html = wrapHtml("Bank Details Successfully Updated", bodyHtml);
  return sendEmail({
    to,
    subject: "Entrace.pk – Bank & IBAN Account Details Updated",
    html,
  });
};
