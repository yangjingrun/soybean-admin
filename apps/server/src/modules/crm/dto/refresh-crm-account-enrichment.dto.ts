import { IsIn } from 'class-validator';

export class RefreshCrmAccountEnrichmentDto {
  @IsIn(['hunter'])
  provider!: 'hunter';
}
