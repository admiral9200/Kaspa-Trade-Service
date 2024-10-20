import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KaspianoBackendApiService {
  constructor(protected httpService: HttpService) {}

  public async sendMailAfterSwap(orderId: string) {
    return await firstValueFrom(
      this.httpService.post('/sendEmail/email-order-completed', {
        orderId,
      }),
    );
  }
}
