export interface IKaspaApiTransactionData {
  subnetwork_id: string;
  transaction_id: string;
  hash: string;
  mass: string;
  block_hash: string[];
  block_time: number;
  is_accepted: boolean;
  accepting_block_hash: string;
  accepting_block_blue_score: number;
  inputs: IKaspaApiTransactionInput[];
  outputs: IKaspaApiTransactionOutput[];
}

export interface IKaspaApiTransactionInput {
  transaction_id: string;
  index: number;
  previous_outpoint_hash: string;
  previous_outpoint_index: string;
  previous_outpoint_resolved: IKaspaApiTransactionOutpointResolved;
  previous_outpoint_address: string;
  previous_outpoint_amount: number;
  signature_script: string;
  sig_op_count: string;
}

export interface IKaspaApiTransactionOutpointResolved {
  transaction_id: string;
  index: number;
  amount: number;
  script_public_key: string;
  script_public_key_address: string;
  script_public_key_type: string;
  accepting_block_hash: string;
}

export interface IKaspaApiTransactionOutput {
  transaction_id: string;
  index: number;
  amount: number;
  script_public_key: string;
  script_public_key_address: string;
  script_public_key_type: string;
  accepting_block_hash: string;
}
