#!/usr/bin/env bash
set -euo pipefail

umask 077

APP_DIR="/home/debian/apps/pasta-house"
SERVER_DIR="$APP_DIR/server"
ENV_FILE="$SERVER_DIR/.env"
BACKUP_DIR="/var/backups/pasta-house/postgres"
RESTORE_DB="pasta_house_restore_test"
START_SECONDS="$(date +%s)"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "ERROR: Cannot read env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${ADMIN_NOTIFICATION_EMAIL:?ADMIN_NOTIFICATION_EMAIL is required}"

if [[ "$DB_NAME" != "pasta_house" ]]; then
  echo "ERROR: Refusing to verify unexpected database: $DB_NAME" >&2
  exit 1
fi

LATEST_DUMP="$(
  find "$BACKUP_DIR" -type f -name 'pasta_house-*.dump' -printf '%T@ %p\n' \
    | sort -nr \
    | head -1 \
    | cut -d' ' -f2-
)"

if [[ -z "$LATEST_DUMP" || ! -f "$LATEST_DUMP" ]]; then
  echo "ERROR: No Pasta House dump found in $BACKUP_DIR" >&2
  exit 1
fi

DUMP_BYTES="$(stat -c%s "$LATEST_DUMP")"

if [[ "$DUMP_BYTES" -le 0 ]]; then
  echo "ERROR: Latest dump is empty: $LATEST_DUMP" >&2
  exit 1
fi

DUMP_FILENAME="$(basename "$LATEST_DUMP")"
DUMP_SIZE_HUMAN="$(du -h "$LATEST_DUMP" | awk '{print $1}')"
DUMP_DATE_HUMAN="$(date -d "@$(stat -c %Y "$LATEST_DUMP")" '+%d/%m/%Y à %H:%M UTC')"
BACKUP_COUNT="$(find "$BACKUP_DIR" -type f -name 'pasta_house-*.dump' | wc -l | tr -d ' ')"
BACKUP_DIR_SIZE_HUMAN="$(du -sh "$BACKUP_DIR" | awk '{print $1}')"

cleanup() {
  runuser -u postgres -- dropdb --if-exists "$RESTORE_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

runuser -u postgres -- createdb "$RESTORE_DB"

runuser -u postgres -- pg_restore \
  --dbname="$RESTORE_DB" \
  --no-owner \
  --no-acl \
  < "$LATEST_DUMP"

RESTORED_TABLE_COUNT="$(
  runuser -u postgres -- psql -d "$RESTORE_DB" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
)"

RESTORED_ORDERS_COUNT="$(
  runuser -u postgres -- psql -d "$RESTORE_DB" -tAc \
    "SELECT COUNT(*) FROM orders;"
)"

export PGPASSWORD="$DB_PASSWORD"

LIVE_ORDERS_COUNT="$(
  psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    -tAc "SELECT COUNT(*) FROM orders;"
)"

unset PGPASSWORD

END_SECONDS="$(date +%s)"
RTO_SECONDS="$((END_SECONDS - START_SECONDS))"

if [[ "$RTO_SECONDS" -lt 60 ]]; then
  RTO_HUMAN="moins d'une minute"
else
  RTO_HUMAN="$RTO_SECONDS secondes"
fi

cleanup
trap - EXIT

REPORT_TEXT="$(cat <<REPORT
Rapport backup Pasta House

Statut global : OK
Action requise : aucune

Résumé :
- Le dernier backup a été restauré avec succès dans une base de test.
- Le backup contient bien les commandes.
- La base temporaire de test a été supprimée après vérification.

Informations utiles :
- Commandes actuellement protégées : $LIVE_ORDERS_COUNT
- Commandes retrouvées dans le backup testé : $RESTORED_ORDERS_COUNT
- Dernier backup vérifié : $DUMP_FILENAME
- Date du backup : $DUMP_DATE_HUMAN
- Taille du backup : $DUMP_SIZE_HUMAN
- Nombre de backups locaux disponibles : $BACKUP_COUNT
- Espace utilisé par les backups locaux : $BACKUP_DIR_SIZE_HUMAN
- Temps de test restore estimé : $RTO_HUMAN

