const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { env } = require("../config/env");
const { getStripe } = require("../lib/stripe");
const { sendEmail } = require("../lib/email");
const { checkoutSessionRateLimit } = require("../middlewares/checkoutSessionRateLimit");

const publicCheckoutRouter = express.Router();

const cartItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pates"),
    productId: z.union([z.string().min(1), z.number().int().positive()]),
    size: z.enum(["ravier", "assiette"]),
    quantity: z.number().int().positive("La quantité doit être supérieure à 0."),
  }),
  z.object({
    type: z.literal("paninis"),
    productId: z.union([z.string().min(1), z.number().int().positive()]),
    formula: z.enum(["seul", "menu"]),
    quantity: z.number().int().positive("La quantité doit être supérieure à 0."),
    beverageId: z.union([z.string().min(1), z.number().int().positive()]).optional(),
  }),
]);

const validateCheckoutSchema = z.object({
  mode: z.enum(["livraison", "retrait"]),
  items: z.array(cartItemSchema).min(1, "Le panier ne peut pas être vide."),
});

const customerSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  telephone: z
    .string()
    .trim()
    .min(1, "Le téléphone est obligatoire.")
    .refine(isValidPhoneNumber, "Numéro de téléphone invalide."),
  email: z.string().trim().email("Email invalide."),
  adresse: z.string().trim().optional().default(""),
  commune: z.string().trim().optional().default(""),
  codePostal: z.string().trim().optional().default(""),
  instructions: z.string().trim().optional().default(""),
  note: z.string().trim().optional().default(""),
});

const createOrderSchema = z.object({
  mode: z.enum(["livraison", "retrait"]),
  items: z.array(cartItemSchema).min(1, "Le panier ne peut pas être vide."),
  customer: customerSchema,
});

const recoverTrackingSchema = z.object({
  email: z.string().trim().email("Email invalide."),
});

function normalizePhoneNumber(value) {
  return String(value)
    .trim()
    .replace(/[()./\-\s]+/g, "");
}

function isValidPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);

  if (!normalized) {
    return false;
  }

  return /^\+?\d{8,15}$/.test(normalized);
}

function toPositiveInteger(value) {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `PH-${year}${month}${day}-${hours}${minutes}${seconds}-${randomPart}`;
}

const BRUSSELS_TIME_ZONE = "Europe/Brussels";

const dayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getBrusselsDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    dayKey: byType.weekday.toLowerCase(),
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function shiftIsoDate(isoDateString, deltaDays) {
  const baseDate = new Date(`${isoDateString}T00:00:00Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + deltaDays);
  return baseDate.toISOString().slice(0, 10);
}

function normalizeServiceDate(value) {
  return String(value).slice(0, 10);
}

function buildServiceWindow({ serviceDate, openTime, closeTime }) {
  if (!openTime || !closeTime) {
    return null;
  }

  const startsAt = `${serviceDate}T${openTime}`;
  const endsAt = closeTime > openTime
    ? `${serviceDate}T${closeTime}`
    : `${shiftIsoDate(serviceDate, 1)}T${closeTime}`;

  return {
    startsAt,
    endsAt,
  };
}

function isLocalDateTimeInWindow(localDateTime, window) {
  return localDateTime >= window.startsAt && localDateTime < window.endsAt;
}

async function getStoreAvailability() {
  const now = new Date();
  const currentParts = getBrusselsDateParts(now);
  const yesterdayDate = shiftIsoDate(currentParts.date, -1);
  const serviceDatesToCheck = [yesterdayDate, currentParts.date];

  const [openingHoursResult, overridesResult, closuresResult] = await Promise.all([
    pool.query(
      `
        SELECT
          day_key,
          is_open,
          open_time,
          close_time
        FROM opening_hours
      `
    ),
    pool.query(
      `
        SELECT
          service_date::text AS service_date,
          is_closed,
          open_time,
          close_time,
          note
        FROM schedule_overrides
        WHERE service_date = ANY($1::date[])
      `,
      [serviceDatesToCheck]
    ),
    pool.query(
      `
        SELECT
          id,
          starts_at,
          ends_at,
          reason
        FROM exceptional_closures
        WHERE starts_at <= NOW()
          AND ends_at > NOW()
        ORDER BY starts_at ASC, id ASC
      `
    ),
  ]);

  const openingHoursByDayKey = new Map(
    openingHoursResult.rows.map((row) => [row.day_key, row])
  );

  const overridesByServiceDate = new Map(
    overridesResult.rows.map((row) => [
      normalizeServiceDate(row.service_date),
      row,
    ])
  );

  const activeClosure = closuresResult.rows[0] || null;
  const localDateTime = `${currentParts.date}T${currentParts.time}`;

  const candidates = serviceDatesToCheck.map((serviceDate) => {
    const override = overridesByServiceDate.get(serviceDate);

    if (override) {
      if (override.is_closed) {
        return {
          source: "override",
          serviceDate,
          isClosed: true,
          note: override.note || null,
          window: null,
        };
      }

      return {
        source: "override",
        serviceDate,
        isClosed: false,
        note: override.note || null,
        window: buildServiceWindow({
          serviceDate,
          openTime: override.open_time,
          closeTime: override.close_time,
        }),
      };
    }

    const serviceDayKey = dayKeys[new Date(`${serviceDate}T00:00:00Z`).getUTCDay()];
    const openingHours = openingHoursByDayKey.get(serviceDayKey);

    if (!openingHours || !openingHours.is_open) {
      return {
        source: "opening_hours",
        serviceDate,
        isClosed: true,
        note: null,
        window: null,
      };
    }

    return {
      source: "opening_hours",
      serviceDate,
      isClosed: false,
      note: null,
      window: buildServiceWindow({
        serviceDate,
        openTime: openingHours.open_time,
        closeTime: openingHours.close_time,
      }),
    };
  });

  const matchingClosedOverride = candidates.find(
    (candidate) =>
      candidate.source === "override" &&
      candidate.isClosed &&
      candidate.serviceDate === currentParts.date
  );

  if (matchingClosedOverride) {
    return {
      isOpen: false,
      reason: "SCHEDULE_OVERRIDE_CLOSED",
      message: matchingClosedOverride.note
        ? `Le restaurant est fermé aujourd'hui : ${matchingClosedOverride.note}`
        : "Le restaurant est fermé aujourd'hui.",
    };
  }

  const candidateWindows = candidates.filter((candidate) => candidate.window);

  const activeWindow = candidateWindows.find((candidate) =>
    isLocalDateTimeInWindow(localDateTime, candidate.window)
  );

  if (activeClosure) {
    return {
      isOpen: false,
      reason: "EXCEPTIONAL_CLOSURE_ACTIVE",
      message: activeClosure.reason
        ? `Le restaurant est actuellement fermé : ${activeClosure.reason}`
        : "Le restaurant est actuellement fermé exceptionnellement.",
    };
  }

  if (!activeWindow) {
    return {
      isOpen: false,
      reason: "OUTSIDE_OPENING_HOURS",
      message: "Le restaurant est actuellement fermé.",
    };
  }

  if (activeWindow.source === "override") {
    return {
      isOpen: true,
      reason: null,
      message: null,
    };
  }

  return {
    isOpen: true,
    reason: null,
    message: null,
  };
}

