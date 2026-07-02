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

export default router;
