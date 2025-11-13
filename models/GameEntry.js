// api/models/GameEntry.js
import mongoose from "mongoose";

export const ENTRY_TYPES = ["freeplay", "deposit", "redeem"];
export const METHODS = ["cashapp", "paypal", "chime", "venmo"];

const gameEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ENTRY_TYPES,
      required: true,
    },
    method: {
      type: String,
      enum: METHODS,
      required: function () {
        return this.type === "deposit" || this.type === "redeem";
      },
    },
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
    // optional raw amount
    amount: {
      type: Number,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
    },
    // "YYYY-MM-DD"
    date: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const GameEntry = mongoose.model("GameEntry", gameEntrySchema);
export default GameEntry;
