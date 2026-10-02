import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TimeTrackingService } from './time-tracking.service';

@Injectable()
export class TimeTrackingScheduler {
  private readonly logger = new Logger(TimeTrackingScheduler.name);

  constructor(private readonly timeService: TimeTrackingService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoPause() {
    try {
      const paused = await this.timeService.autoPauseIdleTimers();
      if (paused > 0) {
        this.logger.log(`Active Pulse: auto-paused ${paused} idle timer(s).`);
      }
    } catch (err) {
      this.logger.error('Active Pulse scheduler error:', err);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoStop() {
    try {
      const stopped = await this.timeService.autoStopExpiredTimers();
      if (stopped > 0) {
        this.logger.log(`Active Pulse: auto-stopped ${stopped} expired timer(s).`);
      }
    } catch (err) {
      this.logger.error('Active Pulse auto-stop scheduler error:', err);
    }
  }
}
