import type { Page } from "playwright";
export interface CaptchaServiceOptions {
    capsolverApiKey?: string;
    twocaptchaApiKey?: string;
}
/** Options for physical grid solving — pass the same site key returned by page captcha detection. */
export interface SolveRecaptchaGridOptions {
    /** Iframe URL contains `k=` — required when multiple reCAPTCHA anchors exist on one page. */
    siteKey?: string;
}
export declare class CaptchaService {
    private readonly opts;
    private solver;
    constructor(opts: CaptchaServiceOptions);
    private wait;
    solveRecaptchaGrid(page: Page, gridOpts?: SolveRecaptchaGridOptions): Promise<boolean>;
    /**
     * portal-nc/captcha.js pattern: iframe[title="reCAPTCHA"] → click
     * `span.recaptcha-checkbox-unchecked`. No site-key filter — avoids picking the
     * invisible Enterprise widget while the interactive challenge uses another key.
     */
    private clickRecaptchaCheckboxDomFirst;
    private clickCheckboxInFrame;
    private pollForGridOrPass;
    private waitForPassed;
    private isChallengeExpired;
    private injectParamsExtractor;
    private getParams;
    private parseClicks;
    private clickTile;
    private clickVerify;
    private clickSkip;
    private solveGrid;
    solveHCaptcha(options: {
        siteKey: string;
        pageUrl: string;
    }): Promise<string>;
    solveArkose(options: {
        publicKey: string;
        pageUrl: string;
        blob?: string;
    }): Promise<string>;
}
export declare function getCaptchaService(opts?: CaptchaServiceOptions): CaptchaService;
//# sourceMappingURL=captcha.d.ts.map