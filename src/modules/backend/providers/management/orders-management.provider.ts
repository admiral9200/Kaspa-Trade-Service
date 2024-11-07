import { Injectable, UnauthorizedException } from '@nestjs/common';
import { P2pOrdersService } from '../../services/p2p-orders.service';
import { KaspaNetworkActionsService } from '../../services/kaspa-network/kaspa-network-actions.service';
import { OrdersManagementUpdateSellOrderDto } from '../../model/dtos/p2p-orders/orders-management-update-sell-order.dto';
import { P2pOrderEntity } from '../../model/schemas/p2p-order.schema';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { isEmptyString } from '../../utils/object.utils';

@Injectable()
export class OrdersManagementProvider {
  constructor(
    private readonly p2pOrderBookService: P2pOrdersService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly telegramBotService: TelegramBotService,
    private readonly config: AppConfigService,
  ) {}

  async generateMasterWallet() {
    return await this.kaspaNetworkActionsService.generateMasterWallet();
  }

  async getOrderData(id: string) {
    const order = await this.p2pOrderBookService.getOrderById(id);
    const wallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
    const orderUtxos = await this.kaspaNetworkActionsService.getWalletTotalBalanceAndUtxos(wallet.address);

    return {
      order,
      tempWalletAddress: wallet.address,
      orderUtxos,
    };
  }

  async updateOrder(id: string, body: OrdersManagementUpdateSellOrderDto): Promise<P2pOrderEntity> {
    return await this.p2pOrderBookService.updateOrderFromOrdersManagement(id, body);
  }

  async getPrivateKey(id: string, password: string, viewerWallet: string) {
    if (isEmptyString(this.config.privateKeyViewingPassword)) {
      throw new UnauthorizedException();
    }

    if (this.config.privateKeyViewingPassword != password) {
      throw new UnauthorizedException();
    }

    const order = await this.p2pOrderBookService.getOrderById(id);

    await this.p2pOrderBookService.setWalletKeyExposedBy(order, viewerWallet);

    const wallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
    let message = TelegramBotService.escapeMarkdown(
      `\nA private key requested for order: ${order._id.toString()}\n\nAdmin wallet:\n${viewerWallet}\n\nPrivate key: ^^^PRIVATE^^^`,
    );

    message = message.replace('^^^PRIVATE^^^', TelegramBotService.formatCodeBlock(wallet.privateKey.toString()));

    await this.telegramBotService.sendFormattedMessage(this.config.getTelegramPrivateKeysChannelId, message);

    return { success: true };
  }
}
