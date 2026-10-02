import { IsUUID, IsOptional, IsNumber } from 'class-validator';

export class StartTimeDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsNumber()
  targetMinutes?: number;
}
