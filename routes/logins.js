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

  if (!username || typeof username !== "string") {
    return res.status(400).json({ message: "username is required" });
  }

  const session = await LoginSession.create({
    username,
    signInAt: signInAt ? new Date(signInAt) : new Date(),
  });

  res.status(201).json({
    _id: String(session._id),
    username: session.username,
    signInAt: session.signInAt.toISOString(),
    signOutAt: session.signOutAt ? session.signOutAt.toISOString() : null,
    createdAt: session.createdAt?.toISOString?.() ?? undefined,
    updatedAt: session.updatedAt?.toISOString?.() ?? undefined,
  });
});

/**
 * 🔴 POST /api/logins/end
 * Body: { sessionId, signOutAt }
 * Used by UserSessionBar when user clicks "Sign Out"
 */
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
      _id: String(session._id),
      username: session.username,
      signInAt: session.signInAt.toISOString(),
      signOutAt: session.signOutAt.toISOString(),
      createdAt: session.createdAt?.toISOString?.() ?? undefined,
      updatedAt: session.updatedAt?.toISOString?.() ?? undefined,
    });
  } catch (err) {
    console.error("Error in POST /api/logins/end:", err);
    res
      .status(500)
      .json({ message: "Failed to end session", error: err.message });
  }
});

/**
 * 🧾 GET /api/logins
 * Optional query: ?username=admin
 * Used by AdminUserActivityTable
 */
router.get("/", async (req, res) => {
  try {
    const { username } = req.query;

    const filter = {};
    if (username && typeof username === "string") {
      filter.username = username;
    }

    const sessions = await LoginSession.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    console.log("📜 /api/logins =>", filter, sessions.length);

    res.json(sessions);
  } catch (err) {
    console.error("Error in GET /api/logins:", err);
    res
      .status(500)
      .json({ message: "Failed to load sessions", error: err.message });
  }
});
router.get("/start", async (req, res) => {
  const sessions = await LoginSession.find().sort({ createdAt: -1 }).lean();
  res.json(sessions);
});
export default router;
