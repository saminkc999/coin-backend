import mongoose from "mongoose";
import dotenv from "dotenv";

// Load env vars (works both locally and on Railway)
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

mongoose.set("strictQuery", false);

let mongoPromise = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "coin";

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
        console.error("❌ MongoDB connection error:", err);
        mongoPromise = null;
        throw err;
      });
  }

  await mongoPromise;
}
