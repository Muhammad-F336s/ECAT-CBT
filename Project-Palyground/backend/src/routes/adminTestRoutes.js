import express from "express";
import {
  getAllTestsAdmin,
  createTest,
  updateTest,
  deleteTest,
  getUniversities,
  createUniversity,
  updateUniversity,
  deleteUniversity,
  pauseUniversity,
  resumeUniversity,
  analyzeAndSavePattern,
} from "../controllers/adminTestController.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

router.use(requireAdminAuth);

// Universities
router.get("/universities", getUniversities);
router.post("/universities", createUniversity);
router.put("/universities/:id", updateUniversity);
router.delete("/universities/:id", deleteUniversity);
router.patch("/universities/:id/pause", pauseUniversity);
router.patch("/universities/:id/resume", resumeUniversity);

// Tests
router.get("/", getAllTestsAdmin);
router.post("/", createTest);
router.put("/:id", updateTest);
router.delete("/:id", deleteTest);

// Pattern
router.post("/:id/pattern", analyzeAndSavePattern);

export default router;
