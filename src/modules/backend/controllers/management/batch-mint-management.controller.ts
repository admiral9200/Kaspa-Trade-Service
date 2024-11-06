import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AllowedRoles, RolesGuard } from '../../guards/roles.guard';
import { UserRoleEnum } from '../../model/dtos/auth/auth-wallet-info';
import { BatchMintManagementProvider } from '../../providers/management/batch-mint-management.provider';

@Controller('batch-mint-management')
@UseGuards(RolesGuard)
@AllowedRoles(UserRoleEnum.SYS_ADMIN)
export class BatchMintManagementController {
  constructor(private readonly batchMintManagementProvider: BatchMintManagementProvider) {}

  @Post(':id/start-pod')
  async startBatchMint(@Param('id') id: string): Promise<any> {
    return await this.batchMintManagementProvider.startBatchMintPod(id);
  }
}
