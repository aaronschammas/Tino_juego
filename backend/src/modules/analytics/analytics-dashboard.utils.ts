import { BadRequestException } from '@nestjs/common';
import {
  DashboardDateField,
  DashboardFiltersDto,
} from './dto/dashboard-filters.dto';

export const DEFAULT_DASHBOARD_TIMEZONE = 'America/Argentina/Buenos_Aires';
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export interface NormalizedDashboardFilters extends Omit<
  DashboardFiltersDto,
  'from' | 'to' | 'timezone' | 'limit'
> {
  from: Date;
  to: Date;
  timezone: string;
  limit: number;
}

export interface DashboardTimeEntry {
  id: string;
  userId: string;
  projectId: string;
  startTime: Date;
  endTime: Date | null;
  totalPausedMs: number | null;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORMATTER_CACHE_LIMIT = 256;
const FORMATTER_OPTIONS = {
  offset: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  },
  weekdayHour: { weekday: 'short', hour: 'numeric', hourCycle: 'h23' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Returns a reusable Intl formatter per timezone; building one costs ~10x more
 * than formatting with it, and the heatmap formats several times per hour bucket.
 */
function getCachedFormatter(
  kind: keyof typeof FORMATTER_OPTIONS,
  timezone: string,
): Intl.DateTimeFormat {
  const key = `${kind}:${timezone}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      ...FORMATTER_OPTIONS[kind],
      timeZone: timezone,
    });
    if (formatterCache.size >= FORMATTER_CACHE_LIMIT) formatterCache.clear();
    formatterCache.set(key, formatter);
  }
  return formatter;
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getCachedFormatter('offset', timezone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const representedAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return representedAsUtc - date.getTime();
}

function dateOnlyBoundary(
  value: string,
  inclusiveDateEnd: boolean,
  timezone: string,
): Date {
  const [year, month, day] = value.split('-').map(Number);
  const validityCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    validityCheck.getUTCFullYear() !== year ||
    validityCheck.getUTCMonth() !== month - 1 ||
    validityCheck.getUTCDate() !== day
  ) {
    throw new BadRequestException(`Invalid dashboard date: ${value}`);
  }
  const localCalendar = new Date(
    Date.UTC(year, month - 1, day + (inclusiveDateEnd ? 1 : 0)),
  );
  const localMidnightAsUtc = Date.UTC(
    localCalendar.getUTCFullYear(),
    localCalendar.getUTCMonth(),
    localCalendar.getUTCDate(),
  );
  let result = new Date(localMidnightAsUtc);
  result = new Date(localMidnightAsUtc - getTimezoneOffsetMs(result, timezone));
  // Re-evaluate once at the resolved instant to account for DST offset changes.
  result = new Date(localMidnightAsUtc - getTimezoneOffsetMs(result, timezone));
  return result;
}

function parseBoundary(
  value: string,
  inclusiveDateEnd: boolean,
  timezone: string,
): Date {
  if (DATE_ONLY_PATTERN.test(value)) {
    return dateOnlyBoundary(value, inclusiveDateEnd, timezone);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid dashboard date: ${value}`);
  }
  return parsed;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeDashboardFilters(
  dto: DashboardFiltersDto = {},
  options?: { heatmap?: boolean; now?: Date; defaultFrom?: Date | null },
): NormalizedDashboardFilters {
  const now = options?.now ? new Date(options.now) : new Date();
  const timezone = dto.timezone || DEFAULT_DASHBOARD_TIMEZONE;
  if (!isValidTimezone(timezone)) {
    throw new BadRequestException('Invalid IANA timezone');
  }
  const to = dto.to ? parseBoundary(dto.to, true, timezone) : now;
  const defaultFrom =
    options?.defaultFrom && options.defaultFrom.getTime() < to.getTime()
      ? new Date(options.defaultFrom)
      : new Date(0);
  const from = dto.from
    ? parseBoundary(dto.from, false, timezone)
    : defaultFrom;

  if (from.getTime() >= to.getTime()) {
    throw new BadRequestException(
      'Dashboard range requires from to be earlier than to',
    );
  }
  if (
    options?.heatmap &&
    dto.from &&
    dto.to &&
    to.getTime() - from.getTime() > 90 * DAY_MS
  ) {
    throw new BadRequestException('Hourly heatmap range cannot exceed 90 days');
  }
  if (dto.dateField === DashboardDateField.COMPLETED) {
    throw new BadRequestException(
      'completed date filtering requires Task.completedAt and is not available yet',
    );
  }

  return {
    ...dto,
    from,
    to,
    timezone,
    limit: dto.limit ?? 50,
    dateField: dto.dateField ?? DashboardDateField.CREATED,
    assigned: dto.assigned,
    groupBy: dto.groupBy ?? 'hourOfWeek',
  };
}

export function calculateActiveMs(
  entry: Pick<DashboardTimeEntry, 'startTime' | 'endTime' | 'totalPausedMs'>,
): number {
  if (!entry.endTime) return 0;
  const elapsed = entry.endTime.getTime() - entry.startTime.getTime();
  return Math.max(0, elapsed - Math.max(0, entry.totalPausedMs ?? 0));
}

export function calculateActiveMsWithinRange(
  entry: Pick<DashboardTimeEntry, 'startTime' | 'endTime' | 'totalPausedMs'>,
  from: Date,
  to: Date,
): number {
  if (!entry.endTime) return 0;
  const rawDurationMs = entry.endTime.getTime() - entry.startTime.getTime();
  if (rawDurationMs <= 0) return 0;
  const overlapStart = Math.max(entry.startTime.getTime(), from.getTime());
  const overlapEnd = Math.min(entry.endTime.getTime(), to.getTime());
  if (overlapStart >= overlapEnd) return 0;
  return (
    ((overlapEnd - overlapStart) / rawDurationMs) * calculateActiveMs(entry)
  );
}

export function roundHours(milliseconds: number): number {
  return Number((milliseconds / HOUR_MS).toFixed(2));
}

export function percentage(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function zonedDayAndHour(
  date: Date,
  timezone: string,
): { dayOfWeek: number; hour: number } {
  const parts = getCachedFormatter('weekdayHour', timezone).formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { dayOfWeek: dayMap[weekday ?? 'Sun'] ?? 0, hour };
}

function nextZonedHourBoundary(timestampMs: number, timezone: string): number {
  const currentOffset = getTimezoneOffsetMs(new Date(timestampMs), timezone);
  const currentLocalMs = timestampMs + currentOffset;
  const nextLocalHourMs = (Math.floor(currentLocalMs / HOUR_MS) + 1) * HOUR_MS;
  let boundary = nextLocalHourMs - currentOffset;
  const boundaryOffset = getTimezoneOffsetMs(new Date(boundary), timezone);
  boundary = nextLocalHourMs - boundaryOffset;
  return boundary > timestampMs ? boundary : timestampMs + HOUR_MS;
}

export function buildHourlyHeatmap(
  entries: DashboardTimeEntry[],
  range: { from: Date; to: Date; timezone: string },
) {
  type MutableCell = {
    dayOfWeek: number;
    hour: number;
    milliseconds: number;
    entryIds: Set<string>;
    userIds: Set<string>;
    projectIds: Set<string>;
  };

  const cells = new Map<string, MutableCell>();
  const includedEntries = new Set<string>();
  const includedUsers = new Set<string>();
  const includedProjects = new Set<string>();
  let totalActiveMs = 0;

  for (const entry of entries) {
    if (!entry.endTime) continue;
    const rawDurationMs = entry.endTime.getTime() - entry.startTime.getTime();
    const activeMs = calculateActiveMs(entry);
    if (rawDurationMs <= 0 || activeMs <= 0) continue;

    const clippedStartMs = Math.max(
      entry.startTime.getTime(),
      range.from.getTime(),
    );
    const clippedEndMs = Math.min(entry.endTime.getTime(), range.to.getTime());
    if (clippedStartMs >= clippedEndMs) continue;

    // Pause locations are not stored. Net active duration is therefore allocated
    // proportionally across each intersected hourly bucket.
    const activeRatio = activeMs / rawDurationMs;
    let cursor = clippedStartMs;
    while (cursor < clippedEndMs) {
      const nextHour = nextZonedHourBoundary(cursor, range.timezone);
      const bucketEnd = Math.min(nextHour, clippedEndMs);
      const bucketActiveMs = (bucketEnd - cursor) * activeRatio;
      const { dayOfWeek, hour } = zonedDayAndHour(
        new Date(cursor),
        range.timezone,
      );
      const key = `${dayOfWeek}:${hour}`;
      const cell = cells.get(key) ?? {
        dayOfWeek,
        hour,
        milliseconds: 0,
        entryIds: new Set<string>(),
        userIds: new Set<string>(),
        projectIds: new Set<string>(),
      };
      cell.milliseconds += bucketActiveMs;
      cell.entryIds.add(entry.id);
      cell.userIds.add(entry.userId);
      cell.projectIds.add(entry.projectId);
      cells.set(key, cell);
      totalActiveMs += bucketActiveMs;
      cursor = bucketEnd;
    }
    includedEntries.add(entry.id);
    includedUsers.add(entry.userId);
    includedProjects.add(entry.projectId);
  }

  const nonZeroMinutes = [...cells.values()]
    .map((cell) => cell.milliseconds / 60_000)
    .sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(nonZeroMinutes.length * 0.95) - 1);
  const maxMinutes = nonZeroMinutes[p95Index] ?? 0;

  return {
    totals: {
      minutes: Number((totalActiveMs / 60_000).toFixed(2)),
      entries: includedEntries.size,
      users: includedUsers.size,
      projects: includedProjects.size,
    },
    cells: [...cells.values()]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour)
      .map((cell) => {
        const minutes = cell.milliseconds / 60_000;
        return {
          dayOfWeek: cell.dayOfWeek,
          hour: cell.hour,
          minutes: Number(minutes.toFixed(2)),
          entries: cell.entryIds.size,
          users: cell.userIds.size,
          projects: cell.projectIds.size,
          outsideBusinessHours:
            cell.dayOfWeek === 0 ||
            cell.dayOfWeek === 6 ||
            cell.hour < 8 ||
            cell.hour >= 20,
          intensity:
            maxMinutes === 0
              ? 0
              : Number(Math.min(1, minutes / maxMinutes).toFixed(3)),
        };
      }),
    normalization: {
      method: 'p95' as const,
      maxMinutes: Number(maxMinutes.toFixed(2)),
    },
  };
}
