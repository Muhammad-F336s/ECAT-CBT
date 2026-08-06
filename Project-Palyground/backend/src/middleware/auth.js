import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../jwtSecret.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Authorization token is required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

export const requireSelfOrAdmin = (paramName = "userId") => (req, res, next) => {
  const targetId = req.params[paramName];
  if (!targetId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  if (req.auth.role === "admin" || req.auth.id === targetId) {
    return next();
  }

  return res.status(403).json({ error: "You can only access your own data." });
};
