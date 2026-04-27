const crypto = require("crypto");
const { env } = require("../config/env");

const ADMIN_CSRF_COOKIE_NAME = "admin_csrf_token";
const isProduction = env.nodeEnv === "production";

function getAdminCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function generateAdminCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function setAdminCsrfCookie(res, token = generateAdminCsrfToken()) {
  res.cookie(ADMIN_CSRF_COOKIE_NAME, token, getAdminCsrfCookieOptions());
  return token;
}

function clearAdminCsrfCookie(res) {
  res.clearCookie(ADMIN_CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

module.exports = {
  ADMIN_CSRF_COOKIE_NAME,
  generateAdminCsrfToken,
  setAdminCsrfCookie,
  clearAdminCsrfCookie,
};