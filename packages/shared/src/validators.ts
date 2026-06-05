export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parsePagination(
  page?: string | number,
  limit?: string | number,
): { page: number; limit: number; offset: number } {
  const parsedPage = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit,
  };
}
