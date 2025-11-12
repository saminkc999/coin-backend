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
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}
function toDate(d) {
  const v = new Date(d);
  return isNaN(v.getTime()) ? undefined : v;
}

/**
 * POST /api/game-entries
 * Body (single or batch):
 *  Single:
 *   {
 *     type: "freeplay" | "deposit" | "redeem",
 *     playerName: string,
 *     gameName?: string,
 *     method?: "cashapp"|"paypal"|"chime"|"venmo", // for deposit/redeem only
 *     amountBase?: number,  // user input (preferred)
 *     amount?: number,      // fallback if amountBase missing
 *     bonusRate?: number,   // % (applies only for deposit)
 *     note?: string,
 *     date?: ISO string
 *   }
 *  Batch (optional):
 *   {
 *     ...same fields... but instead of gameName, send:
 *     gameNames: string[]
 *   }
 */
router.post("/", async (req, res) => {
  try {
    const {
      type,
      playerName,
      gameName,
      gameNames, // optional for batch
      method,
      note,
      amountBase,
      bonusRate,
      date,
    } = req.body;

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    if (!playerName || typeof playerName !== "string" || !playerName.trim()) {
      return res.status(400).json({ message: "playerName required" });
    }

    // method validation: only for money moves
    let normalizedMethod = undefined;
    if (type === "deposit" || type === "redeem") {
      if (method != null) {
        if (!ALLOWED_METHODS.includes(String(method))) {
          return res.status(400).json({ message: "Invalid method" });
        }
        normalizedMethod = String(method);
      }
    }

    const base = toNumber(amountBase ?? req.body.amount, NaN);
    if (!Number.isFinite(base) || base < 0) {
      return res.status(400).json({ message: "amount must be >= 0" });
    }

    const rate = Math.max(0, toNumber(bonusRate, 0));
    const isDeposit = type === "deposit";
    const computedBonus = isDeposit ? (base * rate) / 100 : 0;
    const finalAmount = isDeposit ? base + computedBonus : base;

    // Prepare one payload factory
    const mkDoc = (gName = "") => ({
      type,
      playerName: playerName.trim(),
      gameName: String(gName || "").trim(),
      method: normalizedMethod,
      amount: finalAmount,
      amountBase: base,
      bonusRate: isDeposit ? rate : 0,
      bonusAmount: isDeposit ? computedBonus : 0,
      amountFinal: finalAmount,
      note: note ? String(note) : "",
      date: date ? toDate(date) : undefined,
    });

    // Batch support: if gameNames[] provided, create many
    if (Array.isArray(gameNames) && gameNames.length > 0) {
      const docs = await GameEntry.insertMany(
        gameNames.map((n) => mkDoc(n)),
        { ordered: true }
      );
      return res.status(201).json({
        message: `Saved ${docs.length} entr${docs.length > 1 ? "ies" : "y"}`,
        entries: docs,
      });
    }

    // Single
    const doc = await GameEntry.create(mkDoc(gameName));
    return res.status(201).json({ message: "Entry saved", entry: doc });
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
