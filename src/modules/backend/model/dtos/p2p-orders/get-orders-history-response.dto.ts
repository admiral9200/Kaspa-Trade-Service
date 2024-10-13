import { OrderHistoryDm } from '../../dms/order-history.dm';

export interface GetOrdersHistoryResponseDto {
  orders: OrderHistoryDm[];
  totalCount: number;
  allTickers: string[];
}
