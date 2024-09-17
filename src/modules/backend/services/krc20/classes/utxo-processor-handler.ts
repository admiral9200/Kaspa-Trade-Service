import {
  IUtxoProcessorArgs,
  PrivateKey,
  UtxoContext,
  UtxoProcessor,
} from 'libs/kaspa-dev/kaspa';

const ACTION_TO_REGISTER = 'utxo-proc-start';

export class UtxoProcessorHandler {
  private context: UtxoContext;
  private processor: UtxoProcessor;

  constructor(
    args: IUtxoProcessorArgs,
    private privateKey: PrivateKey,
  ) {
    this.processor = new UtxoProcessor(args);
    this.context = new UtxoContext({
      processor: this.processor,
    });
  }

  getContext(): UtxoContext {
    return this.context;
  }

  async registerProcessorAndWaitForResponse(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('UtxoProcessor did not start after 2 minutes'));
      }, 120000);

      this.processor.addEventListener('utxo-proc-start', async () => {
        clearTimeout(timer);
        try {
          await this.context.clear();
          // console.log(`TrxManager: registerProcessor - tracking pool address`);
          await this.context.trackAddresses([
            this.privateKey
              .toPublicKey()
              .toAddress(this.processor.networkId)
              .toString(),
          ]);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.processor.start().catch((err) => {
        console.error('registerProcessorAndWaitForResponse err', err);
      });
    });
  }

  async dispose() {
    this.processor.removeEventListener(ACTION_TO_REGISTER);
  }
}
