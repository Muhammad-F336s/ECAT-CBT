import express from "express";
import {
  createLoginMessage,
  deleteAdmin,
  getInboxMessages,
  listAdmins,
  listLoginMessages,
  listRecipients,
  regenerateAdminSecret,
  updateAdmin,
  getPlatformAnalytics,
  getSettings,
  updateSettings,
  getPlatformTickets,
  updateTicketStatus,
  impersonateUser,
  getNotificationCounts,
  markMessagesAsRead,
  deleteTicket,
  deleteLoginMessage,
} from "../controllers/adminController.js";
import {
  getSubjectsAndChapters,
  createSubject,
  createChapter,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  listPendingQuestions,
  approveQuestion,
  approveAllVerifiedQuestions,
  getApprovedQuestionsGrouped,
} from "../controllers/adminQuestionController.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

router.use(requireAdminAuth);

router.get("/admins", listAdmins);
router.patch("/admins/:adminId", updateAdmin);
router.post("/admins/:adminId/secret", regenerateAdminSecret);
router.delete("/admins/:adminId", deleteAdmin);
router.get("/recipients", listRecipients);
router.get("/messages", listLoginMessages);
router.post("/messages", createLoginMessage);
router.get("/messages/inbox", getInboxMessages);
router.get("/analytics", getPlatformAnalytics);
router.get("/settings", getSettings);
router.patch("/settings", updateSettings);
router.get("/support/tickets", getPlatformTickets);
router.patch("/support/tickets/:ticketId", updateTicketStatus);
router.delete("/support/tickets/:ticketId", deleteTicket);
router.post("/impersonate", impersonateUser);
router.get("/notifications/counts", getNotificationCounts);
router.post("/messages/mark-read", markMessagesAsRead);
router.delete("/messages/:id", deleteLoginMessage);



// Subject, Chapter & Question CRUD Router Links
router.get("/subjects", getSubjectsAndChapters);
router.post("/subjects", createSubject);
router.post("/chapters", createChapter);
router.get("/questions", listQuestions);
router.get("/questions/pending", listPendingQuestions);
router.get("/questions/approved-grouped", getApprovedQuestionsGrouped);
router.post("/questions/batch-approve-verified", approveAllVerifiedQuestions);
router.post("/questions/:questionId/approve", approveQuestion);
router.post("/questions", createQuestion);
router.put("/questions/:questionId", updateQuestion);
router.delete("/questions/:questionId", deleteQuestion);

export default router;
