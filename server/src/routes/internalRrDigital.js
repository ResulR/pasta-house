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


// [step9a-start]
// ---------------------------------------------------------------------------
// Step 9A — Schedule helpers
// Logic ported from publicCheckout.js (getStoreAvailability).
// These are intentionally private to this module; publicCheckout.js is
// NOT modified so that its behaviour remains unchanged.
// ---------------------------------------------------------------------------

const _SCHED_TZ = "Europe/Brussels";

const _SCHED_DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function _schedBrusselsDateParts(date) {
  date = date || new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: _SCHED_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const byType = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    dayKey: byType.weekday.toLowerCase(),
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function _schedShiftDate(isoDate, deltaDays) {
  const base = new Date(`${isoDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function _schedNormalizeDate(value) {
  return String(value).slice(0, 10);
}

function _schedBuildWindow({ serviceDate, openTime, closeTime }) {
  if (!openTime || !closeTime) return null;
  const startsAt = `${serviceDate}T${openTime}`;
  const endsAt =
    closeTime > openTime
      ? `${serviceDate}T${closeTime}`
      : `${_schedShiftDate(serviceDate, 1)}T${closeTime}`;
  return { startsAt, endsAt };
}

function _schedInWindow(localDateTime, w) {
  return localDateTime >= w.startsAt && localDateTime < w.endsAt;
}

// Computes the real-time store availability (mirrors getStoreAvailability()
// in publicCheckout.js). Called exclusively from GET /schedule.
async function _computeScheduleAvailability() {
  const now = new Date();
  const current = _schedBrusselsDateParts(now);
  const yesterday = _schedShiftDate(current.date, -1);
  const datesToCheck = [yesterday, current.date];

  const [hoursResult, overridesResult, closuresResult] = await Promise.all([
    pool.query(`SELECT day_key, is_open, open_time, close_time FROM opening_hours`),
    pool.query(
      `SELECT service_date::text AS service_date, is_closed, open_time, close_time, note
         FROM schedule_overrides
        WHERE service_date = ANY($1::date[])`,
      [datesToCheck]
    ),
    pool.query(
      `SELECT id, starts_at, ends_at, reason
         FROM exceptional_closures
        WHERE starts_at <= NOW() AND ends_at > NOW()
        ORDER BY starts_at ASC, id ASC`
    ),
  ]);

  const hoursByDayKey = new Map(hoursResult.rows.map((r) => [r.day_key, r]));
  const overridesByDate = new Map(
    overridesResult.rows.map((r) => [_schedNormalizeDate(r.service_date), r])
  );
  const activeClosure = closuresResult.rows[0] || null;
  const localNow = `${current.date}T${current.time}`;

  const candidates = datesToCheck.map((sd) => {
    const ov = overridesByDate.get(sd);
    if (ov) {
      if (ov.is_closed) {
        return { source: "override", serviceDate: sd, isClosed: true, note: ov.note || null, window: null };
      }
      return {
        source: "override",
        serviceDate: sd,
        isClosed: false,
        note: ov.note || null,
        window: _schedBuildWindow({ serviceDate: sd, openTime: ov.open_time, closeTime: ov.close_time }),
      };
    }
    const dk = _SCHED_DAY_KEYS[new Date(`${sd}T00:00:00Z`).getUTCDay()];
    const oh = hoursByDayKey.get(dk);
    if (!oh || !oh.is_open) {
      return { source: "opening_hours", serviceDate: sd, isClosed: true, note: null, window: null };
    }
    return {
      source: "opening_hours",
      serviceDate: sd,
      isClosed: false,
      note: null,
      window: _schedBuildWindow({ serviceDate: sd, openTime: oh.open_time, closeTime: oh.close_time }),
    };
  });

  const closedOverrideToday = candidates.find(
    (c) => c.source === "override" && c.isClosed && c.serviceDate === current.date
  );
  if (closedOverrideToday) {
    return {
      isOpen: false,
      reason: "SCHEDULE_OVERRIDE_CLOSED",
      message: closedOverrideToday.note
        ? `Le restaurant est ferme aujourd'hui : ${closedOverrideToday.note}`
        : "Le restaurant est ferme aujourd'hui.",
    };
  }

  const activeWindow = candidates
    .filter((c) => c.window)
    .find((c) => _schedInWindow(localNow, c.window));

  if (activeClosure) {
    return {
      isOpen: false,
      reason: "EXCEPTIONAL_CLOSURE_ACTIVE",
      message: activeClosure.reason
        ? `Le restaurant est actuellement ferme : ${activeClosure.reason}`
        : "Le restaurant est actuellement ferme exceptionnellement.",
    };
  }

  if (!activeWindow) {
    return {
      isOpen: false,
      reason: "OUTSIDE_OPENING_HOURS",
      message: "Le restaurant est actuellement ferme.",
    };
  }

  return { isOpen: true, reason: null, message: null };
}

