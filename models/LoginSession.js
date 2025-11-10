// api/models/LoginSession.js
import mongoose from "mongoose";

const LoginSessionSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    signInAt: {
      type: Date,
      required: true,
    },
    signOutAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

const LoginSession =
  mongoose.models.LoginSession ||
  mongoose.model("LoginSession", LoginSessionSchema);

export default LoginSession;
