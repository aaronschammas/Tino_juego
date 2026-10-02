import { Module } from '@nestjs/common';
import { PlanPolicyService } from './plan-policy.service';

@Module({
  providers: [PlanPolicyService],
  exports: [PlanPolicyService],
})
export class PlanPolicyModule {}
