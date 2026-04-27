const jwt = require("jsonwebtoken");
const { pool } = require("../db/pool");
const { env } = require("../config/env");

async function requireAdminAuth(req, res, next) {
  try {
    if (!env.jwtSecret) {
      return res.status(500).json({
        ok: false,
        message: "JWT secret is not configured.",
      });
    }

    const token = req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Non authentifié.",
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (_error) {
      return res.status(401).json({
        ok: false,
        message: "Session invalide ou expirée.",
      });
    }

    if (payload.role !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "Accès refusé.",
      });
    }

    const adminId = Number(payload.sub);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({
        ok: false,
        message: "Session invalide.",
      });
    }

    const result = await pool.query(
      `
        SELECT id, email, full_name, is_active, last_login_at, created_at, updated_at
        FROM admins
        WHERE id = $1
        LIMIT 1
      `,
      [adminId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        ok: false,
        message: "Admin introuvable.",
      });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(403).json({
        ok: false,
        message: "Ce compte admin est désactivé.",
      });
    }

    req.admin = {
      id: Number(admin.id),
      email: admin.email,
      fullName: admin.full_name,
      lastLoginAt: admin.last_login_at,
      createdAt: admin.created_at,
      updatedAt: admin.updated_at,
    };

    return next();
  } catch (error) {
    console.error("Require admin auth error:", error);
    return res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
}

module.exports = { requireAdminAuth };