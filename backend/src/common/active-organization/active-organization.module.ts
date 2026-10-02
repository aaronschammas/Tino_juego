import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { ActiveOrganizationService } from './active-organization.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ActiveOrganizationService],
  exports: [ActiveOrganizationService],
})
export class ActiveOrganizationModule {}
