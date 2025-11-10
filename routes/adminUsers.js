// routes/adminUsers.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js"; // 👈 adjust path if your models folder is outside routes

const router = express.Router();

// GET /api/admin/users
router.get("/", async (req, res) => {
  try {
    const users = await User.find(
      {},
      "username email lastSignInAt lastSignOutAt totalPayments totalFreeplay totalDeposit totalRedeem"
    ).sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// PUT /api/admin/users/:id
router.put("/:id", async (req, res) => {
  try {
    const { totalPayments, totalFreeplay, totalDeposit, totalRedeem } =
      req.body;

    const update = {
      totalPayments: Number(totalPayments) || 0,
      totalFreeplay: Number(totalFreeplay) || 0,
      totalDeposit: Number(totalDeposit) || 0,
      totalRedeem: Number(totalRedeem) || 0,
    };

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Error updating user totals:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// POST /api/admin/users/:id/reset-password
router.post("/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { passwordHash },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
