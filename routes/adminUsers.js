import express from "express";
import bcrypt from "bcryptjs";

import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import LoginHistory from "../models/LoginHistory.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = express.Router();

// all routes below require admin
router.use(requireAdmin);

/**
 * PUT /api/admin/users/:id
 * Body: { name, email }
 */
router.put("/:id", async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // ensure email not taken by another user
    const existing = await User.findOne({
      _id: { $ne: id },
      email: normalizedEmail,
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Another user already uses that email" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name.trim();
    user.email = normalizedEmail;
    await user.save();

    res.json({
      message: "User updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("Admin update user error:", err);
    res
      .status(500)
      .json({ message: "Failed to update user", error: err.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Deletes user and their login history
 */
router.delete("/:id", async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // optional: clean up login history
    await LoginHistory.deleteMany({ userId: id });

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Admin delete user error:", err);
    res
      .status(500)
      .json({ message: "Failed to delete user", error: err.message });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Body: { newPassword }
 */
router.post("/:id/reset-password", async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    user.passwordHash = passwordHash;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Admin reset password error:", err);
    res
      .status(500)
      .json({ message: "Failed to reset password", error: err.message });
  }
});

export default router;
