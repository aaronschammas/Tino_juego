import { IsEmail, IsEnum, IsOptional, IsArray, IsString } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class InviteMembersDto {
  @IsEmail()
  email: string;

  @IsEnum(OrganizationRole)
  @IsOptional()
  role: OrganizationRole = OrganizationRole.ORG_MEMBER;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  projectIds?: string[] = [];
}
