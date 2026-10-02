import { IsOptional, IsUUID, IsString } from 'class-validator';

export class StopTimeDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  endTime?: string;
}

