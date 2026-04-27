const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");

const adminOrdersRouter = express.Router();

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
          fulfillment_method
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