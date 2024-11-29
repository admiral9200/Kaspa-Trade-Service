import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SortDto } from '../abstract/sort.dto';
import { SortDirection } from '../../enums/sort-direction.enum';
import { PaginationDto } from '../abstract/pagination.dto';
import { PAGINATION_LIMIT_DEFAULT } from 'src/modules/backend/constants';
import { LunchpadOrderStatus } from '../../enums/lunchpad-statuses.enum';

export class GetUserLunchpadOrderListFiltersDto {
  @IsEnum(LunchpadOrderStatus, { each: true })
  @IsOptional()
  statuses?: LunchpadOrderStatus[];

  @IsNumber()
  @IsOptional()
  roundNumber?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tickers?: string;

  @IsNumber()
  @IsOptional()
  startDateTimestamp?: number;

  @IsNumber()
  @IsOptional()
  endDateTimestamp?: number;
}

export class GetUserLunchpadOrderListDto {
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
  @Type(() => GetUserLunchpadOrderListFiltersDto)
  @IsOptional()
  filters?: GetUserLunchpadOrderListFiltersDto;
}
