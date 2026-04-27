const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");
const adminProductsRouter = express.Router();

function slugifyProductName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const createProductSchema = z.object({
  categoryId: z.union([z.string().min(1), z.number().int().positive()]),
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  description: z.string().trim().optional().default(""),
  order: z.number().int().min(0).nullable().optional(),
  featured: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  available: z.boolean().optional().default(true),
  variants: z.array(
    z.object({
      code: z.string().trim().min(1, "Le code variante est obligatoire."),
      name: z.string().trim().min(1, "Le nom variante est obligatoire."),
      price: z.number().nonnegative("Le prix doit être positif ou nul."),
      active: z.boolean().optional().default(true),
      isDefault: z.boolean().optional().default(false),
    })
  ).min(1, "Au moins une variante est obligatoire."),
});

adminProductsRouter.get("/products", requireAdminAuth, async (_req, res) => {
  try {
    const [categoriesResult, productsResult, variantsResult] = await Promise.all([
      pool.query(`
        SELECT
          id,
          name,
          slug,
          sort_order,
          is_active
        FROM categories
        ORDER BY sort_order ASC, id ASC
      `),
      pool.query(`
        SELECT
          id,
          category_id,
          name,
          slug,
          description,
          sort_order,
          is_active,
          is_available,
          is_featured
        FROM products
        ORDER BY sort_order ASC, id ASC
      `),
      pool.query(`
        SELECT
          id,
          product_id,
          code,
          name,
          price_cents,
          sort_order,
          is_active,
          is_default
        FROM product_variants
        ORDER BY sort_order ASC, id ASC
      `),
    ]);

    const categories = categoriesResult.rows.map((category) => ({
      id: String(category.id),
      slug: category.slug,
      name: category.name,
      order: category.sort_order,
      active: category.is_active,
    }));

    const variantsByProductId = new Map();

    for (const variant of variantsResult.rows) {
      if (!variantsByProductId.has(variant.product_id)) {
        variantsByProductId.set(variant.product_id, []);
      }

      const mappedVariant = {
        id: String(variant.id),
        code: variant.code,
        name: variant.name,
        ...(variant.code === "ravier" || variant.code === "assiette"
          ? { size: variant.code }
          : { formula: variant.code }),
        price: Number(variant.price_cents) / 100,
        active: variant.is_active,
      };

      variantsByProductId.get(variant.product_id).push(mappedVariant);
    }

    const products = productsResult.rows.map((product) => ({
      id: String(product.id),
      categoryId: String(product.category_id),
      name: product.name,
      description: product.description || "",
      active: product.is_active,
      available: product.is_available,
      order: product.sort_order,
      featured: product.is_featured,
      variants: variantsByProductId.get(product.id) || [],
    }));

    return res.status(200).json({
      ok: true,
      data: {
        categories,
        products,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/products error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

const updateProductActiveSchema = z.object({
  active: z.boolean(),
});

adminProductsRouter.patch("/products/:id/active", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant produit invalide.",
      });
    }

    const parsed = updateProductActiveSchema.safeParse(req.body);

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
        UPDATE products
        SET is_active = $2
        WHERE id = $1
        RETURNING id, is_active
      `,
      [productId, active]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Produit introuvable.",
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
    console.error("PATCH /api/admin/products/:id/active error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

const updateProductAvailabilitySchema = z.object({
  available: z.boolean(),
});

adminProductsRouter.patch("/products/:id/availability", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant produit invalide.",
      });
    }

    const parsed = updateProductAvailabilitySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { available } = parsed.data;

    const result = await pool.query(
      `
        UPDATE products
        SET is_available = $2
        WHERE id = $1
        RETURNING id, is_available
      `,
      [productId, available]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Produit introuvable.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        id: String(result.rows[0].id),
        available: result.rows[0].is_available,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/products/:id/availability error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

const updateProductDetailsSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  description: z.string().trim(),
  order: z.number().int().min(0),
  featured: z.boolean(),
});

adminProductsRouter.patch("/products/:id", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant produit invalide.",
      });
    }

    const parsed = updateProductDetailsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { name, description, order, featured } = parsed.data;

    const result = await pool.query(
      `
        UPDATE products
        SET
          name = $2,
          description = $3,
          sort_order = $4,
          is_featured = $5
        WHERE id = $1
        RETURNING
          id,
          category_id,
          name,
          description,
          sort_order,
          is_active,
          is_available,
          is_featured
      `,
      [productId, name, description, order, featured]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Produit introuvable.",
      });
    }

    const product = result.rows[0];

    return res.status(200).json({
      ok: true,
      data: {
        id: String(product.id),
        categoryId: String(product.category_id),
        name: product.name,
        description: product.description || "",
        active: product.is_active,
        available: product.is_available,
        order: product.sort_order,
        featured: product.is_featured,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/products/:id error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

const updateProductVariantsSchema = z.object({
  variants: z.array(
    z.object({
      id: z.string().min(1),
      price: z.number().nonnegative(),
      active: z.boolean(),
    })
  ).min(1),
});

adminProductsRouter.patch("/products/:id/variants", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  const client = await pool.connect();

  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant produit invalide.",
      });
    }

    const parsed = updateProductVariantsSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { variants } = parsed.data;

    const existingProduct = await client.query(
      `
        SELECT id
        FROM products
        WHERE id = $1
        LIMIT 1
      `,
      [productId]
    );

    if (existingProduct.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Produit introuvable.",
      });
    }

    const existingVariantsResult = await client.query(
      `
        SELECT id, product_id, code, name, price_cents, is_active
        FROM product_variants
        WHERE product_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    const existingVariantIds = new Set(
      existingVariantsResult.rows.map((row) => String(row.id))
    );

    for (const variant of variants) {
      if (!existingVariantIds.has(variant.id)) {
        return res.status(400).json({
          ok: false,
          message: "Une ou plusieurs variantes ne correspondent pas à ce produit.",
        });
      }
    }

    await client.query("BEGIN");

    for (const variant of variants) {
      const variantId = Number(variant.id);

      await client.query(
        `
          UPDATE product_variants
          SET
            price_cents = $3,
            is_active = $4
          WHERE id = $1
            AND product_id = $2
        `,
        [variantId, productId, Math.round(variant.price * 100), variant.active]
      );
    }

    const updatedVariantsResult = await client.query(
      `
        SELECT id, code, name, price_cents, is_active
        FROM product_variants
        WHERE product_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [productId]
    );

    await client.query("COMMIT");

    const variantsResponse = updatedVariantsResult.rows.map((variant) => ({
      id: String(variant.id),
      code: variant.code,
      name: variant.name,
      ...(variant.code === "ravier" || variant.code === "assiette"
        ? { size: variant.code }
        : { formula: variant.code }),
      price: Number(variant.price_cents) / 100,
      active: variant.is_active,
    }));

    return res.status(200).json({
      ok: true,
      data: {
        productId: String(productId),
        variants: variantsResponse,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("PATCH /api/admin/products/:id/variants error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

adminProductsRouter.post("/products", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  const client = await pool.connect();

  try {
    const parsed = createProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const {
      categoryId,
      name,
      description,
      order,
      featured,
      active,
      available,
      variants,
    } = parsed.data;

    const normalizedCategoryId = Number(categoryId);

    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Catégorie invalide.",
      });
    }

    const slug = slugifyProductName(name);

    if (!slug) {
      return res.status(400).json({
        ok: false,
        message: "Impossible de générer un slug valide pour ce produit.",
      });
    }

    const normalizedVariants = variants.map((variant, index) => ({
      code: variant.code.trim().toLowerCase(),
      name: variant.name.trim(),
      priceCents: Math.round(variant.price * 100),
      active: variant.active ?? true,
      isDefault: variant.isDefault ?? false,
      sortOrder: index,
    }));

    const variantCodes = normalizedVariants.map((variant) => variant.code);
    const uniqueVariantCodes = new Set(variantCodes);

    if (uniqueVariantCodes.size !== variantCodes.length) {
      return res.status(400).json({
        ok: false,
        message: "Les codes de variantes doivent être uniques pour un produit.",
      });
    }

    const defaultVariantsCount = normalizedVariants.filter((variant) => variant.isDefault).length;

    if (defaultVariantsCount > 1) {
      return res.status(400).json({
        ok: false,
        message: "Une seule variante peut être définie par défaut.",
      });
    }

    if (defaultVariantsCount === 0 && normalizedVariants.length > 0) {
      normalizedVariants[0].isDefault = true;
    }

    await client.query("BEGIN");

    const categoryResult = await client.query(
      `
        SELECT id
        FROM categories
        WHERE id = $1
        LIMIT 1
      `,
      [normalizedCategoryId]
    );

    if (categoryResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Catégorie introuvable.",
      });
    }

    const existingSlugResult = await client.query(
      `
        SELECT id
        FROM products
        WHERE slug = $1
        LIMIT 1
      `,
      [slug]
    );

    if (existingSlugResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        ok: false,
        message: "Un produit avec ce nom existe déjà.",
      });
    }

    let finalSortOrder = order;

    if (finalSortOrder === null || finalSortOrder === undefined) {
      const sortOrderResult = await client.query(
        `
          SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
          FROM products
          WHERE category_id = $1
        `,
        [normalizedCategoryId]
      );

      finalSortOrder = Number(sortOrderResult.rows[0].next_sort_order);
    }

    const createdProductResult = await client.query(
      `
        INSERT INTO products (
          category_id,
          name,
          slug,
          description,
          sort_order,
          is_active,
          is_available,
          is_featured
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          category_id,
          name,
          slug,
          description,
          sort_order,
          is_active,
          is_available,
          is_featured
      `,
      [
        normalizedCategoryId,
        name.trim(),
        slug,
        description ?? "",
        finalSortOrder,
        active,
        available,
        featured,
      ]
    );

    const createdProduct = createdProductResult.rows[0];

    for (const variant of normalizedVariants) {
      await client.query(
        `
          INSERT INTO product_variants (
            product_id,
            code,
            name,
            price_cents,
            sort_order,
            is_active,
            is_default
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          createdProduct.id,
          variant.code,
          variant.name,
          variant.priceCents,
          variant.sortOrder,
          variant.active,
          variant.isDefault,
        ]
      );
    }

    const createdVariantsResult = await client.query(
      `
        SELECT
          id,
          code,
          name,
          price_cents,
          sort_order,
          is_active,
          is_default
        FROM product_variants
        WHERE product_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [createdProduct.id]
    );

    await client.query("COMMIT");

    const responseVariants = createdVariantsResult.rows.map((variant) => ({
      id: String(variant.id),
      code: variant.code,
      name: variant.name,
      ...(variant.code === "ravier" || variant.code === "assiette"
        ? { size: variant.code }
        : { formula: variant.code }),
      price: Number(variant.price_cents) / 100,
      active: variant.is_active,
    }));

    return res.status(201).json({
      ok: true,
      data: {
        id: String(createdProduct.id),
        categoryId: String(createdProduct.category_id),
        name: createdProduct.name,
        description: createdProduct.description || "",
        active: createdProduct.is_active,
        available: createdProduct.is_available,
        order: createdProduct.sort_order,
        featured: createdProduct.is_featured,
        variants: responseVariants,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("POST /api/admin/products error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

adminProductsRouter.delete("/products/:id", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  const client = await pool.connect();

  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant produit invalide.",
      });
    }

    await client.query("BEGIN");

    const existingProductResult = await client.query(
      `
        SELECT id, name
        FROM products
        WHERE id = $1
        LIMIT 1
      `,
      [productId]
    );

    if (existingProductResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        message: "Produit introuvable.",
      });
    }

    await client.query(
      `
        DELETE FROM product_variants
        WHERE product_id = $1
      `,
      [productId]
    );

    await client.query(
      `
        DELETE FROM products
        WHERE id = $1
      `,
      [productId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      ok: true,
      data: {
        id: String(productId),
      },
      message: "Produit supprimé avec succès.",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("DELETE /api/admin/products/:id error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

module.exports = { adminProductsRouter };