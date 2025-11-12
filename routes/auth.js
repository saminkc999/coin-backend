import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { ensureAdminUser } from "../utils/admin.js";
import { connectDB } from "../config/db.js";

const router = express.Router();

// Ensure DB + admin exists (safe guards)
router.use(async (_req, _res, next) => {
  try { await connectDB(); } catch {}
  try { await ensureAdminUser(); } catch (err) {
    console.error("❌ ensureAdminUser failed:", err);
  }
  next();
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, username } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username || normalizedEmail.split("@")[0],
      name: name || "User",
      email: normalizedEmail,
      passwordHash,
      role: "user",
      isAdmin: false,
    });
    res.status(201).json({
      message: "User registered",
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const payload = { userId: user._id, role: user.role, isAdmin: user.isAdmin };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "dev-secret", {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
