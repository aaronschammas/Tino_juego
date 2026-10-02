import ExcelJS from 'exceljs';
import { attachCharts, ChartSpec } from './report-charts';
import {
  COLORS,
  decimalHours,
  fileDate,
  safeText,
  statusColors,
  statusLabels,
} from './report-theme';
import { ReportDocument } from './report-types';

const DATA_SHEET = 'Datos';
const SUMMARY_SHEET = 'Resumen';
const STATUS_HEADER_ROW = 20;
const META_ROW = 26;
const MAX_CHART_ROWS = 15;

function solid(color: string): ExcelJS.Fill {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${color}` },
  };
}

function statusRows(report: ReportDocument) {
  const present = report.statusDistribution.filter((item) => item.count > 0);
  return present.length ? present : report.statusDistribution;
}

function buildSummary(sheet: ExcelJS.Worksheet, report: ReportDocument) {
  sheet.columns = Array.from({ length: 14 }, () => ({ width: 12 }));

  sheet.getCell(STATUS_HEADER_ROW, 1).value = 'Estado Tareas';
  sheet.getCell(STATUS_HEADER_ROW, 2).value = 'Cantidad';
  [1, 2].forEach((column) => {
    const cell = sheet.getCell(STATUS_HEADER_ROW, column);
    cell.fill = solid(COLORS.navy);
    cell.font = { bold: true, italic: true, color: { argb: 'FFFFFFFF' } };
  });
  statusRows(report).forEach((item, index) => {
    const row = STATUS_HEADER_ROW + 1 + index;
    sheet.getCell(row, 1).value = item.label;
    sheet.getCell(row, 2).value = item.count;
    sheet.getCell(row, 1).border = {
      bottom: { style: 'thin', color: { argb: `FF${COLORS.border}` } },
    };
    sheet.getCell(row, 2).border = {
      bottom: { style: 'thin', color: { argb: `FF${COLORS.border}` } },
    };
  });

  const meta: Array<[string, string]> = [
    ['Organización', report.organization.name],
    [
      'Período',
      `${fileDate(report.range.from)} — ${fileDate(report.range.to)}`,
    ],
    ['Proyecto', report.filters.project],
    ['Usuario', report.filters.user],
    ['Estado', report.filters.status],
    [
      'Generado',
      new Date(report.generatedAt).toLocaleString('es-AR', {
        timeZone: report.timezone,
      }),
    ],
  ];
  sheet.getCell(META_ROW - 1, 1).value = 'Detalle del informe';
  sheet.getCell(META_ROW - 1, 1).font = {
    bold: true,
    size: 13,
    color: { argb: `FF${COLORS.navy}` },
  };
  meta.forEach(([label, value], index) => {
    const row = META_ROW + index;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = {
      bold: true,
      color: { argb: `FF${COLORS.gray}` },
    };
    sheet.mergeCells(row, 2, row, 6);
    sheet.getCell(row, 2).value = safeText(value);
  });

  const cardsRow = META_ROW + meta.length + 2;
  const cards: Array<[string, number, string]> = [
    ['Tareas', report.summary.totalTasks, COLORS.blue],
    ['Completadas', report.summary.completedTasks, COLORS.green],
    ['No completadas', report.summary.incompleteTasks, COLORS.red],
    [
      'Horas estimadas',
      decimalHours(report.summary.totalEstimatedHours),
      COLORS.lime,
    ],
    [
      'Horas totales',
      decimalHours(report.summary.totalActualHours),
      COLORS.orange,
    ],
    [
      'Desvío de horas',
      decimalHours(report.summary.deviationHours),
      COLORS.navy,
    ],
  ];
  cards.forEach(([label, value, color], index) => {
    const column = 1 + index * 2;
    sheet.mergeCells(cardsRow, column, cardsRow, column + 1);
    sheet.mergeCells(cardsRow + 1, column, cardsRow + 2, column + 1);
    const header = sheet.getCell(cardsRow, column);
    header.value = label;
    header.fill = solid(color);
    header.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    const cell = sheet.getCell(cardsRow + 1, column);
    cell.value = value;
    cell.font = { bold: true, size: 15, color: { argb: `FF${COLORS.navy}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (index >= 3) cell.numFmt = '0.00';
  });
}

