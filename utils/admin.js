import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "NepKath@2025?";

  // derive a username if not provided
  const adminUsernameEnv = process.env.ADMIN_USERNAME;
  const adminUsername =
    adminUsernameEnv ||
    (adminEmail.includes("@") ? adminEmail.split("@")[0] : "admin");

  let admin = await User.findOne({ email: adminEmail });

  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    admin = await User.create({
      email: adminEmail,
      username: adminUsername, // 👈 IMPORTANT
      passwordHash,
      role: "admin",
    });

    console.log(
      `✅ Created default admin user: ${adminEmail} (username: ${adminUsername})`
    );
  } else if (!admin.username) {
    // If admin exists but has no username, fix it
    admin.username = adminUsername;
    await admin.save();
    console.log(`✅ Updated existing admin to have username: ${adminUsername}`);
  }
}
