// api/models/GameEntry.js
import mongoose from "mongoose";

const gameEntrySchema = new mongoose.Schema(
  {
    // What kind of transaction is this?
    type: {
      type: String,
      enum: ["freeplay", "deposit", "redeem", "bonus"],
      required: true,
      index: true,
    },

    // Who?
    playerName: { type: String, required: true, trim: true, index: true },

    // Which game? (optional but useful)
    gameName: { type: String, trim: true, default: "" },

    // How much? (freeplay/bonus can be 0 if you want to track just the entry)
    amount: { type: Number, min: 0, required: true },

    // Optional note
    note: { type: String, trim: true, default: "" },

    // Optional explicit date (defaults to now)
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("GameEntry", gameEntrySchema);
