import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDate,
  IsNumber,
  Max,
  Min,
  ValidateBy,
} from 'class-validator';
import { TaskStatus, Priority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  isWholeMinuteHours,
  MAX_TASK_ESTIMATED_HOURS,
} from './task-duration.constants';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
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

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

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
