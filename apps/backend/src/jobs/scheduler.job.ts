import { automationService } from '../services/automation.service';

export async function processSchedulerTick(): Promise<void> {
  await automationService.runSchedulerCycle();
}
