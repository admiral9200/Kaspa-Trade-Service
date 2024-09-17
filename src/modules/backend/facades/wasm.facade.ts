import { Injectable } from '@nestjs/common';
import { Krc20ActionsService } from '../services/krc20/krc20-actions.service';

@Injectable()
export class WasmFacade {
  constructor(private readonly krc20actionsService: Krc20ActionsService) {}
}
