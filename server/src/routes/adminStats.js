const express = require("express");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");

const adminStatsRouter = express.Router();

adminStatsRouter.get("/stats", requireAdminAuth, async (_req, res) => {
  try {
    const summaryResult = await pool.query(`
      WITH bounds AS (
        SELECT
          date_trunc('day', now()) AS start_of_day,
          date_trunc('week', now()) AS start_of_week
      )
      SELECT
        COUNT(*) FILTER (
          WHERE orders.created_at >= bounds.start_of_day
        ) AS orders_today,
        COUNT(*) FILTER (
          WHERE orders.created_at >= bounds.start_of_week
        ) AS orders_this_week,
        COALESCE(SUM(orders.total_cents) FILTER (
          WHERE orders.created_at >= bounds.start_of_day
            AND orders.status <> 'cancelled'
            AND orders.paid_at IS NOT NULL
        ), 0) AS revenue_today_cents,
        COALESCE(SUM(orders.total_cents) FILTER (
          WHERE orders.created_at >= bounds.start_of_week
            AND orders.status <> 'cancelled'
            AND orders.paid_at IS NOT NULL
        ), 0) AS revenue_this_week_cents
      FROM orders
      CROSS JOIN bounds
    `);

    const topItemsResult = await pool.query(`
      SELECT
        COALESCE(order_items.product_name_snapshot, 'Article inconnu') AS product_name,
        COALESCE(order_items.variant_name_snapshot, order_items.variant_code_snapshot, '') AS variant_name,
        SUM(order_items.quantity)::int AS quantity_sold,
        SUM(order_items.line_total_cents)::int AS revenue_cents
      FROM order_items
      JOIN orders ON orders.id = order_items.order_id
      WHERE orders.paid_at IS NOT NULL
        AND orders.status <> 'cancelled'
        AND order_items.item_type = 'product'
        AND orders.created_at >= date_trunc('week', now())
      GROUP BY
        order_items.product_name_snapshot,
        order_items.variant_name_snapshot,
        order_items.variant_code_snapshot
      ORDER BY quantity_sold DESC, revenue_cents DESC, product_name ASC
      LIMIT 5
    `);

    const summary = summaryResult.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        ordersToday: Number(summary.orders_today || 0),
        ordersThisWeek: Number(summary.orders_this_week || 0),
        revenueTodayCents: Number(summary.revenue_today_cents || 0),
        revenueThisWeekCents: Number(summary.revenue_this_week_cents || 0),
        topItemsThisWeek: topItemsResult.rows.map((item) => ({
          productName: item.product_name,
          variantName: item.variant_name,
          quantitySold: Number(item.quantity_sold || 0),
          revenueCents: Number(item.revenue_cents || 0),
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { adminStatsRouter };