function validateCustomerPayload(mode, customer) {
  if (mode !== "livraison") {
    return null;
  }

  const deliveryFieldErrors = {};

  if (!customer.adresse.trim()) {
    deliveryFieldErrors.adresse = ["L'adresse est obligatoire."];
  }

  if (!customer.commune.trim()) {
    deliveryFieldErrors.commune = ["La commune est obligatoire."];
  }

  if (!customer.codePostal.trim()) {
    deliveryFieldErrors.codePostal = ["Le code postal est obligatoire."];
  }

  if (Object.keys(deliveryFieldErrors).length === 0) {
    return null;
  }

  return {
    ok: false,
    error: "INVALID_REQUEST_BODY",
    message: "Corps de requête invalide.",
    errors: {
      formErrors: [],
      fieldErrors: deliveryFieldErrors,
    },
  };
}

async function createOrderRecord({ client, mode, customer, validatedCart }) {
  const fulfillmentMethod = mode === "livraison" ? "delivery" : "pickup";
  const customerNote = mode === "livraison"
    ? (customer.instructions.trim() || null)
    : (customer.note.trim() || null);

  let orderNumber = generateOrderNumber();

  while (true) {
    const existingOrderNumberResult = await client.query(
      `
        SELECT id
        FROM orders
        WHERE order_number = $1
        LIMIT 1
      `,
      [orderNumber]
    );

    if (existingOrderNumberResult.rowCount === 0) {
      break;
    }

    orderNumber = generateOrderNumber();
  }

  const createdOrderResult = await client.query(
    `
      INSERT INTO orders (
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
        currency
      )
      VALUES (
        $1,
        'awaiting_payment',
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13
      )
      RETURNING
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
        created_at
    `,
    [
      orderNumber,
      fulfillmentMethod,
      customer.nom.trim(),
      normalizePhoneNumber(customer.telephone),
      customer.email.trim(),
      mode === "livraison" ? customer.adresse.trim() : null,
      mode === "livraison" ? customer.codePostal.trim() : null,
      mode === "livraison" ? customer.commune.trim() : null,
      customerNote,
      validatedCart.subtotalCents,
      validatedCart.deliveryFeeCents,
      validatedCart.totalCents,
      validatedCart.currency,
    ]
  );

  const createdOrder = createdOrderResult.rows[0];

  for (let index = 0; index < validatedCart.items.length; index += 1) {
    const item = validatedCart.items[index];
    const lineNumber = index + 1;

    if (item.itemType === "product") {
      await client.query(
        `
          INSERT INTO order_items (
            order_id,
            line_number,
            item_type,
            product_id,
            product_variant_id,
            product_name_snapshot,
            variant_code_snapshot,
            variant_name_snapshot,
            unit_price_cents,
            quantity,
            line_total_cents
          )
          VALUES ($1, $2, 'product', $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          createdOrder.id,
          lineNumber,
          Number(item.productId),
          Number(item.variantId),
          item.productName,
          item.variantCode,
          item.variantName,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents,
        ]
      );

      continue;
    }

    await client.query(
      `
        INSERT INTO order_items (
          order_id,
          line_number,
          item_type,
          beverage_id,
          beverage_name_snapshot,
          unit_price_cents,
          quantity,
          line_total_cents
        )
        VALUES ($1, $2, 'beverage', $3, $4, $5, $6, $7)
      `,
      [
        createdOrder.id,
        lineNumber,
        Number(item.beverageId),
        item.beverageName,
        item.unitPriceCents,
        item.quantity,
        item.lineTotalCents,
      ]
    );
  }

  await client.query(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note,
        changed_by_admin_id
      )
      VALUES ($1, 'awaiting_payment', $2, NULL)
    `,
    [createdOrder.id, "Commande créée en attente de paiement."]
  );

  return createdOrder;
}

function buildStripeLineItems(validatedCart) {
  const lineItems = [];
  const itemsByKey = new Map();

  for (const item of validatedCart.items) {
    let key = "";

    if (item.itemType === "product") {
      key = `product::${item.productId}::${item.variantId}`;
    } else {
      key = `beverage::${item.beverageId}::${item.unitPriceCents}`;
    }

    const existing = itemsByKey.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    if (item.itemType === "product") {
      itemsByKey.set(key, {
        price_data: {
          currency: validatedCart.currency.toLowerCase(),
          product_data: {
            name: item.productName,
            description: item.variantName,
          },
          unit_amount: item.unitPriceCents,
        },
        quantity: item.quantity,
      });
      continue;
    }

    itemsByKey.set(key, {
      price_data: {
        currency: validatedCart.currency.toLowerCase(),
        product_data: {
          name: item.beverageName,
        },
        unit_amount: item.unitPriceCents,
      },
      quantity: item.quantity,
    });
  }

  for (const lineItem of itemsByKey.values()) {
    lineItems.push(lineItem);
  }

  if (validatedCart.deliveryFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: validatedCart.currency.toLowerCase(),
        product_data: {
          name: "Frais de livraison",
        },
        unit_amount: validatedCart.deliveryFeeCents,
      },
      quantity: 1,
    });
  }

  return lineItems;
}

function buildEstimatedTimeLabel({ fulfillmentMethod, deliverySettings }) {
  if (!deliverySettings) {
    return null;
  }

  if (fulfillmentMethod === "delivery") {
    const minutes = Number(deliverySettings.estimated_delivery_time_min);

    if (!Number.isInteger(minutes) || minutes <= 0) {
      return null;
    }

    return `environ ${minutes} min`;
  }

  const minutes = Number(deliverySettings.estimated_pickup_time_min);

  if (!Number.isInteger(minutes) || minutes <= 0) {
    return null;
  }

  return `environ ${minutes} min`;
}

