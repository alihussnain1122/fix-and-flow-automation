import { Schedule, CreateScheduleDto, UpdateScheduleDto } from '@fix-and-flow/types';

export interface ScheduleRow {
  id: string;
  account_id: string;
  cron_expression: string | null;
  min_interval_minutes: number;
  max_interval_minutes: number;
  daily_post_limit: number;
  status: string;
  next_run_at: Date | null;
  last_run_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export type { Schedule, CreateScheduleDto, UpdateScheduleDto };
