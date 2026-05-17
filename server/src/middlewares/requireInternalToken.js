const crypto = require("crypto");

function requireInternalToken(req, res, next) {
  const envToken = process.env.RR_DIGITAL_INTERNAL_TOKEN;

  if (!envToken) {
    console.error("requireInternalToken: RR_DIGITAL_INTERNAL_TOKEN is not set");
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_CONFIG_ERROR",
    });
  }

  const headerToken = req.get("X-Internal-Token");

  if (!headerToken) {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED",
    });
  }

  const envBuffer = Buffer.from(envToken, "utf8");
  const headerBuffer = Buffer.from(headerToken, "utf8");

  let tokensMatch = false;

  if (envBuffer.length === headerBuffer.length) {
    try {
      tokensMatch = crypto.timingSafeEqual(envBuffer, headerBuffer);
    } catch (_err) {
      tokensMatch = false;
    }
  }

  if (!tokensMatch) {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED",
    });
  }

  return next();
}

module.exports = { requireInternalToken };
