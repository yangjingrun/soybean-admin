import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGeoCatalogService } from './crm-geo-catalog.service';

describe('CrmGeoCatalogService', () => {
  it('lists countries from persisted city dictionary rows', async () => {
    const service = new CrmGeoCatalogService(
      createPrisma({
        countryGroups: [
          { countryCode: 'SA', count: 3 },
          { countryCode: 'US', count: 8 }
        ],
        cityRows: []
      }) as never
    );

    const countries = await service.listCountries();

    assert.deepEqual(countries, [
      { code: 'SA', label: '沙特阿拉伯', cityCount: 3 },
      { code: 'US', label: '美国', cityCount: 8 }
    ]);
  });

  it('lists unique cities with timezone under the selected country', async () => {
    const calls: unknown[] = [];
    const service = new CrmGeoCatalogService(
      createPrisma({
        calls,
        countryGroups: [],
        cityRows: [
          {
            geonameId: 108410,
            countryCode: 'SA',
            name: 'Riyadh',
            asciiName: 'Riyadh',
            timeZone: 'Asia/Riyadh'
          },
          {
            geonameId: 108410,
            countryCode: 'SA',
            name: 'الرياض',
            asciiName: 'Riyadh',
            timeZone: 'Asia/Riyadh'
          },
          {
            geonameId: 105343,
            countryCode: 'SA',
            name: 'Jeddah',
            asciiName: 'Jeddah',
            timeZone: 'Asia/Riyadh'
          }
        ],
        localizedRows: [
          {
            geonameId: 108410,
            name: '利雅得',
            languageCode: 'zh',
            isPreferred: true,
            isShort: false
          }
        ]
      }) as never
    );

    const cities = await service.listCities({ countryCode: ' sa ', keyword: ' riy ', limit: 10 });

    assert.deepEqual(cities, [
      {
        name: 'Riyadh',
        asciiName: 'Riyadh',
        displayName: '利雅得',
        countryCode: 'SA',
        timeZone: 'Asia/Riyadh'
      },
      {
        name: 'Jeddah',
        asciiName: 'Jeddah',
        displayName: null,
        countryCode: 'SA',
        timeZone: 'Asia/Riyadh'
      }
    ]);
    assert.deepEqual(calls[0], {
      countryCode: 'SA',
      keyword: 'riy',
      take: 30
    });
  });

  it('searches cities across countries when country code is omitted', async () => {
    const calls: unknown[] = [];
    const service = new CrmGeoCatalogService(
      createPrisma({
        calls,
        countryGroups: [],
        cityRows: [
          {
            geonameId: 5128581,
            countryCode: 'US',
            name: 'New York',
            asciiName: 'New York',
            timeZone: 'America/New_York'
          }
        ]
      }) as never
    );

    const cities = await service.listCities({ keyword: ' york ', limit: 5 });

    assert.deepEqual(cities, [
      {
        name: 'New York',
        asciiName: 'New York',
        displayName: null,
        countryCode: 'US',
        timeZone: 'America/New_York'
      }
    ]);
    assert.deepEqual(calls[0], {
      countryCode: undefined,
      keyword: 'york',
      take: 15
    });
  });
});

function createPrisma(input: {
  countryGroups: Array<{ countryCode: string; count: number }>;
  cityRows: Array<{ geonameId: number; countryCode: string; name: string; asciiName: string | null; timeZone: string }>;
  localizedRows?: Array<{
    geonameId: number;
    name: string;
    languageCode: string | null;
    isPreferred: boolean;
    isShort: boolean;
  }>;
  calls?: unknown[];
}) {
  return {
    crmGeoCityName: {
      async groupBy() {
        return input.countryGroups.map(group => ({
          countryCode: group.countryCode,
          _count: {
            countryCode: group.count
          }
        }));
      },
      async findMany(args: { where: { countryCode?: string; geonameId?: { in: number[] } }; take: number }) {
        if (args.where.geonameId) {
          return input.localizedRows ?? [];
        }

        input.calls?.push({
          countryCode: args.where.countryCode,
          keyword: 'OR' in args.where ? normalizeFirstKeyword(args.where.OR) : undefined,
          take: args.take
        });

        return input.cityRows;
      }
    }
  };
}

function normalizeFirstKeyword(orClause: unknown) {
  const [first] = Array.isArray(orClause) ? orClause : [];
  const contains = first?.name?.contains;

  return typeof contains === 'string' ? contains : undefined;
}
