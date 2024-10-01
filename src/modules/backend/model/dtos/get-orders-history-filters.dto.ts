import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { SellOrderStatus } from '../enums/sell-order-status.enum';

export class GetOrdersHistoryFiltersDto {
  @IsEnum(SellOrderStatus, { each: true })
  @IsOptional()
  statuses?: SellOrderStatus[];

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
