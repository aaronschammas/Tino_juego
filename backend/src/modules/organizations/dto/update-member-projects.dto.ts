import { IsArray, IsString } from 'class-validator';

export class UpdateMemberProjectsDto {
  @IsArray()
  @IsString({ each: true })
  projectIds: string[];
}
