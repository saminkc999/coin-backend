// api/routes/games.js
import express from "express";
import { connectDB } from "../config/db.js";
import Game from "../models/Game.js";
import UserActivity from "../models/UserActivity.js";
import { safeNum } from "../utils/numbers.js";

// 👇 NEW: game entries model (create this file if you don't have it yet)
import GameEntry, {
  ENTRY_TYPES,
  METHODS as ENTRY_METHODS,
} from "../models/GameEntry.js";

const router = express.Router();

const ALLOWED_ENTRY_TYPES = ENTRY_TYPES || ["freeplay", "deposit", "redeem"];
const ALLOWED_METHODS = ENTRY_METHODS || [
  "cashapp",
  "paypal",
  "chime",
  "venmo",
];

// small helpers
const toNumber = (n, def = 0) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
};
const toISODateOrNull = (d) => {
  if (!d) return null;
  const v = new Date(d);
  if (Number.isNaN(v.getTime())) return null;
  return v.toISOString();
};
const toYMD = (d) => {
  const iso = toISODateOrNull(d) || new Date().toISOString();
  return iso.slice(0, 10); // "YYYY-MM-DD"
};

/**
 * NOTE:
 * If you mount this router as:
 *   app.use("/api", gameRoutes)
 * then these routes will be:
 *   GET    /api/games            -> with ?q= returns string[] (names), else Game[]
 *   POST   /api/games
 *   PUT    /api/games/:id
 *   DELETE /api/games/:id
 *   POST   /api/games/:id/add-moves
 */

// GET /api/games  (names suggest when ?q= provided; else full list)
router.get("/games", async (req, res) => {
  try {
    await connectDB();

    const q = (req.query.q || "").toString().trim();

    // If typing query exists -> return distinct names for autocomplete
    if (q) {
      const filter = { name: { $regex: q, $options: "i" } };
      const names = await Game.distinct("name", filter);
      const sorted = names
        .filter((n) => typeof n === "string" && n.trim().length > 0)
        .sort((a, b) => a.localeCompare(b));
      return res.json(sorted); // string[]
    }

    // No query -> return full game docs for admin tables, etc.
    const games = await Game.find({}).sort({ createdAt: 1 }).lean();
    return res.json(games); // Game[]
  } catch (err) {
    console.error("GET /api/games error:", err);
    res.status(500).json({ message: "Failed to load games" });
  }
});

// POST /api/games  (create new game)
router.post("/games", async (req, res) => {
  const {
    name,
    coinsSpent = 0,
    coinsEarned = 0,
    coinsRecharged = 0,
  } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Game name is required" });
  }

  try {
    await connectDB();

    // Optional: prevent duplicate names (comment out if you allow duplicates)
    const exists = await Game.findOne({ name }).lean();
    if (exists) {
      return res
        .status(409)
        .json({ message: "Game with this name already exists" });
    }

    const newGame = await Game.create({
      id: Date.now(), // numeric id used by frontend
      name,
      coinsSpent,
      coinsEarned,
      coinsRecharged,
      // totalCoins recalculated in GameSchema.pre("save")
    });

    res.status(201).json(newGame);
  } catch (err) {
    console.error("POST /api/games error:", err);
    res.status(500).json({ message: "Failed to create game" });
  }
});

// PUT /api/games/:id  (absolute totals update)
router.put("/games/:id", async (req, res) => {
  const { id } = req.params;
  const {
    coinsSpent,
    coinsEarned,
    coinsRecharged,
    lastRechargeDate,
    // totalCoins is recalculated in pre("save")
  } = req.body;

  try {
    await connectDB();

    const game = await Game.findOne({ id: Number(id) });
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (typeof coinsSpent === "number") game.coinsSpent = coinsSpent;
    if (typeof coinsEarned === "number") game.coinsEarned = coinsEarned;
    if (typeof coinsRecharged === "number")
      game.coinsRecharged = coinsRecharged;

    if (lastRechargeDate !== undefined) {
      game.lastRechargeDate = lastRechargeDate;
    }

    await game.save();
    res.json(game);
  } catch (err) {
    console.error("PUT /api/games/:id error:", err);
    res.status(500).json({ message: "Failed to update game" });
  }
});

// DELETE /api/games/:id
router.delete("/games/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await connectDB();

    const result = await Game.findOneAndDelete({ id: Number(id) }).lean();
    if (!result) return res.status(404).json({ message: "Game not found" });

    res.json(result);
  } catch (err) {
    console.error("DELETE /api/games/:id error:", err);
    res.status(500).json({ message: "Failed to delete game" });
  }
});

