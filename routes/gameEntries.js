// api/routes/gameEntries.js
import express from "express";
import { connectDB } from "../config/db.js";
import GameEntry, {
  ALLOWED_TYPES,
  ALLOWED_METHODS,
} from "../models/GameEntry.js";

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
 *
 *   // EITHER:
 *   //   - Our tag flow:     playerName (required), playerTag optional
 *   //   - Player tag flow:  playerTag (required),  playerName optional
 *   playerName?: string,
 *   playerTag?: string,
 *
 *   gameName: string,
 *   amountBase: number,
 *   bonusRate?: number,
 *   bonusAmount?: number,
 *   amountFinal: number,
 *   amount?: number,
 *   note?: string,
 *   date?: string | Date,
 *
 *   // Redeem / credit tracking (our tag flow)
 *   totalPaid?: number,
 *   totalCashout?: number,
 *   remainingPay?: number,
 *   isPending?: boolean,
 *
 *   // Player tag flow
 *   reduction?: number,  // amountBase - totalCashout
 *   extraMoney?: number  // for player-tag extra money
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
      playerTag,

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
      isPending,
      reduction,
      extraMoney,
    } = req.body;

    // basic validations
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ message: "username is required" });
    }

    // ✅ Allow either playerName OR playerTag
    const hasPlayerName =
      typeof playerName === "string" && playerName.trim().length > 0;
    const hasPlayerTag =
      typeof playerTag === "string" && playerTag.trim().length > 0;

    if (!hasPlayerName && !hasPlayerTag) {
      return res.status(400).json({
        message: "Either playerName or playerTag is required",
      });
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
      base + (type === "deposit" ? (base * rate) / 100 : 0)
    );

    // normalize totals
    const totalCashoutNum = toNumber(totalCashout, 0);
    const remainingPayNum = toNumber(remainingPay, 0);
    const totalPaidNum = toNumber(totalPaid, 0);

    // 🔻 For player-tag flow: reduction = amountBase - totalCashout (if not provided)
    const reductionNum = toNumber(
      reduction,
      Math.max(0, base - totalCashoutNum)
    );

    const extraMoneyNum = toNumber(extraMoney, 0);

    const doc = await GameEntry.create({
      type,
      method: normalizedMethod,

      username: username.trim(),
      createdBy: (createdBy || username).trim(),

      // keep both; schema allows playerName optional, playerTag optional
      playerName: hasPlayerName ? playerName.trim() : "",
      playerTag: hasPlayerTag ? playerTag.trim() : "",

      gameName: String(gameName).trim(),

      amountBase: base,
      bonusRate: type === "deposit" ? rate : 0,
      bonusAmount: type === "deposit" ? bonus : 0,
      amountFinal: finalAmount,

      amount: toNumber(amount, undefined),

      note: note ? String(note) : "",

      date: normalizeDateString(date),

      totalPaid: totalPaidNum,
      totalCashout: totalCashoutNum,
      remainingPay: remainingPayNum,

      // our-tag redeem pending flag
      isPending: type === "redeem" ? Boolean(isPending) : false,

      // player-tag reduction
      reduction: reductionNum,

      // player-tag extra money
      extraMoney: extraMoneyNum,
    });

    return res.status(201).json({ message: "Entry saved", entry: doc });
  } catch (err) {
    console.error("❌ POST /api/game-entries error:", err);

    // Surface Mongoose validation problems as 400 with details
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: "Failed to save entry" });
  }
});

/**
 * 🟢 GET /api/game-entries/pending-by-tag
 * Query: playerTag (required), username (optional)
 *
 * Used by PLAYER TAG mode:
 * - finds the latest redeem for this tag with remainingPay > 0
 * - returns remainingPay so frontend can auto-fill cost amount
 *
 * Example:
 *   GET /api/game-entries/pending-by-tag?playerTag=@saga&username=ani
 */
router.get("/pending-by-tag", async (req, res) => {
  try {
    let { playerTag, username } = req.query;

    if (!playerTag || !String(playerTag).trim()) {
      return res.status(400).json({ message: "playerTag is required" });
    }

    const tag = String(playerTag).trim();

    const filter = {
      playerTag: tag,
      type: "redeem",
      // only still pending ones
      remainingPay: { $gt: 0 },
    };

    // optionally scope by username (if you want per-admin/user separation)
    if (username && String(username).trim()) {
      filter.username = String(username).trim();
    }

    const doc = await GameEntry.findOne(filter).sort({ createdAt: -1 }).lean();

    if (!doc) {
      return res
        .status(404)
        .json({ message: "No pending redeem found for this player tag" });
    }

    res.json({
      playerTag: tag,
      username: doc.username,
      gameName: doc.gameName ?? null,
      remainingPay: doc.remainingPay ?? 0,
      totalCashout: doc.totalCashout ?? 0,
      totalPaid: doc.totalPaid ?? 0,
      entryId: doc._id,
      createdAt: doc.createdAt,
      date: doc.date,
    });
  } catch (err) {
    console.error("❌ GET /api/game-entries/pending-by-tag error:", err);
    res.status(500).json({ message: "Failed to lookup player tag" });
  }
});

