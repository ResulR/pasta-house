const { env } = require("../config/env");

const ADMIN_AUTH_COOKIE_NAME = "admin_token";
const isProduction = env.nodeEnv === "production";

function getAdminAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function setAdminAuthCookie(res, token) {
  res.cookie(ADMIN_AUTH_COOKIE_NAME, token, getAdminAuthCookieOptions());
}

function clearAdminAuthCookie(res) {
  res.cookie(ADMIN_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

module.exports = {
  ADMIN_AUTH_COOKIE_NAME,
  getAdminAuthCookieOptions,
  setAdminAuthCookie,
  clearAdminAuthCookie,
};