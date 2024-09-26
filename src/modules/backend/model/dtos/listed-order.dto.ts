export interface ListedOrderDto {
  orderId: string;
  pricePerToken: number;
  quantity: number;
  ticker: string;
  totalPrice: number;
  expiresAt: Date;
  createdAt: Date;
}
