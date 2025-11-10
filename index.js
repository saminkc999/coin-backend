// api/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";
import paymentRoutes from "./routes/payments.js";
import loginRoutes from "./routes/logins.js";
import statsRoutes from "./routes/stats.js";
import healthRoutes from "./routes/health.js";
import adminUserRoutes from "./routes/adminUsers.js";
import loginRoutes from "./routes/logins.js";

dotenv.config();

const app = express();

// 🌍 Allowed frontend origins
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://coin-frontend.vercel.app";

const allowedOrigins = [
  "http://localhost:5173", // local dev
  "http://localhost:3000", // CRA dev
  FRONTEND_ORIGIN, // deployed frontend
];

// ✅ CORS
app.use(
  cors({
    origin: allowedOrigins,
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

// ✅ mount routes
app.use("/api/auth", authRoutes);
app.use("/api", gameRoutes);
app.use("/api", paymentRoutes);
app.use("/api", loginRoutes);
app.use("/api", statsRoutes);
app.use("/api", healthRoutes);
app.use("/api/admin/users", adminUserRoutes);

// ✅ start server (Railway sets PORT automatically)
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`✅ Backend running on port ${PORT}`)
    );
  } catch (err) {
    console.error("🚨 Failed to start server:", err.message || err);
    process.exit(1);
  }
}

export default app;
