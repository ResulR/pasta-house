const { env } = require("../config/env");

async function notifyRrDigitalNewOrder({ orderId, session }) {
  const baseUrl = env.rrDigitalNotifyBaseUrl;
  const token = env.rrDigitalNotifyToken;
  const companyId = env.rrDigitalNotifyCompanyId;

  if (!baseUrl || !token || !companyId) {
    console.warn("[rr-digital] notifyRrDigitalNewOrder: configuration manquante, notification ignoree.");
    return;
  }

  const url = baseUrl.replace(/\/+$/, "") + "/api/internal/pasta-house/new-order";

  const body = {
    companyId,
    orderId: String(orderId),
    orderNumber: session.metadata?.order_number ?? null,
    totalCents: typeof session.amount_total === "number" ? session.amount_total : null,
    fulfillmentMethod: session.metadata?.fulfillment_method ?? null,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": token,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn("[rr-digital] notifyRrDigitalNewOrder: statut", response.status, text.slice(0, 100));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("[rr-digital] notifyRrDigitalNewOrder: erreur fetch:", message);
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { notifyRrDigitalNewOrder };
