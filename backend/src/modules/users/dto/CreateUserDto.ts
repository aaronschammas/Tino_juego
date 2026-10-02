import { IsEmail, IsString, Matches } from 'class-validator';
import { PERSON_NAME_PATTERN, PERSON_NAME_PATTERN_MESSAGE } from 'src/common/validators/name.validator';
export class CreateUserDto{

    @IsEmail()
    email:string


    @IsString()
    @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
    name:string

    @IsString()
    @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
    lastname:string
}