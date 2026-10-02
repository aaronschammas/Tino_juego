/**
 * DTOs de la importacion manual de SUPERADMIN. Solo viaja el token que Trello
 * entrega al autorizar; la API key es la de la app de Tino y la pone el backend.
 * Un `apiKey` en el body se rechaza (ValidationPipe con forbidNonWhitelisted).
 */
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum TrelloImportMode {
  NEW_PROJECT = 'NEW_PROJECT',
  EXISTING_PROJECT = 'EXISTING_PROJECT',
}

export class TrelloImportTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class TrelloPreviewDto extends TrelloImportTokenDto {
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @IsEnum(TrelloImportMode)
  mode: TrelloImportMode;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class TrelloExecuteImportDto extends TrelloPreviewDto {}
