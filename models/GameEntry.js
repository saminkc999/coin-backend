// api/models/GameEntry.js
import mongoose from "mongoose";

export const ALLOWED_TYPES = ["freeplay", "deposit", "redeem"];
export const ALLOWED_METHODS = ["cashapp", "paypal", "chime", "venmo"];

const gameEntrySchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true, trim: true },
    type: { type: String, enum: ALLOWED_TYPES, required: true },
    method: {
      type: String,
      enum: ALLOWED_METHODS,
      required: function () {
        return this.type === "deposit" || this.type === "redeem";
      },
    },
    playerName: { type: String, required: true, trim: true },
    gameName: { type: String, required: true, trim: true },
    amountBase: { type: Number, required: true, min: 0 },
    amount: { type: Number, min: 0 },
    bonusRate: { type: Number, default: 0, min: 0 },
    bonusAmount: { type: Number, default: 0, min: 0 },
    amountFinal: { type: Number, required: true, min: 0 },
    note: { type: String, default: "", trim: true },
    date: { type: String },
    totalPaid: { type: Number, default: 0, min: 0 },
    totalCashout: { type: Number, default: 0, min: 0 },
    remainingPay: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const GameEntry =
  mongoose.models.GameEntry || mongoose.model("GameEntry", gameEntrySchema);

export default GameEntry;
