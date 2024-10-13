import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { LunchpadService } from '../services/lunchpad.service';
import { CreateLunchpadRequestDto, CreateLunchpadResponseDto } from '../model/dtos/lunchpad/create-lunchpad.dto';

@Injectable()
export class LunchpadProvider {
  constructor(
    private readonly lunchpadService: LunchpadService,
    private readonly kaspaFacade: KaspaFacade,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly logger: AppLogger,
  ) {}

  async createLunchpad(
    createLunchpadDto: CreateLunchpadRequestDto,
    ownerWalletAddress: string,
  ): Promise<CreateLunchpadResponseDto> {
    const walletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();

    const lunchpad = await this.lunchpadService.createLunchpad(createLunchpadDto, ownerWalletAddress, walletSequenceId);

    if (!lunchpad) {
      throw new Error('Lunchpad not created');
    }

    const walletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.walletSequenceId);

    return {
      lunchpad,
      walletAddress,
    };
  }
}
