import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Priority, TaskStatus } from '@prisma/client';

export enum DashboardAssignedFilter {
  ALL = 'all',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
}

export enum DashboardDateField {
  CREATED = 'created',
  DUE = 'due',
  COMPLETED = 'completed',
  ACTIVITY = 'activity',
}

function toArray(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class DashboardFiltersDto {
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsString({ each: true })
  projectIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsEnum(TaskStatus, { each: true })
  statuses?: TaskStatus[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsEnum(Priority, { each: true })
  priorities?: Priority[];

  @IsOptional()
  @IsEnum(DashboardAssignedFilter)
  assigned?: DashboardAssignedFilter;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  hasTime?: boolean;

  @IsOptional()
  @IsEnum(DashboardDateField)
  dateField?: DashboardDateField;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsIn(['hourOfWeek'])
  groupBy?: 'hourOfWeek';
}
