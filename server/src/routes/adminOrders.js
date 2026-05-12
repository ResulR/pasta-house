const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { env } = require("../config/env");
const { sendEmail } = require("../lib/email");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");

const adminOrdersRouter = express.Router();

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

  if (!shouldSendCustomerStatusEmail({
    fulfillmentMethod: order.fulfillment_method,
    previousStatus,
    nextStatus: order.status,
  })) {
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

function formatCsvCell(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function formatEuroFromCents(cents) {
  return (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
}

function buildCsvRows(rows) {
  const header = [
    "Numéro commande",
    "Date",
    "Statut",
    "Mode",
    "Nom client",
    "Téléphone",
    "Email",
    "Adresse",
    "Code postal",
    "Ville",
    "Note client",
    "Sous-total EUR",
    "Frais livraison EUR",
    "Total EUR",
    "Devise",
    "Payée le",
    "Stripe payment intent",
    "Articles",
  ];

  const body = rows.map((row) => [
    row.order_number,
    row.created_at ? new Date(row.created_at).toISOString() : "",
    row.status,
    row.fulfillment_method,
    row.customer_name,
    row.customer_phone,
    row.customer_email,
    row.delivery_address_line1,
    row.delivery_postal_code,
    row.delivery_city,
    row.customer_note,
    formatEuroFromCents(row.subtotal_cents),
    formatEuroFromCents(row.delivery_fee_cents),
    formatEuroFromCents(row.total_cents),
    row.currency,
    row.paid_at ? new Date(row.paid_at).toISOString() : "",
    row.stripe_payment_intent_id,
    row.items_summary,
  ]);

  return [header, ...body]
    .map((line) => line.map(formatCsvCell).join(";"))
    .join("\n");
}

const exportOrdersSchema = z.object({
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

adminOrdersRouter.get("/orders/export", requireAdminAuth, async (req, res) => {
  try {
    const parsed = exportOrdersSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Paramètres d’export invalides. Format attendu : YYYY-MM-DD.",
        errors: parsed.error.flatten(),
      });
    }

    const { from, to } = parsed.data;

    if (from && to && from > to) {
      return res.status(400).json({
        ok: false,
        message: "La date de début doit être avant la date de fin.",
      });
    }

    const filters = [];
    const values = [];

    if (from) {
      values.push(from);
      filters.push(`orders.created_at >= $${values.length}::date`);
    }

    if (to) {
      values.push(to);
      filters.push(`orders.created_at < ($${values.length}::date + INTERVAL '1 day')`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const exportResult = await pool.query(
      `
        SELECT
          orders.order_number,
          orders.created_at,
          orders.status,
          orders.fulfillment_method,
          orders.customer_name,
          orders.customer_phone,
          orders.customer_email,
          orders.delivery_address_line1,
          orders.delivery_postal_code,
          orders.delivery_city,
          orders.customer_note,
          orders.subtotal_cents,
          orders.delivery_fee_cents,
          orders.total_cents,
          orders.currency,
          orders.paid_at,
          orders.stripe_payment_intent_id,
          COALESCE(
            string_agg(
              CASE
                WHEN order_items.item_type = 'product'
                  THEN concat(
                    order_items.quantity,
                    'x ',
                    COALESCE(order_items.product_name_snapshot, 'Article inconnu'),
                    CASE
                      WHEN COALESCE(order_items.variant_name_snapshot, order_items.variant_code_snapshot, '') <> ''
                        THEN concat(' (', COALESCE(order_items.variant_name_snapshot, order_items.variant_code_snapshot), ')')
                      ELSE ''
                    END
                  )
                WHEN order_items.item_type = 'beverage'
                  THEN concat(
                    order_items.quantity,
                    'x ',
                    COALESCE(order_items.beverage_name_snapshot, 'Boisson inconnue')
                  )
                ELSE concat(order_items.quantity, 'x Article inconnu')
              END,
              ' | '
              ORDER BY order_items.line_number ASC, order_items.id ASC
            ),
            ''
          ) AS items_summary
        FROM orders
        LEFT JOIN order_items ON order_items.order_id = orders.id
        ${whereClause}
        GROUP BY orders.id
        ORDER BY orders.created_at DESC, orders.id DESC
      `,
      values
    );

    const csv = buildCsvRows(exportResult.rows);
    const suffix = from || to ? `${from || "start"}_${to || "today"}` : "all";
    const filename = `pasta-house-commandes-${suffix}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(`\uFEFF${csv}\n`);
  } catch (error) {
    console.error("GET /api/admin/orders/export error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminOrdersRouter.get("/orders", requireAdminAuth, async (_req, res) => {
  try {
    const [ordersResult, orderItemsResult, statusHistoryResult] = await Promise.all([
      pool.query(`
        SELECT
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
          stripe_payment_intent_id,
          created_at,
          updated_at
        FROM orders
        ORDER BY created_at DESC, id DESC
      `),
      pool.query(`
        SELECT
          id,
          order_id,
          line_number,
          item_type,
          product_id,
          product_variant_id,
          beverage_id,
          product_name_snapshot,
          variant_code_snapshot,
          variant_name_snapshot,
          beverage_name_snapshot,
          unit_price_cents,
          quantity,
          line_total_cents,
          created_at
        FROM order_items
        ORDER BY order_id DESC, line_number ASC, id ASC
      `),
      pool.query(`
        SELECT
          id,
          order_id,
          status,
          note,
          changed_by_admin_id,
          created_at
        FROM order_status_history
        ORDER BY order_id DESC, created_at ASC, id ASC
      `),
    ]);

    const itemsByOrderId = new Map();

    for (const item of orderItemsResult.rows) {
      const orderIdKey = String(item.order_id);

      if (!itemsByOrderId.has(orderIdKey)) {
        itemsByOrderId.set(orderIdKey, []);
      }

      itemsByOrderId.get(orderIdKey).push({
        id: String(item.id),
        lineNumber: item.line_number,
        itemType: item.item_type,
        productId: item.product_id ? String(item.product_id) : null,
        productVariantId: item.product_variant_id ? String(item.product_variant_id) : null,
        beverageId: item.beverage_id ? String(item.beverage_id) : null,
        productNameSnapshot: item.product_name_snapshot,
        variantCodeSnapshot: item.variant_code_snapshot,
        variantNameSnapshot: item.variant_name_snapshot,
        beverageNameSnapshot: item.beverage_name_snapshot,
        unitPriceCents: Number(item.unit_price_cents),
        quantity: item.quantity,
        lineTotalCents: Number(item.line_total_cents),
        createdAt: item.created_at,
      });
    }

    const statusHistoryByOrderId = new Map();

    for (const historyRow of statusHistoryResult.rows) {
      const orderIdKey = String(historyRow.order_id);

      if (!statusHistoryByOrderId.has(orderIdKey)) {
        statusHistoryByOrderId.set(orderIdKey, []);
      }

      statusHistoryByOrderId.get(orderIdKey).push({
        id: String(historyRow.id),
        status: historyRow.status,
        note: historyRow.note,
        changedByAdminId: historyRow.changed_by_admin_id
          ? String(historyRow.changed_by_admin_id)
          : null,
        createdAt: historyRow.created_at,
      });
    }

    const orders = ordersResult.rows.map((order) => {
      const orderIdKey = String(order.id);

      return {
        id: orderIdKey,
        orderNumber: order.order_number,
        status: order.status,
        fulfillmentMethod: order.fulfillment_method,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerEmail: order.customer_email,
        deliveryAddressLine1: order.delivery_address_line1,
        deliveryPostalCode: order.delivery_postal_code,
        deliveryCity: order.delivery_city,
        customerNote: order.customer_note,
        subtotalCents: Number(order.subtotal_cents),
        deliveryFeeCents: Number(order.delivery_fee_cents),
        totalCents: Number(order.total_cents),
        currency: order.currency,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: itemsByOrderId.get(orderIdKey) || [],
        statusHistory: statusHistoryByOrderId.get(orderIdKey) || [],
      };
    });

    return res.status(200).json({
      ok: true,
      data: {
        orders,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/orders error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

const updateOrderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "awaiting_payment",
    "paid",
    "preparing",
    "ready",
    "in_delivery",
    "completed",
    "cancelled",
    "payment_failed",
  ]),
  note: z.string().trim().optional().default(""),
});

adminOrdersRouter.patch("/orders/:id/status", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  const client = await pool.connect();

  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant commande invalide.",
      });
    }

    const parsed = updateOrderStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { status, note } = parsed.data;

    await client.query("BEGIN");

    const existingOrderResult = await client.query(
      `
        SELECT
          id,
          order_number,
          status,
          fulfillment_method,
          customer_name,
          customer_email,
          public_tracking_token
        FROM orders
        WHERE id = $1
        LIMIT 1
      `,
      [orderId]
    );

    if (existingOrderResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Commande introuvable.",
      });
    }
    const existingOrder = existingOrderResult.rows[0];

        if (
      status === "awaiting_payment" ||
      status === "paid" ||
      status === "payment_failed" ||
      status === "pending"
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Les statuts de paiement sont gérés automatiquement par le système de paiement.",
      });
    }

    if (
      existingOrder.fulfillment_method === "pickup" &&
      status === "in_delivery"
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        message: "Une commande en retrait ne peut pas passer en livraison.",
      });
    }

    const updatedOrderResult = await client.query(
      `
        UPDATE orders
        SET
          status = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          order_number,
          status,
          fulfillment_method,
          customer_name,
          customer_email,
          public_tracking_token,
          updated_at
      `,
      [orderId, status]
    );

    await client.query(
      `
        INSERT INTO order_status_history (
          order_id,
          status,
          note,
          changed_by_admin_id
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        orderId,
        status,
        note || null,
        req.admin?.id ? Number(req.admin.id) : null,
      ]
    );

    await client.query("COMMIT");

    const updatedOrder = updatedOrderResult.rows[0];

    try {
      await sendCustomerStatusEmailIfNeeded({
        order: updatedOrder,
        previousStatus: existingOrder.status,
      });
    } catch (emailError) {
      console.error("Customer status email send error:", emailError);
    }

    return res.status(200).json({
      ok: true,
      data: {
        id: String(updatedOrder.id),
        orderNumber: updatedOrder.order_number,
        previousStatus: existingOrder.status,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updated_at,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("PATCH /api/admin/orders/:id/status error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

module.exports = { adminOrdersRouter };