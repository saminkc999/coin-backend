// api/models/FacebookLead.js
import mongoose from "mongoose";

const FacebookLeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    source: {
      type: String,
      default: "facebook", // optional
    },
  },
  { timestamps: true }
);

const FacebookLead = mongoose.model("FacebookLead", FacebookLeadSchema);
export default FacebookLead;
