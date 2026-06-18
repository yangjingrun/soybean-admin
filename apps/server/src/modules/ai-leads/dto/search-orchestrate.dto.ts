import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SearchOrchestrateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  requirement!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  targetLeadCount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  maxSearchRequests?: number;
}
