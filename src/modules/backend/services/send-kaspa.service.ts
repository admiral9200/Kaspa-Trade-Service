import {Injectable} from "@nestjs/common";
import { RpcClient, Encoding , Resolver, PrivateKey } from "kaspa-wasm-dev";
import TransactionSender from "../../../../libs/kaspa-tools/src/TransactionSender";
import minimist from 'minimist';

@Injectable()
export class SendKaspaService {

}