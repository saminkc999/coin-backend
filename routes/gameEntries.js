// api/routes/gameEntries.js
import express from "express";
import { connectDB } from "../config/db.js";
import GameEntry from "../models/GameEntry.js";

const router = express.Router();

const ALLOWED_TYPES = ["freeplay", "deposit", "redeem"];

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

// helpers
function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}
function toDate(d) {
  const v = new Date(d);
  return isNaN(v.getTime()) ? undefined : v;
}

/**
 * POST /api/game-entries
 * Body (from frontend):
 * {
 *   type: "freeplay" | "deposit" | "redeem",
 *   playerName: string,
 *   gameName?: string,
 *   amount: number,            // client’s final amount (ignored in favor of server calc)
 *   note?: string,
 *   amountBase?: number,       // user input
 *   bonusRate?: number,        // % (only applies for deposit)
 *   bonusAmount?: number,      // client calc (ignored; we recompute)
 *   amountFinal?: number,      // client calc (ignored; we recompute)
 *   date?: ISO string
 * }
 */
router.post("/", async (req, res) => {
  try {
    const { type, playerName, gameName, note, amountBase, bonusRate, date } =
      req.body;

    // validate type
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    // validate playerName
    if (!playerName || typeof playerName !== "string" || !playerName.trim()) {
      return res.status(400).json({ message: "playerName required" });
    }

    // parse numbers
    const base = toNumber(amountBase ?? req.body.amount, NaN);
    if (!Number.isFinite(base) || base < 0) {
      return res.status(400).json({ message: "amount must be >= 0" });
    }

    const rate = Math.max(0, toNumber(bonusRate, 0));

    // compute bonus server-side (only for deposits)
    const computedBonus = type === "deposit" ? (base * rate) / 100 : 0;
    const finalAmount = type === "deposit" ? base + computedBonus : base;

    const doc = await GameEntry.create({
      type,
      playerName: playerName.trim(),
      gameName: (gameName || "").trim(),
      // store both final and breakdown (amount mirrors final for consistency)
      amount: finalAmount,
      amountBase: base,
      bonusRate: type === "deposit" ? rate : 0,
      bonusAmount: type === "deposit" ? computedBonus : 0,
      amountFinal: finalAmount,
      note: note ? String(note) : "",
      date: date ? toDate(date) : undefined,
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
router.get("/", async (req, res) => {
  try {
    const { playerName, type, from, to, limit } = req.query;

    const filter = {};
    if (playerName) filter.playerName = String(playerName);

    if (type && ALLOWED_TYPES.includes(String(type))) {
      filter.type = String(type);
    }

    if (from || to) {
      const fromDate = from ? toDate(String(from)) : undefined;
      const toDate = to ? toDate(String(to)) : undefined;

      if (fromDate || toDate) {
        filter.date = {};
        if (fromDate) filter.date.$gte = fromDate;
        if (toDate) filter.date.$lte = toDate;
      }
    }

    const lim = Math.min(toNumber(limit, 30), 200);

    const docs = await GameEntry.find(filter)
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();

    res.json(docs);
  } catch (err) {
    console.error("❌ GET /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to load entries" });
  }
});

export default router;
