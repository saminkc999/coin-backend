// api/routes/games.js
import express from "express";
import { connectDB } from "../config/db.js";
import Game from "../models/Game.js";
import UserActivity from "../models/UserActivity.js";
import { safeNum } from "../utils/numbers.js";

const router = express.Router();

/**
 * NOTE:
 * If you mount this router as:
 *   app.use("/api", gameRoutes)
 * then these routes will be:
 *   GET    /api/games
 *   POST   /api/games
 *   PUT    /api/games/:id
 *   DELETE /api/games/:id
 *   POST   /api/games/:id/add-moves
 */

// GET /api/games
router.get("/games", async (_, res) => {
  try {
    await connectDB();
    const games = await Game.find({}).sort({ createdAt: 1 }).lean();
    res.json(games);
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

    const newGame = await Game.create({
      id: Date.now(), // numeric id used by frontend
      name,
      coinsSpent,
      coinsEarned,
      coinsRecharged,
      // totalCoins will be auto-calculated in GameSchema.pre("save")
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
    // totalCoins is intentionally ignored; model recalculates it
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

    // totalCoins will be recalculated in pre("save")
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

// POST /api/games/:id/add-moves  (increment-only for user actions)
router.post("/games/:id/add-moves", async (req, res) => {
  const { id } = req.params;
  const {
    freeplayDelta = 0, // coinsEarned +
    redeemDelta = 0, // coinsSpent +
    depositDelta = 0, // coinsRecharged +
    // totalCoins is NOT trusted from frontend anymore
    username = "Unknown User",
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

    // Update game totals (history)
    game.coinsEarned = safeNum(game.coinsEarned) + freeplay;
    game.coinsSpent = safeNum(game.coinsSpent) + redeem;
    game.coinsRecharged = safeNum(game.coinsRecharged) + deposit;

    // If there's a deposit, update lastRechargeDate as "YYYY-MM-DD"
    if (deposit > 0) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      game.lastRechargeDate = `${yyyy}-${mm}-${dd}`;
    }

    // totalCoins will be recalculated in GameSchema.pre("save")
    await game.save();

    // Log user activity for charts
    if (freeplay || redeem || deposit) {
      await UserActivity.create({
        username,
        gameId: game.id,
        gameName: game.name,
        freeplay,
        redeem,
        deposit,
      });
    }

    return res.json(game);
  } catch (err) {
    console.error("POST /api/games/:id/add-moves error:", err);
    return res.status(500).json({ message: "Failed to update game moves" });
  }
});

export default router;
