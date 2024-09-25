import { IsOptional, Min } from 'class-validator';
import { PAGINATION_LIMIT_DEFAULT } from '../../../constants/p2p-order.constants';

export class PaginationDto {
  @IsOptional()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Min(1)
  limit: number = PAGINATION_LIMIT_DEFAULT;
}
