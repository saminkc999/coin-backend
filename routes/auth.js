// backend/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import LoginHistory from "../models/LoginHistory.js";
import { connectDB } from "../config/db.js";
import { ensureAdminUser } from "../utils/admin.js"; // ✅ fixed import path

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";

// 🧠 Initialize admin only once
let adminInitialized = false;
async function ensureAdminOnce() {
  if (adminInitialized) return;
  await connectDB();
  await ensureAdminUser();
  adminInitialized = true;
}

/* ---------------------------
 *  POST /api/auth/register
 * ------------------------- */
router.post("/register", async (req, res) => {
  try {
    await ensureAdminOnce();

    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing)
      return res
        .status(409)
        .json({ message: "User with that email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "user",
      isAdmin: false,
    });

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({
      message: "Server error during registration",
      error: err.message,
    });
  }
});

/* ---------------------------
 *  POST /api/auth/login
 * ------------------------- */
router.post("/login", async (req, res) => {
  try {
    await ensureAdminOnce();

    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Track login
    try {
      await LoginHistory.create({
        userId: user._id,
        email: user.email,
        loggedInAt: new Date(),
      });
    } catch (err) {
      console.warn("⚠️ Failed to record login history:", err.message);
    }

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({
      message: "Server error during login",
      error: err.message,
    });
  }
});

/* ---------------------------
 *  GET /api/auth/me
 * ------------------------- */
router.get("/me", async (req, res) => {
  try {
    await ensureAdminOnce();

    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");

    if (!token)
      return res.status(401).json({ message: "Missing or invalid token" });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(payload.userId).select(
      "_id name email role isAdmin"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    console.error("❌ Me error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
