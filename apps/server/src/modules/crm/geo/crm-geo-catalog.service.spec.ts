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
      { code: 'SA', label: 'Saudi Arabia', cityCount: 3 },
      { code: 'US', label: 'United States', cityCount: 8 }
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
        ]
      }) as never
    );

    const cities = await service.listCities({ countryCode: ' sa ', keyword: ' riy ', limit: 10 });

    assert.deepEqual(cities, [
      {
        name: 'Riyadh',
        asciiName: 'Riyadh',
        countryCode: 'SA',
        timeZone: 'Asia/Riyadh'
      },
      {
        name: 'Jeddah',
        asciiName: 'Jeddah',
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
});

function createPrisma(input: {
  countryGroups: Array<{ countryCode: string; count: number }>;
  cityRows: Array<{ geonameId: number; countryCode: string; name: string; asciiName: string | null; timeZone: string }>;
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
      async findMany(args: { where: { countryCode: string }; take: number }) {
        input.calls?.push({
          countryCode: args.where.countryCode,
          keyword: 'OR' in args.where ? 'riy' : undefined,
          take: args.take
        });

        return input.cityRows;
      }
    }
  };
}
