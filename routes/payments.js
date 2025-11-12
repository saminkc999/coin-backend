// api/routes/payments.js
import express from "express";
import { nanoid } from "nanoid";

import { connectDB } from "../config/db.js";
import Payment from "../models/Payment.js";
import { validMethods } from "../utils/numbers.js";
import { computeTotals } from "../utils/totals.js";

const router = express.Router();

/* ---------- Helpers ---------- */
const normalizeDate = (d) => {
  // Accept ISO or YYYY-MM-DD, fallback to today (YYYY-MM-DD)
  if (typeof d === "string" && d.length) {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }
  return new Date().toISOString().slice(0, 10);
};

const parseMoney = (v, { allowZero = false } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (!allowZero && n <= 0) return null;
  if (allowZero && n < 0) return null;
  return Math.round(n * 100) / 100;
};

/* ---------- Ensure DB for every route here ---------- */
router.use(async (_req, _res, next) => {
  try {
    await connectDB();
  } catch (e) {
    console.error("DB connect error (payments):", e);
  }
  next();
});

/* ---------- GET /api/payments?date=YYYY-MM-DD ---------- */
router.get("/payments", async (req, res) => {
  try {
    const { date } = req.query;
    const q = date ? { date: String(date) } : {};
    const payments = await Payment.find(q).sort({ createdAt: -1 }).lean();
    res.json(payments);
  } catch (err) {
    console.error("GET /api/payments error:", err);
    res.status(500).json({ message: "Failed to load payments" });
  }
});

/* ---------- GET /api/payments/cashout ---------- */
router.get("/payments/cashout", async (_req, res) => {
  try {
    const cashouts = await Payment.find({ txType: "cashout" })
      .sort({ createdAt: -1 })
      .lean();
    res.json(cashouts);
  } catch (err) {
    console.error("GET /api/payments/cashout error:", err);
    res.status(500).json({ message: "Failed to load cashout payments" });
  }
});

/* ---------- GET /api/totals ---------- */
router.get("/totals", async (_req, res) => {
  try {
    const totals = await computeTotals();
    res.json(totals);
  } catch (err) {
    console.error("GET /api/totals error:", err);
    res.status(500).json({ message: "Failed to compute totals" });
  }
});

/* ---------- POST /api/payments/cashin ---------- */
/* body: { amount, method, note?, playerName?, date? } */
// routes/payments.js  (cashin)
router.post("/payments/cashin", async (req, res) => {
  try {
    const { amount, method, note, playerName, date } = req.body;

    const amt = parseMoney(amount);
    if (amt === null)
      return res.status(400).json({ message: "Invalid amount" });

    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

    const payment = await Payment.create({
      id: nanoid(),
      amount: amt,
      method,
      txType: "cashin",
      note: typeof note === "string" ? note.trim() : "", // <-- no null
      playerName: typeof playerName === "string" ? playerName.trim() : "", // <-- no null
      date: date ? new Date(date) : new Date(), // Date is fine; pre('validate') sets dateString
    });
    const totals = await computeTotals();
    res.status(201).json({ ok: true, payment, totals });
  } catch (err) {
    console.error("POST /api/payments/cashin error:", err);
    const message = err?.message || "Failed to create cash-in payment";
    const details = err?.errors
      ? Object.fromEntries(
          Object.entries(err.errors).map(([k, v]) => [
            k,
            v?.message || String(v),
          ])
        )
      : undefined;
    return res.status(500).json({ message, details });
  }
});

/* ---------- POST /api/payments/cashout ---------- */
/* body: { amount, method, playerName, totalPaid?, totalCashout?, date? } */
router.post("/payments/cashout", async (req, res) => {
  try {
    const { amount, method, playerName, totalPaid, totalCashout, date } =
      req.body;

    const amt = parseMoney(amount);
    if (amt === null)
      return res.status(400).json({ message: "Invalid amount" });

    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

    if (!playerName || typeof playerName !== "string") {
      return res.status(400).json({ message: "playerName is required" });
    }

    const tPaid =
      totalPaid !== undefined
        ? parseMoney(totalPaid, { allowZero: true })
        : undefined;
    const tCashout =
      totalCashout !== undefined
        ? parseMoney(totalCashout, { allowZero: true })
        : undefined;

    if (totalPaid !== undefined && tPaid === null) {
      return res.status(400).json({ message: "Invalid totalPaid" });
    }
    if (totalCashout !== undefined && tCashout === null) {
      return res.status(400).json({ message: "Invalid totalCashout" });
    }

    const payment = await Payment.create({
      id: nanoid(),
      amount: amt,
      method,
      txType: "cashout",
      note: null,
      playerName: playerName.trim(),
      totalPaid: tPaid,
      totalCashout: tCashout,
      date: normalizeDate(date),
    });

    const totals = await computeTotals();
    res.status(201).json({ ok: true, payment, totals });
  } catch (err) {
    console.error("POST /api/payments/cashout error:", err);
    res.status(500).json({ message: "Failed to create cash-out payment" });
  }
});