async function getOrderEmailPayload({ client, orderId }) {
  const [orderResult, itemsResult, deliverySettingsResult] = await Promise.all([
    client.query(
      `
        SELECT
          id,
          order_number,
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
          created_at,
          public_tracking_token
        FROM orders
        WHERE id = $1
        LIMIT 1
      `,
      [orderId]
    ),
    client.query(
      `
        SELECT
          line_number,
          item_type,
          product_name_snapshot,
          variant_name_snapshot,
          beverage_name_snapshot,
          unit_price_cents,
          quantity,
          line_total_cents
        FROM order_items
        WHERE order_id = $1
        ORDER BY line_number ASC
      `,
      [orderId]
    ),
    client.query(
      `
        SELECT
          estimated_delivery_time_min,
          estimated_pickup_time_min,
          rush_mode_enabled
        FROM delivery_settings
        WHERE singleton = TRUE
        LIMIT 1
      `
    ),
  ]);

  if (orderResult.rowCount === 0) {
    throw new Error(`Order ${orderId} not found for email payload.`);
  }

  return {
    order: orderResult.rows[0],
    items: itemsResult.rows,
    deliverySettings: deliverySettingsResult.rows[0] || null,
  };
}

function formatPriceFromCents(cents, currency = "EUR") {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency,
  }).format(Number(cents) / 100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildOrderConfirmationEmailHtml({ order, items, deliverySettings }) {
  const modeLabel =
    order.fulfillment_method === "delivery" ? "Livraison" : "Retrait";

  const trackingUrl = `${env.appBaseUrl}/suivi/${encodeURIComponent(order.public_tracking_token)}`;
  const estimatedTimeLabel = buildEstimatedTimeLabel({
    fulfillmentMethod: order.fulfillment_method,
    deliverySettings,
  });
  const rushMessage = deliverySettings?.rush_mode_enabled
    ? "Nous faisons face à une forte affluence en ce moment. Votre commande pourrait prendre un peu plus de temps que d’habitude. Merci pour votre patience."
    : null;

  const itemsHtml = items
    .map((item) => {
      const title =
        item.item_type === "product"
          ? `${item.product_name_snapshot || "Produit"}${item.variant_name_snapshot ? ` — ${item.variant_name_snapshot}` : ""}`
          : `${item.beverage_name_snapshot || "Boisson"}`;

      return `
        <tr>
          <td style="padding:8px 0; vertical-align:top;">
            ${escapeHtml(title)}
          </td>
          <td style="padding:8px 0; vertical-align:top; text-align:center;">
            ${escapeHtml(item.quantity)}
          </td>
          <td style="padding:8px 0; vertical-align:top; text-align:right;">
            ${escapeHtml(formatPriceFromCents(item.line_total_cents, order.currency))}
          </td>
        </tr>
      `;
    })
    .join("");

  const addressHtml =
    order.fulfillment_method === "delivery"
      ? `
        <p style="margin:0 0 8px 0;"><strong>Adresse :</strong> ${escapeHtml(order.delivery_address_line1 || "")}</p>
        <p style="margin:0 0 8px 0;"><strong>Ville :</strong> ${escapeHtml(order.delivery_postal_code || "")} ${escapeHtml(order.delivery_city || "")}</p>
      `
      : "";

  const noteLabel =
    order.fulfillment_method === "delivery" ? "Instructions" : "Note";

  const noteHtml = order.customer_note
    ? `<p style="margin:0 0 8px 0;"><strong>${escapeHtml(noteLabel)} :</strong> ${escapeHtml(order.customer_note)}</p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif; color:#111; line-height:1.5;">
      <h1 style="margin:0 0 16px 0;">Merci pour votre commande Pasta House</h1>
      <p style="margin:0 0 12px 0;">
        Votre paiement a bien été confirmé.
      </p>
      <p style="margin:0 0 8px 0;"><strong>Numéro de commande :</strong> ${escapeHtml(order.order_number)}</p>
      <p style="margin:0 0 8px 0;"><strong>Mode :</strong> ${escapeHtml(modeLabel)}</p>
      <p style="margin:0 0 8px 0;"><strong>Nom :</strong> ${escapeHtml(order.customer_name)}</p>
      <p style="margin:0 0 8px 0;"><strong>Téléphone :</strong> ${escapeHtml(order.customer_phone)}</p>
      ${estimatedTimeLabel ? `<p style="margin:0 0 8px 0;"><strong>Temps estimé :</strong> ${escapeHtml(estimatedTimeLabel)}</p>` : ""}
      ${rushMessage ? `<p style="margin:0 0 16px 0; color:#8a5a00;"><strong>Info affluence :</strong> ${escapeHtml(rushMessage)}</p>` : ""}

      ${addressHtml}
      ${noteHtml}

      <div style="margin:24px 0; padding:16px; background:#f8f5f1; border:1px solid #e7ddd2; border-radius:12px;">
        <p style="margin:0 0 12px 0; font-weight:700;">Suivre votre commande</p>
        <p style="margin:0 0 16px 0; color:#555;">
          Vous pouvez suivre l’état de votre commande à tout moment depuis ce lien :
        </p>
        <p style="margin:0 0 16px 0;">
          <a
            href="${escapeHtml(trackingUrl)}"
            style="display:inline-block; padding:12px 18px; background:#111; color:#fff; text-decoration:none; border-radius:10px; font-weight:700;"
          >
            Suivre ma commande
          </a>
        </p>
        <p style="margin:0; color:#555; word-break:break-all;">
          ${escapeHtml(trackingUrl)}
        </p>
      </div>

      <h2 style="margin:24px 0 12px 0; font-size:18px;">Récapitulatif</h2>

      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px 0; text-align:left; border-bottom:1px solid #ddd;">Article</th>
            <th style="padding:8px 0; text-align:center; border-bottom:1px solid #ddd;">Qté</th>
            <th style="padding:8px 0; text-align:right; border-bottom:1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="margin-top:20px;">
        <p style="margin:0 0 6px 0;"><strong>Sous-total :</strong> ${escapeHtml(formatPriceFromCents(order.subtotal_cents, order.currency))}</p>
        <p style="margin:0 0 6px 0;"><strong>Livraison :</strong> ${escapeHtml(formatPriceFromCents(order.delivery_fee_cents, order.currency))}</p>
        <p style="margin:0; font-size:18px;"><strong>Total payé :</strong> ${escapeHtml(formatPriceFromCents(order.total_cents, order.currency))}</p>
      </div>

      <p style="margin-top:24px; color:#555;">
        Conservez cet email, il contient votre numéro de commande et votre lien de suivi.
      </p>
    </div>
  `;
}

function buildOrderConfirmationEmailText({ order, items, deliverySettings }) {
  const modeLabel =
    order.fulfillment_method === "delivery" ? "Livraison" : "Retrait";

  const trackingUrl = `${env.appBaseUrl}/suivi/${encodeURIComponent(order.public_tracking_token)}`;
  const estimatedTimeLabel = buildEstimatedTimeLabel({
    fulfillmentMethod: order.fulfillment_method,
    deliverySettings,
  });
  const rushMessage = deliverySettings?.rush_mode_enabled
    ? "Nous faisons face à une forte affluence en ce moment. Votre commande pourrait prendre un peu plus de temps que d’habitude. Merci pour votre patience."
    : null;

  const lines = items.map((item) => {
    const title =
      item.item_type === "product"
        ? `${item.product_name_snapshot || "Produit"}${item.variant_name_snapshot ? ` - ${item.variant_name_snapshot}` : ""}`
        : `${item.beverage_name_snapshot || "Boisson"}`;

    return `- ${title} x${item.quantity} : ${formatPriceFromCents(item.line_total_cents, order.currency)}`;
  });

  return [
    "Merci pour votre commande Pasta House.",
    "",
    "Votre paiement a bien été confirmé.",
    `Numéro de commande : ${order.order_number}`,
    `Mode : ${modeLabel}`,
    `Nom : ${order.customer_name}`,
    `Téléphone : ${order.customer_phone}`,
    `Email : ${order.customer_email}`,
    estimatedTimeLabel ? `Temps estimé : ${estimatedTimeLabel}` : null,
    rushMessage ? `Info affluence : ${rushMessage}` : null,
    order.fulfillment_method === "delivery"
      ? `Adresse : ${order.delivery_address_line1 || ""}, ${order.delivery_postal_code || ""} ${order.delivery_city || ""}`
      : null,
    order.customer_note ? `Note : ${order.customer_note}` : null,
    "",
    "Suivi de commande :",
    trackingUrl,
    "",
    "Récapitulatif :",
    ...lines,
    "",
    `Sous-total : ${formatPriceFromCents(order.subtotal_cents, order.currency)}`,
    `Livraison : ${formatPriceFromCents(order.delivery_fee_cents, order.currency)}`,
    `Total payé : ${formatPriceFromCents(order.total_cents, order.currency)}`,
    "",
    "Conservez cet email, il contient votre numéro de commande et votre lien de suivi.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendOrderPaidConfirmationEmail({ client, orderId }) {
  const payload = await getOrderEmailPayload({ client, orderId });

  await sendEmail({
    to: payload.order.customer_email,
    subject: `Pasta House — confirmation de commande ${payload.order.order_number}`,
    html: buildOrderConfirmationEmailHtml(payload),
    text: buildOrderConfirmationEmailText(payload),
  });
}

function buildTrackingRecoveryEmailHtml({ order }) {
  const trackingUrl = `${env.appBaseUrl}/suivi/${encodeURIComponent(order.public_tracking_token)}`;
  const modeLabel =
    order.fulfillment_method === "delivery" ? "Livraison" : "Retrait";

  return `
    <div style="font-family:Arial,sans-serif; color:#111; line-height:1.5;">
      <h1 style="margin:0 0 16px 0;">Retrouver votre commande Pasta House</h1>
      <p style="margin:0 0 12px 0;">
        Vous nous avez demandé de retrouver votre lien de suivi.
      </p>
      <p style="margin:0 0 8px 0;"><strong>Numéro de commande :</strong> ${escapeHtml(order.order_number)}</p>
      <p style="margin:0 0 16px 0;"><strong>Mode :</strong> ${escapeHtml(modeLabel)}</p>

      <div style="margin:24px 0; padding:16px; background:#f8f5f1; border:1px solid #e7ddd2; border-radius:12px;">
        <p style="margin:0 0 12px 0; font-weight:700;">Suivre votre commande</p>
        <p style="margin:0 0 16px 0; color:#555;">
          Cliquez sur ce lien pour accéder au suivi de votre commande :
        </p>
        <p style="margin:0 0 16px 0;">
          <a
            href="${escapeHtml(trackingUrl)}"
            style="display:inline-block; padding:12px 18px; background:#111; color:#fff; text-decoration:none; border-radius:10px; font-weight:700;"
          >
            Suivre ma commande
          </a>
        </p>
        <p style="margin:0; color:#555; word-break:break-all;">
          ${escapeHtml(trackingUrl)}
        </p>
      </div>

      <p style="margin-top:24px; color:#555;">
        Si vous avez fait une erreur dans l’adresse email saisie ou si vous rencontrez encore un problème, contactez directement le restaurant.
      </p>
    </div>
  `;
}

function buildTrackingRecoveryEmailText({ order }) {
  const trackingUrl = `${env.appBaseUrl}/suivi/${encodeURIComponent(order.public_tracking_token)}`;
  const modeLabel =
    order.fulfillment_method === "delivery" ? "Livraison" : "Retrait";

  return [
    "Retrouver votre commande Pasta House.",
    "",
    "Vous nous avez demandé de retrouver votre lien de suivi.",
    `Numéro de commande : ${order.order_number}`,
    `Mode : ${modeLabel}`,
    "",
    "Suivi de commande :",
    trackingUrl,
    "",
    "Si vous avez fait une erreur dans l’adresse email saisie ou si vous rencontrez encore un problème, contactez directement le restaurant.",
  ].join("\n");
}

async function sendTrackingRecoveryEmail({ order }) {
  await sendEmail({
    to: order.customer_email,
    subject: `Pasta House — lien de suivi pour la commande ${order.order_number}`,
    html: buildTrackingRecoveryEmailHtml({ order }),
    text: buildTrackingRecoveryEmailText({ order }),
  });
}

const ORDER_TRACKING_RECOVERY_MAX_ATTEMPTS_PER_DAY = 2;
const ORDER_TRACKING_RECOVERY_MAX_ORDER_AGE_HOURS = 5;

function getRequestIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

async function isAuthenticatedAdminRequest(req) {
  try {
    if (!env.jwtSecret) {
      return false;
    }

    const token = req.cookies?.admin_token;

    if (!token) {
      return false;
    }

    let payload;

    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (_error) {
      return false;
    }

    if (payload.role !== "admin") {
      return false;
    }

    const adminId = Number(payload.sub);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return false;
    }

    const result = await pool.query(
      `
        SELECT id, is_active
        FROM admins
        WHERE id = $1
        LIMIT 1
      `,
      [adminId]
    );

    if (result.rowCount === 0) {
      return false;
    }

    return Boolean(result.rows[0].is_active);
  } catch (error) {
    console.error("Optional admin auth check error:", error);
    return false;
  }
}

function getOrderIdFromStripeSession(session) {
  const metadataOrderId = session?.metadata?.order_id;
  const clientReferenceId = session?.client_reference_id;

  const orderId = metadataOrderId || clientReferenceId;
  const normalizedOrderId = toPositiveInteger(orderId);

  return normalizedOrderId;
}

async function markOrderPaid({ client, orderId, paymentIntentId, note }) {
  const existingOrderResult = await client.query(
    `
      SELECT id, status, stripe_payment_intent_id, paid_at
      FROM orders
      WHERE id = $1
      LIMIT 1
    `,
    [orderId]
  );

  if (existingOrderResult.rowCount === 0) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const existingOrder = existingOrderResult.rows[0];

  if (existingOrder.status === "paid") {
    await client.query(
      `
        UPDATE orders
        SET stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id),
            paid_at = COALESCE(paid_at, NOW()),
            updated_at = NOW()
        WHERE id = $2
      `,
      [paymentIntentId || null, orderId]
    );

    return;
  }

  await client.query(
    `
      UPDATE orders
      SET status = 'paid',
          stripe_payment_intent_id = $1,
          paid_at = COALESCE(paid_at, NOW()),
          updated_at = NOW()
      WHERE id = $2
    `,
    [paymentIntentId || null, orderId]
  );

  await client.query(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note,
        changed_by_admin_id
      )
      VALUES ($1, 'paid', $2, NULL)
    `,
    [orderId, note]
  );
}

async function markOrderPaymentFailed({ client, orderId, paymentIntentId, note }) {
  const existingOrderResult = await client.query(
    `
      SELECT id, status, stripe_payment_intent_id
      FROM orders
      WHERE id = $1
      LIMIT 1
    `,
    [orderId]
  );

  if (existingOrderResult.rowCount === 0) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const existingOrder = existingOrderResult.rows[0];

  if (existingOrder.status === "payment_failed") {
    await client.query(
      `
        UPDATE orders
        SET stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id),
            updated_at = NOW()
        WHERE id = $2
      `,
      [paymentIntentId || null, orderId]
    );

    return;
  }

  await client.query(
    `
      UPDATE orders
      SET status = 'payment_failed',
          stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id),
          updated_at = NOW()
      WHERE id = $2
    `,
    [paymentIntentId || null, orderId]
  );

  await client.query(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note,
        changed_by_admin_id
      )
      VALUES ($1, 'payment_failed', $2, NULL)
    `,
    [orderId, note]
  );
}

