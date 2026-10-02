/**
 * Vista previa de una importacion de Trello con los nombres que usa el frontend
 * (board, lists, cards, checklists). La comparten la importacion de SUPERADMIN y
 * la conexion de proyectos.
 *
 * - `buildTrelloPreview()`: cuenta tareas y subtareas nuevas vs. ya importadas,
 *   junta los avisos de estado y lista las tareas con sus subtareas. Si el modo
 *   es proyecto nuevo, "ya importado" significa que el tablero ya tiene proyecto;
 *   si es proyecto existente, que alguna tarea o subtarea ya existe.
 */
import { NormalizedSnapshot } from '../../integration.types';
import { ExistingImportState } from '../../sync/integration-sync.service';

export type TrelloPreviewMode = 'NEW_PROJECT' | 'EXISTING_PROJECT';

export function buildTrelloPreview(
  mode: TrelloPreviewMode,
  snapshot: NormalizedSnapshot,
  existing: ExistingImportState,
  targetProject: { id: string; name: string } | null,
) {
  const duplicateTasks = snapshot.items.filter((item) =>
    existing.duplicateItemIds.has(item.externalId),
  ).length;
  const duplicateSubtasks = snapshot.items.reduce(
    (count, item) =>
      count +
      item.subItems.filter((subItem) =>
        existing.duplicateSubItemIds.has(subItem.externalId),
      ).length,
    0,
  );
  const totalSubtasks = snapshot.items.reduce(
    (count, item) => count + item.subItems.length,
    0,
  );
  const warnings = snapshot.items
    .map((item) => item.statusWarning)
    .filter((warning): warning is string => !!warning);
  const alreadyImported =
    mode === 'NEW_PROJECT'
      ? !!existing.containerProject
      : duplicateTasks > 0 || duplicateSubtasks > 0;

  return {
    board: {
      id: snapshot.container.externalId,
      name: snapshot.container.name,
      description: snapshot.container.description,
      url: snapshot.container.url,
    },
    mode,
    targetProject,
    alreadyImported,
    importDisabled: alreadyImported,
    totals: {
      lists: snapshot.groups.length,
      cards: snapshot.items.length,
      checklists: snapshot.items.reduce(
        (count, item) =>
          count +
          new Set(item.subItems.map((subItem) => subItem.groupName)).size,
        0,
      ),
      subtasks: totalSubtasks,
      newTasks: snapshot.items.length - duplicateTasks,
      duplicateTasks,
      newSubtasks: totalSubtasks - duplicateSubtasks,
      duplicateSubtasks,
      warnings: warnings.length,
    },
    warnings,
    tasks: snapshot.items.map((item) => ({
      id: item.externalId,
      title: item.title,
      status: item.status,
      priority: item.priority,
      dueDate: item.dueDate?.toISOString(),
      listName: item.groupName,
      duplicate: existing.duplicateItemIds.has(item.externalId),
      subtasks: item.subItems.map((subItem) => ({
        id: subItem.externalId,
        title: subItem.title,
        status: subItem.status,
        checklistName: subItem.groupName,
        duplicate: existing.duplicateSubItemIds.has(subItem.externalId),
      })),
    })),
  };
}

export type TrelloPreview = ReturnType<typeof buildTrelloPreview>;
