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
} from "../controllers/userController.js";
import { handleVectorBotChat } from "../controllers/vectorBotController.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";
import { requireAuth, requireSelfOrAdmin } from "../middleware/auth.js";

const router = express.Router();

// Dynamic route tracking parametric endpoint
router.get("/me", requireAuth, getMe);
router.post("/vector-bot/chat", requireAuth, handleVectorBotChat);
router.get("/analytics/:userId", requireAuth, requireSelfOrAdmin("userId"), getUserAnalytics);
router.patch("/profile", requireAuth, updateProfile);
router.post("/support/ticket", requireAuth, createSupportTicket);
router.get("/support/tickets", requireAuth, getUserTickets);
router.post("/support/tickets/:id/reply", requireAuth, replyToTicket);
router.patch("/support/tickets/:id/mark-read", requireAuth, markTicketRead);
router.get("/pending-users", requireAdminAuth, listPendingUsers);
router.get("/approved-users", requireAdminAuth, listApprovedUsers);
router.get("/students", requireAdminAuth, listStudents);
router.post("/approve/:userId", requireAdminAuth, approveUser);
router.post("/approve-demo/:userId", requireAdminAuth, approveDemoUser);
router.post("/revive-demo/:userId", requireAdminAuth, reviveDemoUser);
router.post("/update-package/:userId", requireAdminAuth, updateUserPackage);
router.delete("/reject/:userId", requireAdminAuth, rejectUser);

export default router;
