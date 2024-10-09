import { ServiceTypeEnum } from '../core/enums/service-type.enum';

export const MONGO_DATABASE_CONNECTIONS = {
  P2P: 'p2p',
};

export const SERVICE_TYPE = (process.env.SERVICE_TYPE || ServiceTypeEnum.API).trim() as ServiceTypeEnum;
