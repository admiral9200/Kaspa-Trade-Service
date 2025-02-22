import { Injectable } from '@nestjs/common';
import { Resolver, RpcClient } from 'libs/kaspa/kaspa';
import { Encoding } from 'libs/kaspa/kaspa';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';

@Injectable()
export class RpcService {
  private RPC: RpcClient;
  private network: string;

  constructor(private configService: AppConfigService) {
    this.network = this.configService.kaspaNetwork;
    this.refreshRpc();
  }

  getRpc() {
    return this.RPC;
  }

  refreshRpc() {
    this.RPC = new RpcClient({
      resolver: new Resolver(),
      encoding: Encoding.Borsh,
      networkId: this.network,
    });
    return this.getRpc();
  }

  getNetwork() {
    return this.network;
  }
}
