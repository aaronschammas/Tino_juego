import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;
}
