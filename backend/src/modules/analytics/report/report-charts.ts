import JSZip from 'jszip';

export interface ChartAnchor {
  fromColumn: number;
  fromRow: number;
  toColumn: number;
  toRow: number;
}

export interface BarChartSeries {
  nameRef: string;
  valuesRef: string;
  color: string;
}

export interface BarChartSpec {
  kind: 'bar';
  title: string;
  valueAxisTitle: string;
  categoryAxisTitle: string;
  categoriesRef: string;
  series: BarChartSeries[];
  anchor: ChartAnchor;
}

export interface DoughnutChartSpec {
  kind: 'doughnut';
  title: string;
  categoriesRef: string;
  valuesRef: string;
  colors: string[];
  anchor: ChartAnchor;
}

export type ChartSpec = BarChartSpec | DoughnutChartSpec;

const CHART_NS =
  'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const DRAWING_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const CHART_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleXml(text: string, size: number) {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0"><a:solidFill><a:srgbClr val="1E3A5F"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="es-AR" sz="${size}" b="0"/><a:t>${escapeXml(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
}

function axisTitleXml(text: string, rotated: boolean) {
  if (!text) return '';
  const bodyPr = rotated
    ? '<a:bodyPr rot="-5400000" vert="horz"/>'
    : '<a:bodyPr/>';
  return `<c:title><c:tx><c:rich>${bodyPr}<a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:r><a:rPr lang="es-AR" sz="900"/><a:t>${escapeXml(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

function barChartXml(spec: BarChartSpec) {
  const categoryAxis = 811110001;
  const valueAxis = 811110002;
  const series = spec.series
    .map(
      (item, index) =>
        `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:strRef><c:f>${escapeXml(item.nameRef)}</c:f></c:strRef></c:tx><c:spPr><a:solidFill><a:srgbClr val="${item.color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/><c:cat><c:strRef><c:f>${escapeXml(spec.categoriesRef)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${escapeXml(item.valuesRef)}</c:f></c:numRef></c:val></c:ser>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace ${CHART_NS}><c:roundedCorners val="0"/><c:chart>${titleXml(spec.title, 1400)}<c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="70"/><c:overlap val="-20"/><c:axId val="${categoryAxis}"/><c:axId val="${valueAxis}"/></c:barChart><c:catAx><c:axId val="${categoryAxis}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>${axisTitleXml(spec.categoryAxisTitle, true)}<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${valueAxis}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="${valueAxis}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines/>${axisTitleXml(spec.valueAxisTitle, false)}<c:numFmt formatCode="0.00" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${categoryAxis}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:legend><c:legendPos val="t"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function doughnutChartXml(spec: DoughnutChartSpec) {
  const points = spec.colors
    .map(
      (color, index) =>
        `<c:dPt><c:idx val="${index}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace ${CHART_NS}><c:roundedCorners val="0"/><c:chart>${titleXml(spec.title, 1400)}<c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${points}<c:cat><c:strRef><c:f>${escapeXml(spec.categoriesRef)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${escapeXml(spec.valuesRef)}</c:f></c:numRef></c:val></c:ser><c:firstSliceAng val="0"/><c:holeSize val="50"/></c:doughnutChart></c:plotArea><c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function chartXml(spec: ChartSpec) {
  return spec.kind === 'bar' ? barChartXml(spec) : doughnutChartXml(spec);
}

function drawingXml(specs: ChartSpec[], firstChartIndex: number) {
  const anchors = specs
    .map((spec, index) => {
      const { anchor } = spec;
      return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${anchor.fromColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${anchor.toColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 2}" name="Grafico ${firstChartIndex + index}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${index + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
}

function drawingRelsXml(specs: ChartSpec[], firstChartIndex: number) {
  const relations = specs
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="${CHART_TYPE}" Target="../charts/chart${firstChartIndex + index}.xml"/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations}</Relationships>`;
}

async function readText(zip: JSZip, path: string) {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

async function resolveSheetPath(zip: JSZip, sheetName: string) {
  const workbook = await readText(zip, 'xl/workbook.xml');
  const rels = await readText(zip, 'xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) return null;
  const sheet = new RegExp(
    `<sheet[^>]*name="${escapeXml(sheetName)}"[^>]*/>`,
  ).exec(workbook);
  const relationId = sheet && /r:id="([^"]+)"/.exec(sheet[0]);
  if (!relationId) return null;
  const relation = new RegExp(
    `<Relationship[^>]*Id="${relationId[1]}"[^>]*/>`,
  ).exec(rels);
  const target = relation && /Target="([^"]+)"/.exec(relation[0]);
  if (!target) return null;
  return `xl/${target[1].replace(/^\/?xl\//, '').replace(/^\//, '')}`;
}

