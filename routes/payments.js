// api/routes/payments.js
import express from "express";
import { nanoid } from "nanoid";

import { connectDB } from "../config/db.js";
import Payment from "../models/Payment.js";
import { validMethods } from "../utils/numbers.js";
import { computeTotals } from "../utils/totals.js";

const router = express.Router();

// 🧾 GET /api/payments?date=YYYY-MM-DD (optional filter)
router.get("/payments", async (req, res) => {
  const { date } = req.query;

  try {
    await connectDB();

    const query = date ? { date: String(date) } : {};
    const payments = await Payment.find(query).sort({ createdAt: -1 }).lean();

    res.json(payments);
  } catch (err) {
    console.error("GET /api/payments error:", err);
    res.status(500).json({ message: "Failed to load payments" });
  }
});

// GET /api/payments/cashout — only cashout records
router.get("/payments/cashout", async (_req, res) => {
  try {
    await connectDB();

    // Find only cashout transactions, newest first
    const cashouts = await Payment.find({ txType: "cashout" })
      .sort({ createdAt: -1 })
      .lean();

    res.json(cashouts);
  } catch (err) {
    console.error("GET /api/payments/cashout error:", err);
    res.status(500).json({ message: "Failed to load cashout payments" });
  }
});

// 💰 GET /api/totals
router.get("/totals", async (_req, res) => {
  try {
    const totals = await computeTotals();
    res.json(totals);
  } catch (err) {
    console.error("GET /api/totals error:", err);
    res.status(500).json({ message: "Failed to compute totals" });
  }
});

// ✅ CASH IN: POST /api/payments/cashin
// body: { amount, method, note?, playerName?, date? }
router.post("/payments/cashin", async (req, res) => {
  const { amount, method, note, playerName, date } = req.body;
  const amt = Number(amount);

  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: "Invalid method" });
  }

  // date: YYYY-MM-DD
  let paymentDate;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    paymentDate = date;
  } else {
    paymentDate = new Date().toISOString().slice(0, 10);
  }

  try {
    await connectDB();

    const payment = await Payment.create({
      id: nanoid(),
      amount: Math.round(amt * 100) / 100,
      method,
      txType: "cashin",
      note: note?.trim() || null,
      // 👇 now stored for cashin
      playerName: playerName?.trim() || null,
      date: paymentDate,
    });

    const totals = await computeTotals();

    res.status(201).json({
      ok: true,
      payment,
      totals,
    });
  } catch (err) {
    console.error("POST /api/payments/cashin error:", err);
    res.status(500).json({ message: "Failed to create cash-in payment" });
  }
});

// 🚪 CASH OUT: POST /api/payments/cashout
// body: { amount, method, playerName, totalPaid?, totalCashout?, date? }
router.post("/payments/cashout", async (req, res) => {
  const { amount, method, playerName, totalPaid, totalCashout, date } = req.body;
  const amt = Number(amount);

  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: "Invalid method" });
  }
  if (!playerName || typeof playerName !== "string") {
    return res.status(400).json({ message: "playerName is required" });
  }

  let paymentDate;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    paymentDate = date;
  } else {
    paymentDate = new Date().toISOString().slice(0, 10);
  }

  // normalize totals if provided
  const tPaid =
    totalPaid !== undefined && totalPaid !== null
      ? Number(totalPaid)
      : undefined;
  const tCashout =
    totalCashout !== undefined && totalCashout !== null
      ? Number(totalCashout)
      : undefined;

  if (tPaid !== undefined && (!Number.isFinite(tPaid) || tPaid < 0)) {
    return res.status(400).json({ message: "Invalid totalPaid" });
  }
  if (tCashout !== undefined && (!Number.isFinite(tCashout) || tCashout < 0)) {
    return res.status(400).json({ message: "Invalid totalCashout" });
  }

  try {
    await connectDB();

    const payment = await Payment.create({
      id: nanoid(),
      amount: Math.round(amt * 100) / 100,
      method,
      txType: "cashout",
      note: null,
      playerName: playerName.trim(),
      totalPaid:
        tPaid !== undefined ? Math.round(tPaid * 100) / 100 : undefined,
      totalCashout:
        tCashout !== undefined ? Math.round(tCashout * 100) / 100 : undefined,
      date: paymentDate,
    });

    const totals = await computeTotals();

    res.status(201).json({
      ok: true,
      payment,
      totals,
    });
  } catch (err) {
    console.error("POST /api/payments/cashout error:", err);
    res.status(500).json({ message: "Failed to create cash-out payment" });
  }
});

// ♻️ POST /api/reset
router.post("/reset", async (_req, res) => {
  try {
    await connectDB();
    await Payment.deleteMany({});
    const totals = { cashapp: 0, paypal: 0, chime: 0 };

    res.json({ ok: true, totals });
  } catch (err) {
    console.error("POST /api/reset error:", err);
    res.status(500).json({ message: "Failed to reset payments" });
  }
});

