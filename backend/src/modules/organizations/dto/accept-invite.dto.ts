import { IsString, Matches, MinLength } from 'class-validator';
import { PERSON_NAME_PATTERN, PERSON_NAME_PATTERN_MESSAGE } from 'src/common/validators/name.validator';

export class AcceptInviteDto {
  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(1)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  name: string;

  @IsString()
  @MinLength(1)
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  lastname: string;
}
