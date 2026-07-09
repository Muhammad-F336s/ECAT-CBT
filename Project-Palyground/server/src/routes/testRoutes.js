import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { generateTest, submitTest, getTestResult, getContentLibrary, generateChapterPractice } from "../controllers/testController.js";
import { getSyllabusMetadata } from "../controllers/syllabusController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/syllabus-metadata", getSyllabusMetadata);
router.get("/content-library", getContentLibrary);
router.post("/generate-chapter-practice", generateChapterPractice);
router.post("/generate", generateTest);
router.post("/submit", submitTest);
router.get("/result/:attemptId", getTestResult);

export default router;
