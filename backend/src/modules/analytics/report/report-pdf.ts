import PDFDocument from 'pdfkit';
import {
  COLORS,
  deviationColor,
  formatHours,
  shortDate,
  statusColors,
  statusLabels,
} from './report-theme';
import {
  ReportDocument,
  ReportTaskRow,
  ReportUserMetric,
} from './report-types';

type Doc = PDFKit.PDFDocument;

const MARGIN = 42;
const CONTENT_TOP = 104;
const BOTTOM_LIMIT = 62;
const CELL_HEIGHT = 43;
const CELL_GAP = 7;

interface Cell {
  label: string;
  value: string;
  color: string;
  valueColor?: string;
}

function contentWidth(doc: Doc) {
  return doc.page.width - MARGIN * 2;
}

function clockMark(doc: Doc, cx: number, cy: number, radius: number) {
  doc.save();
  doc
    .lineWidth(1.6)
    .strokeColor(`#${COLORS.blue}`)
    .circle(cx, cy, radius)
    .stroke();
  doc
    .lineWidth(1.5)
    .moveTo(cx, cy)
    .lineTo(cx, cy - radius * 0.55)
    .stroke();
  doc
    .lineWidth(1.5)
    .moveTo(cx, cy)
    .lineTo(cx + radius * 0.45, cy + radius * 0.3)
    .stroke();
  doc.restore();
}

function header(
  doc: Doc,
  report: ReportDocument,
  title: string,
  eyebrow?: string,
) {
  const width = contentWidth(doc);
  doc.save();
  if (eyebrow) {
    doc
      .fillColor(`#${COLORS.muted}`)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(eyebrow.toUpperCase(), MARGIN, 42, {
        width: width - 36,
        characterSpacing: 1.4,
        lineBreak: false,
      });
    doc
      .fillColor(`#${COLORS.navy}`)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(title, MARGIN, 54, { width: width - 36, lineBreak: false });
  } else {
    doc
      .fillColor(`#${COLORS.navy}`)
      .font('Helvetica-Bold')
      .fontSize(19)
      .text(title, MARGIN, 46, { width: width - 36, lineBreak: false });
  }
  doc
    .fillColor(`#${COLORS.gray}`)
    .font('Helvetica')
    .fontSize(8.5)
    .text(
      `Período: ${shortDate(report.range.from)} — ${shortDate(report.range.to)}`,
      MARGIN,
      79,
      { width, lineBreak: false },
    );
  clockMark(doc, doc.page.width - MARGIN - 12, 56, 11);
  doc
    .moveTo(MARGIN, 96)
    .lineTo(doc.page.width - MARGIN, 96)
    .lineWidth(1)
    .strokeColor(`#${COLORS.border}`)
    .stroke();
  doc.restore();
  doc.y = CONTENT_TOP;
}

function footer(doc: Doc, report: ReportDocument, page: number) {
  const generated = new Date(report.generatedAt).toLocaleString('es-AR', {
    timeZone: report.timezone,
  });
  doc
    .fillColor(`#${COLORS.muted}`)
    .font('Helvetica')
    .fontSize(7.5)
    .text(
      `${report.organization.name} · Generado ${generated} · Página ${page}`,
      MARGIN,
      doc.page.height - 34,
      { width: contentWidth(doc), align: 'right', lineBreak: false },
    );
}

function metricCell(doc: Doc, x: number, y: number, width: number, cell: Cell) {
  doc.roundedRect(x, y, width, 15, 3).fill(`#${cell.color}`);
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(5.8)
    .text(cell.label.toUpperCase(), x + 3, y + 5, {
      width: width - 6,
      align: 'center',
      characterSpacing: 0.4,
      lineBreak: false,
    });
  doc
    .roundedRect(x, y + 17, width, 26, 3)
    .fillAndStroke('#FFFFFF', `#${COLORS.border}`);
  doc
    .fillColor(`#${cell.valueColor ?? COLORS.navy}`)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(cell.value, x + 3, y + 25, {
      width: width - 6,
      align: 'center',
      lineBreak: false,
    });
}

