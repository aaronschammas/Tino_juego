import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum MobileSummaryPeriod {
  WEEK = 'week',
  MONTH = 'month',
}

export enum MobileSummaryScope {
  SELF = 'self',
  ORGANIZATION = 'organization',
}

export class MobileSummaryDto {
  @IsEnum(MobileSummaryPeriod)
  period!: MobileSummaryPeriod;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(MobileSummaryScope)
  scope: MobileSummaryScope = MobileSummaryScope.SELF;
}
