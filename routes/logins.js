// api/routes/logins.js
import express from "express";
import { connectDB } from "../config/db.js";
import LoginSession from "../models/LoginSession.js";

const router = express.Router();

// Ensure DB connection for all routes
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connection error in logins:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

/**
 * 🟢 POST /api/logins/start
 * Body: { username, signInAt }
 * Used by UserSessionBar when user clicks "Sign In"
 */
router.post("/start", async (req, res) => {
  const { username, signInAt } = req.body;
  const session = await LoginSession.create({
    username,
    signInAt: signInAt ? new Date(signInAt) : new Date(),
  });
  res.status(201).json({
    id: String(session._id),
    signInAt: session.signInAt.toISOString(),
  });
});

/**
 * 🔴 POST /api/logins/end
 * Body: { sessionId, signOutAt }
 * Used by UserSessionBar when user clicks "Sign Out"
 */
// POST /api/logins/end
router.post("/end", async (req, res) => {
  try {
    const { sessionId, signOutAt } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const session = await LoginSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    session.signOutAt = signOutAt ? new Date(signOutAt) : new Date();
    await session.save();

    return res.json({
      message: "Session ended successfully",
      id: String(session._id),
      signOutAt: session.signOutAt.toISOString(),
    });
  } catch (err) {
    console.error("Error in POST /api/logins/end:", err);
    res
      .status(500)
      .json({ message: "Failed to end session", error: err.message });
  }
});

/**
 * (Optional) GET /api/logins
 * See last 50 sessions – useful for admin / debugging
 */
router.get("/logins", async (_req, res) => {
  try {
    const sessions = await LoginSession.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(sessions);
  } catch (err) {
    console.error("Error in GET /api/logins:", err);
    res
      .status(500)
      .json({ message: "Failed to load sessions", error: err.message });
  }
});

export default router;
