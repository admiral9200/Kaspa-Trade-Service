import { RpcClient, UtxoContext, UtxoProcessor } from 'libs/kaspa/kaspa';

const WAIT_TIMEOUT = 2 * 60 * 1000;

export class UtxoProcessorManager {
  private processor: UtxoProcessor = null;
  private context: UtxoContext = null;

  private processorEventListenerPromise = null;
  private processorEventListenerResolve = null;
  private processorEventListenerReject = null;
  private processorEventListenerTimeout = null;
  private processorEventListenerTimoutReached = false;

  private processorHandlerWithBind = null;
  private balanceEventHandlerWithBind = null;

  private balancePromise = null;
  private balanceResolve = null;
  private isBalancedResolved = true;

  static async useUtxoProcessorManager<T>(
    rpc: RpcClient,
    network: string,
    publicAddress: string,
    func: (context: UtxoContext, utxoProcessonManager: UtxoProcessorManager) => Promise<any>,
  ): Promise<T> {
    const trxManager = new UtxoProcessorManager(rpc, network, publicAddress);
    await trxManager.registerEventHandlers();

    try {
      return await func(trxManager.getContext(), trxManager);
    } catch (error) {
      throw error;
    } finally {
      try {
        await trxManager.dispose();
      } catch (error) {
        console.error('Failed to dispose trxManager', error);
      }
    }
  }

  constructor(
    private readonly rpc: RpcClient,
    private readonly network: string,
    private readonly publicAddress: string,
  ) {
    this.processorHandlerWithBind = this.processorEventListener.bind(this);
    this.balanceEventHandlerWithBind = this.balanceEventHandler.bind(this);
    this.processor = new UtxoProcessor({ rpc: this.rpc, networkId: this.network });
    this.context = new UtxoContext({ processor: this.processor });
  }

  getContext(): UtxoContext {
    return this.context;
  }

  private initBalancePromiseAndTimeout() {
    this.isBalancedResolved = false;
    this.balancePromise = new Promise((resolve) => {
      this.balanceResolve = resolve;
    });
  }

  private async balanceEventHandler(event) {
    if (event.type == 'pending') {
      this.initBalancePromiseAndTimeout();
    } else if (event.type == 'balance') {
      if (!this.balancePromise) {
        return;
      }

      if (!this.isBalancedResolved) {
        const currentHasPending = event.data.balance.pending > 0;
        if (!currentHasPending) {
          this.isBalancedResolved = true;
          this.balanceResolve();
        }
      }
    }
  }

  private async processorEventListener() {
    if (this.processorEventListenerTimoutReached) {
      return;
    }

    clearTimeout(this.processorEventListenerTimeout);

    try {
      await this.context.clear();
      await this.context.trackAddresses([this.publicAddress]);
      this.processorEventListenerResolve();
    } catch (error) {
      this.processorEventListenerReject(error);
    }
  }

  private async registerEventHandlers() {
    if (this.processorEventListenerPromise) {
      throw new Error('This object can be used only once');
    }

    await this.registerProcessor();
  }

  async dispose(): Promise<void> {
    await this.stopAndUnregisterProcessor();
  }

  private async registerProcessor() {
    this.processorEventListenerTimeout = setTimeout(() => {
      this.processorEventListenerTimoutReached = true;
      this.processorEventListenerReject('Timeout on Transaction completion');
      this.dispose();
    }, WAIT_TIMEOUT);

    this.processorEventListenerPromise = new Promise((resolve, reject) => {
      this.processorEventListenerResolve = resolve;
      this.processorEventListenerReject = reject;
    });
    this.processor.addEventListener('utxo-proc-start', this.processorHandlerWithBind);
    this.processor.addEventListener('balance', this.balanceEventHandlerWithBind);
    this.processor.addEventListener('pending', this.balanceEventHandlerWithBind);
    await this.processor.start();
    return await this.processorEventListenerPromise;
  }

  private async stopAndUnregisterProcessor() {
    await this.processor.stop();
    this.processor.removeEventListener('utxo-proc-start', this.processorHandlerWithBind);
    this.processor.removeEventListener('balance', this.balanceEventHandlerWithBind);
    this.processor.removeEventListener('pending', this.balanceEventHandlerWithBind);
  }

  async waitForPendingUtxoToFinish() {
    if (this.balancePromise) {
      await this.balancePromise;
    }
  }
}
