/**
 * DTOs de la conexion de proyectos con Trello. La api key la pone el backend;
 * el frontend solo envia el token que devolvio la autorizacion de Trello.
 *
 * - `TrelloAuthorizeUrlQueryDto`: origen del frontend al que Trello debe volver.
 * - `TrelloTokenDto`: token del usuario (para listar tableros).
 * - `TrelloConnectionPreviewDto`: tablero + destino (proyecto nuevo o existente).
 * - `TrelloConnectDto`: lo anterior + la equivalencia lista -> estado elegida.
 * - `UpdateStatusMappingsDto`: equivalencias a cambiar en un proyecto conectado.
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TaskStatus } from '@prisma/client';

export enum ConnectionTargetMode {
  NEW_PROJECT = 'NEW_PROJECT',
  EXISTING_PROJECT = 'EXISTING_PROJECT',
}

export class TrelloAuthorizeUrlQueryDto {
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  returnOrigin: string;
}

export class TrelloTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}

export class TrelloConnectionPreviewDto extends TrelloTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  boardId: string;

  @IsEnum(ConnectionTargetMode)
  mode: ConnectionTargetMode;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class StatusMappingEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  externalGroupId: string;

  @IsEnum(TaskStatus)
  status: TaskStatus;
}

export class TrelloConnectDto extends TrelloConnectionPreviewDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => StatusMappingEntryDto)
  statusMapping: StatusMappingEntryDto[];
}

export class UpdateStatusMappingsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => StatusMappingEntryDto)
  statusMapping: StatusMappingEntryDto[];
}
