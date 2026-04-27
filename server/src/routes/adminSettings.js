const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");

const adminSettingsRouter = express.Router();

const updateSiteSettingsSchema = z.object({
  restaurantName: z.string().trim().min(1, "Le nom du restaurant est obligatoire."),
  phone: z.string().trim().max(255).optional().default(""),
  email: z.string().trim().max(255).optional().default(""),
  addressLine1: z.string().trim().max(255).optional().default(""),
  postalCode: z.string().trim().max(50).optional().default(""),
  city: z.string().trim().max(255).optional().default(""),
  country: z.string().trim().min(1, "Le pays est obligatoire.").max(255).optional().default("Belgique"),
  legalName: z.string().trim().max(255).optional().default(""),
  vatNumber: z.string().trim().max(255).optional().default(""),
});

adminSettingsRouter.get("/settings", requireAdminAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          restaurant_name,
          phone,
          email,
          address_line1,
          postal_code,
          city,
          country,
          legal_name,
          vat_number
        FROM site_settings
        WHERE singleton = TRUE
        LIMIT 1
      `
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Paramètres du site introuvables.",
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        id: String(row.id),
        restaurantName: row.restaurant_name,
        phone: row.phone || "",
        email: row.email || "",
        addressLine1: row.address_line1 || "",
        postalCode: row.postal_code || "",
        city: row.city || "",
        country: row.country || "",
        legalName: row.legal_name || "",
        vatNumber: row.vat_number || "",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/settings error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminSettingsRouter.patch("/settings", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const parsed = updateSiteSettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const {
      restaurantName,
      phone,
      email,
      addressLine1,
      postalCode,
      city,
      country,
      legalName,
      vatNumber,
    } = parsed.data;

    const result = await pool.query(
      `
        UPDATE site_settings
        SET
          restaurant_name = $1,
          phone = $2,
          email = $3,
          address_line1 = $4,
          postal_code = $5,
          city = $6,
          country = $7,
          legal_name = $8,
          vat_number = $9,
          updated_at = NOW()
        WHERE singleton = TRUE
        RETURNING
          id,
          restaurant_name,
          phone,
          email,
          address_line1,
          postal_code,
          city,
          country,
          legal_name,
          vat_number
      `,
      [
        restaurantName,
        phone || null,
        email || null,
        addressLine1 || null,
        postalCode || null,
        city || null,
        country,
        legalName || null,
        vatNumber || null,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Paramètres du site introuvables.",
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        id: String(row.id),
        restaurantName: row.restaurant_name,
        phone: row.phone || "",
        email: row.email || "",
        addressLine1: row.address_line1 || "",
        postalCode: row.postal_code || "",
        city: row.city || "",
        country: row.country || "",
        legalName: row.legal_name || "",
        vatNumber: row.vat_number || "",
      },
      message: "Paramètres du site mis à jour avec succès.",
    });
  } catch (error) {
    console.error("PATCH /api/admin/settings error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { adminSettingsRouter };