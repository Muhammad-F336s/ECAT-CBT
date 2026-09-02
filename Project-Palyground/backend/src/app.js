import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import adminTestRoutes from "./routes/adminTestRoutes.js";

dotenv.config();

// ---- CORS origin: must be explicitly configured in production ----
const isProduction = process.env.NODE_ENV === "production";
const corsOriginRaw = process.env.CLIENT_ORIGIN;

if (isProduction && !corsOriginRaw) {
  throw new Error(
    "[FATAL] CLIENT_ORIGIN environment variable is not set in production. " +
      "Set it to your frontend URL, e.g. CLIENT_ORIGIN=https://your-app.vercel.app"
  );
}

// Dev fallback is safe — only localhost is allowed when env is absent
const corsOrigins = corsOriginRaw
  ? corsOriginRaw.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

const app = express();

// Trust proxy only in production (behind Vercel/Render/Cloudflare)
// In dev, this is off so X-Forwarded-For cannot be spoofed to bypass rate limiting
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Security Headers
app.use(helmet());

// Global Rate Limiting: 1000 requests per 15 minutes per IP (Allows for background polling)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Too many requests from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);
app.use(express.json());

// Main App API Routes Mount Points
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin-tests", adminTestRoutes);
app.use("/api/test", testRoutes);
app.use("/api/user", userRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/exams", examRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "active", engine: "Prisma Neon Fully Operational" });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`🚀 Core engine listening on port ${PORT}`);
});
