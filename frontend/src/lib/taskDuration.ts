export const MAX_TASK_HOURS = 999;
export const MAX_TASK_MINUTES = 59;
export const MAX_TASK_TOTAL_MINUTES = MAX_TASK_HOURS * 60 + MAX_TASK_MINUTES;
export const TASK_DURATION_ERROR = 'La estimación máxima permitida es de 999 h 59 min';

/**
 * Segundos que le faltan a una tarea del juego de la feria (su estimación dura menos de un minuto, algo que Tino
 * no permite cargar a mano), o null si es una tarea común.
 */
export function shortTaskSeconds(task: { estimatedHours?: number | null; actualHours?: number | null } | null | undefined) {
  const estimate = Math.round((task?.estimatedHours ?? 0) * 3600);
  if (estimate <= 0 || estimate >= 60) return null;
  return Math.max(1, estimate - Math.round((task?.actualHours ?? 0) * 3600));
}

/** Duración objetivo de un timer en minutos: la de la tarea si es del juego (fracción de minuto), si no la elegida. */
export function timerTargetMinutes(
  entry: { targetMinutes?: number; task?: { estimatedHours?: number | null } | null } | null | undefined,
  fallback: number,
) {
  const seconds = shortTaskSeconds(entry?.task);
  return seconds ? seconds / 60 : entry?.targetMinutes || fallback;
}

export function parseTaskDuration(hours: string, minutes: string) {
  if (!/^\d{1,3}$/.test(hours) || !/^\d{1,2}$/.test(minutes)) return null;
  if (Number(hours) > MAX_TASK_HOURS || Number(minutes) > MAX_TASK_MINUTES) return null;
  return Number(hours) * 60 + Number(minutes);
}
