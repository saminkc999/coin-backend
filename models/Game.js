// api/models/Game.js
import mongoose from "mongoose";

const GameSchema = new mongoose.Schema(
  {
    // numeric ID used by frontend (keep unique for each game)
    id: { type: Number, required: true, unique: true },

    name: { type: String, required: true, trim: true },

    // freeplay = subtract from total
    coinsEarned: { type: Number, default: 0 },

    // redeem = adds to total
    coinsSpent: { type: Number, default: 0 },

    // deposit = subtracts from total
    coinsRecharged: { type: Number, default: 0 },

    // auto-calculated total coins = redeem - freeplay - deposit
    totalCoins: { type: Number, default: 0 },

    // optional recharge timestamp (YYYY-MM-DD)
    lastRechargeDate: { type: String, default: null },
  },
  { timestamps: true }
);

// 🧮 Auto-update totalCoins before saving
GameSchema.pre("save", function (next) {
  this.totalCoins =
    (this.coinsSpent || 0) -
    (this.coinsEarned || 0) -
    (this.coinsRecharged || 0);
  next();
});

const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);
export default Game;
