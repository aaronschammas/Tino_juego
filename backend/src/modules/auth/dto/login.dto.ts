import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    googleToken?: string;
}
