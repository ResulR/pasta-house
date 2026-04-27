const express = require("express");
const { z } = require("zod");
const { pool } = require("../db/pool");
const { requireAdminAuth } = require("../middlewares/requireAdminAuth");
const { requireAdminCsrf } = require("../middlewares/requireAdminCsrf");

const adminScheduleRouter = express.Router();

const updateOpeningHoursSchema = z.object({
  schedule: z.array(
    z.object({
      day: z.enum(["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]),
      open: z.boolean(),
      openTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure d'ouverture invalide."),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure de fermeture invalide."),
    })
  ).length(7, "Les 7 jours doivent être fournis."),
});

const createExceptionalClosureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  reason: z.string().trim().optional().default(""),
});

const createScheduleOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure d'ouverture invalide.").optional().default(""),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure de fermeture invalide.").optional().default(""),
  reason: z.string().trim().optional().default(""),
});

const FRONT_DAY_TO_DAY_KEY = {
  lundi: "monday",
  mardi: "tuesday",
  mercredi: "wednesday",
  jeudi: "thursday",
  vendredi: "friday",
  samedi: "saturday",
  dimanche: "sunday",
};

const DAY_KEY_TO_FRONT_DAY = {
  monday: "lundi",
  tuesday: "mardi",
  wednesday: "mercredi",
  thursday: "jeudi",
  friday: "vendredi",
  saturday: "samedi",
  sunday: "dimanche",
};

