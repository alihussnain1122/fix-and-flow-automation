import { AccountStatus } from '@fix-and-flow/types';
import { hasFacebookSessionCookie } from '../../utils/facebook-cookies';
import { BAN_INDICATORS, FLAGGED_INDICATORS } from './marketplace.selectors';

export interface AccountHealthResult {
  status: AccountStatus;
  reason?: string;
  isLoggedIn: boolean;
}

export function detectAccountHealth(
  pageText: string,
  url: string,
  cookies?: Array<{ name?: string; value?: string }>,
): AccountHealthResult {
  const lowerText = pageText.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (
    lowerUrl.includes('checkpoint') ||
    BAN_INDICATORS.some((indicator) => lowerText.includes(indicator))
  ) {
    return {
      status: AccountStatus.BANNED,
      reason: 'Account checkpoint or ban detected',
      isLoggedIn: false,
    };
  }

  if (FLAGGED_INDICATORS.some((indicator) => lowerText.includes(indicator))) {
    return {
      status: AccountStatus.FLAGGED,
      reason: 'Account flagged for verification',
      isLoggedIn: false,
    };
  }

  if (lowerUrl.includes('/login') || lowerUrl.includes('/reg/')) {
    return {
      status: AccountStatus.INACTIVE,
      isLoggedIn: false,
      reason: 'Facebook login page',
    };
  }

  const sessionCookie = cookies ? hasFacebookSessionCookie(cookies) : false;

  const isLoggedIn =
    sessionCookie ||
    lowerUrl.includes('marketplace') ||
    documentHasFeedIndicators(lowerText) ||
    lowerText.includes('facebook') && !lowerText.includes('log in') && !lowerText.includes('sign up');

  return {
    status: isLoggedIn ? AccountStatus.ACTIVE : AccountStatus.INACTIVE,
    isLoggedIn,
    reason: isLoggedIn ? undefined : 'Not logged in',
  };
}

function documentHasFeedIndicators(text: string): boolean {
  return (
    text.includes('notifications') ||
    text.includes("what's on your mind") ||
    text.includes('create a post') ||
    text.includes('meta') ||
    text.includes('search facebook')
  );
}
