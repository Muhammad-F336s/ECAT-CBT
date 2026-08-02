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

dotenv.config();

const app = express();

// Trust proxy if deployed behind Vercel, Render, or Cloudflare
app.set("trust proxy", 1);

const corsOrigin = process.env.CLIENT_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((o) => o.trim()),
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
app.use("/api/test", testRoutes);
app.use("/api/user", userRoutes);
app.use("/api/resources", resourceRoutes);

app.get("/api/health", (req, res) => {
  res
    .status(200)
    .json({ status: "active", engine: "Prisma Neon Fully Operational" });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`🚀 Core engine listening on port ${PORT}`);
});
