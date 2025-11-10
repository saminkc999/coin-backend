// api/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import { connectDB } from "./config/db.js"; // 👈 add this

import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";
import paymentRoutes from "./routes/payments.js";
import loginRoutes from "./routes/logins.js";
import statsRoutes from "./routes/stats.js";
import healthRoutes from "./routes/health.js";
import adminUserRoutes from "./routes/adminUsers.js";

const app = express();

// 🌍 Allowed frontend origins
// - FRONTEND_ORIGIN: your deployed Vercel frontend
// - Local dev: Vite (5173) and Vercel dev (3000)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN; // e.g. https://coin-frontend.vercel.app

const allowedOrigins = [
  "http://localhost:5173", // Vite dev
  "http://localhost:3000", // vercel dev / CRA dev
];

if (FRONTEND_ORIGIN) {
  allowedOrigins.push(FRONTEND_ORIGIN);
}

// ✅ CORS config (only once)
app.use(
  cors({
    origin: (origin, callback) => {
      // allow mobile apps / curl / Postman (no origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn("❌ CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ JSON body parsing
app.use(express.json());

// ✅ global logger
app.use((req, res, next) => {
  console.log("📥", req.method, req.url);
  next();
});

//  ✅ mount routes
app.use("/api/auth", authRoutes);
app.use("/api", gameRoutes);
app.use("/api", paymentRoutes);
app.use("/api", loginRoutes);
app.use("/api", statsRoutes);
app.use("/api", healthRoutes);
app.use("/api/admin/users", adminUserRoutes);

// ✅ start server (Railway will set PORT)
const PORT = process.env.PORT || 5000;

// 🔌 connect DB first, THEN listen
async function startServer() {
  try {
    await connectDB(); // 👈 ensure MongoDB is ready
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error("🚨 Failed to start server:", err.message || err);
    process.exit(1); // optional, but good for Railway to restart if broken
  }
}

startServer();

export default app;