adminScheduleRouter.get("/schedule", requireAdminAuth, async (_req, res) => {
  try {
    const [openingHoursResult, exceptionalClosuresResult, scheduleOverridesResult] = await Promise.all([
      pool.query(
        `
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
        `
      ),
      pool.query(
        `
          SELECT
            id,
            TO_CHAR((starts_at AT TIME ZONE 'Europe/Brussels')::date, 'YYYY-MM-DD') AS closure_date,
            reason
          FROM exceptional_closures
          ORDER BY starts_at ASC, id ASC
        `
      ),
      pool.query(
        `
          SELECT
            id,
            TO_CHAR(service_date, 'YYYY-MM-DD') AS service_date,
            is_closed,
            open_time,
            close_time,
            note
          FROM schedule_overrides
          ORDER BY service_date ASC, id ASC
        `
      ),
    ]);

    return res.status(200).json({
      ok: true,
      data: {
        schedule: openingHoursResult.rows.map((row) => ({
          day: DAY_KEY_TO_FRONT_DAY[row.day_key],
          open: row.is_open,
          openTime: String(row.open_time).slice(0, 5),
          closeTime: String(row.close_time).slice(0, 5),
        })),
        closures: exceptionalClosuresResult.rows.map((row) => ({
          id: String(row.id),
          date: row.closure_date,
          reason: row.reason || "",
        })),
        overrides: scheduleOverridesResult.rows.map((row) => ({
          id: String(row.id),
          date: row.service_date,
          isClosed: row.is_closed,
          openTime: row.open_time ? String(row.open_time).slice(0, 5) : "",
          closeTime: row.close_time ? String(row.close_time).slice(0, 5) : "",
          reason: row.note || "",
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/schedule error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminScheduleRouter.patch("/schedule/opening-hours", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  const client = await pool.connect();

  try {
    const parsed = updateOpeningHoursSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { schedule } = parsed.data;

    const seenDays = new Set(schedule.map((day) => day.day));

    if (seenDays.size !== 7) {
      return res.status(400).json({
        ok: false,
        message: "Chaque jour doit être présent une seule fois.",
      });
    }

    await client.query("BEGIN");

    for (const day of schedule) {
      const dayKey = FRONT_DAY_TO_DAY_KEY[day.day];

      const result = await client.query(
        `
          UPDATE opening_hours
          SET
            is_open = $2,
            open_time = $3,
            close_time = $4,
            updated_at = NOW()
          WHERE day_key = $1
          RETURNING id
        `,
        [dayKey, day.open, day.openTime, day.closeTime]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          ok: false,
          message: `Jour introuvable dans opening_hours : ${day.day}`,
        });
      }
    }

    const updatedResult = await client.query(
      `
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
      `
    );

    await client.query("COMMIT");

    return res.status(200).json({
      ok: true,
      data: {
        schedule: updatedResult.rows.map((row) => ({
          day: DAY_KEY_TO_FRONT_DAY[row.day_key],
          open: row.is_open,
          openTime: String(row.open_time).slice(0, 5),
          closeTime: String(row.close_time).slice(0, 5),
        })),
      },
      message: "Horaires mis à jour avec succès.",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // no-op
    }

    console.error("PATCH /api/admin/schedule/opening-hours error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  } finally {
    client.release();
  }
});

adminScheduleRouter.post("/schedule/closures", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const parsed = createExceptionalClosureSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { date, reason } = parsed.data;

    const startsAt = `${date}T00:00:00+02:00`;
    const endsAt = `${date}T23:59:59+02:00`;

    const createdResult = await pool.query(
      `
        INSERT INTO exceptional_closures (
          starts_at,
          ends_at,
          reason
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          TO_CHAR((starts_at AT TIME ZONE 'Europe/Brussels')::date, 'YYYY-MM-DD') AS closure_date,
          reason
      `,
      [startsAt, endsAt, reason || null]
    );

    const closure = createdResult.rows[0];

    return res.status(201).json({
      ok: true,
      data: {
        id: String(closure.id),
        date: closure.closure_date,
        reason: closure.reason || "",
      },
      message: "Fermeture exceptionnelle créée avec succès.",
    });
  } catch (error) {
    console.error("POST /api/admin/schedule/closures error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminScheduleRouter.post("/schedule/overrides", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const parsed = createScheduleOverrideSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "Corps de requête invalide.",
        errors: parsed.error.flatten(),
      });
    }

    const { date, isClosed, openTime, closeTime, reason } = parsed.data;

    if (!isClosed && (!openTime || !closeTime)) {
      return res.status(400).json({
        ok: false,
        message: "Les heures d'ouverture et de fermeture sont obligatoires si le jour n'est pas fermé.",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO schedule_overrides (
          service_date,
          is_closed,
          open_time,
          close_time,
          note
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (service_date)
        DO UPDATE SET
          is_closed = EXCLUDED.is_closed,
          open_time = EXCLUDED.open_time,
          close_time = EXCLUDED.close_time,
          note = EXCLUDED.note,
          updated_at = NOW()
        RETURNING
          id,
          TO_CHAR(service_date, 'YYYY-MM-DD') AS service_date,
          is_closed,
          open_time,
          close_time,
          note
      `,
      [
        date,
        isClosed,
        isClosed ? null : openTime,
        isClosed ? null : closeTime,
        reason || null,
      ]
    );

    const override = result.rows[0];

    return res.status(201).json({
      ok: true,
      data: {
        id: String(override.id),
        date: override.service_date,
        isClosed: override.is_closed,
        openTime: override.open_time ? String(override.open_time).slice(0, 5) : "",
        closeTime: override.close_time ? String(override.close_time).slice(0, 5) : "",
        reason: override.note || "",
      },
      message: "Override de planning enregistré avec succès.",
    });
  } catch (error) {
    console.error("POST /api/admin/schedule/overrides error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminScheduleRouter.delete("/schedule/closures/:id", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const closureId = Number(req.params.id);

    if (!Number.isInteger(closureId) || closureId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant fermeture invalide.",
      });
    }

    const result = await pool.query(
      `
        DELETE FROM exceptional_closures
        WHERE id = $1
        RETURNING id
      `,
      [closureId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Fermeture exceptionnelle introuvable.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        id: String(result.rows[0].id),
      },
      message: "Fermeture exceptionnelle supprimée avec succès.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/schedule/closures/:id error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

adminScheduleRouter.delete("/schedule/overrides/:id", requireAdminAuth, requireAdminCsrf, async (req, res) => {
  try {
    const overrideId = Number(req.params.id);

    if (!Number.isInteger(overrideId) || overrideId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Identifiant override invalide.",
      });
    }

    const result = await pool.query(
      `
        DELETE FROM schedule_overrides
        WHERE id = $1
        RETURNING id
      `,
      [overrideId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Override introuvable.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        id: String(result.rows[0].id),
      },
      message: "Override de planning supprimé avec succès.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/schedule/overrides/:id error:", error);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

module.exports = { adminScheduleRouter };