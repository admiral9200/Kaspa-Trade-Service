import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SortDto } from '../abstract/sort.dto';
import { SortDirection } from '../../enums/sort-direction.enum';
import { PaginationDto } from '../abstract/pagination.dto';
import { PAGINATION_LIMIT_DEFAULT } from 'src/modules/backend/constants';
import { SellOrderStatus } from '../../enums/sell-order-status.enum';
import { SellOrderStatusV2 } from '../../enums/sell-order-status-v2.enum';
import * as _ from 'lodash';

export class GetUserOrdersFiltersDto {
  @IsArray()
  @IsIn(_.uniq([...Object.values(SellOrderStatus), ...Object.values(SellOrderStatusV2)]), { each: true })
  @IsOptional()
  statuses?: (SellOrderStatus | SellOrderStatusV2)[];

  @IsString({ each: true })
  @IsOptional()
  tickers?: string[];

  @IsBoolean()
  @IsOptional()
  isSeller?: boolean;

  @IsBoolean()
  @IsOptional()
  isBuyer?: boolean;

  @IsOptional()
  totalPrice?: {
    min?: number;
    max?: number;
  };

  @IsNumber()
  @IsOptional()
  startDateTimestamp?: number;

  @IsNumber()
  @IsOptional()
  endDateTimestamp?: number;
}

export class GetUserOrdersRequestDto {
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
  @Type(() => GetUserOrdersFiltersDto)
  @IsOptional()
  filters?: GetUserOrdersFiltersDto;
}
