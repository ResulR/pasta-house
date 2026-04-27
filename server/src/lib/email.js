const { Resend } = require("resend");
const { env } = require("../config/env");

let resendInstance = null;

function getResend() {
  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendInstance) {
    resendInstance = new Resend(env.resendApiKey);
  }

  return resendInstance;
}

async function sendEmail({ to, subject, html, text }) {
  if (!env.resendApiKey || !env.resendFromEmail) {
    throw new Error("Resend email configuration is incomplete.");
  }

  const resend = getResend();

  const payload = {
    from: env.resendFromEmail,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (text) {
    payload.text = text;
  }

  if (env.resendReplyToEmail) {
    payload.replyTo = env.resendReplyToEmail;
  }

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    throw new Error(error.message || "Failed to send email with Resend.");
  }

  return data;
}

module.exports = { sendEmail };