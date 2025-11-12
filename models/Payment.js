// api/models/Payment.js
import mongoose from "mongoose";
import { nanoid } from "nanoid";

export const METHODS = ["cashapp", "paypal", "chime"];
export const TX_TYPES = ["cashin", "cashout"];

const paymentSchema = new mongoose.Schema(
  {
    // Optional: link to a user later if needed
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    // Custom ID used in routes (auto if not provided)
    id: {
      type: String,
      unique: true,
      default: () => nanoid(12),
    },

    amount: { type: Number, required: true, min: 0 },

    // payment method (cashapp, paypal, chime)
    method: { type: String, required: true },

    // "cashin" (add) or "cashout" (withdraw)
    txType: { type: String, enum: TX_TYPES, required: true, default: "cashin" },

    // cashin only (optional)
    playerName: { type: String, trim: true, default: "" },

    // cashout only (optional audit math)
    totalPaid: { type: Number, default: 0, min: 0 },
    totalCashout: { type: Number, default: 0, min: 0 },

    note: { type: String, default: "", trim: true },

    // Keep both for convenience:
    // - date (real Date for sorting/ranges)
    // - dateString ("YYYY-MM-DD" for quick grouping/filtering)
    date: { type: Date, default: Date.now, index: true },
    dateString: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Normalize dateString and sanitize fields before validation
paymentSchema.pre("validate", function (next) {
  // Ensure date is a Date
  const d = this.date ? new Date(this.date) : new Date();
  this.date = d;

  // Build YYYY-MM-DD
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  this.dateString = `${y}-${m}-${day}`;

  // Normalize cashin/cashout specifics
  if (this.txType === "cashin") {
    // allow playerName, ignore totals
    this.totalPaid = 0;
    this.totalCashout = 0;
  } else if (this.txType === "cashout") {
    // ignore playerName for cashout if not explicitly set
    if (!this.playerName) this.playerName = "";
  }

  next();
});

// Helpful compound indexes
paymentSchema.index({ dateString: 1, txType: 1, method: 1 });
paymentSchema.index({ createdAt: -1 });

// Clean JSON output (keep custom id, hide _id/__v)
paymentSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
  },
});

const Payment =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

export default Payment;
