// api/models/Game.js
import mongoose from "mongoose";

const GameSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true }, // numeric id used by frontend
    name: { type: String, required: true },
    coinsSpent: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },
    coinsRecharged: { type: Number, default: 0 },
    totalCoins: { type: Number, default: 0 },
    lastRechargeDate: { type: String, default: null }, // "YYYY-MM-DD" or null
  },
  { timestamps: true }
);

const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);
export default Game;
