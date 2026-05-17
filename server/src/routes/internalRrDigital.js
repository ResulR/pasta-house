const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireInternalToken } = require("../middlewares/requireInternalToken");

const internalRrDigitalRouter = express.Router();

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 50;

const listOrdersSchema = z.object({
  date: z.enum(["today"]).optional(),
  status: z
    .enum([
      "pending",
      "awaiting_payment",
      "paid",
      "preparing",
      "ready",
      "in_delivery",
      "completed",
      "cancelled",
      "payment_failed",
    ])
    .optional(),
  limit: z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(LIMIT_MAX))
    .optional(),
});

// GET /api/internal/rr-digital/orders
internalRrDigitalRouter.get("/orders", requireInternalToken, async (req, res) => {
  try {
    const parsed = listOrdersSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "BAD_REQUEST",
        message: "Parametres invalides.",
        errors: parsed.error.flatten(),
      });
    }

    const { date, status, limit } = parsed.data;
    const effectiveLimit = limit ?? LIMIT_DEFAULT;

    const filters = [];
    const values = [];

    if (date === "today") {
      filters.push("orders.created_at >= date_trunc('day', now())");
      filters.push("orders.created_at < date_trunc('day', now()) + INTERVAL '1 day'");
    }

    if (status) {
      values.push(status);
      filters.push(`orders.status = \$${values.length}`);
    }

    values.push(effectiveLimit);
    const limitPlaceholder = `\$${values.length}`;

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
         id,
         order_number,
         status,
         fulfillment_method,
         customer_name,
         customer_phone,
         customer_email,
         total_cents,
         currency,
         paid_at,
         created_at,
         updated_at
       FROM orders
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limitPlaceholder}`,
      values
    );

    const orders = result.rows.map((row) => ({
      id: String(row.id),
      orderNumber: row.order_number,
      status: row.status,
      fulfillmentMethod: row.fulfillment_method,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      totalCents: Number(row.total_cents),
      currency: row.currency,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.status(200).json({
      ok: true,
      data: { orders },
    });
  } catch (error) {
    console.error("GET /api/internal/rr-digital/orders error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

// GET /api/internal/rr-digital/orders/:id
internalRrDigitalRouter.get("/orders/:id", requireInternalToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        ok: false,
        error: "BAD_REQUEST",
        message: "Identifiant commande invalide.",
      });
    }

    const [orderResult, itemsResult] = await Promise.all([
      pool.query(
        `SELECT
           id,
           order_number,
           status,
           fulfillment_method,
           customer_name,
           customer_phone,
           customer_email,
           delivery_address_line1,
           delivery_postal_code,
           delivery_city,
           customer_note,
           subtotal_cents,
           delivery_fee_cents,
           total_cents,
           currency,
           paid_at,
           created_at,
           updated_at
         FROM orders
         WHERE id = $1
         LIMIT 1`,
        [orderId]
      ),
      pool.query(
        `SELECT
           id,
           line_number,
           item_type,
           product_name_snapshot,
           variant_code_snapshot,
           variant_name_snapshot,
           beverage_name_snapshot,
           unit_price_cents,
           quantity,
           line_total_cents
         FROM order_items
         WHERE order_id = $1
         ORDER BY line_number ASC, id ASC`,
        [orderId]
      ),
    ]);

    if (orderResult.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: "NOT_FOUND",
        message: "Commande introuvable.",
      });
    }

    const row = orderResult.rows[0];

    const order = {
      id: String(row.id),
      orderNumber: row.order_number,
      status: row.status,
      fulfillmentMethod: row.fulfillment_method,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      deliveryAddressLine1: row.delivery_address_line1,
      deliveryPostalCode: row.delivery_postal_code,
      deliveryCity: row.delivery_city,
      customerNote: row.customer_note,
      subtotalCents: Number(row.subtotal_cents),
      deliveryFeeCents: Number(row.delivery_fee_cents),
      totalCents: Number(row.total_cents),
      currency: row.currency,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: itemsResult.rows.map((item) => ({
        id: String(item.id),
        lineNumber: item.line_number,
        itemType: item.item_type,
        productNameSnapshot: item.product_name_snapshot,
        variantCodeSnapshot: item.variant_code_snapshot,
        variantNameSnapshot: item.variant_name_snapshot,
        beverageNameSnapshot: item.beverage_name_snapshot,
        unitPriceCents: Number(item.unit_price_cents),
        quantity: item.quantity,
        lineTotalCents: Number(item.line_total_cents),
      })),
    };

    return res.status(200).json({
      ok: true,
      data: { order },
    });
  } catch (error) {
    console.error("GET /api/internal/rr-digital/orders/:id error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { internalRrDigitalRouter };
