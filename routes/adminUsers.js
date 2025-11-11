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

// * DELETE /api/admin/users/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log("🗑 Delete request for user id:", id);

    const user = await User.findById(id);

    if (!user) {
      console.log("⚠️ User not found for id:", id);
      return res.status(404).json({ message: "User not found." });
    }

    console.log("🔎 Found user:", {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
    });

    // 🚫 PROTECT ADMIN ACCOUNTS
    const isAdmin =
      user.isAdmin === true ||
      (typeof user.role === "string" && user.role.toLowerCase() === "admin") ||
      (typeof user.username === "string" &&
        user.username.toLowerCase() === "admin");

    if (isAdmin) {
      console.log("❌ Attempt to delete admin user. Blocking.");
      return res.status(403).json({ message: "Admin user cannot be deleted." });
    }

    await User.findByIdAndDelete(id);

    console.log("✅ User deleted:", id);
    return res.json({ message: "User deleted successfully." });
  } catch (err) {
    console.error("🔥 Error deleting user:", err);
    return res
      .status(500)
      .json({ message: "Server error while deleting user." });
  }
});

export default router;
