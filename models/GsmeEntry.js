import mongoose from "mongoose";

/**
 * GameEntry Model
 * Tracks all game-related financial actions:
 * - deposit (player adds money)
 * - redeem  (player withdraws or redeems)
 * - freeplay (no-cost session, usually promotional)
 * - bonus   (manual or system-added bonus)
 *
 * Each entry is linked to a player name and optionally a specific game.
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

    // Transaction amount (always ≥ 0)
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
 * Example entry:
 * {
 *   type: "deposit",
 *   playerName: "JohnDoe",
 *   gameName: "CrashCats",
 *   amount: 50,
 *   note: "Deposit via CashApp",
 *   date: "2025-11-12T00:00:00Z"
 * }
 */

export default mongoose.model("GameEntry", gameEntrySchema);