async function processStripeWebhookEvent({ client, event }) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = getOrderIdFromStripeSession(session);

      if (!orderId) {
        throw new Error("Missing order_id in checkout.session.completed.");
      }

      if (session.payment_status !== "paid") {
        return;
      }

      await markOrderPaid({
        client,
        orderId,
        paymentIntentId: session.payment_intent || null,
        note: "Paiement Stripe confirmé via webhook checkout.session.completed.",
      });

      try {
        await sendOrderPaidConfirmationEmail({ client, orderId });
      } catch (emailError) {
        console.error("Order paid email send error:", emailError);
      }

      return;
    }

    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const orderId = getOrderIdFromStripeSession(session);

      if (!orderId) {
        throw new Error("Missing order_id in checkout.session.async_payment_succeeded.");
      }

      await markOrderPaid({
        client,
        orderId,
        paymentIntentId: session.payment_intent || null,
        note: "Paiement Stripe asynchrone confirmé via webhook.",
      });

      try {
        await sendOrderPaidConfirmationEmail({ client, orderId });
      } catch (emailError) {
        console.error("Order paid email send error:", emailError);
      }

      return;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const orderId = getOrderIdFromStripeSession(session);

      if (!orderId) {
        throw new Error("Missing order_id in checkout.session.async_payment_failed.");
      }

      await markOrderPaymentFailed({
        client,
        orderId,
        paymentIntentId: session.payment_intent || null,
        note: "Le paiement Stripe asynchrone a échoué.",
      });

      return;
    }

    default:
      return;
  }
}

