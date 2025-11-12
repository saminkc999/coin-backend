// api/routes/gameEntries.js
import express from "express";
import { connectDB } from "../config/db.js";
import GameEntry from "../models/GameEntry.js";

const router = express.Router();

// Ensure DB for all routes here
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connect (gameEntries) failed:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

/**
 * POST /api/game-entries
 * Body: { type, playerName, gameName?, amount, note?, date? }
 */
router.post("/game-entries", async (req, res) => {
  try {
    const { type, playerName, gameName, amount, note, date } = req.body;

    if (!type || !["freeplay", "deposit", "redeem", "bonus"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }
    if (!playerName || typeof playerName !== "string") {
      return res.status(400).json({ message: "playerName required" });
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) {
      return res.status(400).json({ message: "amount must be >= 0" });
    }

    const doc = await GameEntry.create({
      type,
      playerName: playerName.trim(),
      gameName: (gameName || "").trim(),
      amount: amt,
      note: note ? String(note) : "",
      date: date ? new Date(date) : undefined,
    });

    res.status(201).json({ message: "Entry saved", entry: doc });
  } catch (err) {
    console.error("❌ POST /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to save entry" });
  }
});

/**
 * GET /api/game-entries
 * Query (optional): playerName, type, from, to, limit
 */
router.get("/game-entries", async (req, res) => {
  try {
    const { playerName, type, from, to, limit } = req.query;

    const filter = {};
    if (playerName) filter.playerName = String(playerName);
    if (type && ["freeplay", "deposit", "redeem", "bonus"].includes(type)) {
      filter.type = type;
    }
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(String(from));
      if (to) filter.date.$lte = new Date(String(to));
    }

    const docs = await GameEntry.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 30, 200))
      .lean();

    res.json(docs);
  } catch (err) {
    console.error("❌ GET /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to load entries" });
  }
});

export default router;
