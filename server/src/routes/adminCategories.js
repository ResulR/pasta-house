const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");  

const adminCategoriesRouter = express.Router();

const updateCategoryActiveSchema = z.object({
  active: z.boolean(),
});

adminCategoriesRouter.get("/categories", requireAdminAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        slug,
        sort_order,
        is_active
      FROM categories
      ORDER BY sort_order ASC, id ASC
    `);

    return res.status(200).json({
      ok: true,
      data: {
        categories: result.rows.map((category) => ({
          id: String(category.id),
          slug: category.slug,
          name: category.name,
          order: category.sort_order,
          active: category.is_active,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/categories error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminCategoriesRouter.patch("/categories/:id/active", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant catégorie invalide.",
      });
    }

    const parsed = updateCategoryActiveSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { active } = parsed.data;

    const result = await pool.query(
      `
        UPDATE categories
        SET
          is_active = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, is_active
      `,
      [categoryId, active]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Catégorie introuvable.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        id: String(result.rows[0].id),
        active: result.rows[0].is_active,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/categories/:id/active error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { adminCategoriesRouter };