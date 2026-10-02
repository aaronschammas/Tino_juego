/**
 * Adivinanza automatica del estado de Tino a partir del nombre de una lista.
 *
 * - `normalizeText()`: pasa a minusculas y quita tildes y espacios de los bordes,
 *   para comparar nombres escritos a mano ("En Progreso" = "en progreso").
 * - `guessTaskStatus()`: compara el nombre completo contra la tabla
 *   `STATUS_NAMES`; si no coincide exacto devuelve `null`, que significa "sin
 *   equivalencia": el usuario la tiene que definir a mano.
 */
import { TaskStatus } from '@prisma/client';

const STATUS_NAMES: Array<{ status: TaskStatus; names: string[] }> = [
  {
    status: TaskStatus.TODO,
    names: ['todo', 'to do', 'por hacer', 'pendiente'],
  },
  {
    status: TaskStatus.IN_PROGRESS,
    names: ['doing', 'in progress', 'en progreso', 'haciendo'],
  },
  { status: TaskStatus.BLOCKED, names: ['blocked', 'bloqueado', 'bloqueada'] },
  {
    status: TaskStatus.DONE,
    names: ['done', 'hecho', 'finalizado', 'completado'],
  },
];

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function guessTaskStatus(name: string): TaskStatus | null {
  const normalized = normalizeText(name);
  const match = STATUS_NAMES.find((entry) =>
    entry.names.some((candidate) => normalized === normalizeText(candidate)),
  );

  return match?.status ?? null;
}
