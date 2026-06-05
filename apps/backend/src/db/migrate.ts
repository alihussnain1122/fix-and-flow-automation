import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase, getPool } from '../config/database';
import { logger } from '../config/logger';

async function migrate(): Promise<void> {
  try {
    await connectDatabase();

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    logger.info('Running database migrations...');
    await getPool().query(schema);
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

migrate();
