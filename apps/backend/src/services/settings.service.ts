import { query } from '../config/database';

const POSTS_AUTOMATION_KEY = 'posts_automation_enabled';

export class SettingsService {
  async isPostsAutomationEnabled(): Promise<boolean> {
    const result = await query<{ value: boolean }>(
      `SELECT value FROM app_settings WHERE key = $1`,
      [POSTS_AUTOMATION_KEY],
    );
    if (!result.rows[0]) return false;
    return result.rows[0].value === true;
  }

  async setPostsAutomationEnabled(enabled: boolean): Promise<boolean> {
    await query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [POSTS_AUTOMATION_KEY, JSON.stringify(enabled)],
    );
    return enabled;
  }
}

export const settingsService = new SettingsService();