/* ---------- POST /api/reset ---------- */
router.post("/reset", async (_req, res) => {
  try {
    await Payment.deleteMany({});
    const totals = { cashapp: 0, paypal: 0, chime: 0 };
    res.json({ ok: true, totals });
  } catch (err) {
    console.error("POST /api/reset error:", err);
    res.status(500).json({ message: "Failed to reset payments" });
  }
});

/* ---------- POST /api/recalc ---------- */
router.post("/recalc", async (_req, res) => {
  try {
    const totals = await computeTotals();
    res.json({ ok: true, totals });
  } catch (err) {
    console.error("POST /api/recalc error:", err);
    res.status(500).json({ message: "Failed to recalc totals" });
  }
});

/* ---------- PUT /api/payments/:id ---------- */
router.put("/payments/:id", async (req, res) => {
  try {
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

    const payment = await Payment.findOne({ id });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    // amount
    if (amount !== undefined) {
      const amt = parseMoney(amount);
      if (amt === null)
        return res.status(400).json({ message: "Invalid amount" });
      payment.amount = amt;
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
    if (date !== undefined) {
      payment.date = normalizeDate(date);
    }

    // note & playerName
    if (note !== undefined) payment.note = note?.trim() || null;
    if (playerName !== undefined)
      payment.playerName = playerName?.trim() || null;

    // totals (cashout extras)
    if (totalPaid !== undefined) {
      const tPaid = parseMoney(totalPaid, { allowZero: true });
      if (tPaid === null)
        return res.status(400).json({ message: "Invalid totalPaid" });
      payment.totalPaid = tPaid;
    }

    if (totalCashout !== undefined) {
      const tCashout = parseMoney(totalCashout, { allowZero: true });
      if (tCashout === null)
        return res.status(400).json({ message: "Invalid totalCashout" });
      payment.totalCashout = tCashout;
    }

    await payment.save();
    const totals = await computeTotals();
    res.json({ ok: true, payment, totals });
  } catch (err) {
    console.error("PUT /api/payments/:id error:", err);
    res.status(500).json({ message: "Failed to update payment" });
  }
});

/* ---------- DELETE /api/payments/:id ---------- */
router.delete("/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await Payment.findOneAndDelete({ id }).lean();
    if (!removed) return res.status(404).json({ message: "Payment not found" });

    const totals = await computeTotals();
    res.json({ ok: true, removed, totals });
  } catch (err) {
    console.error("DELETE /api/payments/:id error:", err);
    res.status(500).json({ message: "Failed to delete payment" });
  }
});

/* ---------- POST /api/recharge (unified) ---------- */
/* body: { amount, method, txType, note?, playerName?, totalPaid?, totalCashout?, date? } */
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

    const amt = parseMoney(amount);
    if (amt === null)
      return res.status(400).json({ message: "Invalid amount" });

    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

    const normalizedType = txType === "cashout" ? "cashout" : "cashin";
    const paymentDate = normalizeDate(date);

    const payload = {
      id: nanoid(),
      amount: amt,
      method,
      txType: normalizedType,
      note: note?.trim() || null,
      playerName:
        normalizedType === "cashin" ? playerName?.trim() || null : null,
      date: paymentDate,
    };

    if (normalizedType === "cashout") {
      const tPaid =
        totalPaid !== undefined
          ? parseMoney(totalPaid, { allowZero: true })
          : undefined;
      const tCashout =
        totalCashout !== undefined
          ? parseMoney(totalCashout, { allowZero: true })
          : undefined;

      if (totalPaid !== undefined && tPaid === null) {
        return res.status(400).json({ message: "Invalid totalPaid" });
      }
      if (totalCashout !== undefined && tCashout === null) {
        return res.status(400).json({ message: "Invalid totalCashout" });
      }
      if (tPaid !== undefined) payload.totalPaid = tPaid;
      if (tCashout !== undefined) payload.totalCashout = tCashout;
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
