import express from "express";
import {
  getUserAnalytics,
  listPendingUsers,
  listApprovedUsers,
  listStudents,
  approveUser,
  rejectUser,
  updateUserPackage,
} from "../controllers/userController.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// Dynamic route tracking parametric endpoint
router.get("/analytics/:userId", getUserAnalytics);
router.get("/pending-users", requireAdminAuth, listPendingUsers);
router.get("/approved-users", requireAdminAuth, listApprovedUsers);
router.get("/students", requireAdminAuth, listStudents);
router.post("/approve/:userId", requireAdminAuth, approveUser);
router.post("/update-package/:userId", requireAdminAuth, updateUserPackage);
router.delete("/reject/:userId", requireAdminAuth, rejectUser);

export default router;
