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
 * Optional:
 *   ?username=admin   -> filter by username
 *   ?latest=1         -> only latest session (per username filter)
 * Used by AdminUserActivityTable
 */
router.get("/", async (req, res) => {
  try {
    const { username, latest } = req.query;

    const filter = {};
    if (username && typeof username === "string") {
      filter.username = username;
    }

    let query = LoginSession.find(filter).sort({ signInAt: -1 });

    // If latest=1, only return the most recent session
    if (latest === "1" || latest === "true") {
      query = query.limit(1);
    } else {
      query = query.limit(200);
    }

    const sessions = await query.lean();

    const formatted = sessions.map((s) => ({
      _id: String(s._id),
      username: s.username,
      signInAt: s.signInAt ? new Date(s.signInAt).toISOString() : null,
      signOutAt: s.signOutAt ? new Date(s.signOutAt).toISOString() : null,
      createdAt:
        s.createdAt && s.createdAt.toISOString
          ? s.createdAt.toISOString()
          : undefined,
      updatedAt:
        s.updatedAt && s.updatedAt.toISOString
          ? s.updatedAt.toISOString()
          : undefined,
    }));

    console.log(
      "📜 GET /api/logins => filter:",
      filter,
      "count:",
      formatted.length
    );

    res.json(formatted);
  } catch (err) {
    console.error("Error in GET /api/logins:", err);
    res
      .status(500)
      .json({ message: "Failed to load sessions", error: err.message });
  }
});
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const session = await LoginSession.findOne({ username })
      .sort({ signInAt: -1 }) // latest session
      .lean();

    if (!session) {
      return res
        .status(404)
        .json({ message: "No session found for this user" });
    }

    const formatted = {
      _id: String(session._id),
      username: session.username,
      signInAt: session.signInAt
        ? new Date(session.signInAt).toISOString()
        : null,
      signOutAt: session.signOutAt
        ? new Date(session.signOutAt).toISOString()
        : null,
      createdAt: session.createdAt?.toISOString?.() ?? undefined,
      updatedAt: session.updatedAt?.toISOString?.() ?? undefined,
    };

    res.json(formatted);
  } catch (err) {
    console.error("Error in GET /api/logins/:username:", err);
    res
      .status(500)
      .json({ message: "Failed to load user session", error: err.message });
  }
});

export default router;
