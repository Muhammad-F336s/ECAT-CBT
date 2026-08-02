import jwt from "jsonwebtoken";

export const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Admin authorization token is required." });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "super_secret_fallback_key_123",
    );

    if (payload.role !== "admin") {
      return res.status(403).json({ error: "Admin access is required." });
    }

    req.adminAuth = payload;
    return next();
  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(401).json({ error: "Invalid or expired admin token." });
  }
};
