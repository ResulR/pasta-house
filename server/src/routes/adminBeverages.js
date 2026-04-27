const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");

const adminBeveragesRouter = express.Router();

const createBeverageSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  order: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional().default(true),
  price: z.number().nonnegative("Le prix doit être positif ou nul."),
  menuEligible: z.boolean().optional().default(true),
});

const updateBeverageSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  order: z.number().int().min(0),
  active: z.boolean(),
  price: z.number().nonnegative("Le prix doit être positif ou nul."),
  menuEligible: z.boolean(),
});

const updateBeverageActiveSchema = z.object({
  active: z.boolean(),
});

function slugifyBeverageName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

adminBeveragesRouter.get("/beverages", requireAdminAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          slug,
          price_cents,
          sort_order,
          is_active,
          is_menu_eligible
        FROM beverages
        ORDER BY sort_order ASC, id ASC
      `
    );

    return res.status(200).json({
      ok: true,
      data: {
        beverages: result.rows.map((beverage) => ({
          id: String(beverage.id),
          name: beverage.name,
          slug: beverage.slug,
          price: Number(beverage.price_cents) / 100,
          order: beverage.sort_order,
          active: beverage.is_active,
          menuEligible: beverage.is_menu_eligible,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/beverages error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminBeveragesRouter.patch("/beverages/:id/active", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const beverageId = Number(req.params.id);

    if (!Number.isInteger(beverageId) || beverageId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant boisson invalide.",
      });
    }

    const parsed = updateBeverageActiveSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const result = await pool.query(
      `
        UPDATE beverages
        SET is_active = $2
        WHERE id = $1
        RETURNING id, is_active
      `,
      [beverageId, parsed.data.active]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Boisson introuvable.",
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
    console.error("PATCH /api/admin/beverages/:id/active error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminBeveragesRouter.patch("/beverages/:id", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const beverageId = Number(req.params.id);

    if (!Number.isInteger(beverageId) || beverageId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant boisson invalide.",
      });
    }

    const parsed = updateBeverageSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { name, order, active, price, menuEligible } = parsed.data;

    const result = await pool.query(
      `
        UPDATE beverages
        SET
          name = $2,
          price_cents = $3,
          sort_order = $4,
          is_active = $5,
          is_menu_eligible = $6
        WHERE id = $1
        RETURNING
          id,
          name,
          slug,
          price_cents,
          sort_order,
          is_active,
          is_menu_eligible
      `,
      [beverageId, name, Math.round(price * 100), order, active, menuEligible]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Boisson introuvable.",
      });
    }

    const beverage = result.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        id: String(beverage.id),
        name: beverage.name,
        slug: beverage.slug,
        price: Number(beverage.price_cents) / 100,
        order: beverage.sort_order,
        active: beverage.is_active,
        menuEligible: beverage.is_menu_eligible,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/beverages/:id error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminBeveragesRouter.post("/beverages", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  const client = await pool.connect();

  try {
    const parsed = createBeverageSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { name, order, active, price, menuEligible } = parsed.data;
    const slug = slugifyBeverageName(name);

    if (!slug) {
      return res.status(400).json({
        ok: false,
        message: "Impossible de générer un slug valide pour cette boisson.",
      });
    }

    await client.query("BEGIN");

    const existingSlugResult = await client.query(
      `
        SELECT id
        FROM beverages
        WHERE slug = $1
        LIMIT 1
      `,
      [slug]
    );

    if (existingSlugResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        ok: false,
        message: "Une boisson avec ce nom existe déjà.",
      });
    }

    let finalSortOrder = order;

    if (finalSortOrder === null || finalSortOrder === undefined) {
      const sortOrderResult = await client.query(
        `
          SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
          FROM beverages
        `
      );

      finalSortOrder = Number(sortOrderResult.rows[0].next_sort_order);
    }

    const createdBeverageResult = await client.query(
      `
        INSERT INTO beverages (
          name,
          slug,
          price_cents,
          sort_order,
          is_active,
          is_menu_eligible
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          name,
          slug,
          price_cents,
          sort_order,
          is_active,
          is_menu_eligible
      `,
      [name.trim(), slug, Math.round(price * 100), finalSortOrder, active, menuEligible]
    );

    await client.query("COMMIT");

    const beverage = createdBeverageResult.rows[0];

    return res.status(201).json({
      ok: true,
      data: {
        id: String(beverage.id),
        name: beverage.name,
        slug: beverage.slug,
        price: Number(beverage.price_cents) / 100,
        order: beverage.sort_order,
        active: beverage.is_active,
        menuEligible: beverage.is_menu_eligible,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/admin/beverages error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

adminBeveragesRouter.delete("/beverages/:id", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const beverageId = Number(req.params.id);

    if (!Number.isInteger(beverageId) || beverageId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant boisson invalide.",
      });
    }

    const result = await pool.query(
      `
        DELETE FROM beverages
        WHERE id = $1
        RETURNING id
      `,
      [beverageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Boisson introuvable.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        id: String(result.rows[0].id),
      },
      message: "Boisson supprimée avec succès.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/beverages/:id error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { adminBeveragesRouter };