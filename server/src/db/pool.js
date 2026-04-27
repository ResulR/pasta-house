const { Pool } = require("pg");
const { env } = require("../config/env");

const useSsl =
  env.nodeEnv === "production" ||
  String(process.env.DB_SSL || "").toLowerCase() === "true";

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