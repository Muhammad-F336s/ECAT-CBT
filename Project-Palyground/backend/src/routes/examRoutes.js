import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { getOnboardingData, setUserInterests } from "../controllers/examController.js";

const router = express.Router();

router.get("/onboarding-data", requireAuth, getOnboardingData);
router.post("/set-interests", requireAuth, setUserInterests);

export default router;
