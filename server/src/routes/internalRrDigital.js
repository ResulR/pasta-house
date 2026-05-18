const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { env } = require("../config/env");
const { sendEmail } = require("../lib/email");
const { requireInternalToken } = require("../middlewares/requireInternalToken");

const internalRrDigitalRouter = express.Router();

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 50;

// --- Email helpers (logic copied from adminOrders.js — not exported there) -

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shouldSendCustomerStatusEmail({ fulfillmentMethod, previousStatus, nextStatus }) {
  if (previousStatus === nextStatus) {
    return false;
  }
  if (fulfillmentMethod === "delivery" && nextStatus === "in_delivery") {
    return true;
  }
  if (fulfillmentMethod === "pickup" && nextStatus === "ready") {
    return true;
  }
  return false;
}

function buildCustomerStatusEmail({ order }) {
  const trackingUrl = order.public_tracking_token
    ? `${env.appBaseUrl}/suivi/${encodeURIComponent(order.public_tracking_token)}`
    : env.appBaseUrl;

  if (order.fulfillment_method === "delivery" && order.status === "in_delivery") {
    const subject = `Pasta House — votre commande ${order.order_number} est en route`;

    const text = [
      `Bonjour ${order.customer_name || ""}`.trim(),
      "",
      `Votre commande ${order.order_number} est en route.`,
      "",
      "Vous pouvez suivre votre commande ici :",
      trackingUrl,
      "",
      "Merci pour votre commande.",
      "Pasta House",
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h1 style="margin:0 0 16px 0;">Votre commande est en route</h1>
        <p>Bonjour ${escapeHtml(order.customer_name || "")},</p>
        <p>Votre commande <strong>${escapeHtml(order.order_number)}</strong> est maintenant en livraison.</p>
        <p>
          <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">
            Suivre ma commande
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280;">Si le bouton ne fonctionne pas, copiez ce lien : ${escapeHtml(trackingUrl)}</p>
        <p>Merci pour votre commande.<br />Pasta House</p>
      </div>
    `;

    return { subject, text, html };
  }

  if (order.fulfillment_method === "pickup" && order.status === "ready") {
    const subject = `Pasta House — votre commande ${order.order_number} est prête`;

    const text = [
      `Bonjour ${order.customer_name || ""}`.trim(),
      "",
      `Votre commande ${order.order_number} est prête pour le retrait.`,
      "",
      "Vous pouvez consulter le suivi ici :",
      trackingUrl,
      "",
      "Merci pour votre commande.",
      "Pasta House",
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h1 style="margin:0 0 16px 0;">Votre commande est prête</h1>
        <p>Bonjour ${escapeHtml(order.customer_name || "")},</p>
        <p>Votre commande <strong>${escapeHtml(order.order_number)}</strong> est prête pour le retrait.</p>
        <p>
          <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">
            Voir le suivi
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280;">Si le bouton ne fonctionne pas, copiez ce lien : ${escapeHtml(trackingUrl)}</p>
        <p>Merci pour votre commande.<br />Pasta House</p>
      </div>
    `;

    return { subject, text, html };
  }

  return null;
}

async function sendCustomerStatusEmailIfNeeded({ order, previousStatus }) {
  if (!order.customer_email) {
    return;
  }
  if (
    !shouldSendCustomerStatusEmail({
      fulfillmentMethod: order.fulfillment_method,
      previousStatus,
      nextStatus: order.status,
    })
  ) {
    return;
  }
  const emailPayload = buildCustomerStatusEmail({ order });
  if (!emailPayload) {
    return;
  }
  await sendEmail({
    to: order.customer_email,
    subject: emailPayload.subject,
    html: emailPayload.html,
    text: emailPayload.text,
  });
}

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

// Only the 5 statuses that RR Digital is allowed to set manually.
// Payment-managed statuses (pending/awaiting_payment/paid/payment_failed)
// are rejected at the schema level — no need for a runtime blocklist.
const patchOrderStatusSchema = z.object({
  status: z.enum(["preparing", "ready", "in_delivery", "completed", "cancelled"]),
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

// PATCH /api/internal/rr-digital/orders/:id/status
internalRrDigitalRouter.patch("/orders/:id/status", requireInternalToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        ok: false,
        error: "BAD_REQUEST",
        message: "Identifiant commande invalide.",
      });
    }

    const parsed = patchOrderStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "BAD_REQUEST",
        message: "Statut invalide ou non autorise.",
        errors: parsed.error.flatten(),
      });
    }

    const { status } = parsed.data;

    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT
         id,
         order_number,
         status,
         fulfillment_method,
         customer_name,
         customer_email,
         public_tracking_token
       FROM orders
       WHERE id = $1
       LIMIT 1`,
      [orderId]
    );

    if (existingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        error: "NOT_FOUND",
        message: "Commande introuvable.",
      });
    }

    const existingOrder = existingResult.rows[0];

    if (existingOrder.fulfillment_method === "pickup" && status === "in_delivery") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: "BAD_REQUEST",
        message: "Une commande en retrait ne peut pas passer en livraison.",
      });
    }

    await client.query(
      `UPDATE orders
       SET status = $2, updated_at = NOW()
       WHERE id = $1`,
      [orderId, status]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, status, note, changed_by_admin_id)
       VALUES ($1, $2, $3, NULL)`,
      [orderId, status, "Changed via RR Digital App"]
    );

    await client.query("COMMIT");

    // Send email after COMMIT — failure must not rollback the status change.
    try {
      await sendCustomerStatusEmailIfNeeded({
        order: {
          ...existingOrder,
          status,
        },
        previousStatus: existingOrder.status,
      });
    } catch (emailError) {
      console.error(
        "PATCH /orders/:id/status email error (order %d):",
        orderId,
        emailError.message
      );
    }

    // Fetch full safe order + items for response (same shape as GET /orders/:id).
    const [updatedOrderResult, itemsResult] = await Promise.all([
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

    const row = updatedOrderResult.rows[0];

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
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }
    console.error(
      "PATCH /api/internal/rr-digital/orders/:id/status error:",
      error.message
    );
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

module.exports = { internalRrDigitalRouter };
