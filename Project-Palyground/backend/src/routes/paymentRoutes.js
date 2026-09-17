import express from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth.js";
import { handleReceiptUpload } from "../middleware/receiptUpload.js";
import { JWT_SECRET } from "../jwtSecret.js";
import {
  getPackages,
  getBankDetails,
  generateChallan,
  downloadChallanPdf,
  getActiveChallan,
  submitReceipt,
  getPaymentHistory,
  getReceiptFile,
  cancelChallan,
} from "../controllers/paymentController.js";

const router = express.Router();

/**
 * Optional authentication helper: attaches req.auth if a valid Bearer token is passed,
 * but allows unauthenticated access if no token is present.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token) {
    try {
      req.auth = jwt.verify(token, JWT_SECRET);
    } catch {
      // Invalid token, ignore and proceed as guest
    }
  }
  next();
};

// Public / Guest accessible
router.get("/packages", optionalAuth, getPackages);
router.get("/bank-details", getBankDetails);

// Authenticated student routes
router.post("/generate-challan", requireAuth, generateChallan);
router.get("/active-challan", requireAuth, getActiveChallan);
router.get("/challan/:orderId/pdf", requireAuth, downloadChallanPdf);
router.post("/cancel-challan/:orderId", requireAuth, cancelChallan);
router.delete("/challan/:orderId", requireAuth, cancelChallan);
router.post("/submit-receipt", requireAuth, handleReceiptUpload, submitReceipt);
router.get("/history", requireAuth, getPaymentHistory);
router.get("/receipt-file/:orderId", requireAuth, getReceiptFile);

export default router;
