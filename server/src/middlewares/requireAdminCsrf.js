const crypto = require("crypto");
const { ADMIN_CSRF_COOKIE_NAME } = require("../lib/adminCsrf");

function safeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function requireAdminCsrf(req, res, next) {
  const cookieToken = req.cookies?.[ADMIN_CSRF_COOKIE_NAME];
  const headerToken = req.get("x-csrf-token");

  if (!safeEqualString(cookieToken, headerToken)) {
    return res.status(403).json({
      ok: false,
      message: "Jeton CSRF invalide ou manquant.",
    });
  }

  return next();
}

module.exports = { requireAdminCsrf };