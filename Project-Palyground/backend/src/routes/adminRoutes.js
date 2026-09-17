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
  resetAllTestAttempts,
  exportPlatformData,
  getPlatformTickets,
  updateTicketStatus,
  impersonateUser,
  getNotificationCounts,
  markMessagesAsRead,
  deleteTicket,
  deleteLoginMessage,
  unlockAiConfiguration,
  getAiConfiguration,
  listGroqModels,
  updateAiConfiguration,
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
import { listProfileChangeRequests, reviewProfileChangeRequest } from "../controllers/profileChangeController.js";
import {
  listPackages,
  getPackageDetails,
  updatePackageDetails,
  updatePackagePrice,
  togglePackageActive,
  setRecommendedPackage,
} from "../controllers/adminPackageController.js";
import {
  getFeaturesList,
  submitPackageChangeRequest,
  listChangeRequests,
  approvePackageChange,
  rejectPackageChange,
} from "../controllers/adminPackageChangeController.js";
import {
  listPaymentOrders,
  getPaymentPendingCounts,
  getPaymentOrderDetail,
  markUnderReview,
  verifyPaymentOrder,
  rejectPaymentOrder,
  manualPackageGrant,
  discardPaymentOrders,
} from "../controllers/adminPaymentController.js";
import {
  getBankSettings,
  requestBankChange,
  approveBankChange,
  cancelBankChange,
  cancelAllPendingBankRequests,
} from "../controllers/adminBankSettingsController.js";

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
router.get("/bank-settings", getBankSettings);
router.post("/bank-settings/request-change", requestBankChange);
router.post("/bank-settings/approve-change", approveBankChange);
router.post("/bank-settings/cancel-change", cancelBankChange);
router.post("/bank-settings/cancel-all", cancelAllPendingBankRequests);
router.post("/ai/unlock", unlockAiConfiguration);
router.get("/ai/config", getAiConfiguration);
router.get("/ai/models", listGroqModels);
router.patch("/ai/config", updateAiConfiguration);
router.post("/danger/reset-attempts", resetAllTestAttempts);
router.get("/danger/export-data", exportPlatformData);
router.get("/support/tickets", getPlatformTickets);
router.patch("/support/tickets/:ticketId", updateTicketStatus);
router.delete("/support/tickets/:ticketId", deleteTicket);
router.post("/impersonate", impersonateUser);
router.get("/notifications/counts", getNotificationCounts);
router.post("/messages/mark-read", markMessagesAsRead);
router.delete("/messages/:id", deleteLoginMessage);
router.get("/profile-change-requests", listProfileChangeRequests);
router.patch("/profile-change-requests/:requestId", reviewProfileChangeRequest);

// ─── Package Catalog Management ──────────────────────────────────────────────
router.get("/packages", listPackages);
router.get("/packages/:code", getPackageDetails);
router.put("/packages/:code", updatePackageDetails);
router.patch("/packages/:code/price", updatePackagePrice);
router.patch("/packages/:code/toggle", togglePackageActive);
router.patch("/packages/:code/recommended", setRecommendedPackage);

// ─── Package Change Requests (Root Admin Approval Flow) ──────────────────────
router.get("/package-changes/features-list", getFeaturesList);
router.get("/package-changes/requests", listChangeRequests);
router.post("/package-changes/submit", submitPackageChangeRequest);
router.post("/package-changes/:id/approve", approvePackageChange);
router.post("/package-changes/:id/reject", rejectPackageChange);

// ─── Admin Payment Management ─────────────────────────────────────────────────
router.get("/payments/pending-count", getPaymentPendingCounts);
router.get("/payments", listPaymentOrders);
router.get("/payments/:orderId", getPaymentOrderDetail);
router.post("/payments/:orderId/mark-under-review", markUnderReview);
router.post("/payments/:orderId/verify", verifyPaymentOrder);
router.post("/payments/:orderId/reject", rejectPaymentOrder);
router.patch("/students/:userId/package", manualPackageGrant);
router.post("/payments/discard", discardPaymentOrders);

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
