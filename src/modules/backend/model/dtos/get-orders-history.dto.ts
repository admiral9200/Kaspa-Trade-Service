import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SortDto } from './abstract/sort.dto';
import { SortDirection } from '../enums/sort-direction.enum';
import { PaginationDto } from './abstract/pagination.dto';
import { PAGINATION_LIMIT_DEFAULT } from '../../constants/p2p-order.constants';
import { GetOrdersHistoryFiltersDto } from './get-orders-history-filters.dto';

export class GetOrdersHistoryDto {
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
  @Type(() => GetOrdersHistoryFiltersDto)
  @IsOptional()
  filters?: GetOrdersHistoryFiltersDto;
}
