// api/routes/facebookLeads.js
import express from "express";
import { connectDB } from "../config/db.js";
import FacebookLead from "../models/FacebookLead.js";

const router = express.Router();

// Ensure DB connection for all routes
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connection error in facebookLeads:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

/**
 * 🟢 POST /api/facebook-leads
 * Body: { name, email }
 */
router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({ message: "Both name and email are required" });
    }

    const lead = await FacebookLead.create({ name, email });
    res.status(201).json({ message: "Lead saved", lead });
  } catch (err) {
    console.error("Error in POST /api/facebook-leads:", err);
    res
      .status(500)
      .json({ message: "Failed to save lead", error: err.message });
  }
});

/**
 * 📤 GET /api/facebook-leads/export
 * Returns CSV that can be opened in Excel
 */
router.get("/export", async (_req, res) => {
  try {
    const leads = await FacebookLead.find().sort({ createdAt: -1 }).lean();

    // CSV header
    let csv = "Name,Email,Source,Created At\n";

    // CSV rows
    csv += leads
      .map((lead) => {
        const name = (lead.name || "").replace(/"/g, '""');
        const email = (lead.email || "").replace(/"/g, '""');
        const source = (lead.source || "").replace(/"/g, '""');
        const createdAt = lead.createdAt
          ? new Date(lead.createdAt).toISOString()
          : "";
        // wrap in quotes to be safe for commas
        return `"${name}","${email}","${source}","${createdAt}"`;
      })
      .join("\n");

    const fileName = `facebook_leads_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(csv);
  } catch (err) {
    console.error("Error in GET /api/facebook-leads/export:", err);
    res
      .status(500)
      .json({ message: "Failed to export leads", error: err.message });
  }
});

export default router;
