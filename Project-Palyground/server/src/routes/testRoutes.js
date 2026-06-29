import express from "express";
import { generateTest, submitTest } from "../controllers/testController.js";

const router = express.Router();

router.post("/generate", generateTest);
router.post("/submit", submitTest); // Bound submission route

export default router;