function metricRow(doc: Doc, y: number, cells: Cell[]) {
  const width = contentWidth(doc);
  const size = (width - CELL_GAP * (cells.length - 1)) / cells.length;
  cells.forEach((cell, index) =>
    metricCell(doc, MARGIN + index * (size + CELL_GAP), y, size, cell),
  );
  return y + CELL_HEIGHT;
}

function userCells(metric: ReportUserMetric): Cell[] {
  return [
    { label: 'Tareas', value: String(metric.totalTasks), color: COLORS.blue },
    {
      label: 'Completadas',
      value: String(metric.completedTasks),
      color: COLORS.green,
    },
    {
      label: 'No completadas',
      value: String(metric.incompleteTasks),
      color: COLORS.red,
    },
    {
      label: 'Estimado',
      value: formatHours(metric.estimatedHours),
      color: COLORS.lime,
    },
    {
      label: 'Real',
      value: formatHours(metric.actualHours),
      color: COLORS.orange,
    },
    {
      label: 'Desvío',
      value: formatHours(metric.deviationHours),
      color: COLORS.navy,
      valueColor: deviationColor(metric.deviationHours),
    },
  ];
}

function taskCells(task: ReportTaskRow): Cell[] {
  return [
    {
      label: 'Estado',
      value: statusLabels[task.status],
      color: statusColors[task.status],
    },
    {
      label: 'Estimado',
      value: formatHours(task.estimatedHours),
      color: COLORS.blue,
    },
    { label: 'Real', value: formatHours(task.actualHours), color: COLORS.lime },
    {
      label: 'Desvío',
      value: formatHours(task.deviationHours),
      color: COLORS.orange,
      valueColor: deviationColor(task.deviationHours),
    },
  ];
}

function taskTitleHeight(doc: Doc, task: ReportTaskRow) {
  doc.font('Helvetica-Bold').fontSize(10.5);
  return doc.heightOfString(task.title || 'Tarea', {
    width: contentWidth(doc),
  });
}

function taskCardHeight(doc: Doc, task: ReportTaskRow) {
  return (
    10 +
    taskTitleHeight(doc, task) +
    (task.parentTitle ? 11 : 0) +
    6 +
    CELL_HEIGHT +
    16
  );
}

function taskCard(doc: Doc, y: number, task: ReportTaskRow) {
  const width = contentWidth(doc);
  doc
    .fillColor(`#${COLORS.muted}`)
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .text(`TAREA · ${task.projectName}`.toUpperCase(), MARGIN, y, {
      width,
      characterSpacing: 1.1,
      lineBreak: false,
    });
  const titleHeight = taskTitleHeight(doc, task);
  doc
    .fillColor(`#${COLORS.navy}`)
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .text(task.title || 'Tarea', MARGIN, y + 10, { width });
  let cursor = y + 10 + titleHeight;
  if (task.parentTitle) {
    doc
      .fillColor(`#${COLORS.gray}`)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`Subtarea de: ${task.parentTitle}`, MARGIN, cursor, {
        width,
        lineBreak: false,
      });
    cursor += 11;
  }
  return metricRow(doc, cursor + 6, taskCells(task)) + 16;
}

