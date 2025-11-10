// api/routes/logins.js
import express from "express";
import { connectDB } from "../config/db.js";
import LoginHistory from "../models/LoginHistory.js";

const router = express.Router();

// Ensure DB connection for all routes in this router
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
 * GET /api/logins/all
 * Used by AdminLoginTable: returns normalized login records
 */
router.get("/all", async (_req, res) => {
  try {
    const logs = await LoginHistory.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const mapped = logs.map((log) => ({
      _id: String(log._id),
      userEmail: log.userEmail || log.email || "",
      userName: log.userName || "",
      loginTime: log.loginTime || log.loggedInAt || log.createdAt || null,
      logoutTime: log.logoutTime || log.loggedOutAt || null,
      createdAt: log.createdAt || null,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Failed to fetch login history:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch login records", error: err.message });
  }
});

/**
 * POST /api/logins/start
 * Create a new login record when user successfully logs in
 * Body: { userEmail, userName }
 */
router.post("/start", async (req, res) => {
  try {
    const { userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res
        .status(400)
        .json({ message: "userEmail and userName are required" });
    }

    const login = await LoginHistory.create({
      userEmail,
      userName,
      loginTime: new Date(),
    });

    res.status(201).json(login.toJSON());
  } catch (err) {
    console.error("Error creating login record:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * POST /api/logins/end
 * Optional: mark logout time for a session
 * Body: { sessionId }
 */
router.post("/end", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const session = await LoginHistory.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    session.logoutTime = new Date();
    await session.save();

    res.json(session.toJSON());
  } catch (err) {
    console.error("Error updating logout time:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /api/logins
 * Simple recent raw records
 */
router.get("/", async (_req, res) => {
  try {
    const records = await LoginHistory.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(records);
  } catch (err) {
    console.error("Failed to load records:", err);
    res
      .status(500)
      .json({ message: "Failed to load records", error: err.message });
  }
});

export default router;
