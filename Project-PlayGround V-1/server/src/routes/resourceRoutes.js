import express from "express";
import {
  getResources,
  createResourceGroup,
  deleteResourceGroup,
  addResourceFile,
  deleteResourceFile,
  addResourceItem,
  deleteResourceItem,
} from "../controllers/resourceController.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Fetching material resources is accessible by both students & admin
router.get("/", requireAuth, getResources);

// All mutation endpoints require Admin clearance
router.post("/groups", requireAdminAuth, createResourceGroup);
router.delete("/groups/:groupId", requireAdminAuth, deleteResourceGroup);
router.post("/groups/:groupId/files", requireAdminAuth, addResourceFile);
router.delete("/files/:fileId", requireAdminAuth, deleteResourceFile);
router.post("/groups/:groupId/items", requireAdminAuth, addResourceItem);
router.delete("/items/:itemId", requireAdminAuth, deleteResourceItem);

export default router;