async function validateCartPayload({ mode, items }) {
  const normalizedItems = [];
  const validationErrors = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const normalizedProductId = toPositiveInteger(item.productId);

    if (!normalizedProductId) {
      validationErrors.push({
        code: "INVALID_PRODUCT_ID",
        message: "Identifiant produit invalide.",
        itemIndex: index,
      });
      continue;
    }

    if (item.type === "pates") {
      normalizedItems.push({
        itemIndex: index,
        type: item.type,
        productId: normalizedProductId,
        variantCode: item.size,
        quantity: item.quantity,
      });
      continue;
    }

    const normalizedBeverageId = item.beverageId === undefined
      ? null
      : toPositiveInteger(item.beverageId);

    if (item.formula === "menu" && !normalizedBeverageId) {
      validationErrors.push({
        code: "MISSING_MENU_BEVERAGE",
        message: "Une boisson est obligatoire pour un panini menu.",
        itemIndex: index,
      });
      continue;
    }

    if (item.beverageId !== undefined && !normalizedBeverageId) {
      validationErrors.push({
        code: "INVALID_BEVERAGE_ID",
        message: "Identifiant boisson invalide.",
        itemIndex: index,
      });
      continue;
    }

    normalizedItems.push({
      itemIndex: index,
      type: item.type,
      productId: normalizedProductId,
      variantCode: item.formula,
      quantity: item.quantity,
      beverageId: normalizedBeverageId,
    });
  }

  if (validationErrors.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "CART_VALIDATION_FAILED",
        details: validationErrors,
      },
    };
  }

  const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const beverageIds = [
    ...new Set(
      normalizedItems
        .filter((item) => item.type === "paninis" && item.beverageId)
        .map((item) => item.beverageId)
    ),
  ];

  const [productsResult, variantsResult, beveragesResult, deliverySettingsResult] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          category_id,
          name,
          is_active,
          is_available
        FROM products
        WHERE id = ANY($1::bigint[])
      `,
      [productIds]
    ),
    pool.query(
      `
        SELECT
          id,
          product_id,
          code,
          name,
          price_cents,
          is_active
        FROM product_variants
        WHERE product_id = ANY($1::bigint[])
      `,
      [productIds]
    ),
    beverageIds.length > 0
      ? pool.query(
          `
            SELECT
              id,
              name,
              price_cents,
              is_active,
              is_menu_eligible
            FROM beverages
            WHERE id = ANY($1::bigint[])
          `,
          [beverageIds]
        )
      : Promise.resolve({ rows: [] }),
    pool.query(
      `
        SELECT
          delivery_enabled,
          pickup_enabled,
          delivery_fee_cents,
          minimum_order_cents
        FROM delivery_settings
        LIMIT 1
      `
    ),
  ]);

  const deliverySettings = deliverySettingsResult.rows[0] || null;

  if (!deliverySettings) {
    return {
      ok: false,
      statusCode: 500,
      body: {
        ok: false,
        error: "DELIVERY_SETTINGS_NOT_FOUND",
      },
    };
  }

  if (mode === "livraison" && !deliverySettings.delivery_enabled) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "DELIVERY_DISABLED",
        message: "La livraison est actuellement indisponible.",
      },
    };
  }

  if (mode === "retrait" && !deliverySettings.pickup_enabled) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "PICKUP_DISABLED",
        message: "Le retrait est actuellement indisponible.",
      },
    };
  }

  const productsById = new Map(
    productsResult.rows.map((product) => [String(product.id), product])
  );

  const variantsByProductAndCode = new Map();

  for (const variant of variantsResult.rows) {
    variantsByProductAndCode.set(
      `${String(variant.product_id)}::${variant.code}`,
      variant
    );
  }

  const beveragesById = new Map(
    beveragesResult.rows.map((beverage) => [String(beverage.id), beverage])
  );

  const validatedItems = [];
  let subtotalCents = 0;

  for (const item of normalizedItems) {
    const product = productsById.get(String(item.productId));

    if (!product) {
      validationErrors.push({
        code: "PRODUCT_NOT_FOUND",
        message: "Produit introuvable.",
        itemIndex: item.itemIndex,
      });
      continue;
    }

    if (!product.is_active) {
      validationErrors.push({
        code: "PRODUCT_INACTIVE",
        message: `Le produit "${product.name}" n'est pas actif.`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    if (!product.is_available) {
      validationErrors.push({
        code: "PRODUCT_UNAVAILABLE",
        message: `Le produit "${product.name}" n'est plus disponible.`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    const variant = variantsByProductAndCode.get(
      `${String(item.productId)}::${item.variantCode}`
    );

    if (!variant) {
      validationErrors.push({
        code: "VARIANT_NOT_FOUND",
        message: `La variante demandée est introuvable pour "${product.name}".`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    if (!variant.is_active) {
      validationErrors.push({
        code: "VARIANT_INACTIVE",
        message: `La variante "${variant.name}" n'est pas active pour "${product.name}".`,
        itemIndex: item.itemIndex,
      });
      continue;
    }

    const lineTotalCents = Number(variant.price_cents) * item.quantity;

    validatedItems.push({
      itemType: "product",
      productId: String(product.id),
      productName: product.name,
      variantId: String(variant.id),
      variantCode: variant.code,
      variantName: variant.name,
      unitPriceCents: Number(variant.price_cents),
      quantity: item.quantity,
      lineTotalCents,
    });

    subtotalCents += lineTotalCents;

    if (item.type === "paninis" && item.beverageId) {
      const beverage = beveragesById.get(String(item.beverageId));

      if (!beverage) {
        validationErrors.push({
          code: "BEVERAGE_NOT_FOUND",
          message: "Boisson introuvable pour le panini.",
          itemIndex: item.itemIndex,
        });
        continue;
      }

      if (!beverage.is_active) {
        validationErrors.push({
          code: "BEVERAGE_INACTIVE",
          message: `La boisson "${beverage.name}" n'est pas active.`,
          itemIndex: item.itemIndex,
        });
        continue;
      }

      if (item.variantCode === "menu") {
        if (!beverage.is_menu_eligible) {
          validationErrors.push({
            code: "BEVERAGE_NOT_MENU_ELIGIBLE",
            message: `La boisson "${beverage.name}" n'est pas autorisée dans un menu.`,
            itemIndex: item.itemIndex,
          });
          continue;
        }

        validatedItems.push({
          itemType: "beverage",
          beverageId: String(beverage.id),
          beverageName: beverage.name,
          unitPriceCents: 0,
          quantity: item.quantity,
          lineTotalCents: 0,
        });

        continue;
      }

      const beverageUnitPriceCents = Number(beverage.price_cents);

      if (!Number.isInteger(beverageUnitPriceCents) || beverageUnitPriceCents < 0) {
        validationErrors.push({
          code: "BEVERAGE_PRICE_INVALID",
          message: `Le prix de la boisson "${beverage.name}" est invalide.`,
          itemIndex: item.itemIndex,
        });
        continue;
      }

      const beverageLineTotalCents = beverageUnitPriceCents * item.quantity;

      validatedItems.push({
        itemType: "beverage",
        beverageId: String(beverage.id),
        beverageName: beverage.name,
        unitPriceCents: beverageUnitPriceCents,
        quantity: item.quantity,
        lineTotalCents: beverageLineTotalCents,
      });

      subtotalCents += beverageLineTotalCents;
    }
  }

  if (validationErrors.length > 0) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "CART_VALIDATION_FAILED",
        details: validationErrors,
      },
    };
  }

  const minimumOrderCents = Number(deliverySettings.minimum_order_cents);
  const deliveryFeeCents = mode === "livraison"
    ? Number(deliverySettings.delivery_fee_cents)
    : 0;

  const meetsMinimum = mode === "livraison"
    ? subtotalCents >= minimumOrderCents
    : true;

  if (!meetsMinimum) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        ok: false,
        error: "CART_VALIDATION_FAILED",
        details: [
          {
            code: "MINIMUM_NOT_REACHED",
            message: "Le minimum de commande pour la livraison n'est pas atteint.",
          },
        ],
      },
    };
  }

  const totalCents = subtotalCents + deliveryFeeCents;

  return {
    ok: true,
    data: {
      mode,
      currency: "EUR",
      items: validatedItems,
      subtotalCents,
      deliveryFeeCents,
      minimumOrderCents,
      meetsMinimum,
      totalCents,
    },
  };
}

