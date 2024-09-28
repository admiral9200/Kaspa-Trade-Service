import { UtxoEntryReference } from 'libs/kaspa/kaspa';

export interface TotalBalanceWithUtxosInterface {
  totalBalance: bigint;
  utxoEntries: UtxoEntryReference[];
}
