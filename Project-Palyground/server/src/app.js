import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import userRoutes from "./routes/userRoutes.js"; // Added profile user route

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Main App API Routes Mount Points
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/test", testRoutes);
app.use("/api/user", userRoutes); // Mounted user paths

app.get("/api/health", (req, res) => {
  res
    .status(200)
    .json({ status: "active", engine: "Prisma Neon Fully Operational" });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`🚀 Core engine listening on port ${PORT}`);
});
