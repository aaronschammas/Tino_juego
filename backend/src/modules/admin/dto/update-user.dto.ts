import { IsString, IsEmail, Matches, MinLength, MaxLength, IsOptional } from 'class-validator';
import { PERSON_NAME_PATTERN, PERSON_NAME_PATTERN_MESSAGE } from 'src/common/validators/name.validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  name?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  lastname?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(20)
  password?: string;
}
