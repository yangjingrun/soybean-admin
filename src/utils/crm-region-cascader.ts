import type { CascaderOption } from 'naive-ui';

export interface CrmRegionCascaderOption extends CascaderOption {
  label: string;
  value: string;
  keywords: string[];
  nodeType: 'country' | 'city';
  countryCode: string;
  flag?: string;
  cityName?: string;
  asciiName?: string | null;
  isLeaf?: boolean;
  children?: CrmRegionCascaderOption[];
}

const countryDisplayNamesZh = new Intl.DisplayNames(['zh-CN'], { type: 'region' });

/** Convert one persisted GeoNames country row into a remote cascader country node. */
export function createCrmCountryRegionOption(country: Api.Crm.GeoCountryOption): CrmRegionCascaderOption {
  return {
    label: country.label,
    value: createCountryRegionValue(country.code, country.label),
    keywords: [country.label, country.code],
    nodeType: 'country',
    countryCode: country.code,
    flag: createCountryFlag(country.code),
    isLeaf: false
  };
}

/** Convert one persisted GeoNames city row into a leaf cascader city node. */
export function createCrmCityRegionOption(city: Api.Crm.GeoCityOption): CrmRegionCascaderOption {
  return {
    label: formatCityLabel(city),
    value: createCityRegionValue(city.countryCode, city.name, city.asciiName),
    keywords: [city.name, city.asciiName].filter((item): item is string => Boolean(item)),
    nodeType: 'city',
    countryCode: city.countryCode,
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

  return [];
}

function createCountryRegionValue(countryCode: string, label: string) {
  return `country:${countryCode.toUpperCase()}:${encodeURIComponent(label)}`;
}

function createCityRegionValue(countryCode: string, cityName: string, asciiName: string | null) {
  return `city:${countryCode.toUpperCase()}:${encodeURIComponent(cityName)}:${encodeURIComponent(asciiName ?? '')}`;
}

function isCountryRegionValue(value: string) {
  return value.startsWith('country:');
}

function isCityRegionValue(value: string) {
  return value.startsWith('city:');
}

function readCountryRegionKeywords(value: string) {
  const [, countryCode, encodedLabel] = value.split(':');
  const label = decodeURIComponent(encodedLabel ?? '').trim();

  return Array.from(new Set([label || formatCountryLabel(countryCode ?? '')].filter(Boolean)));
}

function readCityRegionKeywords(value: string) {
  const [, , encodedName, encodedAsciiName] = value.split(':');
  const name = decodeURIComponent(encodedName ?? '').trim();
  const asciiName = decodeURIComponent(encodedAsciiName ?? '').trim();

  return Array.from(new Set([name, asciiName].filter(Boolean)));
}

function formatCountryLabel(countryCode: string) {
  return countryDisplayNamesZh.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
}

function formatCityLabel(city: Api.Crm.GeoCityOption) {
  return city.asciiName && city.asciiName !== city.name ? `${city.name} / ${city.asciiName}` : city.name;
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
