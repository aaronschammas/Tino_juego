import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Priority, TaskStatus } from '@prisma/client';

function emptyToUndefined({ value }: { value: unknown }) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function booleanQueryValue({ value }: { value: unknown }) {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

function trimmedQueryValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

export class ListTasksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 25;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['me'])
  assignedTo?: 'me';

  @IsOptional()
  @Transform(booleanQueryValue)
  @IsIn([true, false])
  overdue?: boolean;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({ strict: true })
  dueFrom?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({ strict: true })
  dueTo?: string;

  @IsOptional()
  @Transform(booleanQueryValue)
  @IsIn([true, false])
  openOnly?: boolean;

  @IsOptional()
  @Transform(trimmedQueryValue)
  @IsString()
  @MaxLength(100)
  search?: string;
}
