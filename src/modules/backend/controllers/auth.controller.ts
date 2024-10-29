import { Body, Controller, Post } from '@nestjs/common';
import { VerifySignedMessageRequestDto } from '../model/dtos/auth/verify-signed-message-request.dto';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';

@Controller('auth')
export class AuthController {
  constructor(protected readonly kaspaNetworkActionsService: KaspaNetworkActionsService) {}

  @Post('verify-signature')
  async verifySignatureAndRetreiveWallet(@Body() body: VerifySignedMessageRequestDto) {
    const wallet = await this.kaspaNetworkActionsService.veryfySignedMessageAndGetWalletAddress(
      body.message,
      body.signature,
      body.publicKey,
    );

    return { success: !!wallet, wallet };
  }
}
