import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { resolveCrmCustomerCountryCode, resolveCrmCustomerTimeZone } from '../crm-customer-timezone.rules';
import { normalizeGeoNameKey } from './geonames-timezone-import';

interface ResolveCustomerTimeZoneInput {
  country?: string | null;
  city?: string | null;
  timeZone?: string | null;
}

@Injectable()
export class CrmGeoTimezoneService {
  constructor(@Inject(PrismaService) private readonly prisma: Pick<PrismaService, 'crmGeoCityName'>) {}

  /** Resolve the customer timezone from explicit input, GeoNames dictionary, then local country rules. */
  async resolveCustomerTimeZone(input: ResolveCustomerTimeZoneInput) {
    const explicitTimeZone = input.timeZone?.trim();

    if (explicitTimeZone) {
      return explicitTimeZone;
    }

    const dictionaryTimeZone = await this.resolveDictionaryTimeZone(input);

    if (dictionaryTimeZone) {
      return dictionaryTimeZone;
    }

    return resolveCrmCustomerTimeZone(input);
  }

  private async resolveDictionaryTimeZone(input: ResolveCustomerTimeZoneInput) {
    const countryCode = resolveCrmCustomerCountryCode(input.country);
    const normalizedName = normalizeGeoNameKey(input.city);

    if (!countryCode || !normalizedName) {
      return null;
    }

    const match = await this.prisma.crmGeoCityName.findFirst({
      where: {
        countryCode,
        normalizedName
      },
      orderBy: [{ population: 'desc' }, { nameSource: 'asc' }],
      select: {
        timeZone: true
      }
    });

    return match?.timeZone ?? null;
  }
}