// POST /api/games/:id/add-moves
router.post("/games/:id/add-moves", async (req, res) => {
  const { id } = req.params;
  const {
    freeplayDelta = 0,
    redeemDelta = 0,
    depositDelta = 0,
    username = "Unknown User",
    freeplayTotal,
    redeemTotal,
    depositTotal,
  } = req.body;

  try {
    await connectDB();

    const game = await Game.findOne({ id: Number(id) });
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const freeplay = safeNum(freeplayDelta);
    const redeem = safeNum(redeemDelta);
    const deposit = safeNum(depositDelta);

    // Update cumulative totals
    game.coinsEarned = safeNum(game.coinsEarned) + freeplay; // freeplay
    game.coinsSpent = safeNum(game.coinsSpent) + redeem; // redeem
    game.coinsRecharged = safeNum(game.coinsRecharged) + deposit; // deposit

    // Update last recharge date on deposit
    if (deposit > 0) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      game.lastRechargeDate = `${yyyy}-${mm}-${dd}`;
    }

    await game.save();

    // Log user activity
    if (freeplay || redeem || deposit) {
      await UserActivity.create({
        username,
        gameId: game.id,
        gameName: game.name,
        freeplay,
        redeem,
        deposit,
        freeplayTotal:
          typeof freeplayTotal === "number" ? freeplayTotal : undefined,
        redeemTotal: typeof redeemTotal === "number" ? redeemTotal : undefined,
        depositTotal:
          typeof depositTotal === "number" ? depositTotal : undefined,
      });
    }

    return res.json(game);
  } catch (err) {
    console.error("POST /api/games/:id/add-moves error:", err);
    return res.status(500).json({ message: "Failed to update game moves" });
  }
});

// ✅ FIXED: POST /api/games/:id/reset-recharge
router.post("/games/:id/reset-recharge", async (req, res) => {
  const { id } = req.params;

  try {
    await connectDB();

    const game = await Game.findOneAndUpdate(
      { id: Number(id) },
      { $set: { coinsRecharged: 0, lastRechargeDate: null } },
      { new: true }
    ).lean();

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json(game);
  } catch (err) {
    console.error("POST /api/games/:id/reset-recharge error:", err);
    res.status(500).json({ message: "Failed to reset recharge" });
  }
});

/* ------------------------------------------------------------------
 *  GAME ENTRIES (freeplay / deposit / redeem with method)
 *  Used by GameEntryForm: POST /api/game-entries
 * ------------------------------------------------------------------*/

// POST /api/game-entries
router.post("/game-entries", async (req, res) => {
  try {
    await connectDB();

    const {
      type,
      method,
      playerName,
      gameName,
      amountBase,
      bonusRate,
      bonusAmount,
      amountFinal,
      note,
      date,
    } = req.body;

    // validate type
    if (!ALLOWED_ENTRY_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    if (!playerName || !gameName) {
      return res
        .status(400)
        .json({ message: "playerName and gameName are required" });
    }

    // method is required for deposit/redeem
    if (type === "deposit" || type === "redeem") {
      if (!method) {
        return res
          .status(400)
          .json({ message: "method is required for deposit/redeem" });
      }
      if (!ALLOWED_METHODS.includes(method)) {
        return res.status(400).json({ message: "Invalid method" });
      }
    }

    const base = toNumber(amountBase);
    const bonusR = toNumber(bonusRate);
    const bonusAmt = toNumber(bonusAmount);
    const finalAmt = toNumber(amountFinal || base + bonusAmt, 0);
    const ymd = toYMD(date);

    const doc = await GameEntry.create({
      type,
      method: type === "freeplay" ? undefined : method,
      playerName: String(playerName).trim(),
      gameName: String(gameName).trim(),
      amountBase: base,
      bonusRate: bonusR,
      bonusAmount: bonusAmt,
      amountFinal: finalAmt,
      amount: finalAmt, // keep a direct amount field too if you like
      note: note ? String(note).trim() : "",
      date: ymd,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("POST /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to save game entry" });
  }
});

// GET /api/game-entries  (for tables, history, etc.)
router.get("/game-entries", async (req, res) => {
  try {
    await connectDB();

    // you can later add filters: ?playerName= & ?type= & ?date=
    const entries = await GameEntry.find({}).sort({ createdAt: -1 }).lean();

    res.json(entries);
  } catch (err) {
    console.error("GET /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to load game entries" });
  }
});

export default router;
