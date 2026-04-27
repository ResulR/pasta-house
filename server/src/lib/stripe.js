const Stripe = require("stripe");
const { env } = require("../config/env");

let stripeInstance = null;

function getStripe() {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(env.stripeSecretKey);
  }

  return stripeInstance;
}

module.exports = { getStripe }; 