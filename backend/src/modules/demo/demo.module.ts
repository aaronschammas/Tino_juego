import { Module } from '@nestjs/common';
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

/** Modo demo de la feria: escenarios, reinicio y estado para el juego. `PrismaService` llega por DatabaseModule global. */
@Module({
  imports: [TimeTrackingModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
