const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { env } = require("./config/env");
const { pool } = require("./db/pool");
const { publicMenuRouter } = require("./routes/publicMenu");
const { publicCheckoutRouter } = require("./routes/publicCheckout");
const { adminAuthRouter } = require("./routes/adminAuth");
const { adminProductsRouter } = require("./routes/adminProducts");
const { adminBeveragesRouter } = require("./routes/adminBeverages");
const { adminOrdersRouter } = require("./routes/adminOrders");
const { adminScheduleRouter } = require("./routes/adminSchedule");
const { adminDeliveryRouter } = require("./routes/adminDelivery");
const { adminCategoriesRouter } = require("./routes/adminCategories");
const { adminSettingsRouter } = require("./routes/adminSettings");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "font-src": ["'self'", "https:", "data:"],
      "form-action": ["'self'", "https://checkout.stripe.com"],
      "frame-ancestors": ["'none'"],
      "img-src": ["'self'", "data:", "https:"],
      "object-src": ["'none'"],
      "script-src": ["'self'", "https://js.stripe.com"],
      "script-src-attr": ["'none'"],
      "style-src": ["'self'", "https:", "'unsafe-inline'"],
      "connect-src": [
        "'self'",
        "https://api.stripe.com",
        "https://checkout.stripe.com",
      ],
      "upgrade-insecure-requests": [],
    },
  },
}));

app.use(cors({
  origin: env.appBaseUrl,
  credentials: true,
}));

app.use("/api/public/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api/public", publicMenuRouter);
app.use("/api/public", publicCheckoutRouter);
app.use("/api/admin", adminAuthRouter);
app.use("/api/admin", adminProductsRouter);
app.use("/api/admin", adminBeveragesRouter);
app.use("/api/admin", adminOrdersRouter);
app.use("/api/admin", adminScheduleRouter);
app.use("/api/admin", adminDeliveryRouter);
app.use("/api/admin", adminCategoriesRouter);
app.use("/api/admin", adminSettingsRouter);

app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    return res.status(200).json({
      ok: true,
      service: "pasta-house-server",
      db: "connected",
      now: result.rows[0].now,
    });
  } catch (error) {
    console.error("Health check error:", error);
    return res.status(500).json({
      ok: false,
      service: "pasta-house-server",
      db: "disconnected",
    });
  }
});

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});