function userTable(doc: Doc, y: number, group: ReportUserMetric[]) {
  const width = contentWidth(doc);
  const labelWidth = 116;
  const columnWidth = (width - labelWidth) / Math.max(1, group.length);
  const rows: Array<[string, (metric: ReportUserMetric) => string, boolean]> = [
    ['Tareas totales', (m) => String(m.totalTasks), false],
    ['Completadas', (m) => String(m.completedTasks), false],
    ['No completadas', (m) => String(m.incompleteTasks), false],
    ['Tiempo estimado', (m) => formatHours(m.estimatedHours), false],
    ['Tiempo real', (m) => formatHours(m.actualHours), false],
    ['Desvío', (m) => formatHours(m.deviationHours), true],
  ];
  doc.roundedRect(MARGIN, y, width, 34, 4).fill(`#${COLORS.blue}`);
  doc.rect(MARGIN, y + 24, width, 10).fill(`#${COLORS.blue}`);
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Métrica', MARGIN + 8, y + 13, {
      width: labelWidth - 16,
      lineBreak: false,
    });
  group.forEach((metric, index) =>
    doc.text(
      metric.name,
      MARGIN + labelWidth + index * columnWidth + 4,
      y + 9,
      { width: columnWidth - 8, align: 'center' },
    ),
  );
  let cursor = y + 34;
  rows.forEach(([label, value, isDeviation], rowIndex) => {
    doc
      .rect(MARGIN, cursor, width, 30)
      .fillAndStroke(
        rowIndex % 2 ? '#FFFFFF' : `#${COLORS.pale}`,
        `#${COLORS.border}`,
      );
    doc
      .fillColor(`#${COLORS.navy}`)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(label, MARGIN + 8, cursor + 11, {
        width: labelWidth - 16,
        lineBreak: false,
      });
    group.forEach((metric, index) => {
      doc
        .fillColor(
          `#${isDeviation ? deviationColor(metric.deviationHours) : COLORS.navy}`,
        )
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(
          value(metric),
          MARGIN + labelWidth + index * columnWidth + 4,
          cursor + 11,
          { width: columnWidth - 8, align: 'center', lineBreak: false },
        );
    });
    cursor += 30;
  });
  return cursor;
}

function summaryCells(report: ReportDocument): Cell[] {
  return [
    {
      label: 'Tareas',
      value: String(report.summary.totalTasks),
      color: COLORS.blue,
    },
    {
      label: 'Completadas',
      value: String(report.summary.completedTasks),
      color: COLORS.green,
    },
    {
      label: 'No completadas',
      value: String(report.summary.incompleteTasks),
      color: COLORS.red,
    },
    {
      label: 'Estimado',
      value: formatHours(report.summary.totalEstimatedHours),
      color: COLORS.lime,
    },
    {
      label: 'Real',
      value: formatHours(report.summary.totalActualHours),
      color: COLORS.orange,
    },
    {
      label: 'Desvío',
      value: formatHours(report.summary.deviationHours),
      color: COLORS.navy,
      valueColor: deviationColor(report.summary.deviationHours),
    },
  ];
}

function collect(doc: Doc) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export async function renderReportPdf(
  report: ReportDocument,
  individual: boolean,
) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: { Title: 'Informe Tino', Author: 'Tino' },
  });
  const metric = individual ? report.users[0] : null;
  const title = metric ? metric.name : 'Informe Tino';
  const eyebrow = metric ? 'Usuario' : undefined;
  header(doc, report, title, eyebrow);

  const nextPage = () => {
    doc.addPage();
    header(doc, report, title, eyebrow);
    return CONTENT_TOP;
  };

  if (!report.tasks.length) {
    doc
      .fillColor(`#${COLORS.gray}`)
      .font('Helvetica')
      .fontSize(13)
      .text('No hay datos para los filtros seleccionados.', MARGIN, 200, {
        width: contentWidth(doc),
        align: 'center',
      });
  } else if (!individual) {
    let cursor = metricRow(doc, CONTENT_TOP, summaryCells(report)) + 26;
    const groups = Array.from(
      { length: Math.max(1, Math.ceil(report.users.length / 5)) },
      (_, index) => report.users.slice(index * 5, index * 5 + 5),
    );
    groups.forEach((group, index) => {
      if (!group.length) return;
      if (index) cursor = nextPage();
      cursor = userTable(doc, cursor, group);
    });
  } else {
    let cursor = CONTENT_TOP;
    if (metric) cursor = metricRow(doc, cursor, userCells(metric)) + 26;
    for (const task of report.tasks) {
      const height = taskCardHeight(doc, task);
      if (cursor + height > doc.page.height - BOTTOM_LIMIT) cursor = nextPage();
      cursor = taskCard(doc, cursor, task);
    }
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    footer(doc, report, index + 1);
  }
  return collect(doc);
}
