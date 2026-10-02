import { IsOptional, IsUUID } from 'class-validator';

export class ListCommentsDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