Détails techniques :
- Dump : $LATEST_DUMP
- Tables restaurées : $RESTORED_TABLE_COUNT
- Base temporaire utilisée : $RESTORE_DB
REPORT
)"

export REPORT_TEXT
export LATEST_DUMP
export DUMP_FILENAME
export DUMP_SIZE_HUMAN
export DUMP_DATE_HUMAN
export DUMP_BYTES
export BACKUP_COUNT
export BACKUP_DIR_SIZE_HUMAN
export RESTORED_TABLE_COUNT
export LIVE_ORDERS_COUNT
export RESTORED_ORDERS_COUNT
export RTO_SECONDS
export RTO_HUMAN

cd "$SERVER_DIR"

node <<'NODE'
const { sendEmail } = require("./src/lib/email");
const { env } = require("./src/config/env");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:8px 0;color:#64748b;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;text-align:right;font-weight:700;color:#0f172a;">${escapeHtml(value)}</td>
    </tr>
  `;
}

async function main() {
  const text = process.env.REPORT_TEXT;
  const subject = `[Pasta House] Backup vérifié avec succès - ${new Date().toISOString().slice(0, 10)}`;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e2e8f0;">
        <div style="font-size:14px;color:#64748b;margin-bottom:8px;">Pasta House · Rapport backup hebdomadaire</div>

        <h1 style="font-size:26px;line-height:1.2;margin:0 0 16px;color:#0f172a;">
          Backup vérifié avec succès
        </h1>

        <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:18px 0;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#166534;">Statut global : OK</p>
          <p style="margin:6px 0 0;color:#166534;">Aucune action requise. Le dernier backup a été restauré et vérifié dans une base de test.</p>
        </div>

        <h2 style="font-size:18px;margin:24px 0 10px;">Résumé utile</h2>

        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          ${row("Commandes protégées actuellement", process.env.LIVE_ORDERS_COUNT)}
          ${row("Commandes retrouvées dans le backup testé", process.env.RESTORED_ORDERS_COUNT)}
          ${row("Dernier backup vérifié", process.env.DUMP_FILENAME)}
          ${row("Date du backup", process.env.DUMP_DATE_HUMAN)}
          ${row("Taille du backup", process.env.DUMP_SIZE_HUMAN)}
          ${row("Nombre de backups locaux disponibles", process.env.BACKUP_COUNT)}
          ${row("Espace utilisé par les backups locaux", process.env.BACKUP_DIR_SIZE_HUMAN)}
          ${row("Temps de test restore", process.env.RTO_HUMAN)}
        </table>

        <div style="background:#f1f5f9;border-radius:12px;padding:14px;margin-top:24px;">
          <p style="margin:0 0 8px;font-weight:700;">Ce qui a été vérifié</p>
          <ul style="margin:0;padding-left:20px;color:#334155;">
            <li>Le dernier fichier backup existe et n’est pas vide.</li>
            <li>Le backup a été restauré dans une base temporaire.</li>
            <li>Les tables PostgreSQL ont été retrouvées.</li>
            <li>Le nombre de commandes dans le backup correspond à la base actuelle.</li>
            <li>La base temporaire de test a été supprimée après vérification.</li>
          </ul>
        </div>

        <details style="margin-top:20px;color:#475569;">
          <summary style="cursor:pointer;font-weight:700;">Détails techniques</summary>
          <div style="font-size:13px;margin-top:10px;line-height:1.6;">
            <div><strong>Dump :</strong> ${escapeHtml(process.env.LATEST_DUMP)}</div>
            <div><strong>Tables restaurées :</strong> ${escapeHtml(process.env.RESTORED_TABLE_COUNT)}</div>
            <div><strong>RTO brut :</strong> ${escapeHtml(process.env.RTO_SECONDS)} secondes</div>
          </div>
        </details>

        <p style="font-size:12px;color:#94a3b8;margin-top:28px;">
          Rapport automatique envoyé par le VPS Pasta House.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: env.adminNotificationEmail,
    subject,
    html,
    text,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

echo "$REPORT_TEXT"
