export interface CrmGeoCityNameImportRow {
  geonameId: number;
  countryCode: string;
  name: string;
  normalizedName: string;
  asciiName: string | null;
  timeZone: string;
  population: number;
  latitude: number | null;
  longitude: number | null;
  nameSource: 'name' | 'ascii' | 'alternate';
  languageCode: string | null;
  isPreferred: boolean;
  isShort: boolean;
}

export interface CrmGeoCityImportBase {
  geonameId: number;
  countryCode: string;
  asciiName: string | null;
  timeZone: string;
  population: number;
  latitude: number | null;
  longitude: number | null;
}

const geonamesCityColumn = {
  geonameId: 0,
  name: 1,
  asciiName: 2,
  alternateNames: 3,
  latitude: 4,
  longitude: 5,
  countryCode: 8,
  population: 14,
  timeZone: 17
} as const;
const geonamesAlternateNameColumn = {
  geonameId: 1,
  languageCode: 2,
  name: 3,
  isPreferred: 4,
  isShort: 5
} as const;
const chineseLanguageCodes = new Set(['zh', 'zh-cn', 'zh-hans', 'zh-hant', 'zh-tw', 'zh-hk', 'zh-mo', 'cmn', 'yue']);
const hanScriptPattern = /\p{Script=Han}/u;

/**
 * Normalize external place names into stable lookup keys while preserving non-Latin scripts.
 */
export function normalizeGeoNameKey(value?: string | null) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .replace(/\u0640/g, '')
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Build searchable city name rows from one tab-separated GeoNames cities file line. */
export function buildGeoCityNameRowsFromCityLine(line: string): CrmGeoCityNameImportRow[] {
  const base = buildGeoCityImportBaseFromCityLine(line);

  if (!base) {
    return [];
  }

  const columns = line.split('\t');
  const rows: CrmGeoCityNameImportRow[] = [];
  const seen = new Set<string>();

  addNameRow(rows, seen, createBaseImportRow(base), columns[geonamesCityColumn.name], 'name');
  addNameRow(rows, seen, createBaseImportRow(base), base.asciiName, 'ascii');

  for (const name of (columns[geonamesCityColumn.alternateNames] ?? '').split(',')) {
    addNameRow(rows, seen, createBaseImportRow(base), name, 'alternate');
  }

  return rows;
}

/** Build the reusable city base fields from one GeoNames cities file line. */
export function buildGeoCityImportBaseFromCityLine(line: string): CrmGeoCityImportBase | null {
  const columns = line.split('\t');
  const geonameId = Number.parseInt(columns[geonamesCityColumn.geonameId] ?? '', 10);
  const countryCode = (columns[geonamesCityColumn.countryCode] ?? '').trim().toUpperCase();
  const timeZone = (columns[geonamesCityColumn.timeZone] ?? '').trim();

  if (!Number.isFinite(geonameId) || !countryCode || !timeZone) {
    return null;
  }

  return {
    geonameId,
    countryCode,
    asciiName: normalizeNullableText(columns[geonamesCityColumn.asciiName]),
    timeZone,
    population: normalizeInteger(columns[geonamesCityColumn.population]),
    latitude: normalizeFloat(columns[geonamesCityColumn.latitude]),
    longitude: normalizeFloat(columns[geonamesCityColumn.longitude])
  };
}

/** Build a trusted Chinese city alias row from one GeoNames alternateNamesV2 file line. */
export function buildChineseGeoCityNameRowFromAlternateLine(
  line: string,
  baseByGeonameId: ReadonlyMap<number, CrmGeoCityImportBase>
): CrmGeoCityNameImportRow | null {
  const columns = line.split('\t');
  const geonameId = Number.parseInt(columns[geonamesAlternateNameColumn.geonameId] ?? '', 10);
  const languageCode = normalizeNullableText(columns[geonamesAlternateNameColumn.languageCode])?.toLowerCase() ?? null;
  const name = normalizeNullableText(columns[geonamesAlternateNameColumn.name]);
  const base = baseByGeonameId.get(geonameId);

  if (!base || !name || !languageCode || !chineseLanguageCodes.has(languageCode) || !isHanScriptName(name)) {
    return null;
  }

  const normalizedName = normalizeGeoNameKey(name);

  if (!normalizedName) {
    return null;
  }

  return {
    ...createBaseImportRow(base),
    name,
    normalizedName,
    nameSource: 'alternate',
    languageCode,
    isPreferred: columns[geonamesAlternateNameColumn.isPreferred] === '1',
    isShort: columns[geonamesAlternateNameColumn.isShort] === '1'
  };
}

function createBaseImportRow(
  base: CrmGeoCityImportBase
): Omit<CrmGeoCityNameImportRow, 'name' | 'normalizedName' | 'nameSource'> {
  return {
    ...base,
    languageCode: null,
    isPreferred: false,
    isShort: false
  };
}

function addNameRow(
  rows: CrmGeoCityNameImportRow[],
  seen: Set<string>,
  base: Omit<CrmGeoCityNameImportRow, 'name' | 'normalizedName' | 'nameSource'>,
  rawName: string | null | undefined,
  nameSource: CrmGeoCityNameImportRow['nameSource']
) {
  const name = normalizeNullableText(rawName);
  const normalizedName = normalizeGeoNameKey(name);

  if (!name || !normalizedName || seen.has(normalizedName)) {
    return;
  }

  seen.add(normalizedName);
  rows.push({
    ...base,
    name,
    normalizedName,
    nameSource
  });
}

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim();

  return normalized || null;
}

function isHanScriptName(name: string) {
  return hanScriptPattern.test(name);
}

function normalizeInteger(value?: string | null) {
  const number = Number.parseInt(value ?? '', 10);

  return Number.isFinite(number) ? number : 0;
}

function normalizeFloat(value?: string | null) {
  const number = Number.parseFloat(value ?? '');

  return Number.isFinite(number) ? number : null;
}