publicCheckoutRouter.post("/stripe/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
    return res.status(500).json({
      ok: false,
      error: "STRIPE_WEBHOOK_NOT_CONFIGURED",
    });
  }

  if (!signature) {
    return res.status(400).json({
      ok: false,
      error: "MISSING_STRIPE_SIGNATURE",
    });
  }

  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.stripeWebhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error);
    return res.status(400).json({
      ok: false,
      error: "INVALID_STRIPE_SIGNATURE",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingEventResult = await client.query(
      `
        SELECT id, processed_at
        FROM webhook_events
        WHERE provider = $1
          AND event_id = $2
        LIMIT 1
      `,
      ["stripe", event.id]
    );

    if (existingEventResult.rowCount > 0) {
      await client.query("COMMIT");
      return res.status(200).json({ received: true, duplicate: true });
    }

    const insertedEventResult = await client.query(
      `
        INSERT INTO webhook_events (
          provider,
          event_id,
          event_type,
          payload
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      ["stripe", event.id, event.type, JSON.stringify(event)]
    );

    const webhookEventId = insertedEventResult.rows[0].id;

    await client.query("SAVEPOINT stripe_webhook_processing");

    try {
      await processStripeWebhookEvent({ client, event });

      await client.query(
        `
          UPDATE webhook_events
          SET processed_at = NOW(),
              processing_error = NULL
          WHERE id = $1
        `,
        [webhookEventId]
      );

      await client.query("COMMIT");

      return res.status(200).json({ received: true });
    } catch (processingError) {
      await client.query("ROLLBACK TO SAVEPOINT stripe_webhook_processing");

      await client.query(
        `
          UPDATE webhook_events
          SET processing_error = $2
          WHERE id = $1
        `,
        [webhookEventId, processingError.message]
      );

      await client.query("COMMIT");

      console.error("Stripe webhook processing error:", processingError);

      return res.status(500).json({
        ok: false,
        error: "STRIPE_WEBHOOK_PROCESSING_FAILED",
      });
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/public/stripe/webhook error:", error);

    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

publicCheckoutRouter.post("/checkout/validate", async (req, res) => {
  try {
    const parsed = validateCheckoutSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_BODY",
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const validationResult = await validateCartPayload(parsed.data);

    if (!validationResult.ok) {
      return res.status(validationResult.statusCode).json(validationResult.body);
    }

    const storeAvailability = await getStoreAvailability();

    if (!storeAvailability.isOpen) {
      return res.status(400).json({
        ok: false,
        error: "STORE_CLOSED",
        message: storeAvailability.message,
        details: [
          {
            code: storeAvailability.reason,
            message: storeAvailability.message,
          },
        ],
      });
    }

    return res.status(200).json({
      ok: true,
      data: validationResult.data,
    });
  } catch (error) {
    console.error("POST /api/public/checkout/validate error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

publicCheckoutRouter.post("/checkout/session", checkoutSessionRateLimit, async (req, res) => {
  const client = await pool.connect();

  try {
    if (!env.stripeSecretKey) {
      return res.status(500).json({
        ok: false,
        error: "STRIPE_NOT_CONFIGURED",
        message: "Le paiement Stripe n'est pas encore configuré sur le serveur.",
      });
    }

    const parsed = createOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_BODY",
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { mode, items, customer } = parsed.data;
    const customerValidationError = validateCustomerPayload(mode, customer);

    if (customerValidationError) {
      return res.status(400).json(customerValidationError);
    }

    const validationResult = await validateCartPayload({ mode, items });

    if (!validationResult.ok) {
      return res.status(validationResult.statusCode).json(validationResult.body);
    }

    const storeAvailability = await getStoreAvailability();

    if (!storeAvailability.isOpen) {
      return res.status(400).json({
        ok: false,
        error: "STORE_CLOSED",
        message: storeAvailability.message,
      });
    }

    const validatedCart = validationResult.data;
    const stripe = getStripe();
    const stripeLineItems = buildStripeLineItems(validatedCart);

    await client.query("BEGIN");

    const createdOrder = await createOrderRecord({
      client,
      mode,
      customer,
      validatedCart,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${env.appBaseUrl}/commande-confirmee?orderNumber=${encodeURIComponent(createdOrder.order_number)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appBaseUrl}/paiement-annule?orderNumber=${encodeURIComponent(createdOrder.order_number)}`,
      client_reference_id: String(createdOrder.id),
      customer_email: customer.email.trim(),
      metadata: {
        order_id: String(createdOrder.id),
        order_number: createdOrder.order_number,
      },
      line_items: stripeLineItems,
    });

    await client.query(
      `
        UPDATE orders
        SET stripe_checkout_session_id = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [session.id, createdOrder.id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      data: {
        orderId: String(createdOrder.id),
        orderNumber: createdOrder.order_number,
        status: createdOrder.status,
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/public/checkout/session error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

publicCheckoutRouter.post("/orders", async (req, res) => {
  const client = await pool.connect();

  try {
    const parsed = createOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_BODY",
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { mode, items, customer } = parsed.data;
    const customerValidationError = validateCustomerPayload(mode, customer);

    if (customerValidationError) {
      return res.status(400).json(customerValidationError);
    }

    const validationResult = await validateCartPayload({ mode, items });

    if (!validationResult.ok) {
      return res.status(validationResult.statusCode).json(validationResult.body);
    }

    const storeAvailability = await getStoreAvailability();

    if (!storeAvailability.isOpen) {
      return res.status(400).json({
        ok: false,
        error: "STORE_CLOSED",
        message: storeAvailability.message,
      });
    }

    const validatedCart = validationResult.data;

    await client.query("BEGIN");

    const createdOrder = await createOrderRecord({
      client,
      mode,
      customer,
      validatedCart,
    });

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      data: {
        id: String(createdOrder.id),
        orderNumber: createdOrder.order_number,
        status: createdOrder.status,
        fulfillmentMethod: createdOrder.fulfillment_method,
        customerName: createdOrder.customer_name,
        customerPhone: createdOrder.customer_phone,
        customerEmail: createdOrder.customer_email,
        deliveryAddressLine1: createdOrder.delivery_address_line1,
        deliveryPostalCode: createdOrder.delivery_postal_code,
        deliveryCity: createdOrder.delivery_city,
        customerNote: createdOrder.customer_note,
        subtotalCents: Number(createdOrder.subtotal_cents),
        deliveryFeeCents: Number(createdOrder.delivery_fee_cents),
        totalCents: Number(createdOrder.total_cents),
        currency: createdOrder.currency,
        createdAt: createdOrder.created_at,
        items: validatedCart.items,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/public/orders error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

publicCheckoutRouter.get("/orders/confirmation", async (req, res) => {
  try {
    const sessionId = typeof req.query.session_id === "string"
      ? req.query.session_id.trim()
      : "";

    const orderNumber = typeof req.query.orderNumber === "string"
      ? req.query.orderNumber.trim()
      : "";

    if (!sessionId || !orderNumber) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST",
        message: "session_id et orderNumber sont obligatoires.",
      });
    }

    const result = await pool.query(
      `
        SELECT
          id,
          order_number,
          status,
          fulfillment_method,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          paid_at,
          created_at,
          public_tracking_token
        FROM orders
        WHERE stripe_checkout_session_id = $1
          AND order_number = $2
        LIMIT 1
      `,
      [sessionId, orderNumber]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: "ORDER_NOT_FOUND",
        message: "Commande introuvable.",
      });
    }

    const order = result.rows[0];
    const paymentConfirmed = order.status === "paid" || order.paid_at !== null;

    return res.status(200).json({
      ok: true,
      data: {
        orderNumber: order.order_number,
        status: order.status,
        fulfillmentMethod: order.fulfillment_method,
        paidAt: order.paid_at,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        paymentConfirmed,
        createdAt: order.created_at,
        trackingToken: order.public_tracking_token,
      },
    });
  } catch (error) {
    console.error("GET /api/public/orders/confirmation error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

publicCheckoutRouter.get("/orders/tracking/:token", async (req, res) => {
  try {
    const trackingToken = typeof req.params.token === "string"
      ? req.params.token.trim()
      : "";

    if (!trackingToken) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST",
        message: "Le token de suivi est obligatoire.",
      });
    }

    const orderResult = await pool.query(
      `
        SELECT
          id,
          order_number,
          status,
          fulfillment_method,
          paid_at,
          created_at,
          updated_at
        FROM orders
        WHERE public_tracking_token = $1
        LIMIT 1
      `,
      [trackingToken]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: "ORDER_NOT_FOUND",
        message: "Commande introuvable.",
      });
    }

    const order = orderResult.rows[0];

    const statusHistoryResult = await pool.query(
      `
        SELECT
          status,
          created_at
        FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [order.id]
    );

    const paymentConfirmed = order.status === "paid" || order.paid_at !== null;

    return res.status(200).json({
      ok: true,
      data: {
        orderNumber: order.order_number,
        status: order.status,
        fulfillmentMethod: order.fulfillment_method,
        paidAt: order.paid_at,
        paymentConfirmed,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        statusHistory: statusHistoryResult.rows.map((row) => ({
          status: row.status,
          createdAt: row.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/public/orders/tracking/:token error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

publicCheckoutRouter.post("/orders/recover-tracking", async (req, res) => {
  const client = await pool.connect();

  try {
    const parsed = recoverTrackingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_BODY",
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const requestIp = getRequestIp(req);
    const isAdminRequest = await isAuthenticatedAdminRequest(req);

    if (!isAdminRequest) {
      const [emailAttemptsResult, ipAttemptsResult] = await Promise.all([
        client.query(
          `
            SELECT COUNT(*)::int AS attempt_count
            FROM order_tracking_recovery_attempts
            WHERE email = $1
              AND created_at >= NOW() - INTERVAL '1 day'
          `,
          [normalizedEmail]
        ),
        client.query(
          `
            SELECT COUNT(*)::int AS attempt_count
            FROM order_tracking_recovery_attempts
            WHERE ip_address = $1
              AND created_at >= NOW() - INTERVAL '1 day'
          `,
          [requestIp]
        ),
      ]);

      const emailAttemptCount = emailAttemptsResult.rows[0]?.attempt_count ?? 0;
      const ipAttemptCount = ipAttemptsResult.rows[0]?.attempt_count ?? 0;

      if (
        emailAttemptCount >= ORDER_TRACKING_RECOVERY_MAX_ATTEMPTS_PER_DAY ||
        ipAttemptCount >= ORDER_TRACKING_RECOVERY_MAX_ATTEMPTS_PER_DAY
      ) {
        return res.status(429).json({
          ok: false,
          error: "ORDER_TRACKING_RECOVERY_LIMIT_REACHED",
          message:
            "Trop de tentatives ont déjà été effectuées pour retrouver une commande. Merci de nous contacter directement.",
        });
      }

      await client.query(
        `
          INSERT INTO order_tracking_recovery_attempts (
            email,
            ip_address
          )
          VALUES ($1, $2)
        `,
        [normalizedEmail, requestIp]
      );
    }

    const orderResult = await client.query(
      `
        SELECT
          id,
          order_number,
          fulfillment_method,
          customer_email,
          public_tracking_token,
          status,
          created_at
        FROM orders
        WHERE lower(customer_email) = $1
          AND status = ANY($2::text[])
          AND created_at >= NOW() - ($3::text || ' hours')::interval
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [
        normalizedEmail,
        ["paid", "preparing", "ready", "in_delivery", "completed"],
        String(ORDER_TRACKING_RECOVERY_MAX_ORDER_AGE_HOURS),
      ]
    );

    if (orderResult.rowCount > 0) {
      try {
        await sendTrackingRecoveryEmail({ order: orderResult.rows[0] });
      } catch (emailError) {
        console.error("Tracking recovery email send error:", emailError);
      }
    }

    return res.status(200).json({
      ok: true,
      message:
        "Si une commande récente correspond à cette adresse, un email de suivi vient d’être envoyé. Pensez à vérifier aussi vos spams, promotions et courriers indésirables.",
    });
  } catch (error) {
    console.error("POST /api/public/orders/recover-tracking error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

module.exports = { publicCheckoutRouter };