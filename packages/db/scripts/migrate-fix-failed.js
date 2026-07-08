/**
 * Fix stuck Prisma migrations (safe to re-run).
 *
 * Usage (from packages/db):
 *   pnpm run migrate:fix-failed
 */
const { execSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ROOT = path.resolve(__dirname, '..');
const DELIVERY_MIGRATION = '202603240001_add_delivery_address_to_users';
const SALE_OFFERS_MIGRATION = '202606270001_sale_offers';

function runPrisma(args) {
  execSync(`npx prisma ${args} --schema schema.prisma`, {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  });
}

function resolveApplied(name) {
  try {
    runPrisma(`migrate resolve --applied ${name}`);
    console.log(`Marked ${name} as applied.`);
  } catch {
    console.log(`${name} is already applied or does not need resolve — skipping.`);
  }
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

async function migrationFinished(conn, name) {
  const [rows] = await conn.query(
    `SELECT finished_at FROM _prisma_migrations WHERE migration_name = ? LIMIT 1`,
    [name],
  );
  return rows.length > 0 && rows[0].finished_at != null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in ../../.env');
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);
  try {
    const deliveryDone = await migrationFinished(conn, DELIVERY_MIGRATION);
    if (!deliveryDone) {
      const hasColumn = await columnExists(conn, 'users', 'deliveryAddress');
      if (!hasColumn) {
        console.log('Adding users.deliveryAddress…');
        await conn.query(
          'ALTER TABLE `users` ADD COLUMN `deliveryAddress` VARCHAR(512) NULL AFTER `phone`',
        );
      }
      resolveApplied(DELIVERY_MIGRATION);
    } else {
      console.log(`${DELIVERY_MIGRATION} already applied.`);
    }

    const saleOffersDone = await migrationFinished(conn, SALE_OFFERS_MIGRATION);
    const hasSaleOffers = await tableExists(conn, 'sale_offers');

    if (!saleOffersDone && hasSaleOffers) {
      console.log('sale_offers table exists — syncing migration history…');
      resolveApplied(SALE_OFFERS_MIGRATION);
    } else if (!saleOffersDone && !hasSaleOffers) {
      console.log('sale_offers missing — will be created by migrate deploy.');
    } else {
      console.log(`${SALE_OFFERS_MIGRATION} already applied.`);
    }

    console.log('Running migrate deploy…');
    try {
      runPrisma('migrate deploy');
    } catch {
      if (hasSaleOffers || (await tableExists(conn, 'sale_offers'))) {
        console.log('Deploy failed but sale_offers exists — syncing migration history…');
        resolveApplied(SALE_OFFERS_MIGRATION);
        runPrisma('migrate deploy');
      } else {
        throw new Error('migrate deploy failed');
      }
    }

    console.log('All migrations are up to date.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
