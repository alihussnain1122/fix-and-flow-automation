import { logger } from '../config/logger';

export interface CityValidationResult {
  valid: boolean;
  normalized?: string;
  name?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
  reason?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'FixAndFlow/1.0 (facebook-marketplace-automation)';

export class CityValidationService {
  async validate(query: string, countryCode = 'us'): Promise<CityValidationResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { valid: false, reason: 'City is required' };
    }

    try {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set('q', trimmed);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('addressdetails', '1');
      if (countryCode) {
        url.searchParams.set('countrycodes', countryCode);
      }

      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });

      if (!response.ok) {
        logger.warn({ status: response.status, query: trimmed }, 'City validation API failed');
        return { valid: false, reason: 'Could not verify city online. Try again in a moment.' };
      }

      const results = (await response.json()) as Array<{
        name?: string;
        type?: string;
        class?: string;
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: Record<string, string>;
      }>;

      if (!Array.isArray(results) || results.length === 0) {
        return {
          valid: false,
          reason: 'City not found. Use a real US city, e.g. Houston, TX or Dallas, Texas',
        };
      }

      const hit = results[0];
      const address = hit.address ?? {};
      const placeName =
        address.city ||
        address.town ||
        address.village ||
        address.hamlet ||
        address.suburb ||
        hit.name;

      if (!placeName) {
        return {
          valid: false,
          reason: 'Could not confirm a city name. Try "City, State" format.',
        };
      }

      const state = address.state ?? address.region ?? undefined;
      const country = address.country ?? 'United States';
      const normalized = [placeName, state, country].filter(Boolean).join(', ');

      return {
        valid: true,
        normalized,
        name: placeName,
        state,
        country,
        lat: hit.lat ? parseFloat(hit.lat) : undefined,
        lon: hit.lon ? parseFloat(hit.lon) : undefined,
      };
    } catch (error) {
      logger.warn({ error, query: trimmed }, 'City validation error');
      return { valid: false, reason: 'Could not verify city online. Check your internet connection.' };
    }
  }
}

export const cityValidationService = new CityValidationService();
