// api/utils/admin.js
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NepKath@2025?";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin"; // 👈 NEW

export async function ensureAdminUser() {
  try {
    const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    // --------- CREATE ADMIN IF MISSING ----------
    if (!user) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

      user = await User.create({
        username: ADMIN_USERNAME, // 👈 REQUIRED BY SCHEMA
        name: ADMIN_NAME,
        email: normalizedEmail,
        passwordHash, // 👈 important: matches schema field
        role: "admin",
        isAdmin: true,
      });

      console.log("✅ Admin user created:", normalizedEmail);
      return user;
    }

    // --------- UPDATE EXISTING ADMIN ----------
    let updated = false;

    // make sure username exists
    if (!user.username) {
      user.username = ADMIN_USERNAME;
      updated = true;
      console.log("👤 Admin username set from env for:", normalizedEmail);
    }

    // Ensure admin role flags
    if (user.role !== "admin") {
      user.role = "admin";
      updated = true;
    }
    if (!user.isAdmin) {
      user.isAdmin = true;
      updated = true;
    }

    // Ensure password matches ADMIN_PASSWORD from env
    const currentHash = user.passwordHash || "";
    const samePassword = await bcrypt.compare(ADMIN_PASSWORD, currentHash);
    if (!samePassword) {
      user.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      updated = true;
      console.log("🔑 Admin password updated from env for:", normalizedEmail);
    }

    if (updated) {
      await user.save();
      console.log("✅ Admin user updated:", normalizedEmail);
    } else {
      console.log("ℹ️ Admin user already up-to-date:", normalizedEmail);
    }

    return user;
  } catch (err) {
    console.error("❌ Failed to ensure admin user:", err);
    throw err;
  }
}
