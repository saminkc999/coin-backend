// testMongo.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // loads .env from this folder

const uri = process.env.MONGODB_URI;
console.log("🔍 Testing connection to:", uri.split("@")[1]);

async function testConnection() {
  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

testConnection();
