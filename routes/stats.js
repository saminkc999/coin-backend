// api/routes/stats.js
import express from "express";
import { connectDB } from "../config/db.js";
import UserActivity from "../models/UserActivity.js";

const router = express.Router();

const RANGE_DAYS = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

// GET /api/stats/game-coins?range=day|week|month|year
router.get("/stats/game-coins", async (req, res) => {
  const range = String(req.query.range || "week").toLowerCase();
  const days = RANGE_DAYS[range] || RANGE_DAYS.week;

  try {
    await connectDB();

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - (days - 1));

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            gameId: "$gameId",
            gameName: "$gameName",
          },
          freeplay: { $sum: "$freeplay" },
          redeem: { $sum: "$redeem" },
          deposit: { $sum: "$deposit" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          gameId: "$_id.gameId",
          gameName: "$_id.gameName",
          coinsEarned: "$freeplay",
          coinsSpent: "$redeem",
          coinsRecharged: "$deposit",
        },
      },
      { $sort: { date: 1, gameName: 1 } },
    ];

    const stats = await UserActivity.aggregate(pipeline);

    return res.json({ stats });
  } catch (err) {
    console.error("GET /api/stats/game-coins error:", err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
});

export default router;
