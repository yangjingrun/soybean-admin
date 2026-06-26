import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ok } from '../../../shared/api-response';
import { CurrentContext } from '../../auth/auth.decorators';
import { CrmControllerBase } from '../crm-controller.helpers';
import type { CrmUserContext } from '../crm.types';
import { CrmGeoCityQueryDto } from '../dto/crm-geo-query.dto';
import { CrmGeoCatalogService } from '../geo/crm-geo-catalog.service';

/** Serves CRM geography dictionaries for lead forms and filters. */
@Controller('crm/geo')
export class CrmGeoController extends CrmControllerBase {
  constructor(@Inject(CrmGeoCatalogService) private readonly geoCatalogService: CrmGeoCatalogService) {
    super();
  }

  @Get('countries')
  async listCountries(@CurrentContext() context: CrmUserContext | null = null) {
    this.requireUserContext(context);

    return ok(await this.geoCatalogService.listCountries());
  }

  @Get('cities')
  async listCities(@CurrentContext() context: CrmUserContext | null = null, @Query() query: CrmGeoCityQueryDto) {
    this.requireUserContext(context);

    return ok(await this.geoCatalogService.listCities(query));
  }
}
