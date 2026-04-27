const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { env } = require("../config/env");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");
const {
  ADMIN_CSRF_COOKIE_NAME,
  setAdminCsrfCookie,
  clearAdminCsrfCookie,
} = require("../lib/adminCsrf");
const {
  setAdminAuthCookie,
  clearAdminAuthCookie,
} = require("../lib/adminAuthCookie");

const adminAuthRouter = express.Router();
const isProduction = env.nodeEnv === "production";

const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Trop de tentatives de connexion. Réessayez plus tard.",
  },
});

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

adminAuthRouter.get("/auth/csrf", (req, res) => {
  const existingToken = req.cookies?.[ADMIN_CSRF_COOKIE_NAME];
  const token = existingToken || setAdminCsrfCookie(res);

  if (existingToken) {
    res.cookie(ADMIN_CSRF_COOKIE_NAME, existingToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }

  return res.status(200).json({
    ok: true,
    csrfToken: token,
  });
});

adminAuthRouter.post("/auth/login", adminLoginRateLimit, requireAdminCsrf, async (req, res) => {
  try {
    if (!env.jwtSecret) {
      return res.status(500).json({
        ok: false,
        message: "JWT secret is not configured.",
      });
    }

    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Invalid request body.",
        errors: parsed.error.flatten(),
      });
    }

    const { email, password } = parsed.data;

    const result = await pool.query(
      `
        SELECT id, email, password_hash, full_name, is_active
        FROM admins
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        ok: false,
        message: "Email ou mot de passe incorrect.",
      });
    }

    const admin = result.rows[0];
    const adminId = Number(admin.id);

    if (!admin.is_active) {
      return res.status(403).json({
        ok: false,
        message: "Ce compte admin est désactivé.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        ok: false,
        message: "Email ou mot de passe incorrect.",
      });
    }

    const token = jwt.sign(
      {
        sub: String(adminId),
        role: "admin",
        email: admin.email,
      },
      env.jwtSecret,
      { expiresIn: "7d" }
    );

    await pool.query(
      `
        UPDATE admins
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [adminId]
    );

    setAdminAuthCookie(res, token);

    setAdminCsrfCookie(res);

    return res.status(200).json({
      ok: true,
      admin: {
        id: adminId,
        email: admin.email,
        fullName: admin.full_name,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
});

adminAuthRouter.get("/auth/me", async (req, res) => {
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

    const adminId = Number(payload.sub);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({
        ok: false,
        message: "Session invalide.",
      });
    }

    const result = await pool.query(
      `
        SELECT id, email, full_name, is_active, last_login_at
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

    return res.status(200).json({
      ok: true,
      admin: {
        id: Number(admin.id),
        email: admin.email,
        fullName: admin.full_name,
        lastLoginAt: admin.last_login_at,
      },
    });
  } catch (error) {
    console.error("Admin auth me error:", error);
    return res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
});

adminAuthRouter.post("/auth/logout", requireAdminAuth, requireAdminCsrf, async (_req, res) => {
  try {
    clearAdminAuthCookie(res);
    clearAdminCsrfCookie(res);

    return res.status(200).json({
      ok: true,
      message: "Déconnexion réussie.",
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    return res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
});

adminAuthRouter.get("/protected", requireAdminAuth, async (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "Accès admin autorisé.",
    admin: req.admin,
  });
});

module.exports = { adminAuthRouter };