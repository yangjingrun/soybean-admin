import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const sourcePath = '/Users/yjr/.codex/attachments/ace2771d-f3e7-456c-b8a8-914f6052ef33/pasted-text.txt';
const outputDir = '/Users/yjr/Desktop/soybean-admin-naive/outputs/serper-maps-leads';
const outputPath = path.join(outputDir, 'Serper Maps 轴承经销商线索.xlsx');
const previewPath = path.join(outputDir, 'preview.png');

const raw = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const places = Array.isArray(raw.places) ? raw.places : [];
const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add('汇总');
const dataSheet = workbook.worksheets.add('商家数据');

summarySheet.showGridLines = false;
dataSheet.showGridLines = false;

const headers = [
  '序号',
  '公司名称',
  '官网',
  '是否有官网',
  '电话',
  '地址',
  '主分类',
  '全部分类',
  '评分',
  '评论数',
  '纬度',
  '经度',
  'Google Place ID',
  'CID',
  'FID',
  '营业时间',
  '缩略图',
  '地图区域 ll',
  '结果位置'
];

const rows = places.map((place, index) => [
  index + 1,
  text(place.title),
  text(place.website),
  text(place.website) ? '有官网' : '无官网',
  text(place.phoneNumber),
  text(place.address),
  text(place.type),
  Array.isArray(place.types) ? place.types.join('、') : '',
  numberOrBlank(place.rating),
  numberOrBlank(place.ratingCount),
  numberOrBlank(place.latitude),
  numberOrBlank(place.longitude),
  idText(place.placeId),
  idText(place.cid),
  idText(place.fid),
  formatOpeningHours(place.openingHours),
  text(place.thumbnailUrl),
  text(raw.ll),
  numberOrBlank(place.position)
]);

dataSheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
dataSheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
dataSheet.freezePanes.freezeRows(1);

const usedRange = dataSheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length);
usedRange.format.font.name = 'Arial';
usedRange.format.font.size = 10;
usedRange.format.borders = {
  insideHorizontal: { style: 'thin', color: '#E5E7EB' },
  bottom: { style: 'thin', color: '#CBD5E1' }
};

const headerRange = dataSheet.getRangeByIndexes(0, 0, 1, headers.length);
headerRange.format.fill.color = '#1F4E78';
headerRange.format.font.color = '#FFFFFF';
headerRange.format.font.bold = true;
headerRange.format.rowHeightPx = 30;
headerRange.format.horizontalAlignment = 'center';

dataSheet.getRange(`A2:A${rows.length + 1}`).format.horizontalAlignment = 'center';
dataSheet.getRange(`D2:D${rows.length + 1}`).format.horizontalAlignment = 'center';
dataSheet.getRange(`I2:L${rows.length + 1}`).format.horizontalAlignment = 'right';
dataSheet.getRange(`I2:I${rows.length + 1}`).setNumberFormat('0.0');
dataSheet.getRange(`J2:J${rows.length + 1}`).setNumberFormat('#,##0');
dataSheet.getRange(`K2:L${rows.length + 1}`).setNumberFormat('0.000000');
dataSheet.getRange(`M2:O${rows.length + 1}`).setNumberFormat('@');
dataSheet.getRange(`P2:P${rows.length + 1}`).format.wrapText = true;
dataSheet.getRange(`H2:H${rows.length + 1}`).format.wrapText = true;
dataSheet.getRange(`F2:F${rows.length + 1}`).format.wrapText = true;

setColumnWidths(dataSheet, [7, 30, 30, 11, 16, 34, 22, 38, 8, 9, 12, 12, 31, 22, 31, 44, 26, 25, 9]);

summarySheet.getRange('A1:D1').merge();
summarySheet.getRange('A1:D1').values = [['Serper Maps 商家线索汇总']];
summarySheet.getRange('A1:D1').format.fill.color = '#1F4E78';
summarySheet.getRange('A1:D1').format.font.color = '#FFFFFF';
summarySheet.getRange('A1:D1').format.font.bold = true;
summarySheet.getRange('A1:D1').format.font.size = 15;
summarySheet.getRange('A1:D1').format.rowHeightPx = 34;

summarySheet.getRange('A3:B9').values = [
  ['指标', '数值'],
  ['搜索词', text(raw.searchParameters?.q)],
  ['地图区域 ll', text(raw.ll)],
  ['商家总数', null],
  ['有官网数量', null],
  ['无官网数量', null],
  ['官网覆盖率', null]
];
summarySheet.getRange('B6').formulas = [[`=COUNTA('商家数据'!B2:B${rows.length + 1})`]];
summarySheet.getRange('B7').formulas = [[`=COUNTIF('商家数据'!D2:D${rows.length + 1},"有官网")`]];
summarySheet.getRange('B8').formulas = [['=B6-B7']];
summarySheet.getRange('B9').formulas = [['=IFERROR(B7/B6,0)']];
summarySheet.getRange('B9').setNumberFormat('0.0%');

summarySheet.getRange('D3:E6').values = [
  ['字段', '值'],
  ['返回 credits', numberOrBlank(raw.credits)],
  ['返回结果位置范围', `${Math.min(...places.map(p => p.position))}-${Math.max(...places.map(p => p.position))}`],
  ['原始类型', text(raw.searchParameters?.type)]
];

summarySheet.getRange('A3:B3').format.fill.color = '#D9EAF7';
summarySheet.getRange('D3:E3').format.fill.color = '#D9EAF7';
summarySheet.getRange('A3:B9').format.borders = { preset: 'all', style: 'thin', color: '#CBD5E1' };
summarySheet.getRange('D3:E6').format.borders = { preset: 'all', style: 'thin', color: '#CBD5E1' };
summarySheet.getRange('A3:E3').format.font.bold = true;
summarySheet.getRange('A1:E9').format.font.name = 'Arial';
summarySheet.getRange('A1:E9').format.font.size = 10;
summarySheet.getRange('A3:A9').format.font.bold = true;
summarySheet.getRange('D3:D6').format.font.bold = true;
setColumnWidths(summarySheet, [16, 32, 4, 18, 24]);

await fs.mkdir(outputDir, { recursive: true });

const check = await workbook.inspect({
  kind: 'table',
  sheetId: '商家数据',
  range: 'A1:S8',
  include: 'values,formulas',
  tableMaxRows: 8,
  tableMaxCols: 19,
  maxChars: 6000
});
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'final formula error scan',
  maxChars: 2000
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: '商家数据', range: 'A1:S12', scale: 1, format: 'png' });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);

function text(value) {
  return typeof value === 'string' ? value : '';
}

function idText(value) {
  const normalized = text(value);
  return normalized ? `ID ${normalized}` : '';
}

function numberOrBlank(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatOpeningHours(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return Object.entries(value)
    .map(([day, hours]) => `${day}: ${hours}`)
    .join('\n');
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width;
  });
}
