import { IsEnum, IsString, IsDateString, IsOptional } from "class-validator";
import { Priority } from '@prisma/client';

export class UpdateProjectDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsDateString()
    dueDate?: Date;

    @IsOptional()
    @IsEnum(Priority)
    priority?: Priority;
}