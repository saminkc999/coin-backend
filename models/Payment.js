// api/models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // Custom ID used in your routes (nanoid)
    id: {
      type: String,
      required: true,
      unique: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // payment method (cashapp, paypal, chime, etc.)
    // routes already validate this using validMethods
    method: {
      type: String,
      required: true,
    },

    // "cashin" (add) or "cashout" (withdraw)
    txType: {
      type: String,
      enum: ["cashin", "cashout"],
      default: "cashin",
    },

    note: {
      type: String,
      default: null,
    },

    // stored as "YYYY-MM-DD" string
    date: {
      type: String,
      required: true,
    },
  },
  {
    // adds createdAt / updatedAt automatically
    timestamps: true,
  }
);

// Clean JSON output (keep your custom id, hide _id / __v)
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
