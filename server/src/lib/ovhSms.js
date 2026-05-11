const crypto = require("crypto");
const { env } = require("../config/env");

const OVH_ENDPOINTS = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
};

function getOvhBaseUrl() {
  return OVH_ENDPOINTS[env.ovhEndpoint] || OVH_ENDPOINTS["ovh-eu"];
}

function ensureOvhSmsConfig() {
  const missing = [];

  if (!env.ovhApplicationKey) missing.push("OVH_APPLICATION_KEY");
  if (!env.ovhApplicationSecret) missing.push("OVH_APPLICATION_SECRET");
  if (!env.ovhConsumerKey) missing.push("OVH_CONSUMER_KEY");
  if (!env.ovhSmsServiceName) missing.push("OVH_SMS_SERVICE_NAME");
  if (!env.ovhSmsSender) missing.push("OVH_SMS_SENDER");
  if (!env.adminNotificationPhone) missing.push("ADMIN_NOTIFICATION_PHONE");

  if (missing.length > 0) {
    throw new Error(`OVH SMS configuration incomplete: ${missing.join(", ")}`);
  }
}

async function getOvhTimestamp() {
  const response = await fetch(`${getOvhBaseUrl()}/auth/time`);

  if (!response.ok) {
    throw new Error(`OVH auth time request failed with status ${response.status}`);
  }

  const timestamp = await response.text();
  const normalizedTimestamp = Number(timestamp);

  if (!Number.isInteger(normalizedTimestamp) || normalizedTimestamp <= 0) {
    throw new Error("Invalid OVH auth timestamp response.");
  }

  return String(normalizedTimestamp);
}

function buildOvhSignature({ method, url, body, timestamp }) {
  const signaturePayload = [
    env.ovhApplicationSecret,
    env.ovhConsumerKey,
    method,
    url,
    body,
    timestamp,
  ].join("+");

  return `$1$${crypto.createHash("sha1").update(signaturePayload).digest("hex")}`;
}

async function sendOvhSms({ message }) {
  ensureOvhSmsConfig();

  const method = "POST";
  const baseUrl = getOvhBaseUrl();
  const url = `${baseUrl}/sms/${encodeURIComponent(env.ovhSmsServiceName)}/jobs`;
  const body = JSON.stringify({
    message,
    receivers: [env.adminNotificationPhone],
    sender: env.ovhSmsSender,
    noStopClause: true,
  });

  const timestamp = await getOvhTimestamp();
  const signature = buildOvhSignature({
    method,
    url,
    body,
    timestamp,
  });

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Ovh-Application": env.ovhApplicationKey,
      "X-Ovh-Consumer": env.ovhConsumerKey,
      "X-Ovh-Signature": signature,
      "X-Ovh-Timestamp": timestamp,
    },
    body,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`OVH SMS send failed with status ${response.status}: ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (_error) {
    return responseText;
  }
}

module.exports = { sendOvhSms };
