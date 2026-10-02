/**
 * Equivalencia entre grupos externos (listas de Trello) y estados de Tino.
 *
 * El flujo es: se sugiere una equivalencia automatica, el usuario la revisa en
 * una lista y completa a mano las que quedaron sin equivalencia; recien ahi se
 * aplica al snapshot antes de importar.
 *
 * - `suggestStatusMapping()`: por cada grupo devuelve el estado adivinado por
 *   nombre (o `null`) y cuantas tareas tiene, para mostrarlo en la lista.
 * - `findUnmappedGroups()`: grupos sin estado en la equivalencia elegida; si hay
 *   alguno, la conexion no puede crearse.
 * - `applyStatusMapping()`: devuelve una copia del snapshot con el estado de
 *   cada tarea tomado de su grupo. Las tareas marcadas `isCompleted` quedan en
 *   DONE, y como ya hay equivalencia se borran los avisos de "se importara como TODO".
 */
import { TaskStatus } from '@prisma/client';
import { NormalizedGroup, NormalizedSnapshot } from '../integration.types';
import { guessTaskStatus } from './status-guess';

export type StatusMapping = Map<string, TaskStatus>;

export interface StatusMappingSuggestion {
  externalGroupId: string;
  name: string;
  suggestedStatus: TaskStatus | null;
  itemCount: number;
}

export function suggestStatusMapping(
  snapshot: NormalizedSnapshot,
): StatusMappingSuggestion[] {
  return snapshot.groups.map((group) => ({
    externalGroupId: group.externalId,
    name: group.name,
    suggestedStatus: guessTaskStatus(group.name),
    itemCount: snapshot.items.filter(
      (item) => item.groupExternalId === group.externalId,
    ).length,
  }));
}

export function findUnmappedGroups(
  groups: NormalizedGroup[],
  mapping: StatusMapping,
): NormalizedGroup[] {
  return groups.filter((group) => !mapping.has(group.externalId));
}

export function applyStatusMapping(
  snapshot: NormalizedSnapshot,
  mapping: StatusMapping,
): NormalizedSnapshot {
  return {
    ...snapshot,
    items: snapshot.items.map((item) => ({
      ...item,
      status: item.isCompleted
        ? TaskStatus.DONE
        : (mapping.get(item.groupExternalId) ?? item.status),
      statusWarning: mapping.has(item.groupExternalId)
        ? undefined
        : item.statusWarning,
    })),
  };
}
