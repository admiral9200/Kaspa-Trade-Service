import { Injectable } from '@nestjs/common';
import { RpcService } from './rpc.service';

const CONNECTION_TIMEOUT = 20 * 1000;
const SERVER_INFO_TIMEOUT = 5 * 1000;

@Injectable()
export class KaspaNetworkConnectionManagerService {
  private connectionPromise = null;
  private connectionMadeResolve = null;
  private connectionMadeReject = null;
  private disconnectFunctionWithBind = null;

  constructor(private readonly rpcService: RpcService) {
    this.disconnectFunctionWithBind = this.onDisconnect.bind(this);
    this.initPromise();
    this.handleConnection().catch((err) => console.error('Failed initializing connection', err));
  }

  private onDisconnect(data) {
    console.error('Rpc disconnected', data);
    this.initPromise();
    this.rpcService.getRpc().removeEventListener('disconnect', this.disconnectFunctionWithBind);

    this.handleConnection().catch((err) => console.error('Failed initializing connection', err));
  }

  private initPromise() {
    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionMadeResolve = resolve;
      this.connectionMadeReject = reject;
    });
    this.connectionPromise.catch((err) => console.error('Failed initializing connection', err));
  }

  private rejectConnection() {
    const currentReject = this.connectionMadeReject;
    this.initPromise();
    currentReject('Failed connecting to RPC');
  }

  private async handleConnection() {
    console.log('Trying to connect to RPC...');

    let reachedTimeout = false;
    let isFirstTime = true;

    while (!this.rpcService.getRpc().isConnected) {
      if (isFirstTime) {
        isFirstTime = false;
      } else {
        this.rejectConnection();
      }

      let timeoutForConnection = setTimeout(() => {
        console.error('Rpc connection timeout, connect function stuck');

        this.rejectConnection();
        this.handleConnection();
        reachedTimeout = true;
      }, CONNECTION_TIMEOUT);

      try {
        const currentRpc = await this.rpcService.refreshRpc();
        await currentRpc.connect();

        if (reachedTimeout) {
          console.error('Rpc connection reached time out');
          try {
            await currentRpc.disconnect();
          } catch (err) {
            console.error('Failed disconnecting RPC', err);
          }

          return;
        }

        clearTimeout(timeoutForConnection);
        timeoutForConnection = null;

        if (!(await this.isServerValid())) {
          console.error('Rpc connected to an invalid server');
          await currentRpc.disconnect();
        }
      } catch (err) {
        console.error('Failed connecting RPC', err);
      } finally {
        if (timeoutForConnection) {
          clearTimeout(timeoutForConnection);
        }
      }
    }

    this.rpcService.getRpc().addEventListener('disconnect', this.disconnectFunctionWithBind);

    console.log('RPC Connected Successfully');

    this.connectionMadeResolve();
  }

  private async isServerValid(): Promise<boolean> {
    if (!this.rpcService.getRpc().isConnected) {
      return false;
    }

    return new Promise(async (res) => {
      let isTimeoutCalled = false;

      const timeout = setTimeout(async () => {
        console.error('getServerInfo Timeout');
        isTimeoutCalled = true;
        res(false);
      }, SERVER_INFO_TIMEOUT);

      try {
        const serverInfo = await this.rpcService.getRpc().getServerInfo();

        if (!isTimeoutCalled) {
          res(serverInfo.isSynced && serverInfo.hasUtxoIndex);
        }
      } catch (err) {
        console.error('Failed getServerInfo', err);
        if (!isTimeoutCalled) {
          res(false);
        }
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  public async waitForConnection(): Promise<void> {
    await this.connectionPromise;

    if (!this.rpcService.getRpc().isConnected) {
      throw new Error('Rpc not connected');
    }
  }
}