// 🔄 POST /api/recalc
router.post("/recalc", async (_req, res) => {
  try {
    const totals = await computeTotals();
    res.json({ ok: true, totals });
  } catch (err) {
    console.error("POST /api/recalc error:", err);
    res.status(500).json({ message: "Failed to recalc totals" });
  }
});

// ✏️ PUT /api/payments/:id (edit payment)
router.put("/payments/:id", async (req, res) => {
  const { id } = req.params;
  const {
    amount,
    method,
    note,
    playerName,
    date,
    txType,
    totalPaid,
    totalCashout,
  } = req.body;

  try {
    await connectDB();

    const payment = await Payment.findOne({ id });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // amount
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      payment.amount = Math.round(amt * 100) / 100;
    }

    // method
    if (method !== undefined) {
      if (!validMethods.includes(method)) {
        return res.status(400).json({ message: "Invalid method" });
      }
      payment.method = method;
    }

    // txType
    if (txType !== undefined) {
      payment.txType = txType === "cashout" ? "cashout" : "cashin";
    }

    // date
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      payment.date = date;
    }

    // note & playerName
    if (note !== undefined) {
      payment.note = note?.trim() || null;
    }
    if (playerName !== undefined) {
      payment.playerName = playerName?.trim() || null;
    }

    // totalPaid
    if (totalPaid !== undefined) {
      const tPaid = Number(totalPaid);
      if (!Number.isFinite(tPaid) || tPaid < 0) {
        return res.status(400).json({ message: "Invalid totalPaid" });
      }
      payment.totalPaid = Math.round(tPaid * 100) / 100;
    }

    // totalCashout
    if (totalCashout !== undefined) {
      const tCashout = Number(totalCashout);
      if (!Number.isFinite(tCashout) || tCashout < 0) {
        return res.status(400).json({ message: "Invalid totalCashout" });
      }
      payment.totalCashout = Math.round(tCashout * 100) / 100;
    }

    await payment.save();

    const totals = await computeTotals();

    res.json({
      ok: true,
      payment,
      totals,
    });
  } catch (err) {
    console.error("PUT /api/payments/:id error:", err);
    res.status(500).json({ message: "Failed to update payment" });
  }
});

// 🗑️ DELETE /api/payments/:id
router.delete("/payments/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await connectDB();

    const removed = await Payment.findOneAndDelete({ id }).lean();
    if (!removed) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const totals = await computeTotals();

    res.json({
      ok: true,
      removed,
      totals,
    });
  } catch (err) {
    console.error("DELETE /api/payments/:id error:", err);
    res.status(500).json({ message: "Failed to delete payment" });
  }
});

// 🔁 Unified recharge endpoint used by your new PaymentForm
// body: { amount, method, txType, note?, playerName?, totalPaid?, totalCashout?, date? }
router.post("/recharge", async (req, res) => {
  try {
    const {
      amount,
      method,
      txType,
      note,
      playerName,
      totalPaid,
      totalCashout,
      date,
    } = req.body;

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

    const normalizedType = txType === "cashout" ? "cashout" : "cashin";

    // keep same date format: YYYY-MM-DD string
    let paymentDate;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      paymentDate = date;
    } else {
      paymentDate = new Date().toISOString().slice(0, 10);
    }

    const tPaid =
      totalPaid !== undefined && totalPaid !== null
        ? Number(totalPaid)
        : undefined;
    const tCashout =
      totalCashout !== undefined && totalCashout !== null
        ? Number(totalCashout)
        : undefined;

    if (tPaid !== undefined && (!Number.isFinite(tPaid) || tPaid < 0)) {
      return res.status(400).json({ message: "Invalid totalPaid" });
    }
    if (tCashout !== undefined && (!Number.isFinite(tCashout) || tCashout < 0)) {
      return res.status(400).json({ message: "Invalid totalCashout" });
    }

    await connectDB();

    const payload = {
      id: nanoid(),
      amount: Math.round(amt * 100) / 100,
      method,
      txType: normalizedType,
      note: note?.trim() || null,
      playerName:
        normalizedType === "cashin" ? playerName?.trim() || null : null,
      date: paymentDate,
    };

    if (normalizedType === "cashout") {
      if (tPaid !== undefined) {
        payload.totalPaid = Math.round(tPaid * 100) / 100;
      }
      if (tCashout !== undefined) {
        payload.totalCashout = Math.round(tCashout * 100) / 100;
      }
    }

    const payment = await Payment.create(payload);
    const totals = await computeTotals();

    res.status(201).json({ ok: true, payment, totals });
  } catch (err) {
    console.error("Error in POST /api/payments/recharge:", err);
    res.status(500).json({ message: "Failed to create payment" });
  }
});

export default router;
