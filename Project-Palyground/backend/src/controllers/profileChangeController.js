import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import prisma from "../db.js";

const TRACKS = new Set(["Pre-Engineering", "Pre-Medical", "ICS", "ICom", "FA", "Other / Gap-year"]);
const SUBJECTS = new Set(["math", "physics", "chemistry", "biology", "english", "computer"]);
const ALLOWED_SUBJECTS = {
  "Pre-Engineering": new Set(["math", "physics", "chemistry", "english"]),
  "Pre-Medical": new Set(["biology", "physics", "chemistry", "english"]),
  ICS: new Set(["computer", "math", "physics", "english"]),
  ICom: new Set(["math", "english"]),
  FA: new Set(["english"]),
  "Other / Gap-year": new Set(["math", "physics", "chemistry", "biology", "english", "computer"]),
};
const validSubjects = (track, items) => Array.isArray(items) && items.length > 0 && items.length <= 5 && items.every((item) => ALLOWED_SUBJECTS[track]?.has(item));

export const createProfileChangeRequest = async (req, res) => {
  try {
    const { requestedTrack, requestedSubjects, reason, transactionId, receiptProof } = req.body;
    if (!TRACKS.has(requestedTrack) || !validSubjects(requestedTrack, requestedSubjects) || !String(reason || "").trim()) return res.status(400).json({ error: "Provide a valid requested field, subjects, and reason." });
    if (!transactionId?.trim() && !receiptProof) return res.status(400).json({ error: "Add a transaction ID or payment receipt." });
    const user = await prisma.user.findUnique({ where: { id: req.auth.id }, select: { academicTrack: true, academicSubjects: true } });
    if (!user?.academicTrack) return res.status(400).json({ error: "Create your academic profile before requesting a change." });
    const request = await prisma.profileChangeRequest.create({ data: { userId: req.auth.id, currentTrack: user.academicTrack, currentSubjects: user.academicSubjects, requestedTrack, requestedSubjects: [...new Set(requestedSubjects)], reason: reason.trim(), transactionId: transactionId?.trim() || null, receiptProof: receiptProof || null } });
    res.status(201).json({ message: "Change request submitted for payment verification.", request });
  } catch (error) { console.error("Create profile change request:", error); res.status(500).json({ error: "Unable to submit your change request." }); }
};

export const getMyProfileChangeRequests = async (req, res) => {
  const requests = await prisma.profileChangeRequest.findMany({ where: { userId: req.auth.id }, include: { audits: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } });
  res.json(requests);
};

export const listProfileChangeRequests = async (_req, res) => {
  const requests = await prisma.profileChangeRequest.findMany({ include: { user: { select: { id: true, name: true, email: true, cnic: true, academicTrack: true, academicSubjects: true } }, audits: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } });
  res.json(requests);
};

export const reviewProfileChangeRequest = async (req, res) => {
  try {
    const { status, adminReason, adminSecretCode } = req.body;
    if (!["Under review", "Approved", "Rejected", "Applied"].includes(status)) return res.status(400).json({ error: "Invalid request status." });
    if (status === "Rejected" && !String(adminReason || "").trim()) return res.status(400).json({ error: "Provide a rejection reason for the student." });
    const admin = await prisma.admin.findUnique({ where: { id: req.adminAuth.id }, select: { id: true, name: true, email: true, secretHash: true } });
    if (!admin) return res.status(403).json({ error: "Administrator account not found." });
    if (!adminSecretCode || !(await bcrypt.compare(String(adminSecretCode).trim().toUpperCase(), admin.secretHash))) return res.status(403).json({ error: "Invalid admin secret code." });
    const request = await prisma.profileChangeRequest.findUnique({ where: { id: req.params.requestId }, include: { user: true } });
    if (!request) return res.status(404).json({ error: "Change request not found." });
    if (request.status === "Applied") return res.status(409).json({ error: "This request has already been applied." });
    if (status === "Applied" && request.status !== "Approved") return res.status(409).json({ error: "Approve the request before applying the profile update." });
    const data = { status, adminReason: adminReason?.trim() || null, reviewedByAdminId: admin.id, reviewedByName: admin.name, reviewedAt: new Date() };
    if (status === "Applied") {
      await prisma.user.update({ where: { id: request.userId }, data: { academicTrack: request.requestedTrack, academicSubjects: request.requestedSubjects } });
      data.appliedAt = new Date();
      const transporter = process.env.EMAIL_USER && process.env.EMAIL_PASS ? nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }) : null;
      if (transporter) await transporter.sendMail({ from: process.env.EMAIL_USER, to: request.user.email, subject: "Congratulations — your academic profile change is complete", html: `<p>Hi ${request.user.name},</p><p>Congratulations! Your request has been fulfilled. Your academic field is now <strong>${request.requestedTrack}</strong>.</p><p>You can now continue with your updated personalised tests and Content Library.</p>` });
    }
    const updated = await prisma.profileChangeRequest.update({ where: { id: request.id }, data });
    if (status === "Applied") await prisma.loginMessage.create({ data: { recipientEmail: request.user.email, recipientRole: "student", body: `Your academic profile change to ${request.requestedTrack} has been applied.`, senderEmail: admin.email } });
    await prisma.profileChangeRequestAudit.create({ data: { requestId: request.id, action: status, note: data.adminReason, adminId: admin.id, adminName: admin.name } });
    res.json({ message: status === "Applied" ? "Profile updated and confirmation email sent." : "Request reviewed.", request: updated });
  } catch (error) { console.error("Review profile change request:", error); res.status(500).json({ error: "Unable to review this request." }); }
};
