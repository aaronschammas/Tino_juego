import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDate,
  IsNumber,
  IsNotEmpty,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import { TaskStatus, Priority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  isWholeMinuteHours,
  MAX_TASK_ESTIMATED_HOURS,
} from './task-duration.constants';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1,000 caracteres. Máximo de caracteres alcanzado.',
  })
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  // Subtask
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  // Assignment
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  // BI
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_TASK_ESTIMATED_HOURS, {
    message: 'La estimación máxima permitida es de 999 h 59 min',
  })
  @ValidateBy(
    { name: 'isWholeMinuteHours', validator: { validate: isWholeMinuteHours } },
    { message: 'La estimación debe expresarse en minutos enteros' },
  )
  estimatedHours?: number;
}
