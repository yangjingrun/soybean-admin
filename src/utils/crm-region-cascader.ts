import type { CascaderOption } from 'naive-ui';
import type { CrmAdmin1RegionRow } from '@/constants/crm-admin1-regions';

export interface CrmRegionCascaderOption extends CascaderOption {
  label: string;
  value: string;
  keywords: string[];
  nodeType: 'country' | 'admin1' | 'city';
  countryCode: string;
  admin1Code?: string;
  flag?: string;
  displayName?: string | null;
  regionName?: string;
  cityName?: string;
  asciiName?: string | null;
  isLeaf?: boolean;
  children?: CrmRegionCascaderOption[];
}

const countryDisplayNamesZh = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
const countryDisplayNamesEn = new Intl.DisplayNames(['en-US'], { type: 'region' });

/** Convert one persisted GeoNames country row into a remote cascader country node. */
export function createCrmCountryRegionOption(country: Api.Crm.GeoCountryOption): CrmRegionCascaderOption {
  return {
    label: country.label,
    value: createCountryRegionValue(country.code, country.label),
    keywords: createCountryRegionKeywords(country.code, country.label),
    nodeType: 'country',
    countryCode: country.code,
    flag: createCountryFlag(country.code),
    isLeaf: false
  };
}

/** Convert one GeoNames admin1 row into a province/state-level cascader node. */
export function createCrmAdmin1RegionOption(region: CrmAdmin1RegionRow): CrmRegionCascaderOption {
  return {
    label: formatAdmin1Label(region),
    value: createAdmin1RegionValue(region.countryCode, region.code, region.name, region.asciiName, region.displayName),
    keywords: Array.from(
      new Set(
        [region.displayName, region.name, region.asciiName, region.code].filter((item): item is string => Boolean(item))
      )
    ),
    nodeType: 'admin1',
    countryCode: region.countryCode,
    admin1Code: region.code,
    displayName: region.displayName,
    regionName: region.name,
    asciiName: region.asciiName,
    isLeaf: true
  };
}

/** Convert one persisted GeoNames city row into a legacy leaf cascader city node. */
export function createCrmCityRegionOption(city: Api.Crm.GeoCityOption): CrmRegionCascaderOption {
  return {
    label: formatCityLabel(city),
    value: createCityRegionValue(city.countryCode, city.name, city.asciiName, city.displayName),
    keywords: Array.from(
      new Set([city.displayName, city.name, city.asciiName].filter((item): item is string => Boolean(item)))
    ),
    nodeType: 'city',
    countryCode: city.countryCode,
    displayName: city.displayName,
    cityName: city.name,
    asciiName: city.asciiName,
    isLeaf: true
  };
}

/** Match region cascader nodes by label, path and city aliases from GeoNames. */
export function filterCrmRegionOption(pattern: string, option: CascaderOption, path: CascaderOption[] = []) {
  const normalizedPattern = normalizeRegionText(pattern);

  if (!normalizedPattern) {
    return true;
  }

  const regionOption = option as CrmRegionCascaderOption;
  const searchItems = [
    ...path.flatMap(item => [String(item.label ?? ''), ...((item as CrmRegionCascaderOption).keywords ?? [])]),
    regionOption.label,
    regionOption.value,
    ...regionOption.keywords
  ];

  return searchItems.some(item => isFuzzyRegionMatch(item, normalizedPattern));
}

/** Resolve a selected cascader value into backend-searchable region keywords. */
export function getCrmRegionKeywords(value: string) {
  if (isCountryRegionValue(value)) {
    return readCountryRegionKeywords(value);
  }

  if (isCityRegionValue(value)) {
    return readCityRegionKeywords(value);
  }

  if (isAdmin1RegionValue(value)) {
    return readAdmin1RegionKeywords(value);
  }

  return [];
}

function createCountryRegionValue(countryCode: string, label: string) {
  return `country:${countryCode.toUpperCase()}:${encodeURIComponent(label)}`;
}

function createCityRegionValue(
  countryCode: string,
  cityName: string,
  asciiName: string | null,
  displayName: string | null
) {
  return `city:${countryCode.toUpperCase()}:${encodeURIComponent(cityName)}:${encodeURIComponent(asciiName ?? '')}:${encodeURIComponent(displayName ?? '')}`;
}

function createAdmin1RegionValue(
  countryCode: string,
  admin1Code: string,
  regionName: string,
  asciiName: string | null,
  displayName: string | null
) {
  return `admin1:${countryCode.toUpperCase()}:${encodeURIComponent(admin1Code)}:${encodeURIComponent(regionName)}:${encodeURIComponent(asciiName ?? '')}:${encodeURIComponent(displayName ?? '')}`;
}

