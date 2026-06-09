import { CreateScheduleDto, UpdateScheduleDto, ScheduleStatus, JobName } from '@fix-and-flow/types';
import { NotFoundError, ValidationError } from '@fix-and-flow/shared';
import {
  parsePagination,
  DEFAULT_MIN_INTERVAL_MINUTES,
  DEFAULT_MAX_INTERVAL_MINUTES,
  DEFAULT_DAILY_POST_LIMIT,
  MIN_DAILY_POST_LIMIT,
  MAX_DAILY_POST_LIMIT,
} from '@fix-and-flow/shared';
import { getPostingQueue } from '../../config/queue';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { accountService } from '../accounts/account.service';
import { postingService } from '../posting/posting.service';
import { schedulerRepository } from './scheduler.repository';
import { randomBetween } from '../../utils/human-behavior';

export class SchedulerService {
  private resolveDailyPostLimit(limit?: number): number {
    const value = limit ?? DEFAULT_DAILY_POST_LIMIT;
    if (value < MIN_DAILY_POST_LIMIT || value > MAX_DAILY_POST_LIMIT) {
      throw new ValidationError(
        `Daily post limit must be between ${MIN_DAILY_POST_LIMIT} and ${MAX_DAILY_POST_LIMIT} posts per account`,
      );
    }
    return value;
  }

  async findAll(page?: number, limit?: number) {
    const { offset, limit: l } = parsePagination(page, limit);
    return schedulerRepository.findAll(offset, l);
  }

  async findById(id: string) {
    const schedule = await schedulerRepository.findById(id);
    if (!schedule) throw new NotFoundError('Schedule', id);
    return schedulerRepository.mapRow(schedule);
  }

  async create(dto: CreateScheduleDto) {
    await accountService.findById(dto.accountId);

    const existing = await schedulerRepository.findByAccountId(dto.accountId);
    if (existing) {
      throw new ValidationError('Schedule already exists for this account');
    }

    const minInterval = dto.minIntervalMinutes ?? DEFAULT_MIN_INTERVAL_MINUTES;
    const maxInterval = dto.maxIntervalMinutes ?? DEFAULT_MAX_INTERVAL_MINUTES;

    if (minInterval > maxInterval) {
      throw new ValidationError('minIntervalMinutes cannot be greater than maxIntervalMinutes');
    }

    const nextRunAt = this.calculateNextRun(minInterval, maxInterval);
    const dailyPostLimit = this.resolveDailyPostLimit(dto.dailyPostLimit);

    const schedule = await schedulerRepository.create({
      accountId: dto.accountId,
      cronExpression: dto.cronExpression,
      minIntervalMinutes: minInterval,
      maxIntervalMinutes: maxInterval,
      dailyPostLimit,
      nextRunAt,
    });

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.SCHEDULER,
      message: `Schedule created for account ${dto.accountId}`,
      accountId: dto.accountId,
    });

    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    await this.findById(id);

    const updateData: Parameters<typeof schedulerRepository.update>[1] = {};
    if (dto.cronExpression !== undefined) updateData.cronExpression = dto.cronExpression;
    if (dto.minIntervalMinutes !== undefined) updateData.minIntervalMinutes = dto.minIntervalMinutes;
    if (dto.maxIntervalMinutes !== undefined) updateData.maxIntervalMinutes = dto.maxIntervalMinutes;
    if (dto.dailyPostLimit !== undefined) {
      updateData.dailyPostLimit = this.resolveDailyPostLimit(dto.dailyPostLimit);
    }
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.nextRunAt !== undefined) updateData.nextRunAt = dto.nextRunAt;

    const updated = await schedulerRepository.update(id, updateData);
    if (!updated) throw new NotFoundError('Schedule', id);
    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    return schedulerRepository.delete(id);
  }

  calculateNextRun(minMinutes: number, maxMinutes: number): Date {
    const intervalMinutes = randomBetween(minMinutes, maxMinutes);
    return new Date(Date.now() + intervalMinutes * 60 * 1000);
  }

  async processDueSchedules(): Promise<number> {
    const dueSchedules = await schedulerRepository.findDueSchedules();
    let processed = 0;

    for (const scheduleRow of dueSchedules) {
      const schedule = schedulerRepository.mapRow(scheduleRow);

      try {
        const canPost = await accountService.canPost(schedule.accountId);
        if (!canPost) {
          await schedulerRepository.update(schedule.id, {
            nextRunAt: this.calculateNextRun(
              schedule.minIntervalMinutes,
              schedule.maxIntervalMinutes,
            ),
          });
          continue;
        }

        const post = await postingService.createAutomatedPost(schedule.accountId);

        const queue = getPostingQueue();
        await queue.add(JobName.CREATE_POST, {
          postId: post.id,
          accountId: post.accountId,
          title: post.title,
          description: post.description,
          price: post.price,
          imageUrls: post.imageUrls,
        });

        await schedulerRepository.update(schedule.id, {
          lastRunAt: new Date(),
          nextRunAt: this.calculateNextRun(
            schedule.minIntervalMinutes,
            schedule.maxIntervalMinutes,
          ),
        });

        processed++;

        await logService.create({
          level: LogLevel.INFO,
          category: LogCategory.SCHEDULER,
          message: `Scheduled post queued for account ${schedule.accountId}`,
          accountId: schedule.accountId,
          postId: post.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Schedule processing failed';
        await logService.create({
          level: LogLevel.ERROR,
          category: LogCategory.SCHEDULER,
          message,
          accountId: schedule.accountId,
        });
      }
    }

    return processed;
  }

  async pause(id: string) {
    return this.update(id, { status: ScheduleStatus.PAUSED });
  }

  async resume(id: string) {
    const schedule = await this.findById(id);
    return schedulerRepository.update(id, {
      status: ScheduleStatus.ACTIVE,
      nextRunAt: this.calculateNextRun(
        schedule.minIntervalMinutes,
        schedule.maxIntervalMinutes,
      ),
    });
  }
}

export const schedulerService = new SchedulerService();
