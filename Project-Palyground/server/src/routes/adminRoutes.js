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
} from "../controllers/adminController.js";
import {
  getSubjectsAndChapters,
  createSubject,
  createChapter,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
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

// Subject, Chapter & Question CRUD Router Links
router.get("/subjects", getSubjectsAndChapters);
router.post("/subjects", createSubject);
router.post("/chapters", createChapter);
router.get("/questions", listQuestions);
router.post("/questions", createQuestion);
router.put("/questions/:questionId", updateQuestion);
router.delete("/questions/:questionId", deleteQuestion);

export default router;
