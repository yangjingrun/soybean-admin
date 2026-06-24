import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { normalizeGeoNameKey } from './geonames-timezone-import';

interface ListCitiesInput {
  countryCode: string;
  keyword?: string;
  limit?: number;
}

const defaultCityLimit = 80;
const maxCityLimit = 100;
const countryDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });

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
        label: countryDisplayNames.of(group.countryCode) ?? group.countryCode,
        cityCount: group._count.countryCode
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  /** List selectable cities for one country, optionally matching alternate local names. */
  async listCities(input: ListCitiesInput) {
    const countryCode = input.countryCode.trim().toUpperCase();
    const keyword = input.keyword?.trim();
    const limit = normalizeCityLimit(input.limit);
    const normalizedKeyword = normalizeGeoNameKey(keyword);

    const rows = await this.prisma.crmGeoCityName.findMany({
      where: {
        countryCode,
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
    const cities: Array<{ name: string; asciiName: string | null; countryCode: string; timeZone: string }> = [];

    for (const row of rows) {
      if (seen.has(row.geonameId)) {
        continue;
      }

      seen.add(row.geonameId);
      cities.push({
        name: row.name,
        asciiName: row.asciiName,
        countryCode: row.countryCode,
        timeZone: row.timeZone
      });

      if (cities.length >= limit) {
        break;
      }
    }

    return cities;
  }
}

function normalizeCityLimit(limit?: number) {
  if (!limit) {
    return defaultCityLimit;
  }

  return Math.min(Math.max(limit, 1), maxCityLimit);
}
