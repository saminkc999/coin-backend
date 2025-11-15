// api/models/GameEntry.js
import mongoose from "mongoose";

export const ALLOWED_TYPES = ["freeplay", "deposit", "redeem"];
export const ALLOWED_METHODS = ["cashapp", "paypal", "chime", "venmo"];

const gameEntrySchema = new mongoose.Schema(
  {
    // 👤 who is logged in / owner of this entry
    username: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true, trim: true },

    // "freeplay" | "deposit" | "redeem"
    type: { type: String, enum: ALLOWED_TYPES, required: true },

    // 💳 method required only for deposit / redeem
    method: {
      type: String,
      enum: ALLOWED_METHODS,
      required: function () {
        return this.type === "deposit" || this.type === "redeem";
      },
    },

    // 🧍 For "our tag" flow: main identifier
    // For "player tag" flow: optional display name
    playerName: { type: String, trim: true, default: "" },

    // 🎮 Common game name for both flows
    gameName: { type: String, required: true, trim: true },

    // 🎯 Player Tag
    // - Required in player-tag deposit flow
    // - Used on our-tag redeem when it is pending
    playerTag: { type: String, trim: true, default: "" },

    // 💵 base amount (before bonus)
    amountBase: { type: Number, required: true, min: 0 },

    // optional raw amount if needed (you often set = amountFinal)
    amount: { type: Number, min: 0 },

    // 🎁 bonus details (mostly for deposit)
    bonusRate: { type: Number, default: 0, min: 0 },
    bonusAmount: { type: Number, default: 0, min: 0 },

    // final amount (after bonus for deposit, or same as base otherwise)
    amountFinal: { type: Number, required: true, min: 0 },

    note: { type: String, default: "", trim: true },

    // stored as "YYYY-MM-DD" from frontend
    date: { type: String },

    // 💸 Our-tag redeem tracking:
    // - totalPaid: how much has been paid / cost written in form
    // - totalCashout: sum of game final amounts
    // - remainingPay: remaining cost you still have to pay (>= 0)
    totalPaid: { type: Number, default: 0, min: 0 },
    totalCashout: { type: Number, default: 0, min: 0 },
    remainingPay: { type: Number, default: 0, min: 0 },

    // ✅ Pending flag for redeem entries
    // - true when "pending" toggle is ON in our-tag redeem flow
    isPending: { type: Boolean, default: false },

    // 💰 Extra money (if user paid more than needed)
    // e.g. extraMoney = max(0, totalPaid - totalCashout)
    extraMoney: { type: Number, default: 0, min: 0 },

    // 🔻 For player-tag flow
    // reduction = amountBase - totalCashout (computed in frontend or route)
    // This is your "remaining paying" for player-tag deposits
    reduction: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Helpful indexes for dashboard queries
gameEntrySchema.index({ username: 1, date: 1, type: 1 });
gameEntrySchema.index({ playerTag: 1, date: 1 });
gameEntrySchema.index({ createdAt: -1 });

const GameEntry =
  mongoose.models.GameEntry || mongoose.model("GameEntry", gameEntrySchema);

export default GameEntry;
