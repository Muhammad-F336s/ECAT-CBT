import express from "express";
import {
  getUserAnalytics,
  updateProfile,
  listPendingUsers,
  listApprovedUsers,
  listStudents,
  approveUser,
  approveDemoUser,
  reviveDemoUser,
  rejectUser,
  updateUserPackage,
  getMe,
  createSupportTicket,
  getUserTickets,
  replyToTicket,
  markTicketRead,
  startAcademicProfile,
  saveAcademicProfile,
} from "../controllers/userController.js";
import { createProfileChangeRequest, getMyProfileChangeRequests, getOrCreateProfileChangeChallan } from "../controllers/profileChangeController.js";
import { handleVectorBotChat } from "../controllers/vectorBotController.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";
import { requireAuth, requireSelfOrAdmin } from "../middleware/auth.js";
import { requireActivePackage } from "../middleware/requireActivePackage.js";

const router = express.Router();

// ─── Auth-only routes (no package needed) ────────────────────────────────────
router.get("/me", requireAuth, getMe);
router.patch("/profile", requireAuth, updateProfile);
router.post("/academic-profile/start", requireAuth, startAcademicProfile);
router.put("/academic-profile", requireAuth, saveAcademicProfile);
router.post("/profile-change-requests", requireAuth, createProfileChangeRequest);
router.get("/profile-change-requests", requireAuth, getMyProfileChangeRequests);
router.get("/profile-change-challan", requireAuth, getOrCreateProfileChangeChallan);
router.post("/support/ticket", requireAuth, createSupportTicket);
router.get("/support/tickets", requireAuth, getUserTickets);
router.post("/support/tickets/:id/reply", requireAuth, replyToTicket);
router.patch("/support/tickets/:id/mark-read", requireAuth, markTicketRead);

// ─── Protected: Requires active package ──────────────────────────────────────
router.post("/vector-bot/chat", requireAuth, requireActivePackage, handleVectorBotChat);
router.get("/analytics/:userId", requireAuth, requireSelfOrAdmin("userId"), requireActivePackage, getUserAnalytics);

// ─── Admin-only routes ────────────────────────────────────────────────────────
router.get("/pending-users", requireAdminAuth, listPendingUsers);
router.get("/approved-users", requireAdminAuth, listApprovedUsers);
router.get("/students", requireAdminAuth, listStudents);
router.post("/approve/:userId", requireAdminAuth, approveUser);
router.post("/approve-demo/:userId", requireAdminAuth, approveDemoUser);
router.post("/revive-demo/:userId", requireAdminAuth, reviveDemoUser);
router.post("/update-package/:userId", requireAdminAuth, updateUserPackage);
router.delete("/reject/:userId", requireAdminAuth, rejectUser);

export default router;
