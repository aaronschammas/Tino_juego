export const MAX_TASK_HOURS = 999;
export const MAX_TASK_MINUTES = 59;
export const MAX_TASK_TOTAL_MINUTES = MAX_TASK_HOURS * 60 + MAX_TASK_MINUTES;
export const TASK_DURATION_ERROR = 'La estimación máxima permitida es de 999 h 59 min';

export function parseTaskDuration(hours: string, minutes: string) {
  if (!/^\d{1,3}$/.test(hours) || !/^\d{1,2}$/.test(minutes)) return null;
  if (Number(hours) > MAX_TASK_HOURS || Number(minutes) > MAX_TASK_MINUTES) return null;
  return Number(hours) * 60 + Number(minutes);
}
