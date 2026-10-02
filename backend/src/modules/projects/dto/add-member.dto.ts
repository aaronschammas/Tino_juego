import { IsString, IsUUID } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @IsUUID()
  userIdToAdd: string;
}
