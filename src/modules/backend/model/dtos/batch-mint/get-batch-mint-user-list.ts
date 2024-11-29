import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SortDto } from '../abstract/sort.dto';
import { SortDirection } from '../../enums/sort-direction.enum';
import { PaginationDto } from '../abstract/pagination.dto';
import { BatchMintStatus } from '../../enums/batch-mint-statuses.enum';
import { PAGINATION_LIMIT_DEFAULT } from 'src/modules/backend/constants';

export class GetBatchMintUserListFiltersDto {
  @IsString({ each: true })
  @IsOptional()
  tickers?: string[];

  @IsEnum(BatchMintStatus, { each: true })
  @IsOptional()
  statuses?: BatchMintStatus[];

  @IsBoolean()
  @IsOptional()
  isReachedMintLimit?: boolean;

  @IsBoolean()
  @IsOptional()
  isUserCanceled?: boolean;

  @IsNumber()
  @IsOptional()
  startDateTimestamp?: number;

  @IsNumber()
  @IsOptional()
  endDateTimestamp?: number;
}

export class GetBatchMintUserListDto {
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
  @Type(() => GetBatchMintUserListFiltersDto)
  @IsOptional()
  filters?: GetBatchMintUserListFiltersDto;
}
