const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8080",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4000",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "",
  resendReplyToEmail: process.env.RESEND_REPLY_TO_EMAIL || "",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME || "pasta_house",
    user: process.env.DB_USER || "pasta",
    password: process.env.DB_PASSWORD || "",
  },
};

module.exports = { env };