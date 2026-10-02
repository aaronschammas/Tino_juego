import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PERSON_NAME_PATTERN, PERSON_NAME_PATTERN_MESSAGE } from 'src/common/validators/name.validator';

export class UpdateUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
    name?: string;

    @IsOptional()
    @IsString()
    @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
    lastname?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;
}