function isCountryRegionValue(value: string) {
  return value.startsWith('country:');
}

function isCityRegionValue(value: string) {
  return value.startsWith('city:');
}

function isAdmin1RegionValue(value: string) {
  return value.startsWith('admin1:');
}

function readCountryRegionKeywords(value: string) {
  const [, countryCode, encodedLabel] = value.split(':');
  const label = decodeURIComponent(encodedLabel ?? '').trim();

  return Array.from(new Set([label || formatCountryLabel(countryCode ?? '')].filter(Boolean)));
}

function readCityRegionKeywords(value: string) {
  const [, , encodedName, encodedAsciiName, encodedDisplayName] = value.split(':');
  const name = decodeURIComponent(encodedName ?? '').trim();
  const asciiName = decodeURIComponent(encodedAsciiName ?? '').trim();
  const displayName = decodeURIComponent(encodedDisplayName ?? '').trim();

  return Array.from(new Set([displayName, name, asciiName].filter(Boolean)));
}

function readAdmin1RegionKeywords(value: string) {
  const [, , , encodedName, encodedAsciiName, encodedDisplayName] = value.split(':');
  const name = decodeURIComponent(encodedName ?? '').trim();
  const asciiName = decodeURIComponent(encodedAsciiName ?? '').trim();
  const displayName = decodeURIComponent(encodedDisplayName ?? '').trim();

  return Array.from(new Set([displayName, name, asciiName].filter(Boolean)));
}

function formatCountryLabel(countryCode: string) {
  const normalizedCode = countryCode.trim().toUpperCase();

  return formatCountryDisplayName(countryDisplayNamesZh, normalizedCode) ?? normalizedCode;
}

/** Build country search aliases from API label, ISO code and localized region names. */
function createCountryRegionKeywords(countryCode: string, label: string) {
  const normalizedCode = countryCode.trim().toUpperCase();

  return Array.from(
    new Set(
      [
        label,
        normalizedCode,
        formatCountryDisplayName(countryDisplayNamesZh, normalizedCode),
        formatCountryDisplayName(countryDisplayNamesEn, normalizedCode)
      ].filter((item): item is string => Boolean(item))
    )
  );
}

function formatCountryDisplayName(displayNames: Intl.DisplayNames, normalizedCode: string) {
  return /^[A-Z]{2}$/.test(normalizedCode) ? displayNames.of(normalizedCode) : null;
}

function formatCityLabel(city: Api.Crm.GeoCityOption) {
  const primaryName = city.displayName || city.name;
  const secondaryNames = [city.name, city.asciiName].filter((item): item is string =>
    Boolean(item && item !== primaryName)
  );
  const uniqueSecondaryNames = Array.from(new Set(secondaryNames));

  return uniqueSecondaryNames.length ? `${primaryName} / ${uniqueSecondaryNames.join(' / ')}` : primaryName;
}

function formatAdmin1Label(region: CrmAdmin1RegionRow) {
  const primaryName = region.displayName || region.name;
  const secondaryNames = [region.name, region.asciiName].filter((item): item is string =>
    Boolean(item && item !== primaryName)
  );
  const uniqueSecondaryNames = Array.from(new Set(secondaryNames));

  return uniqueSecondaryNames.length ? `${primaryName} / ${uniqueSecondaryNames.join(' / ')}` : primaryName;
}

/** Convert an ISO 3166-1 alpha-2 country code to its regional indicator flag. */
function createCountryFlag(countryCode: string) {
  const normalizedCode = countryCode.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return '';
  }

  const regionalIndicatorOffset = 127397;

  return Array.from(normalizedCode)
    .map(char => String.fromCodePoint(char.charCodeAt(0) + regionalIndicatorOffset))
    .join('');
}

function normalizeRegionText(value: string) {
  return value.toLowerCase().replace(/[\s._-]+/g, '');
}

function isFuzzyRegionMatch(value: string, normalizedPattern: string) {
  const normalizedValue = normalizeRegionText(value);

  if (normalizedValue.includes(normalizedPattern)) {
    return true;
  }

  let patternIndex = 0;

  for (const char of normalizedValue) {
    if (char === normalizedPattern[patternIndex]) {
      patternIndex += 1;
    }

    if (patternIndex === normalizedPattern.length) {
      return true;
    }
  }

  return false;
}
