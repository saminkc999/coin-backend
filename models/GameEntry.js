import mongoose from "mongoose";

/**
 * GameEntry Model
 * Tracks all game-related financial actions:
 * - deposit (player adds money)
 * - redeem  (player withdraws or redeems)
 * - freeplay (no-cost session, usually promotional)
 * - bonus   (manual or system-added bonus)
 *
 * Now supports:
 *  - amountBase: user-entered base amount
 *  - bonusRate: applied percentage (default 0)
 *  - bonusAmount: derived bonus
 *  - amountFinal: final amount (after bonus)
 */

const gameEntrySchema = new mongoose.Schema(
  {
    // Transaction type
    type: {
      type: String,
      enum: ["freeplay", "deposit", "redeem", "bonus"],
      required: true,
      index: true,
    },

    // Player identification
    playerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Game identifier (optional)
    gameName: {
      type: String,
      trim: true,
      default: "",
    },

    // 💰 Base amount entered by admin
    amountBase: {
      type: Number,
      required: true,
      min: 0,
    },

    // 🎁 Bonus percentage (%)
    bonusRate: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 💵 Bonus amount (calculated automatically)
    bonusAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ Final amount (base + bonus)
    amountFinal: {
      type: Number,
      required: true,
      min: 0,
    },

    // (Backward compatibility)
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Notes or admin comment
    note: {
      type: String,
      trim: true,
      default: "",
    },

    // Optional date override — defaults to now
    date: {
      type: Date,
      default: Date.now,
    },

    // Derived for sorting/grouping (e.g., "2025-11-12")
    dateString: {
      type: String,
      required: true,
    },

    // System metadata (optional for UI)
    createdBy: {
      type: String,
      trim: true,
      default: "system",
    },

    // Optional link to Payment or Session IDs (future expansion)
    refId: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

/**
 * 🔁 Auto-compute derived fields before save
 */
gameEntrySchema.pre("validate", function (next) {
  // Normalize dateString
  const d = this.date || new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  this.dateString = `${y}-${m}-${day}`;

  // Auto-calculate bonus + final amount if missing
  const base = Number(this.amountBase ?? 0);
  const rate = Number(this.bonusRate ?? 0);

  // For redeem — no bonus
  let bonus = this.type === "redeem" ? 0 : (base * rate) / 100;
  if (isNaN(bonus) || bonus < 0) bonus = 0;

  this.bonusAmount = bonus;
  this.amountFinal = this.type === "redeem" ? base : base + bonus;
  this.amount = this.amountFinal; // for backward compatibility

  next();
});

export default mongoose.models.GameEntry ||
  mongoose.model("GameEntry", gameEntrySchema);
