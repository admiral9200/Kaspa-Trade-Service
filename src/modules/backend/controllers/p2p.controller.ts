import {Body, Controller, Get, Param, Post} from '@nestjs/common';
import {P2pProvider} from '../providers/p2p.provider';
import {SellRequestDto} from "../model/dtos/sell-request.dto";
import {SellRequestResponseDto} from "../model/dtos/responses/sell-request.response.dto";
import {ConfirmSellOrderRequestResponseDto} from "../model/dtos/responses/confirm-sell-order-request.response.dto";
import {BuyRequestResponseDto} from "../model/dtos/responses/buy-request.response.dto";
import {ConfirmBuyOrderRequestResponseDto} from "../model/dtos/responses/confirm-buy-order-request.response.dto";
import {SellOrderResponseDto} from "../model/dtos/responses/sell-order.response.dto";
import {BuyRequestDto} from "../model/dtos/buy-request.dto";

@Controller('p2p')
export class P2pController {
    constructor(private readonly p2pProvider: P2pProvider) {
    }

    @Get('getSellOrders')
    async getSellOrders(): Promise<SellOrderResponseDto[]> {
        try {
            return await this.p2pProvider.listSellOrders();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Starts the selling flow
     * @param sellRequestDto  The Sell information
     */
    @Post('sell')
    async sellToken(@Body() sellRequestDto: SellRequestDto): Promise<SellRequestResponseDto> {
        try {
            return await this.p2pProvider.createSellOrder(sellRequestDto);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Validates that the seller has sent the tokens to the temporary wallet
     * @param sellOrderId The order ID of the sell order
     */
    @Get('confirmSellOrder/:sellOrderId')
    async confirmSellOrder(@Param('sellOrderId') sellOrderId: string): Promise<ConfirmSellOrderRequestResponseDto> {
        try {
            return await this.p2pProvider.confirmAndValidateSellOrderListing(sellOrderId);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Starts the buying flow
     * @param sellOrderId The order ID of the sell order
     * @param body
     */
    @Post('buy/:sellOrderId')
    async buyToken(@Param('sellOrderId') sellOrderId: string, @Body() body: BuyRequestDto): Promise<BuyRequestResponseDto> {
        try {
            return await this.p2pProvider.buy(sellOrderId, body);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Confirms that the buyer has sent the payment to the seller
     * @param sellOrderId The order ID of the sell order
     */
    @Post('confirmBuyOrder/:sellOrderId')
    async confirmBuy(@Param('sellOrderId') sellOrderId: string): Promise<ConfirmBuyOrderRequestResponseDto> {
        try {
            return await this.p2pProvider.confirmBuy(sellOrderId);
        } catch (error) {
            throw error;
        }
    }
}
