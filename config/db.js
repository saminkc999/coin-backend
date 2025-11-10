// api/config/db.js
import mongoose from "mongoose";

mongoose.set("strictQuery", false);

let mongoPromise = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "coin";

  if (!uri) {
    console.error("❌ MONGODB_URI is missing");
    throw new Error("MONGODB_URI not set");
  }

  // already connected
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!mongoPromise) {
    console.log("📡 Connecting to MongoDB...");
    mongoPromise = mongoose
      .connect(uri, { dbName })
      .then((conn) => {
        console.log("✅ MongoDB connected");
        return conn;
      })
      .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        mongoPromise = null;
        throw err;
      });
  }

  return mongoPromise;
}
