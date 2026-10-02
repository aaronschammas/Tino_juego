import { IsUUID, IsOptional, IsNumber, Min } from 'class-validator';

export class LinkTimeEntryDto {
  @IsUUID()
  taskId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMs?: number;
}
