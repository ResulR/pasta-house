const rateLimit = require("express-rate-limit");

const checkoutSessionRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "CHECKOUT_SESSION_RATE_LIMIT_REACHED",
    message:
      "Trop de tentatives de création de session de paiement ont été effectuées. Merci de réessayer dans quelques minutes.",
  },
});

module.exports = { checkoutSessionRateLimit };