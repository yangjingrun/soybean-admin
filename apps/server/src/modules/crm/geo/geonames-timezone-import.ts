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
  const columns = line.split('\t');
  const geonameId = Number.parseInt(columns[geonamesCityColumn.geonameId] ?? '', 10);
  const countryCode = (columns[geonamesCityColumn.countryCode] ?? '').trim().toUpperCase();
  const timeZone = (columns[geonamesCityColumn.timeZone] ?? '').trim();

  if (!Number.isFinite(geonameId) || !countryCode || !timeZone) {
    return [];
  }

  const asciiName = normalizeNullableText(columns[geonamesCityColumn.asciiName]);
  const base = {
    geonameId,
    countryCode,
    asciiName,
    timeZone,
    population: normalizeInteger(columns[geonamesCityColumn.population]),
    latitude: normalizeFloat(columns[geonamesCityColumn.latitude]),
    longitude: normalizeFloat(columns[geonamesCityColumn.longitude]),
    languageCode: null,
    isPreferred: false,
    isShort: false
  } satisfies Omit<CrmGeoCityNameImportRow, 'name' | 'normalizedName' | 'nameSource'>;
  const rows: CrmGeoCityNameImportRow[] = [];
  const seen = new Set<string>();

  addNameRow(rows, seen, base, columns[geonamesCityColumn.name], 'name');
  addNameRow(rows, seen, base, asciiName, 'ascii');

  for (const name of (columns[geonamesCityColumn.alternateNames] ?? '').split(',')) {
    addNameRow(rows, seen, base, name, 'alternate');
  }

  return rows;
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

function normalizeInteger(value?: string | null) {
  const number = Number.parseInt(value ?? '', 10);

  return Number.isFinite(number) ? number : 0;
}

function normalizeFloat(value?: string | null) {
  const number = Number.parseFloat(value ?? '');

  return Number.isFinite(number) ? number : null;
}
