import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrdersManagementProvider } from '../providers/orders-management.provider';
import { OrdersManagementUpdateSellOrderDto } from '../model/dtos/p2p-orders/orders-management-update-sell-order.dto';
import { AllowedRoles, RolesGuard } from '../guards/roles.guard';
import { UserRoleEnum } from '../model/dtos/auth/auth-wallet-info';

@Controller('orders-management')
@UseGuards(RolesGuard)
@AllowedRoles(UserRoleEnum.SYS_ADMIN)
export class OrdersManagementController {
  constructor(private readonly ordersManagementProvider: OrdersManagementProvider) {}

  @Post('generate-master-wallet')
  async generateMasterWallet() {
    return await this.ordersManagementProvider.generateMasterWallet();
  }

  @Get('order/:id')
  async getOrderById(@Param('id') id: string) {
    return JSON.parse(
      
      JSON.stringify(await this.ordersManagementProvider.getOrderData(id), (key, value) =>
        typeof value === 'bigint' ? Number(value) : value,
      ),
    );
  }

  @Post('order/:id')
  async updateOrder(@Param('id') id: string, @Body() body: OrdersManagementUpdateSellOrderDto) {
    return await this.ordersManagementProvider.updateOrder(id, body);
  }

  @Post('order/:id/private')
  async getPrivateKey(@Param('id') id: string, @Body('password') password: string) {
    return await this.ordersManagementProvider.getPrivateKey(
      id,
      password,
      'kaspatest:qpdzgy8gvav58tgjwlxr7sj8fd6888r8l93tvqnkkwk3mhy8phgd5uq3yrpc2',
    );
  }
}
