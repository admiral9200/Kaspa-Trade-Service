import { IsEnum, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SortDto } from '../abstract/sort.dto';
import { SortDirection } from '../../enums/sort-direction.enum';
import { PaginationDto } from '../abstract/pagination.dto';
import { PAGINATION_LIMIT_DEFAULT } from 'src/modules/backend/constants';
import { LunchpadOrderStatus } from '../../enums/lunchpad-statuses.enum';

export class GetLunchpadOrderListFiltersDto {
  @IsEnum(LunchpadOrderStatus, { each: true })
  @IsOptional()
  statuses?: LunchpadOrderStatus[];

  @IsNumber()
  @IsOptional()
  roundNumber?: number;

  @IsNumber()
  @IsOptional()
  startDateTimestamp?: number;

  @IsNumber()
  @IsOptional()
  endDateTimestamp?: number;
}

export class GetLunchpadOrderListDto {
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
  @Type(() => GetLunchpadOrderListFiltersDto)
  @IsOptional()
  filters?: GetLunchpadOrderListFiltersDto;
}
