/**
 * Test Facebook/network connectivity from this machine.
 * Usage: npm run test:connectivity -w @fix-and-flow/backend
 */
import { checkFacebookReachability } from '../utils/network';
import { env } from '../config/env';
import { logger } from '../config/logger';

async function main(): Promise<void> {
  console.log('\n=== Fix & Flow Connectivity Test ===\n');

  console.log('1. Direct connection (no proxy)...');
  const direct = await checkFacebookReachability();
  console.log(direct.ok ? `   OK (${direct.latencyMs}ms via ${direct.url})` : `   FAILED: ${direct.error}`);

  if (env.PLAYWRIGHT_GLOBAL_PROXY) {
    console.log('\n2. Via PLAYWRIGHT_GLOBAL_PROXY...');
    const global = await checkFacebookReachability(env.PLAYWRIGHT_GLOBAL_PROXY);
    console.log(
      global.ok ? `   OK (${global.latencyMs}ms via ${global.url})` : `   FAILED: ${global.error}`,
    );
  } else {
    console.log('\n2. PLAYWRIGHT_GLOBAL_PROXY not set (skipped)');
  }

  console.log('\n--- Recommendations ---');
  if (!direct.ok) {
    console.log('• Facebook is NOT reachable from this PC without a proxy.');
    console.log('• Add a working residential proxy in the dashboard (Proxies → Add Proxy).');
    console.log('• Assign the proxy to your account, then click Verify.');
    console.log('• Or set PLAYWRIGHT_GLOBAL_PROXY=http://user:pass@host:port in .env');
  } else {
    console.log('• Direct Facebook access works. Account verify should succeed.');
  }

  console.log(`• Browser channel: ${env.PLAYWRIGHT_BROWSER_CHANNEL || 'chromium'}`);
  console.log('• Run: npx playwright install chrome\n');

  process.exit(direct.ok ? 0 : 1);
}

main().catch((err) => {
  logger.error({ err }, 'Connectivity test failed');
  process.exit(1);
});
