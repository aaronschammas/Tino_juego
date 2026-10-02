import { TaskStatus } from '@prisma/client';

export const COLORS = {
  navy: '1E3A5F',
  blue: '19A7E0',
  green: '22C55E',
  emerald: '217346',
  lime: '84CC16',
  orange: 'F97316',
  red: 'EF4444',
  amber: 'F5B700',
  gray: '64748B',
  muted: '94A3B8',
  pale: 'F8FAFC',
  border: 'E2E8F0',
};

export const MAX_EXPORT_ROWS = 20_000;

export const statusLabels: Record<TaskStatus, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  BLOCKED: 'Bloqueada',
  DONE: 'Completada',
};

export const statusColors: Record<TaskStatus, string> = {
  TODO: COLORS.blue,
  IN_PROGRESS: COLORS.amber,
  BLOCKED: COLORS.red,
  DONE: COLORS.green,
};

export function formatHours(hours: number) {
  const sign = hours < 0 ? '-' : '';
  const minutes = Math.round(Math.abs(hours) * 60);
  return `${sign}${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function decimalHours(hours: number) {
  return Number((hours ?? 0).toFixed(2));
}

export function fileDate(value: string) {
  return value.slice(0, 10);
}

export function shortDate(value: string) {
  const [year, month, day] = fileDate(value).split('-');
  return `${day}/${month}/${year.slice(2)}`;
}

export function deviationColor(hours: number) {
  if (hours > 0) return COLORS.red;
  if (hours < 0) return COLORS.green;
  return COLORS.gray;
}

export function safeText(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