/* ---------------------------------------
   🟢 GET /api/game-entries/pending
   ALL pending payments:

   Our-tag redeem:
     - type = "redeem"
     - remainingPay > 0
     - (optional) isPending = true

   Player-tag deposit:
     - type = "deposit"
     - playerTag != ""
     - reduction > 0

   Optional query:
     ?username=ani  → filter only that user’s entries
---------------------------------------- */
router.get("/pending", async (req, res) => {
  try {
    const { username } = req.query;

    const query = {
      $or: [
        // our-tag pending redeems
        {
          type: "redeem",
          remainingPay: { $gt: 0 },
        },
        // player-tag deposits with reduction
        {
          type: "deposit",
          playerTag: { $ne: "" },
          reduction: { $gt: 0 },
        },
      ],
    };

    if (username && String(username).trim()) {
      query.username = String(username).trim();
    }

    const docs = await GameEntry.find(query).sort({ createdAt: -1 }).lean();

    return res.json(docs);
  } catch (err) {
    console.error("❌ GET /api/game-entries/pending error:", err);
    res.status(500).json({ message: "Failed to load pending entries" });
  }
});

/**
 * 🟢 GET /api/game-entries
 * Query (optional): username, playerName, playerTag, type, from, to, limit
 * - date filters work on "YYYY-MM-DD" strings
 */
router.get("/", async (req, res) => {
  try {
    let { playerName, playerTag, type, from, to, limit, username } = req.query;

    const filter = {};

    // ✅ normalize username (handles ?username=&username=ani)
    let normalizedUsername;
    if (Array.isArray(username)) {
      normalizedUsername = username
        .map((u) => String(u).trim())
        .filter(Boolean) // drop empties
        .pop(); // last non-empty, e.g. "ani"
    } else if (typeof username === "string") {
      normalizedUsername = username.trim();
    }

    if (normalizedUsername) {
      filter.username = normalizedUsername;
    }

    if (playerName) {
      filter.playerName = String(playerName).trim();
    }

    // allow filtering by playerTag
    if (playerTag) {
      filter.playerTag = String(playerTag).trim();
    }

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
/**
 * 🟢 PATCH /api/game-entries/:id/clear-pending
 *
 * Used when a pending entry is fully cleared.
 *
 * - For our-tag redeem:
 *     type = "redeem"
 *     → set remainingPay = 0
 *     → bump totalPaid (if you want)
 *     → isPending = false
 *
 * - For player-tag deposit:
 *     type = "deposit" & playerTag != ""
 *     → set reduction = 0
 *
 * Optional body:
 *   {
 *     totalPaid?: number,   // override final totalPaid for redeem
 *     reduction?: number    // override reduction for player-tag (usually 0)
 *   }
 */
router.patch("/:id/clear-pending", async (req, res) => {
  try {
    const { id } = req.params;
    const { totalPaid, reduction } = req.body || {};

    const entry = await GameEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    const update = {};

    // 🔹 our-tag redeem flow
    if (entry.type === "redeem") {
      const currentPaid = toNumber(entry.totalPaid, 0);
      const currentRemaining = toNumber(entry.remainingPay, 0);

      // if frontend sends a specific totalPaid, use it; otherwise auto-add remaining
      const incomingPaid = toNumber(totalPaid, NaN);
      const newTotalPaid = Number.isFinite(incomingPaid)
        ? incomingPaid
        : currentPaid + currentRemaining;

      update.totalPaid = newTotalPaid;
      update.remainingPay = 0;
      update.isPending = false;
    }

    // 🔹 player-tag deposit flow (clear reduction)
    if (entry.type === "deposit" && entry.playerTag) {
      const newReduction = toNumber(reduction, 0); // usually 0
      update.reduction = newReduction;
    }

    const updated = await GameEntry.findByIdAndUpdate(id, update, {
      new: true,
    }).lean();

    return res.json({ message: "Pending cleared", entry: updated });
  } catch (err) {
    console.error("❌ PATCH /api/game-entries/:id/clear-pending error:", err);
    res.status(500).json({ message: "Failed to clear pending" });
  }
});

export default router;
