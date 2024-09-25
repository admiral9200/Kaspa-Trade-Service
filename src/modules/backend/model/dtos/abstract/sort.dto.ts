import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SortDirection } from '../../enums/sort-direction.enum';

export class SortDto {
  @IsEnum(SortDirection)
  direction: SortDirection = SortDirection.DESC;

  @IsString()
  @IsOptional()
  field?: string;
}
