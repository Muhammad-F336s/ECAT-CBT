import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { generateTest, submitTest, getTestResult } from "../controllers/testController.js";
import { getSyllabusMetadata } from "../controllers/syllabusController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/syllabus-metadata", getSyllabusMetadata);
router.post("/generate", generateTest);
router.post("/submit", submitTest);
router.get("/result/:attemptId", getTestResult);

export default router;
