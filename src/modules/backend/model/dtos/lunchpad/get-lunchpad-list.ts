import { IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SortDto } from '../abstract/sort.dto';
import { SortDirection } from '../../enums/sort-direction.enum';
import { PaginationDto } from '../abstract/pagination.dto';
import { PAGINATION_LIMIT_DEFAULT } from 'src/modules/backend/constants';
import { LunchpadStatus } from '../../enums/lunchpad-statuses.enum';

export class GetLunchpadListFiltersDto {
  @IsString({ each: true })
  @IsOptional()
  tickers?: string[];

  @IsEnum(LunchpadStatus, { each: true })
  @IsOptional()
  statuses?: LunchpadStatus[];

  @IsBoolean()
  @IsOptional()
  ownerOnly?: boolean;

  // @IsNumber()
  // @IsOptional()
  // startDateTimestamp?: number;

  // @IsNumber()
  // @IsOptional()
  // endDateTimestamp?: number;
}

export class GetLunchpadListDto {
  @ValidateNested()
  @Type(() => SortDto)
  @IsOptional()
  sort: SortDto = {
    direction: SortDirection.DESC,
  };

  @ValidateNested()
  @Type(() => PaginationDto)
  @IsOptional()
  pagination: PaginationDto = {
    limit: PAGINATION_LIMIT_DEFAULT,
  };

  @ValidateNested()
  @Type(() => GetLunchpadListFiltersDto)
  @IsOptional()
  filters?: GetLunchpadListFiltersDto;
}
