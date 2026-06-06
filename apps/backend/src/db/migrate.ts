import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase, getPool, query } from '../config/database';
import { logger } from '../config/logger';

const BASE_SCHEMA_MARKER = '_base_schema.sql';

/**
 * One-time repair for databases created before idempotent migrations.
 * Marks base schema as applied if core tables already exist.
 */
async function repairLegacyDatabaseState(): Promise<void> {
  const tables = await query<{ regclass: string | null }>(
    `SELECT to_regclass('public.accounts') as regclass`,
  );

  if (!tables.rows[0]?.regclass) {
    return;
  }

  const baseApplied = await query(`SELECT 1 FROM schema_migrations WHERE filename = $1`, [
    BASE_SCHEMA_MARKER,
  ]);

  if ((baseApplied.rowCount ?? 0) === 0) {
    logger.info('Detected existing database — marking base schema as applied');
    await query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      [BASE_SCHEMA_MARKER],
    );
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (file === '002_cities_leads.sql') {
      const cities = await query<{ regclass: string | null }>(
        `SELECT to_regclass('public.cities') as regclass`,
      );
      if (cities.rows[0]?.regclass) {
        await query(
          `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
          [file],
        );
        logger.info({ file }, 'Marked legacy migration as applied');
      }
    }
  }
}

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function isMigrationApplied(filename: string): Promise<boolean> {
  const result = await query(`SELECT 1 FROM schema_migrations WHERE filename = $1`, [filename]);
  return (result.rowCount ?? 0) > 0;
}

async function markMigrationApplied(filename: string): Promise<void> {
  await query(`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`, [
    filename,
  ]);
}

async function runBaseSchema(): Promise<void> {
  if (await isMigrationApplied(BASE_SCHEMA_MARKER)) {
    logger.info('Base schema already applied, skipping');
    return;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  logger.info('Applying base schema...');
  await getPool().query(schema);
  await markMigrationApplied(BASE_SCHEMA_MARKER);
  logger.info('Base schema applied');
}

async function runIncrementalMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    logger.info('No migrations directory found, skipping incremental migrations');
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (await isMigrationApplied(file)) {
      logger.debug({ file }, 'Migration already applied, skipping');
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    logger.info({ file }, 'Applying migration');
    await getPool().query(sql);
    await markMigrationApplied(file);
    logger.info({ file }, 'Migration applied');
  }
}

async function migrate(): Promise<void> {
  try {
    await connectDatabase();
    await ensureMigrationsTable();
    await repairLegacyDatabaseState();
    await runBaseSchema();
    await runIncrementalMigrations();
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

migrate();
