import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PERSON_NAME_PATTERN, PERSON_NAME_PATTERN_MESSAGE } from 'src/common/validators/name.validator';

/**
 * DTO para el paso inicial del registro: datos personales o Google.
 * Si es registro tradicional, requiere nombre, apellido, email y password.
 * Si es Google, solo email y googleToken.
 */
export class RegisterInitDto {
  @IsString()
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  nombre: string;

  @IsString()
  @Matches(PERSON_NAME_PATTERN, { message: PERSON_NAME_PATTERN_MESSAGE })
  apellido: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  googleToken?: string;
}
