import express from "express";
import { getUserAnalytics } from "../controllers/userController.js";

const router = express.Router();

// Dynamic route tracking parametric endpoint
router.get("/analytics/:userId", getUserAnalytics);

export default router;