function buildData(sheet: ExcelJS.Worksheet, report: ReportDocument) {
  const columns = [
    { name: 'Usuarios', width: 26 },
    { name: 'Proyectos', width: 22 },
    { name: 'Tareas', width: 38 },
    { name: 'Estado Tareas', width: 16 },
    { name: 'Horas estimadas', width: 16 },
    { name: 'Horas totales', width: 16 },
    { name: 'Desvío de horas', width: 17 },
    { name: 'Tarea padre', width: 30 },
    { name: 'ID de tarea', width: 38 },
  ];
  sheet.columns = columns.map((column) => ({ width: column.width }));

  const rows = report.tasks.map((task, index) => {
    const line = index + 2;
    return [
      safeText(task.assignedTo),
      safeText(task.projectName),
      safeText(task.title),
      statusLabels[task.status],
      decimalHours(task.estimatedHours),
      decimalHours(task.actualHours),
      {
        formula: `F${line}-E${line}`,
        result: decimalHours(task.deviationHours),
      },
      task.parentTitle ? safeText(task.parentTitle) : '',
      safeText(task.id),
    ];
  });

  sheet.addTable({
    name: 'Tabla_1',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleMedium7', showRowStripes: true },
    columns: columns.map((column) => ({
      name: column.name,
      filterButton: true,
    })),
    rows: rows.length ? rows : [columns.map(() => '')],
  });

  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = solid(COLORS.emerald);
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  report.tasks.forEach((task, index) => {
    const row = sheet.getRow(index + 2);
    row.getCell(3).alignment = { wrapText: true, vertical: 'middle' };
    row.getCell(8).alignment = { wrapText: true, vertical: 'middle' };
    [4].forEach((column) => {
      row.getCell(column).alignment = { horizontal: 'center' };
    });
    [5, 6, 7].forEach((column) => {
      const cell = row.getCell(column);
      cell.numFmt = '0.00';
      cell.alignment = { horizontal: 'right' };
    });
    row.getCell(4).font = {
      bold: true,
      color: { argb: `FF${statusColors[task.status]}` },
    };
  });

  if (report.tasks.length)
    sheet.addConditionalFormatting({
      ref: `G2:G${report.tasks.length + 1}`,
      rules: [
        {
          type: 'cellIs',
          priority: 1,
          operator: 'greaterThan',
          formulae: [0],
          style: { font: { bold: true, color: { argb: `FF${COLORS.red}` } } },
        },
        {
          type: 'cellIs',
          priority: 2,
          operator: 'lessThan',
          formulae: [0],
          style: { font: { bold: true, color: { argb: `FF${COLORS.green}` } } },
        },
      ],
    });
}

function chartSpecs(report: ReportDocument): ChartSpec[] {
  if (!report.tasks.length) return [];
  const lastTaskRow = Math.min(report.tasks.length, MAX_CHART_ROWS) + 1;
  const statuses = statusRows(report);
  const lastStatusRow = STATUS_HEADER_ROW + statuses.length;
  return [
    {
      kind: 'bar',
      title: 'Comparación de horas por tarea',
      valueAxisTitle: 'Horas',
      categoryAxisTitle: 'Tareas',
      categoriesRef: `${DATA_SHEET}!$C$2:$C$${lastTaskRow}`,
      series: [
        {
          nameRef: `${DATA_SHEET}!$E$1`,
          valuesRef: `${DATA_SHEET}!$E$2:$E$${lastTaskRow}`,
          color: COLORS.blue,
        },
        {
          nameRef: `${DATA_SHEET}!$F$1`,
          valuesRef: `${DATA_SHEET}!$F$2:$F$${lastTaskRow}`,
          color: COLORS.red,
        },
      ],
      anchor: { fromColumn: 0, fromRow: 1, toColumn: 6, toRow: 17 },
    },
    {
      kind: 'doughnut',
      title: 'Proporción de estados de las tareas',
      categoriesRef: `${SUMMARY_SHEET}!$A$${STATUS_HEADER_ROW + 1}:$A$${lastStatusRow}`,
      valuesRef: `${SUMMARY_SHEET}!$B$${STATUS_HEADER_ROW + 1}:$B$${lastStatusRow}`,
      colors: statuses.map((item) => statusColors[item.status]),
      anchor: { fromColumn: 7, fromRow: 1, toColumn: 13, toRow: 16 },
    },
  ];
}

export async function renderReportExcel(report: ReportDocument) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Tino';
  book.created = new Date(report.generatedAt);
  const summary = book.addWorksheet(SUMMARY_SHEET);
  const data = book.addWorksheet(DATA_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  buildSummary(summary, report);
  buildData(data, report);
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  return attachCharts(buffer, SUMMARY_SHEET, chartSpecs(report));
}