// ---------------------------------------------------------------------------
// GET /api/internal/rr-digital/schedule
// Read-only. Returns opening hours, closures, overrides, store status and
// real-time availability. No Stripe fields. Protected by requireInternalToken.
// ---------------------------------------------------------------------------
internalRrDigitalRouter.get("/schedule", requireInternalToken, async (_req, res) => {
  try {
    const [
      openingHoursResult,
      closuresResult,
      overridesResult,
      siteSettingsResult,
      deliverySettingsResult,
    ] = await Promise.all([
      pool.query(
        `SELECT day_key, is_open, open_time, close_time
           FROM opening_hours
          ORDER BY
            CASE day_key
              WHEN 'monday'    THEN 1
              WHEN 'tuesday'   THEN 2
              WHEN 'wednesday' THEN 3
              WHEN 'thursday'  THEN 4
              WHEN 'friday'    THEN 5
              WHEN 'saturday'  THEN 6
              WHEN 'sunday'    THEN 7
              ELSE 999
            END`
      ),
      pool.query(
        `SELECT id, starts_at, ends_at, reason
           FROM exceptional_closures
          ORDER BY starts_at ASC, id ASC`
      ),
      pool.query(
        `SELECT id,
                TO_CHAR(service_date, 'YYYY-MM-DD') AS service_date,
                is_closed,
                open_time,
                close_time,
                note
           FROM schedule_overrides
          ORDER BY service_date ASC, id ASC`
      ),
      pool.query(
        `SELECT orders_enabled, orders_disabled_reason
           FROM site_settings
          WHERE singleton = TRUE
          LIMIT 1`
      ),
      pool.query(
        `SELECT delivery_enabled, pickup_enabled, rush_mode_enabled
           FROM delivery_settings
          WHERE singleton = TRUE
          LIMIT 1`
      ),
    ]);

    const siteRow = siteSettingsResult.rows[0] || null;
    const delivRow = deliverySettingsResult.rows[0] || null;

    const storeAvailability = await _computeScheduleAvailability();

    return res.status(200).json({
      ok: true,
      data: {
        openingHours: openingHoursResult.rows.map((r) => ({
          dayKey: r.day_key,
          isOpen: r.is_open,
          openTime: String(r.open_time).slice(0, 5),
          closeTime: String(r.close_time).slice(0, 5),
        })),
        closures: closuresResult.rows.map((r) => ({
          id: String(r.id),
          startsAt: r.starts_at instanceof Date ? r.starts_at.toISOString() : String(r.starts_at),
          endsAt: r.ends_at instanceof Date ? r.ends_at.toISOString() : String(r.ends_at),
          reason: r.reason || null,
        })),
        overrides: overridesResult.rows.map((r) => ({
          id: String(r.id),
          serviceDate: r.service_date,
          isClosed: r.is_closed,
          openTime: r.open_time ? String(r.open_time).slice(0, 5) : null,
          closeTime: r.close_time ? String(r.close_time).slice(0, 5) : null,
          note: r.note || null,
        })),
        storeStatus: {
          ordersEnabled: siteRow ? siteRow.orders_enabled : false,
          ordersDisabledReason:
            siteRow && siteRow.orders_disabled_reason ? siteRow.orders_disabled_reason : null,
          deliveryEnabled: delivRow ? delivRow.delivery_enabled : false,
          pickupEnabled: delivRow ? delivRow.pickup_enabled : false,
          rushModeEnabled: delivRow ? delivRow.rush_mode_enabled : false,
        },
        storeAvailability,
      },
    });
  } catch (error) {
    console.error("GET /api/internal/rr-digital/schedule error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});
// [step9a-end]

module.exports = { internalRrDigitalRouter };
