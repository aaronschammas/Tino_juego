import { Module } from '@nestjs/common';
import { PlanPolicyModule } from 'src/common/plans/plan-policy.module';
import { IntegrationsModule } from 'src/modules/integrations/integrations.module';
import { TrelloImportController } from './trello-import.controller';
import { TrelloImportService } from './trello-import.service';

@Module({
  imports: [PlanPolicyModule, IntegrationsModule],
  controllers: [TrelloImportController],
  providers: [TrelloImportService],
})
export class TrelloImportModule {}