function nextFreeRelationId(rels: string) {
  const used = [...rels.matchAll(/Id="rId(\d+)"/g)].map((match) =>
    Number(match[1]),
  );
  return `rId${Math.max(0, ...used) + 1}`;
}

function withDrawingReference(sheet: string, relationId: string) {
  if (/<drawing\s/.test(sheet)) return sheet;
  const withNamespace = /xmlns:r=/.test(sheet)
    ? sheet
    : sheet.replace(
        /<worksheet(\s|>)/,
        '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"$1',
      );
  return withNamespace.replace(
    '</worksheet>',
    `<drawing r:id="${relationId}"/></worksheet>`,
  );
}

function withOverrides(contentTypes: string, parts: string[]) {
  const overrides = parts
    .filter((part) => !contentTypes.includes(`PartName="${part}"`))
    .map((part) => {
      const type = part.includes('/charts/')
        ? 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'
        : 'application/vnd.openxmlformats-officedocument.drawing+xml';
      return `<Override PartName="${part}" ContentType="${type}"/>`;
    })
    .join('');
  return contentTypes.replace('</Types>', `${overrides}</Types>`);
}

export async function attachCharts(
  buffer: Buffer,
  sheetName: string,
  specs: ChartSpec[],
): Promise<Buffer> {
  if (!specs.length) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = await resolveSheetPath(zip, sheetName);
  const contentTypes = await readText(zip, '[Content_Types].xml');
  const sheet = sheetPath ? await readText(zip, sheetPath) : null;
  if (!sheetPath || !sheet || !contentTypes) return buffer;

  const existingCharts = Object.keys(zip.files).filter((path) =>
    /^xl\/charts\/chart\d+\.xml$/.test(path),
  ).length;
  const existingDrawings = Object.keys(zip.files).filter((path) =>
    /^xl\/drawings\/drawing\d+\.xml$/.test(path),
  ).length;
  const firstChartIndex = existingCharts + 1;
  const drawingIndex = existingDrawings + 1;
  const drawingPath = `xl/drawings/drawing${drawingIndex}.xml`;

  specs.forEach((spec, index) =>
    zip.file(`xl/charts/chart${firstChartIndex + index}.xml`, chartXml(spec)),
  );
  zip.file(drawingPath, drawingXml(specs, firstChartIndex));
  zip.file(
    `xl/drawings/_rels/drawing${drawingIndex}.xml.rels`,
    drawingRelsXml(specs, firstChartIndex),
  );

  const sheetRelsPath = sheetPath.replace(
    /worksheets\/(.+)$/,
    'worksheets/_rels/$1.rels',
  );
  const existingRels =
    (await readText(zip, sheetRelsPath)) ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const relationId = nextFreeRelationId(existingRels);
  zip.file(
    sheetRelsPath,
    existingRels.replace(
      '</Relationships>',
      `<Relationship Id="${relationId}" Type="${DRAWING_TYPE}" Target="../drawings/drawing${drawingIndex}.xml"/></Relationships>`,
    ),
  );
  zip.file(sheetPath, withDrawingReference(sheet, relationId));
  zip.file(
    '[Content_Types].xml',
    withOverrides(contentTypes, [
      `/${drawingPath}`,
      ...specs.map(
        (_, index) => `/xl/charts/chart${firstChartIndex + index}.xml`,
      ),
    ]),
  );

  return Buffer.from(
    await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
  );
}
