import { Injectable } from '@nestjs/common';
import { SellOrderDto } from '../model/dtos/sell-order.dto';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { P2pOrderBookTransformer } from '../transformers/p2p-order-book.transformer';
import { OrderDm } from '../model/dms/order.dm';
import { P2pOrderBookResponseTransformer } from '../transformers/p2p-order-book-response.transformer';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/responses/confirm-buy-order-request.response.dto';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { ConfirmBuyRequestDto } from '../model/dtos/confirm-buy-request.dto';
import { GetOrdersDto } from '../model/dtos/get-orders.dto';
import { ListedOrderDto } from '../model/dtos/listed-order.dto';
import { SwapTransactionsResult } from '../services/kaspa-network/interfaces/SwapTransactionsResult.interface';

@Injectable()
export class P2pProvider {
  constructor(
    private readonly kaspaFacade: KaspaFacade,
    private readonly p2pOrderBookService: P2pOrdersService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
  ) {}

  public async listOrders(ticker: string, getSellOrdersRequestDto: GetOrdersDto): Promise<ListedOrderDto[]> {
    const orders: OrderDm[] = await this.p2pOrderBookService.getSellOrders(ticker, getSellOrdersRequestDto);
    return orders.map((order) => P2pOrderBookTransformer.transformP2pOrderEntityToListedOrderDto(order));
  }

  public async createOrder(sellOrderDto: SellOrderDto): Promise<SellRequestResponseDto> {
    const walletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();

    const createdOrderEntity: P2pOrderEntity = await this.p2pOrderBookService.createSell(sellOrderDto, walletSequenceId);
    const temporaryWalletPublicAddress: string = await this.kaspaFacade.getAccountWalletAddressAtIndex(walletSequenceId);

    return P2pOrderBookResponseTransformer.createSellOrderCreatedResponseDto(createdOrderEntity, temporaryWalletPublicAddress);
  }

  async getCurrentFeeRate() {
    return await this.kaspaNetworkActionsService.getCurrentFeeRate();
  }

  async generateMasterWallet() {
    return await this.kaspaNetworkActionsService.generateMasterWallet();
  }

  public async buy(orderId: string, buyRequestDto: BuyRequestDto): Promise<BuyRequestResponseDto> {
    const sellOrderDm: OrderDm = await this.p2pOrderBookService.assignBuyerToOrder(orderId, buyRequestDto.walletAddress);
    const temporaryWalletPublicAddress: string = await this.kaspaFacade.getAccountWalletAddressAtIndex(
      sellOrderDm.walletSequenceId,
    );

    return P2pOrderBookResponseTransformer.transformOrderDmToBuyResponseDto(sellOrderDm, temporaryWalletPublicAddress);
  }

  public async confirmSell(sellOrderId: string): Promise<ConfirmSellOrderRequestResponseDto> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderById(sellOrderId);

    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    const confirmed: boolean = await this.kaspaFacade.checkIfWalletHasKrc20Token(
      temporaryWalletPublicAddress,
      order.ticker,
      order.quantity,
    );

    if (confirmed) {
      await this.p2pOrderBookService.setReadyForSale(order._id);
    }

    return {
      confirmed,
    };
  }

  public async confirmBuy(sellOrderId: string, confirmBuyDto: ConfirmBuyRequestDto): Promise<ConfirmBuyOrderRequestResponseDto> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderById(sellOrderId);

    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    const isVerified: boolean = await this.kaspaFacade.verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
      confirmBuyDto.transactionId,
      order.buyerWalletAddress,
      temporaryWalletPublicAddress,
      order.totalPrice,
    );

    let transactionsResult: SwapTransactionsResult;

    if (isVerified) {
      const order: P2pOrderEntity = await this.p2pOrderBookService.confirmBuy(sellOrderId);

      transactionsResult = await this.kaspaFacade.doSellSwap(order);
      await this.p2pOrderBookService.setOrderCompleted(sellOrderId);
    }

    return {
      confirmed: isVerified,
      transactions: transactionsResult,
    };
  }

  async cancelSell(sellOrderId: string) {
    await this.p2pOrderBookService.cancelSellOrder(sellOrderId);
  }
}
