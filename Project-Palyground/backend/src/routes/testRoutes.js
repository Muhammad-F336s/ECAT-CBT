import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireActivePackage, requireTestAttempts } from "../middleware/requireActivePackage.js";
import { generateTest, submitTest, getTestResult, getContentLibrary, generateChapterPractice, getRecentAttempts } from "../controllers/testController.js";
import { getSyllabusMetadata } from "../controllers/syllabusController.js";

const router = express.Router();

// All test routes require valid JWT
router.use(requireAuth);

// ─── Metadata (no entitlement needed — student needs this to pick subjects) ─
router.get("/syllabus-metadata", getSyllabusMetadata);

// ─── Recent attempts (needs auth only — not entitlement; student can see history even if expired) ─
router.get("/recent-attempts", getRecentAttempts);

// ─── Protected: Active package required ─────────────────────────────────────
router.get("/content-library", requireActivePackage, getContentLibrary);

// ─── Protected: Active package + remaining attempts required ────────────────
router.post("/generate", requireActivePackage, requireTestAttempts, generateTest);
router.post("/generate-chapter-practice", requireActivePackage, requireTestAttempts, generateChapterPractice);

// ─── Submit test (auth only — attempt deduction happens inside submitTest) ──
router.post("/submit", submitTest);

// ─── View result (auth only — expired students can still review old results) ─
router.get("/result/:attemptId", getTestResult);

export default router;
