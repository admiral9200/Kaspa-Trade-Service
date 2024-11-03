import { SortDto } from '../abstract/sort.dto';
import { IsOptional, ValidateNested } from 'class-validator';
import { PaginationDto } from '../abstract/pagination.dto';
import { Type } from 'class-transformer';
import { SortDirection } from '../../enums/sort-direction.enum';
import { PAGINATION_LIMIT_DEFAULT } from 'src/modules/backend/constants';

export class GetOrdersDto {
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

  constructor() {
    this.sort = new SortDto();
    this.pagination = new PaginationDto();
  }
}
