import { IsIn } from 'class-validator';

/**
 * DTO used to update organization plan during onboarding continuation.
 */
export class UpdateOrganizationPlanDto {
  @IsIn(['free', 'pro', 'max'], { message: 'plan debe ser free, pro o max' })
  plan: 'free' | 'pro' | 'max';
}
