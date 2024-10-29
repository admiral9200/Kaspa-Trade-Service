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

  static async useUtxoProcessorManager<T>(
    rpc: RpcClient,
    network: string,
    publicAddress: string,
    func: (context: UtxoContext) => Promise<any>,
  ): Promise<T> {
    const trxManager = new UtxoProcessorManager(rpc, network, publicAddress);
    await trxManager.registerEventHandlers();

    try {
      return await func(trxManager.getContext());
    } catch (error) {
      try {
        await trxManager.dispose();
      } catch (error) {
        console.error('Failed to dispose trxManager', error);
      }
      throw error;
    }
  }

  constructor(
    private readonly rpc: RpcClient,
    private readonly network: string,
    private readonly publicAddress: string,
  ) {
    this.processorHandlerWithBind = this.processorEventListener.bind(this);
    this.processor = new UtxoProcessor({ rpc: this.rpc, networkId: this.network });
    this.context = new UtxoContext({ processor: this.processor });
  }

  getContext(): UtxoContext {
    return this.context;
  }

  private async processorEventListener() {
    if (this.processorEventListenerTimoutReached) {
      return;
    }

    clearTimeout(this.processorEventListenerTimeout);

    try {
      console.log(`TrxManager: registerProcessor - this.context.clear()`);
      await this.context.clear();
      console.log(`TrxManager: registerProcessor - tracking pool address`);
      await this.context.trackAddresses([this.publicAddress]);
      this.processorEventListenerResolve();
    } catch (error) {
      this.processorEventListenerReject(error);
    }
  }

  async registerEventHandlers() {
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
    await this.processor.start();
    return await this.processorEventListenerPromise;
  }

  private async stopAndUnregisterProcessor() {
    await this.processor.stop();
    this.processor.removeEventListener('utxo-proc-start', this.processorHandlerWithBind);
  }
}
