import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DashboardAssignedFilter,
  DashboardDateField,
  DashboardFiltersDto,
} from './dto/dashboard-filters.dto';
import {
  buildHourlyHeatmap,
  calculateActiveMs,
  calculateActiveMsWithinRange,
  DashboardTimeEntry,
  isValidTimezone,
  normalizeDashboardFilters,
  percentage,
  roundHours,
} from './analytics-dashboard.utils';

const entry = (
  overrides: Partial<DashboardTimeEntry> = {},
): DashboardTimeEntry => ({
  id: 'entry-1',
  userId: 'user-1',
  projectId: 'project-1',
  startTime: new Date('2026-06-22T12:00:00.000Z'),
  endTime: new Date('2026-06-22T13:00:00.000Z'),
  totalPausedMs: 0,
  ...overrides,
});

describe('Dashboard analytics utilities', () => {
  describe('DashboardFiltersDto', () => {
    it('transforms array, boolean and numeric query parameters', async () => {
      const dto = plainToInstance(DashboardFiltersDto, {
        projectIds: 'p1,p2',
        overdue: 'false',
        limit: '200',
      });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.projectIds).toEqual(['p1', 'p2']);
      expect(dto.overdue).toBe(false);
      expect(dto.limit).toBe(200);
    });

    it('rejects invalid dates and limits above 200', async () => {
      const dto = plainToInstance(DashboardFiltersDto, {
        from: 'not-a-date',
        limit: '201',
      });
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toEqual(
        expect.arrayContaining(['from', 'limit']),
      );
    });
  });

  describe('normalizeDashboardFilters', () => {
    it('uses open-ended defaults and a limit of 50', () => {
      const now = new Date('2026-06-21T15:00:00.000Z');
      const result = normalizeDashboardFilters({}, { now });
      expect(result.to).toEqual(now);
      expect(result.from).toEqual(new Date(0));
      expect(result.limit).toBe(50);
    });

    it('turns a date-only to boundary into the next exclusive day', () => {
      const result = normalizeDashboardFilters({
        from: '2026-06-01',
        to: '2026-06-21',
      });
      expect(result.from.toISOString()).toBe('2026-06-01T03:00:00.000Z');
      expect(result.to.toISOString()).toBe('2026-06-22T03:00:00.000Z');
    });

    it('rejects invalid, reversed and oversized heatmap ranges', () => {
      expect(() => normalizeDashboardFilters({ from: 'invalid' })).toThrow(
        BadRequestException,
      );
      expect(() => normalizeDashboardFilters({ from: '2026-02-31' })).toThrow(
        BadRequestException,
      );
      expect(() =>
        normalizeDashboardFilters({ from: '2026-06-22', to: '2026-06-21' }),
      ).toThrow(BadRequestException);
      expect(() =>
        normalizeDashboardFilters(
          { from: '2026-01-01', to: '2026-06-21' },
          { heatmap: true },
        ),
      ).toThrow(BadRequestException);
    });

    it('validates timezone and unsupported completed-date filters', () => {
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Not/A_Timezone')).toBe(false);
      expect(() =>
        normalizeDashboardFilters({ timezone: 'Not/A_Timezone' }),
      ).toThrow('Invalid IANA timezone');
      expect(() =>
        normalizeDashboardFilters({ dateField: DashboardDateField.COMPLETED }),
      ).toThrow('completed date filtering requires Task.completedAt');
    });

    it('supports explicit ISO boundaries and non-default options', () => {
      const result = normalizeDashboardFilters({
        from: '2026-06-01T10:00:00.000Z',
        to: '2026-06-02T10:00:00.000Z',
        timezone: 'UTC',
        limit: 25,
        dateField: DashboardDateField.DUE,
        assigned: DashboardAssignedFilter.ASSIGNED,
        groupBy: 'hourOfWeek',
      });

      expect(result).toEqual(
        expect.objectContaining({
          from: new Date('2026-06-01T10:00:00.000Z'),
          to: new Date('2026-06-02T10:00:00.000Z'),
          timezone: 'UTC',
          limit: 25,
          dateField: DashboardDateField.DUE,
          assigned: DashboardAssignedFilter.ASSIGNED,
        }),
      );
    });

    it('accepts the function defaults when called without arguments', () => {
      const result = normalizeDashboardFilters();
      expect(result.timezone).toBe('America/Argentina/Buenos_Aires');
      expect(result.limit).toBe(50);
    });
  });

  describe('calculateActiveMs', () => {
    it('ignores open entries, subtracts pauses and never returns a negative value', () => {
      expect(calculateActiveMs(entry({ endTime: null }))).toBe(0);
      expect(calculateActiveMs(entry({ totalPausedMs: 15 * 60_000 }))).toBe(
        45 * 60_000,
      );
      expect(calculateActiveMs(entry({ totalPausedMs: 2 * 60 * 60_000 }))).toBe(
        0,
      );
    });

    it('clips active duration proportionally to the requested range', () => {
      const twoHours = entry({
        startTime: new Date('2026-06-10T11:00:00Z'),
        endTime: new Date('2026-06-10T13:00:00Z'),
        totalPausedMs: 30 * 60_000,
      });
      expect(
        calculateActiveMsWithinRange(
          twoHours,
          new Date('2026-06-10T12:00:00Z'),
          new Date('2026-06-10T13:00:00Z'),
        ),
      ).toBe(45 * 60_000);
    });

    it('handles null pauses and ranges with no usable overlap', () => {
      expect(calculateActiveMs(entry({ totalPausedMs: null }))).toBe(
        60 * 60_000,
      );
      expect(
        calculateActiveMsWithinRange(
          entry({ endTime: null }),
          new Date('2026-06-22T12:00:00Z'),
          new Date('2026-06-22T13:00:00Z'),
        ),
      ).toBe(0);
      expect(
        calculateActiveMsWithinRange(
          entry({ endTime: new Date('2026-06-22T11:00:00Z') }),
          new Date('2026-06-22T12:00:00Z'),
          new Date('2026-06-22T13:00:00Z'),
        ),
      ).toBe(0);
      expect(
        calculateActiveMsWithinRange(
          entry(),
          new Date('2026-06-23T12:00:00Z'),
          new Date('2026-06-23T13:00:00Z'),
        ),
      ).toBe(0);
      expect(roundHours(90 * 60_000)).toBe(1.5);
      expect(percentage(1, 0)).toBeNull();
      expect(percentage(1, 4)).toBe(25);
    });
  });

  describe('buildHourlyHeatmap', () => {
    const range = {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-07-01T00:00:00.000Z'),
      timezone: 'America/Argentina/Buenos_Aires',
    };

    it('places a one-hour timer in the correct timezone bucket', () => {
      const result = buildHourlyHeatmap([entry()], range);
      expect(result.totals.minutes).toBe(60);
      expect(result.cells).toEqual([
        expect.objectContaining({
          dayOfWeek: 1,
          hour: 9,
          minutes: 60,
          entries: 1,
          users: 1,
        }),
      ]);
    });

    it('reuses timezone formatters across hour buckets', () => {
      const formatterSpy = jest.spyOn(Intl, 'DateTimeFormat');
      const twelveHours = entry({
        startTime: new Date('2026-06-22T00:00:00.000Z'),
        endTime: new Date('2026-06-22T12:00:00.000Z'),
      });

      const result = buildHourlyHeatmap([twelveHours], {
        ...range,
        timezone: 'Asia/Tokyo',
      });

      expect(result.totals.minutes).toBe(720);
      expect(formatterSpy.mock.calls.length).toBeLessThanOrEqual(2);
      formatterSpy.mockRestore();
    });

    it('splits timers across hours and midnight', () => {
      const long = entry({
        startTime: new Date('2026-06-22T12:45:00.000Z'),
        endTime: new Date('2026-06-22T14:15:00.000Z'),
      });
      const midnight = entry({
        id: 'entry-2',
        startTime: new Date('2026-06-23T02:30:00.000Z'),
        endTime: new Date('2026-06-23T03:30:00.000Z'),
      });
      const result = buildHourlyHeatmap([long, midnight], range);

      expect(result.cells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ dayOfWeek: 1, hour: 9, minutes: 15 }),
          expect.objectContaining({ dayOfWeek: 1, hour: 10, minutes: 60 }),
          expect.objectContaining({ dayOfWeek: 1, hour: 11, minutes: 15 }),
          expect.objectContaining({ dayOfWeek: 1, hour: 23, minutes: 30 }),
          expect.objectContaining({ dayOfWeek: 2, hour: 0, minutes: 30 }),
        ]),
      );
    });

    it('allocates pauses proportionally and normalizes intensity with p95', () => {
      const paused = entry({
        startTime: new Date('2026-06-22T12:45:00.000Z'),
        endTime: new Date('2026-06-22T14:15:00.000Z'),
        totalPausedMs: 30 * 60_000,
      });
      const result = buildHourlyHeatmap([paused], range);

      expect(result.totals.minutes).toBe(60);
      expect(result.cells.map((cell) => cell.minutes)).toEqual([10, 40, 10]);
      expect(result.normalization).toEqual({ method: 'p95', maxMinutes: 40 });
      expect(result.cells.find((cell) => cell.hour === 10)?.intensity).toBe(1);
    });

    it('changes the resulting bucket when timezone changes', () => {
      const buenosAires = buildHourlyHeatmap([entry()], range);
      const utc = buildHourlyHeatmap([entry()], { ...range, timezone: 'UTC' });
      expect(buenosAires.cells[0].hour).toBe(9);
      expect(utc.cells[0].hour).toBe(12);
    });

    it('uses local hour boundaries for fractional-offset timezones', () => {
      const kathmandu = buildHourlyHeatmap(
        [
          entry({
            startTime: new Date('2026-06-22T04:00:00Z'),
            endTime: new Date('2026-06-22T05:00:00Z'),
          }),
        ],
        { ...range, timezone: 'Asia/Kathmandu' },
      );
      expect(kathmandu.cells).toEqual([
        expect.objectContaining({ hour: 9, minutes: 15 }),
        expect.objectContaining({ hour: 10, minutes: 45 }),
      ]);
    });

    it('ignores open, invalid, paused-out and out-of-range entries', () => {
      const result = buildHourlyHeatmap(
        [
          entry({ id: 'open', endTime: null }),
          entry({ id: 'backwards', endTime: new Date('2026-06-22T11:00:00Z') }),
          entry({ id: 'paused-out', totalPausedMs: 60 * 60_000 }),
          entry({
            id: 'outside',
            startTime: new Date('2026-05-01T12:00:00Z'),
            endTime: new Date('2026-05-01T13:00:00Z'),
          }),
        ],
        range,
      );

      expect(result.totals).toEqual({
        minutes: 0,
        entries: 0,
        users: 0,
        projects: 0,
      });
      expect(result.cells).toEqual([]);
      expect(result.normalization.maxMinutes).toBe(0);
    });

    it('merges entries in one bucket and classifies business-hour boundaries', () => {
      const result = buildHourlyHeatmap(
        [
          entry({ id: 'business-1' }),
          entry({ id: 'business-2', userId: 'user-2', projectId: 'project-2' }),
          entry({
            id: 'weekend',
            startTime: new Date('2026-06-21T12:00:00Z'),
            endTime: new Date('2026-06-21T13:00:00Z'),
          }),
          entry({
            id: 'late',
            startTime: new Date('2026-06-23T23:00:00Z'),
            endTime: new Date('2026-06-24T00:00:00Z'),
          }),
        ],
        range,
      );

      expect(result.cells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            hour: 9,
            entries: 2,
            users: 2,
            projects: 2,
            outsideBusinessHours: false,
          }),
          expect.objectContaining({ dayOfWeek: 0, outsideBusinessHours: true }),
          expect.objectContaining({ hour: 20, outsideBusinessHours: true }),
        ]),
      );
    });
  });
});
