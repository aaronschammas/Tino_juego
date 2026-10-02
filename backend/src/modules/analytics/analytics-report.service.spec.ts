import { ForbiddenException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { TaskStatus } from '@prisma/client';
import { AnalyticsReportService } from './analytics-report.service';

describe('AnalyticsReportService', () => {
  const owner = {
    id: 'owner-1',
    organizationId: 'org-1',
    role: 'ORG_OWNER',
  } as any;
  let prisma: any;
  let service: AnalyticsReportService;

  const entry = (start: string, end: string, pause = 0) => ({
    startTime: new Date(start),
    endTime: new Date(end),
    totalPausedMs: pause,
  });
  const task = (overrides: Record<string, unknown> = {}) => ({
    id: 'task-1',
    title: 'Planificación ágil',
    status: TaskStatus.IN_PROGRESS,
    estimatedHours: 2,
    dueDate: null,
    createdAt: new Date('2026-06-10T12:00:00Z'),
    project: { name: 'Proyecto Ñ' },
    assignedToId: 'user-1',
    assignedTo: { id: 'user-1', name: 'José', lastname: 'Pérez' },
    timeEntries: [entry('2026-06-10T12:00:00Z', '2026-06-10T15:00:00Z')],
    subTasks: [],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ORG_OWNER' }),
      },
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'org-1', name: 'Organización Tino' }),
      },
      project: { findMany: jest.fn().mockResolvedValue([{ id: 'project-1' }]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AnalyticsReportService(prisma);
  });

  it('uses overlap or creation in range and excludes updatedAt from the query', async () => {
    prisma.task.findMany.mockResolvedValue([
      task({
        createdAt: new Date('2025-01-01'),
        timeEntries: [entry('2026-06-01T23:00:00Z', '2026-06-02T02:00:00Z')],
      }),
    ]);
    const report = await service.buildReport(owner, {
      from: '2026-06-02',
      to: '2026-06-02',
      timezone: 'UTC',
    });
    expect(report.tasks).toHaveLength(1);
    expect(report.tasks[0].actualHours).toBe(2);
    expect(JSON.stringify(prisma.task.findMany.mock.calls[0][0])).not.toContain(
      'updatedAt',
    );
  });

  it('does not double count a parent when its subtasks are reportable', async () => {
    prisma.task.findMany.mockResolvedValue([
      task({
        assignedTo: null,
        assignedToId: null,
        timeEntries: [],
        subTasks: [
          task({
            id: 'sub-1',
            title: 'Subtarea',
            project: undefined,
            timeEntries: [
              entry('2026-06-10T12:00:00Z', '2026-06-10T14:00:00Z'),
            ],
          }),
        ],
      }),
    ]);
    const report = await service.buildReport(owner, {
      from: '2026-06-01',
      to: '2026-06-30',
      timezone: 'UTC',
    });
    expect(report.summary.totalTasks).toBe(1);
    expect(report.tasks[0]).toMatchObject({
      id: 'sub-1',
      parentTitle: 'Planificación ágil',
      actualHours: 2,
    });
  });

  it('aggregates users by stable id and computes deviations and overdue tasks', async () => {
    prisma.task.findMany.mockResolvedValue([
      task({
        id: 'a',
        dueDate: new Date('2026-06-05'),
        status: TaskStatus.IN_PROGRESS,
      }),
      task({
        id: 'b',
        title: 'Otra',
        status: TaskStatus.DONE,
        estimatedHours: 1,
        timeEntries: [entry('2026-06-11T12:00:00Z', '2026-06-11T13:00:00Z')],
      }),
    ]);
    const report = await service.buildReport(owner, {
      from: '2026-06-01',
      to: '2026-06-30',
      timezone: 'UTC',
    });
    expect(report.users).toHaveLength(1);
    expect(report.users[0]).toMatchObject({
      userId: 'user-1',
      totalTasks: 2,
      actualHours: 4,
      estimatedHours: 3,
      deviationHours: 1,
    });
    expect(report.summary.overdueTasks).toBe(1);
  });

  it('rejects project ids outside the authorized organization scope', async () => {
    await expect(
      service.buildReport(owner, { projectIds: ['other'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('creates a real XLSX with both sheets, a filtered table and decimal hours', async () => {
    prisma.task.findMany.mockResolvedValue([task({ title: '=SUM(A1:A2)' })]);
    const { buffer } = await service.createExcel(owner, {
      from: '2026-06-01',
      to: '2026-06-30',
      timezone: 'UTC',
    });
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Resumen',
      'Datos',
    ]);
    const data = workbook.getWorksheet('Datos')!;
    expect(data.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(data.getCell('C2').value).toBe("'=SUM(A1:A2)");
    expect(data.getCell('E2').value).toBe(2);
    expect(data.getCell('E2').numFmt).toBe('0.00');
    expect(data.getCell('G2').value).toMatchObject({ formula: 'F2-E2' });

    const zip = await JSZip.loadAsync(buffer);
    const table = await zip.file('xl/tables/table1.xml')!.async('string');
    expect(table).toContain('Tabla_1');
    expect(table).toContain('Desvío de horas');
    expect(table).toContain('<autoFilter ref="A1:I2">');
    expect(table).toContain('hiddenButton="0"');
  });

  it('embeds native bar and doughnut charts in the summary sheet', async () => {
    prisma.task.findMany.mockResolvedValue([task()]);
    const { buffer } = await service.createExcel(owner, {
      from: '2026-06-01',
      to: '2026-06-30',
      timezone: 'UTC',
    });
    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        'xl/charts/chart1.xml',
        'xl/charts/chart2.xml',
        'xl/drawings/drawing1.xml',
        'xl/drawings/_rels/drawing1.xml.rels',
      ]),
    );
    const bar = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(bar).toContain('<c:barDir val="bar"/>');
    expect(bar).toContain('Datos!$E$2:$E$2');
    const doughnut = await zip.file('xl/charts/chart2.xml')!.async('string');
    expect(doughnut).toContain('<c:holeSize val="50"/>');
    expect(doughnut).toContain('Resumen!$B$21:$B$21');
    const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
    expect(contentTypes).toContain('/xl/charts/chart1.xml');
    expect(contentTypes).toContain('/xl/drawings/drawing1.xml');
    const summary = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(summary).toMatch(/<drawing r:id="rId\d+"\/>/);
  });

  it('creates a multipage PDF for more than five users', async () => {
    prisma.task.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) =>
        task({
          id: `task-${index}`,
          assignedToId: `user-${index}`,
          assignedTo: {
            id: `user-${index}`,
            name: `Usuario ${index}`,
            lastname: 'Álvarez',
          },
        }),
      ),
    );
    const { buffer } = await service.createPdf(owner, {
      from: '2026-06-01',
      to: '2026-06-30',
      timezone: 'UTC',
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(
      buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });
});
