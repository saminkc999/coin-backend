// api/models/GameEntry.js
import mongoose from "mongoose";

export const ENTRY_TYPES = ["freeplay", "deposit", "redeem"];
export const METHODS = ["cashapp", "paypal", "chime", "venmo"];

const gameEntrySchema = new mongoose.Schema(
  {
    // 👤 Which admin / user created this entry
    username: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },

    // 🔄 Type of entry
    type: {
      type: String,
      enum: ENTRY_TYPES,
      required: true,
    },

    // 💳 Payment method (not used for freeplay)
    method: {
      type: String,
      enum: METHODS,
      required: function () {
        return this.type === "deposit" || this.type === "redeem";
      },
    },

    // 🧍 Player + Game
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    gameName: {
      type: String,
      required: true,
      trim: true,
    },

    // 💵 Amounts & bonus
    amountBase: {
      type: Number,
      required: true,
      min: 0,
    },
    bonusRate: {
      type: Number,
      default: 0,
    },
    bonusAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountFinal: {
      type: Number,
      required: true,
      min: 0,
    },

    // optional raw amount sent from frontend (if you want to keep it)
    amount: {
      type: Number,
      min: 0,
    },

    note: {
      type: String,
      trim: true,
    },

    // 💰 Cashout summary (mainly for type === "redeem")
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCashout: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingPay: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Date stored as string "YYYY-MM-DD"
    date: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// safer in dev/hot-reload:
const GameEntry =
  mongoose.models.GameEntry || mongoose.model("GameEntry", gameEntrySchema);

export default GameEntry;
