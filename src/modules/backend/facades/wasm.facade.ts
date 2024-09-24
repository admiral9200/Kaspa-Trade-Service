import {Injectable} from "@nestjs/common";
import {SendKaspaService} from "../services/send-kaspa.service";

@Injectable()
export class WasmFacade {

    constructor(private readonly sendKaspaService: SendKaspaService) {
    }

    async createWalletAccount() { // todo what are the params
        return 'Placeholder';
    }
}