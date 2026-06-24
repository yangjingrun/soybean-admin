const countryDisplayNamesZh = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
const countryDisplayNamesEn = new Intl.DisplayNames(['en-US'], { type: 'region' });
/** Convert one persisted GeoNames country row into a remote cascader country node. */
export function createCrmCountryRegionOption(country) {
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
/** Convert one persisted GeoNames city row into a leaf cascader city node. */
export function createCrmCityRegionOption(city) {
  return {
    label: formatCityLabel(city),
    value: createCityRegionValue(city.countryCode, city.name, city.asciiName, city.displayName),
    keywords: Array.from(new Set([city.displayName, city.name, city.asciiName].filter(item => Boolean(item)))),
    nodeType: 'city',
    countryCode: city.countryCode,
    displayName: city.displayName,
    cityName: city.name,
    asciiName: city.asciiName,
    isLeaf: true
  };
}
/** Match region cascader nodes by label, path and city aliases from GeoNames. */
export function filterCrmRegionOption(pattern, option, path = []) {
  const normalizedPattern = normalizeRegionText(pattern);
  if (!normalizedPattern) {
    return true;
  }
  const regionOption = option;
  const searchItems = [
    ...path.flatMap(item => [String(item.label ?? ''), ...(item.keywords ?? [])]),
    regionOption.label,
    regionOption.value,
    ...regionOption.keywords
  ];
  return searchItems.some(item => isFuzzyRegionMatch(item, normalizedPattern));
}
/** Resolve a selected cascader value into backend-searchable region keywords. */
export function getCrmRegionKeywords(value) {
  if (isCountryRegionValue(value)) {
    return readCountryRegionKeywords(value);
  }
  if (isCityRegionValue(value)) {
    return readCityRegionKeywords(value);
  }
  return [];
}
function createCountryRegionValue(countryCode, label) {
  return `country:${countryCode.toUpperCase()}:${encodeURIComponent(label)}`;
}
function createCityRegionValue(countryCode, cityName, asciiName, displayName) {
  return `city:${countryCode.toUpperCase()}:${encodeURIComponent(cityName)}:${encodeURIComponent(asciiName ?? '')}:${encodeURIComponent(displayName ?? '')}`;
}
function isCountryRegionValue(value) {
  return value.startsWith('country:');
}
function isCityRegionValue(value) {
  return value.startsWith('city:');
}
function readCountryRegionKeywords(value) {
  const [, countryCode, encodedLabel] = value.split(':');
  const label = decodeURIComponent(encodedLabel ?? '').trim();
  return Array.from(new Set([label || formatCountryLabel(countryCode ?? '')].filter(Boolean)));
}
function readCityRegionKeywords(value) {
  const [, , encodedName, encodedAsciiName, encodedDisplayName] = value.split(':');
  const name = decodeURIComponent(encodedName ?? '').trim();
  const asciiName = decodeURIComponent(encodedAsciiName ?? '').trim();
  const displayName = decodeURIComponent(encodedDisplayName ?? '').trim();
  return Array.from(new Set([displayName, name, asciiName].filter(Boolean)));
}
function formatCountryLabel(countryCode) {
  const normalizedCode = countryCode.trim().toUpperCase();
  return formatCountryDisplayName(countryDisplayNamesZh, normalizedCode) ?? normalizedCode;
}
/** Build country search aliases from API label, ISO code and localized region names. */
function createCountryRegionKeywords(countryCode, label) {
  const normalizedCode = countryCode.trim().toUpperCase();
  return Array.from(
    new Set(
      [
        label,
        normalizedCode,
        formatCountryDisplayName(countryDisplayNamesZh, normalizedCode),
        formatCountryDisplayName(countryDisplayNamesEn, normalizedCode)
      ].filter(item => Boolean(item))
    )
  );
}
function formatCountryDisplayName(displayNames, normalizedCode) {
  return /^[A-Z]{2}$/.test(normalizedCode) ? displayNames.of(normalizedCode) : null;
}
function formatCityLabel(city) {
  const primaryName = city.displayName || city.name;
  const secondaryNames = [city.name, city.asciiName].filter(item => Boolean(item && item !== primaryName));
  const uniqueSecondaryNames = Array.from(new Set(secondaryNames));
  return uniqueSecondaryNames.length ? `${primaryName} / ${uniqueSecondaryNames.join(' / ')}` : primaryName;
}
/** Convert an ISO 3166-1 alpha-2 country code to its regional indicator flag. */
function createCountryFlag(countryCode) {
  const normalizedCode = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return '';
  }
  const regionalIndicatorOffset = 127397;
  return Array.from(normalizedCode)
    .map(char => String.fromCodePoint(char.charCodeAt(0) + regionalIndicatorOffset))
    .join('');
}
function normalizeRegionText(value) {
  return value.toLowerCase().replace(/[\s._-]+/g, '');
}
function isFuzzyRegionMatch(value, normalizedPattern) {
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
