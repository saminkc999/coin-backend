import mongoose from "mongoose";
import dotenv from "dotenv";

// OR: if you want to support both, but prefer .env.local, use override:
dotenv.config({ path: ".env.local", override: true });

let mongoPromise = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "coin";

  console.log("DEBUG connectDB MONGODB_URI:", uri);

  if (!uri) {
    console.error("❌ MONGODB_URI is missing");
    throw new Error("MONGODB_URI not set");
  }

  if (mongoose.connection.readyState === 1) return;

  if (!mongoPromise) {
    console.log("📡 Connecting to MongoDB...");
    mongoPromise = mongoose
      .connect(uri, { dbName })
      .then((conn) => {
        console.log("✅ MongoDB connected");
        return conn;
      })
      .catch((err) => {
        console.error("❌ MongoDB connection error in connectDB:", err);
        mongoPromise = null;
        throw err;
      });
  }

  await mongoPromise;
}
