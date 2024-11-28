import { IsOptional, Max, Min } from 'class-validator';
import { PAGINATION_LIMIT_DEFAULT, PAGINATION_LIMIT_MAX } from 'src/modules/backend/constants';

export class PaginationDto {
  @IsOptional()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Min(1)
  @Max(PAGINATION_LIMIT_MAX)
  limit: number = PAGINATION_LIMIT_DEFAULT;
}
