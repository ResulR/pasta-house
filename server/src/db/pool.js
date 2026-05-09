const { Pool } = require("pg");
const { env } = require("../config/env");

const dbSslValue = String(process.env.DB_SSL || "").toLowerCase();

const useSsl =
  dbSslValue === "true" ||
  (dbSslValue !== "false" &&
    env.nodeEnv === "production" &&
    env.db.host !== "127.0.0.1" &&
    env.db.host !== "localhost");

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  ssl: useSsl
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

module.exports = { pool };