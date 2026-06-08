/** Normalize Playwright cookie objects saved from Facebook sessions. */
export function normalizeFacebookCookies(raw: unknown[]): Record<string, unknown>[] {
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((cookie) => {
      const normalized: Record<string, unknown> = { ...cookie };

      if (!normalized.url && !normalized.domain) {
        normalized.domain = '.facebook.com';
      }

      if (!normalized.path) {
        normalized.path = '/';
      }

      const sameSite = normalized.sameSite;
      if (typeof sameSite === 'string' && !['Strict', 'Lax', 'None'].includes(sameSite)) {
        normalized.sameSite = 'None';
      }

      return normalized;
    });
}

export function hasFacebookSessionCookie(
  cookies: Array<{ name?: string; value?: string }>,
): boolean {
  return cookies.some((cookie) => cookie.name === 'c_user' && Boolean(cookie.value));
}
