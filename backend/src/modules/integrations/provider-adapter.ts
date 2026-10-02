/**
 * Contrato que implementa cada proveedor externo, para que el motor de
 * sincronizacion no dependa de la API de Trello, ClickUp, etc.
 *
 * - `listContainers()`: contenedores abiertos que el usuario puede vincular a un
 *   proyecto (tableros de Trello).
 * - `fetchSnapshot()`: descarga el contenedor completo y lo traduce a valores de
 *   Tino con los tipos de `integration.types.ts`. Con `includeComments` tambien
 *   trae los comentarios (solo hace falta al conectar, no en la vista previa).
 */
import {
  ExternalSources,
  IntegrationProvider,
  NormalizedContainer,
  NormalizedSnapshot,
} from './integration.types';

export interface FetchSnapshotOptions {
  includeComments?: boolean;
}

export interface IntegrationProviderAdapter<TCredentials> {
  readonly provider: IntegrationProvider;
  readonly sources: ExternalSources;

  listContainers(credentials: TCredentials): Promise<NormalizedContainer[]>;

  fetchSnapshot(
    containerId: string,
    credentials: TCredentials,
    options?: FetchSnapshotOptions,
  ): Promise<NormalizedSnapshot>;
}
