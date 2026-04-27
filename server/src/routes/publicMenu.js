const express = require("express");
const { pool } = require("../db/pool");

const router = express.Router();

router.get("/menu", async (_req, res) => {
  try {
    const [
      categoriesResult,
      productsResult,
      variantsResult,
      beveragesResult,
      siteSettingsResult,
      deliverySettingsResult,
      openingHoursResult,
    ] = await Promise.all([
      pool.query(`
        SELECT
          id,
          name,
          slug,
          sort_order,
          is_active
        FROM categories
        WHERE is_active = TRUE
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
        WHERE is_active = TRUE
          AND is_available = TRUE
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
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, id ASC
      `),
      pool.query(`
        SELECT
          id,
          name,
          slug,
          price_cents,
          sort_order,
          is_active,
          is_menu_eligible
        FROM beverages
        WHERE is_active = TRUE
          AND is_menu_eligible = TRUE
        ORDER BY sort_order ASC, id ASC
      `),
      pool.query(`
        SELECT
          restaurant_name,
          phone,
          email,
          address_line1,
          postal_code,
          city,
          country,
          legal_name,
          vat_number
        FROM site_settings
        LIMIT 1
      `),
      pool.query(`
        SELECT
          delivery_enabled,
          pickup_enabled,
          delivery_fee_cents,
          minimum_order_cents,
          delivery_zone_label,
          estimated_delivery_time_min,
          estimated_pickup_time_min,
          rush_mode_enabled
        FROM delivery_settings
        LIMIT 1
      `),
      pool.query(`
        SELECT
          day_key,
          is_open,
          open_time,
          close_time
        FROM opening_hours
        ORDER BY
          CASE day_key
            WHEN 'monday' THEN 1
            WHEN 'tuesday' THEN 2
            WHEN 'wednesday' THEN 3
            WHEN 'thursday' THEN 4
            WHEN 'friday' THEN 5
            WHEN 'saturday' THEN 6
            WHEN 'sunday' THEN 7
            ELSE 999
          END
      `),
    ]);

    const variantsByProductId = new Map();

    for (const variant of variantsResult.rows) {
      if (!variantsByProductId.has(variant.product_id)) {
        variantsByProductId.set(variant.product_id, []);
      }

      variantsByProductId.get(variant.product_id).push({
        id: variant.id,
        code: variant.code,
        name: variant.name,
        priceCents: variant.price_cents,
        sortOrder: variant.sort_order,
        isDefault: variant.is_default,
      });
    }

    const productsByCategoryId = new Map();

    for (const product of productsResult.rows) {
      if (!productsByCategoryId.has(product.category_id)) {
        productsByCategoryId.set(product.category_id, []);
      }

      productsByCategoryId.get(product.category_id).push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        sortOrder: product.sort_order,
        isActive: product.is_active,
        isAvailable: product.is_available,
        isFeatured: product.is_featured,
        variants: variantsByProductId.get(product.id) || [],
      });
    }

    const categories = categoriesResult.rows.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sort_order,
      isActive: category.is_active,
      products: productsByCategoryId.get(category.id) || [],
    }));

    const beverages = beveragesResult.rows.map((beverage) => ({
      id: beverage.id,
      name: beverage.name,
      slug: beverage.slug,
      priceCents: beverage.price_cents,
      sortOrder: beverage.sort_order,
      isActive: beverage.is_active,
      isMenuEligible: beverage.is_menu_eligible,
    }));

    const siteSettingsRow = siteSettingsResult.rows[0] || null;
    const deliverySettingsRow = deliverySettingsResult.rows[0] || null;

    const openingHours = openingHoursResult.rows.map((row) => ({
      dayKey: row.day_key,
      isOpen: row.is_open,
      openTime: row.open_time,
      closeTime: row.close_time,
    }));

    return res.status(200).json({
      ok: true,
      data: {
        categories,
        beverages,
        siteSettings: siteSettingsRow
          ? {
              restaurantName: siteSettingsRow.restaurant_name,
              phone: siteSettingsRow.phone,
              email: siteSettingsRow.email,
              addressLine1: siteSettingsRow.address_line1,
              postalCode: siteSettingsRow.postal_code,
              city: siteSettingsRow.city,
              country: siteSettingsRow.country,
              legalName: siteSettingsRow.legal_name,
              vatNumber: siteSettingsRow.vat_number,
            }
          : null,
        deliverySettings: deliverySettingsRow
          ? {
              deliveryEnabled: deliverySettingsRow.delivery_enabled,
              pickupEnabled: deliverySettingsRow.pickup_enabled,
              deliveryFeeCents: deliverySettingsRow.delivery_fee_cents,
              minimumOrderCents: deliverySettingsRow.minimum_order_cents,
              deliveryZoneLabel: deliverySettingsRow.delivery_zone_label,
              estimatedDeliveryTimeMin: deliverySettingsRow.estimated_delivery_time_min,
              estimatedPickupTimeMin: deliverySettingsRow.estimated_pickup_time_min,
              rushModeEnabled: deliverySettingsRow.rush_mode_enabled,
            }
          : null,
        openingHours,
      },
    });
  } catch (error) {
    console.error("GET /api/public/menu error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { publicMenuRouter: router };