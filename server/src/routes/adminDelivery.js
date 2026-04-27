const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");

const adminDeliveryRouter = express.Router();

const updateDeliverySettingsSchema = z.object({
  enabled: z.boolean(),
  pickupEnabled: z.boolean(),
  fee: z.number().min(0, "Les frais de livraison doivent être positifs ou nuls."),
  minimumOrder: z.number().min(0, "Le minimum de commande doit être positif ou nul."),
  zone: z.string().trim().max(255, "La zone de livraison est trop longue.").default(""),
  estimatedDeliveryTime: z.number().int().positive("Le délai de livraison doit être supérieur à 0."),
  estimatedPickupTime: z.number().int().positive("Le délai de retrait doit être supérieur à 0."),
  rushModeEnabled: z.boolean(),
});

adminDeliveryRouter.get("/delivery", requireAdminAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          delivery_enabled,
          pickup_enabled,
          delivery_fee_cents,
          minimum_order_cents,
          delivery_zone_label,
          estimated_delivery_time_min,
          estimated_pickup_time_min,
          rush_mode_enabled
        FROM delivery_settings
        WHERE singleton = TRUE
        LIMIT 1
      `
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Paramètres de livraison introuvables.",
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        id: String(row.id),
        enabled: row.delivery_enabled,
        pickupEnabled: row.pickup_enabled,
        fee: row.delivery_fee_cents / 100,
        minimumOrder: row.minimum_order_cents / 100,
        zone: row.delivery_zone_label || "",
        estimatedDeliveryTime: row.estimated_delivery_time_min,
        estimatedPickupTime: row.estimated_pickup_time_min,
        rushModeEnabled: row.rush_mode_enabled,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/delivery error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminDeliveryRouter.patch("/delivery", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const parsed = updateDeliverySettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const {
      enabled,
      pickupEnabled,
      fee,
      minimumOrder,
      zone,
      estimatedDeliveryTime,
      estimatedPickupTime,
      rushModeEnabled,
    } = parsed.data;

    const result = await pool.query(
      `
        UPDATE delivery_settings
        SET
          delivery_enabled = $1,
          pickup_enabled = $2,
          delivery_fee_cents = $3,
          minimum_order_cents = $4,
          delivery_zone_label = $5,
          estimated_delivery_time_min = $6,
          estimated_pickup_time_min = $7,
          rush_mode_enabled = $8,
          updated_at = NOW()
        WHERE singleton = TRUE
        RETURNING
          id,
          delivery_enabled,
          pickup_enabled,
          delivery_fee_cents,
          minimum_order_cents,
          delivery_zone_label,
          estimated_delivery_time_min,
          estimated_pickup_time_min,
          rush_mode_enabled
      `,
      [
        enabled,
        pickupEnabled,
        Math.round(fee * 100),
        Math.round(minimumOrder * 100),
        zone || null,
        estimatedDeliveryTime,
        estimatedPickupTime,
        rushModeEnabled,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Paramètres de livraison introuvables.",
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        id: String(row.id),
        enabled: row.delivery_enabled,
        pickupEnabled: row.pickup_enabled,
        fee: row.delivery_fee_cents / 100,
        minimumOrder: row.minimum_order_cents / 100,
        zone: row.delivery_zone_label || "",
        estimatedDeliveryTime: row.estimated_delivery_time_min,
        estimatedPickupTime: row.estimated_pickup_time_min,
        rushModeEnabled: row.rush_mode_enabled,
      },
      message: "Paramètres de livraison mis à jour avec succès.",
    });
  } catch (error) {
    console.error("PATCH /api/admin/delivery error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { adminDeliveryRouter };