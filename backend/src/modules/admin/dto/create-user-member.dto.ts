import { IsString, IsEmail, Matches, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { OrganizationRole } from '@prisma/client';
import { PERSON_NAME_PATTERN, PERSON_NAME_PATTERN_MESSAGE } from 'src/common/validators/name.validator';

export class CreateUserMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  lastname: string;

  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole;
}
