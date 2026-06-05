/**
 * Standalone Playwright demo script.
 * Opens Facebook and simulates basic human interaction.
 *
 * Usage: npx tsx src/scripts/playwright-demo.ts
 */
import { playwrightEngine } from '../modules/posting/playwright.engine';
import { logger } from '../config/logger';

async function main(): Promise<void> {
  logger.info('Starting Playwright Facebook demo...');

  try {
    await playwrightEngine.runBasicFacebookInteraction();
    logger.info('Demo completed successfully');
  } catch (error) {
    logger.error({ error }, 'Demo failed');
    process.exit(1);
  }
}

main();
