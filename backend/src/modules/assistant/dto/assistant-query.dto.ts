import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum AssistantPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
}

export class AssistantQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  query!: string;

  @IsOptional()
  @IsEnum(AssistantPeriod)
  period?: AssistantPeriod;
}
