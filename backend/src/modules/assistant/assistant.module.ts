import { Module } from '@nestjs/common';
import { ActiveOrganizationModule } from 'src/common/active-organization/active-organization.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [ActiveOrganizationModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
