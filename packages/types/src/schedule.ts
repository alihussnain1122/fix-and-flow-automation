export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export interface Schedule {
  id: string;
  accountId: string;
  cronExpression: string | null;
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  dailyPostLimit: number;
  status: ScheduleStatus;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleDto {
  accountId: string;
  cronExpression?: string;
  minIntervalMinutes?: number;
  maxIntervalMinutes?: number;
  dailyPostLimit?: number;
}

export interface UpdateScheduleDto {
  cronExpression?: string;
  minIntervalMinutes?: number;
  maxIntervalMinutes?: number;
  dailyPostLimit?: number;
  status?: ScheduleStatus;
  nextRunAt?: Date;
}
