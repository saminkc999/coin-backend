// api/routes/logins.js
import express from "express";
import { connectDB } from "../config/db.js";
import LoginSession from "../models/LoginSession.js";

const router = express.Router();

/**
 * Ensure DB connection for all routes in this router
 */
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
 * Body: { username, signInAt? }
 * Used by UserSessionBar when user clicks "Sign In"
 */
router.post("/start", async (req, res) => {
  try {
    const { username, signInAt } = req.body;

    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const session = await LoginSession.create({
      username,
      signInAt: signInAt ? new Date(signInAt) : new Date(),
    });

    return res.status(201).json({
      id: String(session._id),
      username: session.username,
      signInAt: session.signInAt.toISOString(),
    });
  } catch (err) {
    console.error("Error in POST /api/logins/start:", err);
    return res
      .status(500)
      .json({ message: "Failed to start session", error: err.message });
  }
});

/**
 * 🔴 POST /api/logins/end
 * Body: { sessionId, signOutAt? }
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
      id: String(session._id),
      username: session.username,
      signOutAt: session.signOutAt.toISOString(),
    });
  } catch (err) {
    console.error("Error in POST /api/logins/end:", err);
    res
      .status(500)
      .json({ message: "Failed to end session", error: err.message });
  }
});

/**
 * 📜 GET /api/logins
 * See last 50 sessions – useful for admin / debugging
 *
 * NOTE: This assumes you mounted it as:
 *   app.use("/api/logins", loginRoutes);
 * So this handler is GET /api/logins (not /api/logins/logins).
 */
router.get("/", async (_req, res) => {
  try {
    const sessions = await LoginSession.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(sessions);
  } catch (err) {
    console.error("Error in GET /api/logins:", err);
    res
      .status(500)
      .json({ message: "Failed to load sessions", error: err.message });
  }
});

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

    // 🔢 Update cumulative totals for the game
    // freeplay & deposit subtract, redeem adds → handled in model's pre("save")
    game.coinsEarned = safeNum(game.coinsEarned) + freeplay; // freeplay
    game.coinsSpent = safeNum(game.coinsSpent) + redeem; // redeem
    game.coinsRecharged = safeNum(game.coinsRecharged) + deposit; // deposit

    // Optionally track last recharge date when deposit happens
    if (deposit > 0) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      game.lastRechargeDate = `${yyyy}-${mm}-${dd}`;
    }

    // totalCoins will be recalculated in GameSchema.pre("save")
    await game.save();

    // 🧾 Log user activity for this action
    if (freeplay || redeem || deposit) {
      await UserActivity.create({
        username,
        gameId: game.id,
        gameName: game.name,
        freeplay, // this action's freeplay
        redeem, // this action's redeem
        deposit, // this action's deposit
        freeplayTotal:
          typeof freeplayTotal === "number" ? freeplayTotal : undefined,
        redeemTotal: typeof redeemTotal === "number" ? redeemTotal : undefined,
        depositTotal:
          typeof depositTotal === "number" ? depositTotal : undefined,
      });
    }

    // send updated game back (includes totalCoins)
    return res.json(game);
  } catch (err) {
    console.error("POST /api/games/:id/add-moves error:", err);
    return res.status(500).json({ message: "Failed to update game moves" });
  }
});

export default router;
