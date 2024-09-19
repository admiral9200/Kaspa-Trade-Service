import { RpcClient } from 'libs/kaspa-dev/kaspa';

// TODO: CHECK THE TRANSACTION. CURRENTLY, IF MORE THAN 2 REQUEST ARE SENT, It's gonna cause problems
export class TransacionReciever {
  private promise = null;
  private resolve = null;
  private reject = null;
  private currentTransaction = null;
  private timeout = null;

  constructor(private readonly rpc: RpcClient) {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  private handleEvent(event) {
    console.log('utxos-changed-prom', this.promise, this);
    console.log('utxos-changed', event);
    this.resolve();
    clearTimeout(this.timeout);
  }

  async registerAddress(address: string) {
    await this.rpc.subscribeUtxosChanged([address]);
    this.rpc.addEventListener('utxos-changed', this.handleEvent.bind(this));
  }

  async dispose() {
    this.rpc.removeEventListener('utxos-changed', this.handleEvent.bind(this));
  }

  async waitForTransactionCompletion(transactionHash) {
    setTimeout(
      () => {
        this.resolve();
      },
      2 * 60 * 1000,
    );
    this.currentTransaction = transactionHash;
    return this.promise;
  }
}
