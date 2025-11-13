// api/routes/gameEntries.js
import express from "express";
import { connectDB } from "../config/db.js";
import GameEntry from "../models/GameEntry.js";

const router = express.Router();

const ALLOWED_TYPES = ["freeplay", "deposit", "redeem"];
const ALLOWED_METHODS = ["cashapp", "paypal", "chime", "venmo"];

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
  if (n === undefined || n === null || n === "") return def;
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

// Normalize any date input to "YYYY-MM-DD" string (or undefined)
function normalizeDateString(d) {
  if (!d) return undefined;
  if (typeof d === "string") {
    // already "YYYY-MM-DD" or ISO -> just slice first 10
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
      return d.slice(0, 10);
    }
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return undefined;
  return dt.toISOString().slice(0, 10);
}

/**
 * 🟢 POST /api/game-entries
 * Body (per game, matches GameEntryForm.tsx):
 * {
 *   type: "freeplay" | "deposit" | "redeem",
 *   method?: "cashapp" | "paypal" | "chime" | "venmo",
 *   username: string,
 *   createdBy?: string,
 *   playerName: string,
 *   gameName: string,
 *   amountBase: number,
 *   bonusRate?: number,
 *   bonusAmount?: number,
 *   amountFinal: number,
 *   amount?: number,
 *   note?: string,
 *   date?: string | Date,
 *   totalPaid?: number,
 *   totalCashout?: number,
 *   remainingPay?: number
 * }
 */
router.post("/", async (req, res) => {
  try {
    const {
      type,
      method,
      username,
      createdBy,
      playerName,
      gameName,

      amountBase,
      amount, // optional raw
      bonusRate,
      bonusAmount,
      amountFinal,

      note,
      date,

      totalPaid,
      totalCashout,
      remainingPay,
    } = req.body;

    // basic validations
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ message: "username is required" });
    }

    if (!playerName || typeof playerName !== "string" || !playerName.trim()) {
      return res.status(400).json({ message: "playerName is required" });
    }

    if (!gameName || typeof gameName !== "string" || !gameName.trim()) {
      return res.status(400).json({ message: "gameName is required" });
    }

    // method validation for deposit/redeem
    let normalizedMethod = undefined;
    if (type === "deposit" || type === "redeem") {
      if (!method) {
        return res.status(400).json({ message: "method is required" });
      }
      if (!ALLOWED_METHODS.includes(String(method))) {
        return res.status(400).json({ message: "Invalid method" });
      }
      normalizedMethod = String(method);
    }

    const base = toNumber(amountBase ?? amount, NaN);
    if (!Number.isFinite(base) || base < 0) {
      return res
        .status(400)
        .json({ message: "amountBase / amount must be >= 0" });
    }

    const rate = Math.max(0, toNumber(bonusRate, 0));
    const bonus = Math.max(0, toNumber(bonusAmount, 0));
    const finalAmount = toNumber(
      amountFinal,
      // fallback if not sent or 0
      base + (type === "deposit" ? (base * rate) / 100 : 0)
    );

    const doc = await GameEntry.create({
      type,
      method: normalizedMethod,

      username: username.trim(),
      createdBy: (createdBy || username).trim(),

      playerName: playerName.trim(),
      gameName: String(gameName).trim(),

      amountBase: base,
      bonusRate: type === "deposit" ? rate : 0,
      bonusAmount: type === "deposit" ? bonus : 0,
      amountFinal: finalAmount,

      amount: toNumber(amount, undefined),

      note: note ? String(note) : "",

      date: normalizeDateString(date),

      totalPaid: toNumber(totalPaid, 0),
      totalCashout: toNumber(totalCashout, 0),
      remainingPay: toNumber(remainingPay, 0),
    });

    return res.status(201).json({ message: "Entry saved", entry: doc });
  } catch (err) {
    console.error("❌ POST /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to save entry" });
  }
});

/**
 * 🟢 GET /api/game-entries
 * Query (optional): playerName, type, from, to, limit
 * - date filters work on "YYYY-MM-DD" strings
 */
// ...
router.get("/", async (req, res) => {
  try {
    const { playerName, type, from, to, limit, username } = req.query;

    const filter = {};

    if (username) filter.username = String(username); // 👈 NEW

    if (playerName) filter.playerName = String(playerName);
    if (type && ALLOWED_TYPES.includes(String(type))) {
      filter.type = String(type);
    }

    const fromStr = normalizeDateString(from);
    const toStr = normalizeDateString(to);

    if (fromStr || toStr) {
      filter.date = {};
      if (fromStr) filter.date.$gte = fromStr;
      if (toStr) filter.date.$lte = toStr;
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
