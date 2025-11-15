// api/routes/salaries.js
import express from "express";
import { connectDB } from "../config/db.js";
import Salary from "../models/Salary.js";

const router = express.Router();

// Ensure DB for all routes here
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connect (salaries) failed:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// helper
const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

/**
 * 🔹 GET /api/salaries
 * Optional query: username, month
 * Example:
 *   /api/salaries
 *   /api/salaries?username=ani
 *   /api/salaries?username=ani&month=2025-11
 */
router.get("/", async (req, res) => {
  try {
    const { username, month } = req.query;

    const filter = {};

    if (username && String(username).trim()) {
      filter.username = String(username).trim();
    }

    if (month && String(month).trim()) {
      filter.month = String(month).trim();
    }

    const docs = await Salary.find(filter)
      .sort({ month: -1, createdAt: -1 })
      .lean();

    res.json(docs);
  } catch (err) {
    console.error("❌ GET /api/salaries error:", err);
    res.status(500).json({ message: "Failed to load salaries" });
  }
});

/**
 * 🔹 POST /api/salaries
 * Body: { username, month, totalSalary, daysAbsent?, remainingSalary? }
 * If remainingSalary not given, it will default to totalSalary.
 * If a row for (username, month) exists, it is updated (upsert).
 */
router.post("/", async (req, res) => {
  try {
    const { username, month, totalSalary, daysAbsent, remainingSalary } =
      req.body;

    if (!username || !String(username).trim()) {
      return res.status(400).json({ message: "username is required" });
    }
    if (!month || !String(month).trim()) {
      return res.status(400).json({ message: "month is required (YYYY-MM)" });
    }

    const total = toNumber(totalSalary, NaN);
    if (!Number.isFinite(total) || total < 0) {
      return res.status(400).json({ message: "Invalid totalSalary" });
    }

    const absDays = toNumber(daysAbsent, 0);
    let remaining =
      remainingSalary != null ? toNumber(remainingSalary, 0) : total; // default: full salary remaining

    if (remaining < 0) remaining = 0;

    const doc = await Salary.findOneAndUpdate(
      { username: String(username).trim(), month: String(month).trim() },
      {
        username: String(username).trim(),
        month: String(month).trim(),
        totalSalary: total,
        daysAbsent: absDays,
        remainingSalary: remaining,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(doc);
  } catch (err) {
    console.error("❌ POST /api/salaries error:", err);
    res.status(500).json({ message: "Failed to save salary" });
  }
});

/**
 * 🔹 PUT /api/salaries/:id
 * Updates an existing salary row (totalSalary, daysAbsent, remainingSalary)
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { totalSalary, daysAbsent, remainingSalary } = req.body;

    const update = {};

    if (totalSalary !== undefined) {
      const total = toNumber(totalSalary, NaN);
      if (!Number.isFinite(total) || total < 0) {
        return res.status(400).json({ message: "Invalid totalSalary" });
      }
      update.totalSalary = total;
    }

    if (daysAbsent !== undefined) {
      const absDays = toNumber(daysAbsent, NaN);
      if (!Number.isFinite(absDays) || absDays < 0) {
        return res.status(400).json({ message: "Invalid daysAbsent" });
      }
      update.daysAbsent = absDays;
    }

    if (remainingSalary !== undefined) {
      let rem = toNumber(remainingSalary, NaN);
      if (!Number.isFinite(rem) || rem < 0) {
        return res.status(400).json({ message: "Invalid remainingSalary" });
      }
      update.remainingSalary = rem;
    }

    const doc = await Salary.findByIdAndUpdate(id, update, { new: true });

    if (!doc) {
      return res.status(404).json({ message: "Salary row not found" });
    }

    res.json(doc);
  } catch (err) {
    console.error("❌ PUT /api/salaries/:id error:", err);
    res.status(500).json({ message: "Failed to update salary" });
  }
});

/**
 * 🔹 DELETE /api/salaries/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await Salary.findByIdAndDelete(id).lean();

    if (!removed) {
      return res.status(404).json({ message: "Salary row not found" });
    }

    res.json({ ok: true, removed });
  } catch (err) {
    console.error("❌ DELETE /api/salaries/:id error:", err);
    res.status(500).json({ message: "Failed to delete salary" });
  }
});

export default router;
