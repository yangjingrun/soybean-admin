import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGeoTimezoneService } from './crm-geo-timezone.service';

describe('CrmGeoTimezoneService', () => {
  it('resolves small-language city names from the GeoNames city dictionary', async () => {
    const service = new CrmGeoTimezoneService(
      createPrisma({
        countryCode: 'SA',
        normalizedName: 'الرياض',
        timeZone: 'Asia/Riyadh'
      }) as never
    );

    const timeZone = await service.resolveCustomerTimeZone({
      country: 'Saudi Arabia',
      city: ' الرياض '
    });

    assert.equal(timeZone, 'Asia/Riyadh');
  });

  it('keeps explicit timezone ahead of dictionary and local rules', async () => {
    const service = new CrmGeoTimezoneService(createPrisma(null) as never);

    const timeZone = await service.resolveCustomerTimeZone({
      country: 'SA',
      city: 'الرياض',
      timeZone: ' Asia/Dubai '
    });

    assert.equal(timeZone, 'Asia/Dubai');
  });

  it('falls back to existing local country rules when dictionary has no match', async () => {
    const service = new CrmGeoTimezoneService(createPrisma(null) as never);

    const timeZone = await service.resolveCustomerTimeZone({
      country: 'United Arab Emirates',
      city: 'مدينة غير معروفة'
    });

    assert.equal(timeZone, 'Asia/Dubai');
  });
});

function createPrisma(match: { countryCode: string; normalizedName: string; timeZone: string } | null) {
  return {
    crmGeoCityName: {
      async findFirst(args: { where: { countryCode: string; normalizedName: string } }) {
        if (!match) {
          return null;
        }

        if (args.where.countryCode === match.countryCode && args.where.normalizedName === match.normalizedName) {
          return { timeZone: match.timeZone };
        }

        return null;
      }
    }
  };
}
