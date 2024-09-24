import { Injectable } from '@nestjs/common';
import { SellRequestDto } from '../model/dtos/sell-request.dto';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { P2pOrderBookTransformer } from '../transformers/p2p-order-book.transformer';
import { SellOrderDm } from '../model/dms/sell-order.dm';
import { P2pOrderBookResponseTransformer } from '../transformers/p2p-order-book-response.transformer';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/responses/confirm-buy-order-request.response.dto';
import { SellOrderResponseDto } from '../model/dtos/responses/sell-order.response.dto';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletService } from '../services/temporary-wallet.service';
import { TemporaryWallet } from '../model/schemas/temporary-wallet.schema';
import { P2pOrder } from '../model/schemas/p2p-order.schema';
import { ConfirmBuyRequestDto } from '../model/dtos/confirm-buy-request.dto';
@Injectable()
export class P2pProvider {
  constructor(
    private readonly kaspaFacade: KaspaFacade,
    private readonly p2pOrderBookService: P2pOrdersService,
    private readonly temporaryWalletService: TemporaryWalletService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
  ) {}

  public async listOrders(): Promise<SellOrderResponseDto[]> {
    const orders: SellOrderDm[] = await this.p2pOrderBookService.getSellOrders();
    return orders.map((order) => P2pOrderBookTransformer.transformSellOrderDmToSellOrderDto(order));
  }

  public async createOrder(dto: SellRequestDto): Promise<SellRequestResponseDto> {
    const sellOrderDm: SellOrderDm = P2pOrderBookTransformer.transformSellRequestDtoToOrderDm(dto);

    const walletSequenceId: number = await this.temporaryWalletService.generateSequenceId();
    const temporaryWalletAddress: string = await this.kaspaFacade.createWalletAccount(walletSequenceId);

    const temporaryWallet: TemporaryWallet = await this.temporaryWalletService.create(walletSequenceId, temporaryWalletAddress);

    const createdSellOrderDm: SellOrderDm = await this.p2pOrderBookService.createSell(sellOrderDm, temporaryWallet);

    return P2pOrderBookResponseTransformer.transformDmToSellResponseDto(createdSellOrderDm);
  }

  async getCurrentFeeRate() {
    return await this.kaspaNetworkActionsService.getCurrentFeeRate();
  }

  async generateMasterWallet() {
    return await this.kaspaNetworkActionsService.generateMasterWallet();
  }

  public async buy(orderId: string, buyRequestDto: BuyRequestDto): Promise<BuyRequestResponseDto> {
    const sellOrderDm: SellOrderDm = await this.p2pOrderBookService.assignBuyerToOrder(orderId, buyRequestDto.walletAddress);
    return P2pOrderBookResponseTransformer.transformDmToBuyResponseDto(sellOrderDm);
  }

  public async confirmSell(sellOrderId: string): Promise<ConfirmSellOrderRequestResponseDto> {
    const order: P2pOrder = await this.p2pOrderBookService.getOrderById(sellOrderId);

    let confirmed: boolean = false;

    // TODO VALIDATRE HERE

    confirmed = true;

    await this.p2pOrderBookService.setReadyForSale(order._id);

    return {
      confirmed,
    };
  }

  public async confirmBuy(sellOrderId: string, confirmBuyDto: ConfirmBuyRequestDto): Promise<ConfirmBuyOrderRequestResponseDto> {
    // Validate that the buyer has sent the KAS to the temporary wallet TODO

    const order: P2pOrder = await this.p2pOrderBookService.confirmBuy(sellOrderId);

    await this.kaspaFacade.doSellSwap(order);

    await this.p2pOrderBookService.setOrderCompleted(sellOrderId);

    return {
      confirmed: true,
    };
  }
}
