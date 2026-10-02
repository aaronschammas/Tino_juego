import { IsEnum, IsString } from 'class-validator';

/**
 * DTO para el paso final del registro: nombre de organización y plan.
 */
export class RegisterCompleteDto {
  @IsString()
  userId: string;

  @IsString()
  organizationName: string;

  @IsEnum(['free', 'pro', 'max'], { message: 'plan debe ser free, pro o max' })
  plan: 'free' | 'pro' | 'max';
}
