import { RpcClient } from 'libs/kaspa/kaspa';

const WAIT_TIMEOUT = 120 * 1000;
export class TransacionReciever {
  static addressesToMontior = {};

  private promise = null;
  private resolve = null;
  private reject = null;
  private timeout = null;
  private id = null;
  private handlerWithBind = null;

  constructor(
    private readonly rpc: RpcClient,
    private publicAddress: string,
    private transactionToMonitor,
    private walletShouldBeEmpty = false,
  ) {
    this.id = Date.now().toString(36) + (Math.random() * 1e9).toString(36).substring(0, 6) + '-' + this.publicAddress;
    this.handlerWithBind = this.handleEvent.bind(this);
  }

  private resolveAsSuccess() {
    this.resolve();
    clearTimeout(this.timeout);
    this.clearEventListener();
  }

  private handleEvent(event) {
    if (this.walletShouldBeEmpty) {
      this.resolveAsSuccess();
      return;
    }

    const addedEntry = event.data.added.find(
      (entry: any) => entry.address.payload === this.publicAddress.toString().split(':')[1],
    );

    if (addedEntry) {
      const addedEventTrxId = addedEntry.outpoint.transactionId;

      if (addedEventTrxId == this.transactionToMonitor) {
        this.resolveAsSuccess();
      }
    }
  }

  async registerEventHandlers() {
    if (this.promise) {
      throw new Error('This object can be used only once');
    }

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });

    if (
      !TransacionReciever.addressesToMontior[this.publicAddress] ||
      Object.keys(TransacionReciever.addressesToMontior[this.publicAddress]).length == 0
    ) {
      TransacionReciever.addressesToMontior[this.publicAddress] = {
        [this.id]: 1,
      };
      await this.rpc.subscribeUtxosChanged([this.publicAddress]);
    } else {
      TransacionReciever.addressesToMontior[this.publicAddress][this.id] = 1;
    }

    this.rpc.addEventListener('utxos-changed', this.handlerWithBind);
  }

  async dispose() {
    await this.clearEventListener();
  }

  private async clearEventListener() {
    this.rpc.removeEventListener('utxos-changed', this.handlerWithBind);

    if (
      TransacionReciever.addressesToMontior[this.publicAddress] &&
      TransacionReciever.addressesToMontior[this.publicAddress][this.id]
    ) {
      delete TransacionReciever.addressesToMontior[this.publicAddress][this.id];
    }

    if (
      TransacionReciever.addressesToMontior[this.publicAddress] &&
      Object.keys(TransacionReciever.addressesToMontior[this.publicAddress]).length == 0
    ) {
      delete TransacionReciever.addressesToMontior[this.publicAddress];
      await this.rpc.unsubscribeUtxosChanged([this.publicAddress]);
    }
  }

  async waitForTransactionCompletion() {
    setTimeout(() => {
      this.reject('Timeout on Transaction completion at TransacionReciever.waitForTransactionCompletion()');
      this.clearEventListener();
    }, WAIT_TIMEOUT);
    return this.promise;
  }
}
