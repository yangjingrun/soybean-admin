import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getMappedCountryZhNameByCode } from '../../../shared/country-name-map';
import { normalizeGeoNameKey } from './geonames-timezone-import';

interface ListCitiesInput {
  countryCode?: string;
  keyword?: string;
  limit?: number;
}

const defaultCityLimit = 80;
const maxCityLimit = 5000;
const countryDisplayNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
const chineseLanguageCodes = new Set([
  'zh',
  'zh-cn',
  'zh-hans',
  'zh-hant',
  'zh-tw',
  'zh-hk',
  'zh-mo',
  'cmn',
  'yue'
]);

interface CityNameRow {
  geonameId: number;
  countryCode: string;
  name: string;
  asciiName: string | null;
  timeZone: string;
  nameSource?: string;
  languageCode?: string | null;
  isPreferred?: boolean;
  isShort?: boolean;
}

@Injectable()
export class CrmGeoCatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: Pick<PrismaService, 'crmGeoCityName'>) {}

  /** List countries that already have GeoNames city rows in the CRM dictionary table. */
  async listCountries() {
    const groups = await this.prisma.crmGeoCityName.groupBy({
      by: ['countryCode'],
      _count: {
        countryCode: true
      },
      orderBy: {
        countryCode: 'asc'
      }
    });

    return groups
      .map(group => ({
        code: group.countryCode,
        label: getMappedCountryZhNameByCode(group.countryCode) ?? countryDisplayNames.of(group.countryCode) ?? group.countryCode,
        cityCount: group['_count'].countryCode
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  /** List selectable cities for one country, optionally matching alternate local names. */
  async listCities(input: ListCitiesInput) {
    const countryCode = input.countryCode?.trim().toUpperCase();
    const keyword = input.keyword?.trim();
    const limit = normalizeCityLimit(input.limit);
    const normalizedKeyword = normalizeGeoNameKey(keyword);

    if (!countryCode && !keyword) {
      return [];
    }

    const rows = await this.prisma.crmGeoCityName.findMany({
      where: {
        ...(countryCode ? { countryCode } : {}),
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: 'insensitive' } },
                { asciiName: { contains: keyword, mode: 'insensitive' } },
                { normalizedName: { contains: normalizedKeyword, mode: 'insensitive' } }
              ]
            }
          : {
              nameSource: {
                in: ['name', 'ascii']
              }
            })
      },
      orderBy: [{ population: 'desc' }, { name: 'asc' }],
      take: limit * 3,
      select: {
        geonameId: true,
        countryCode: true,
        name: true,
        asciiName: true,
        timeZone: true
      }
    });

    const seen = new Set<number>();
    const cityRows: CityNameRow[] = [];

    for (const row of rows) {
      if (seen.has(row.geonameId)) {
        continue;
      }

      seen.add(row.geonameId);
      cityRows.push(row);

      if (cityRows.length >= limit) {
        break;
      }
    }

    const localizedCityNames = await this.loadLocalizedCityNames(cityRows);

    return cityRows.map(row => ({
      name: row.name,
      asciiName: row.asciiName,
      displayName: localizedCityNames.get(row.geonameId) ?? null,
      countryCode: row.countryCode,
      timeZone: row.timeZone
    }));
  }

  private async loadLocalizedCityNames(cityRows: CityNameRow[]) {
    const geonameIds = Array.from(new Set(cityRows.map(row => row.geonameId)));

    if (geonameIds.length === 0) {
      return new Map<number, string>();
    }

    const localizedRows = await this.prisma.crmGeoCityName.findMany({
      where: {
        geonameId: {
          in: geonameIds
        },
        nameSource: 'alternate'
      },
      orderBy: [{ isPreferred: 'desc' }, { isShort: 'asc' }, { name: 'asc' }],
      take: geonameIds.length * 20,
      select: {
        geonameId: true,
        name: true,
        languageCode: true,
        isPreferred: true,
        isShort: true
      }
    });
    const localizedNames = new Map<number, string>();

    for (const row of localizedRows) {
      if (localizedNames.has(row.geonameId) || !isChineseCityName(row)) {
        continue;
      }

      localizedNames.set(row.geonameId, row.name);
    }

    return localizedNames;
  }
}

function normalizeCityLimit(limit?: number) {
  if (!limit) {
    return defaultCityLimit;
  }

  return Math.min(Math.max(limit, 1), maxCityLimit);
}

function isChineseCityName(row: { name: string; languageCode?: string | null }) {
  const languageCode = row.languageCode?.toLowerCase();

  return Boolean(languageCode && chineseLanguageCodes.has(languageCode));
}
