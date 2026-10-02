import { IsString, IsOptional, IsEnum } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class AddMemberDto {
  @IsString()
  userId: string;

  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;
}
