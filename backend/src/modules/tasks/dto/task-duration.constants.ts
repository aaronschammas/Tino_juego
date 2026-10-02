export const MAX_TASK_ESTIMATED_HOURS = 999 + 59 / 60;

export function isWholeMinuteHours(value: unknown) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value * 60 - Math.round(value * 60)) < 1e-8
  );
}
