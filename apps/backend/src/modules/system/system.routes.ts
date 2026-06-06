import { Router, Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils';
import { checkFacebookReachability } from '../../utils/network';
import { env } from '../../config/env';

const router = Router();

router.get(
  '/connectivity',
  asyncHandler(async (_req: Request, res: Response) => {
    const [direct, viaGlobal] = await Promise.all([
      checkFacebookReachability(),
      env.PLAYWRIGHT_GLOBAL_PROXY
        ? checkFacebookReachability(env.PLAYWRIGHT_GLOBAL_PROXY)
        : Promise.resolve(null),
    ]);

    const recommendation = !direct.ok
      ? 'Facebook is not reachable directly. Add a residential proxy to each account, or set PLAYWRIGHT_GLOBAL_PROXY in .env.'
      : 'Direct Facebook access OK.';

    sendSuccess(res, {
      facebook: {
        direct,
        viaGlobalProxy: viaGlobal,
      },
      playwright: {
        headless: env.PLAYWRIGHT_HEADLESS,
        browserChannel: env.PLAYWRIGHT_BROWSER_CHANNEL || 'chromium',
        proxyFallback: env.PLAYWRIGHT_PROXY_FALLBACK,
        globalProxyConfigured: !!env.PLAYWRIGHT_GLOBAL_PROXY,
      },
      recommendation,
    });
  }),
);

export default router;
