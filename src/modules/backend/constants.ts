import { ServiceTypeEnum } from '../core/enums/service-type.enum';

export const MONGO_DATABASE_CONNECTIONS = {
  P2P: 'p2p',
};

export const SERVICE_TYPE = (process.env.SERVICE_TYPE || ServiceTypeEnum.API).trim() as ServiceTypeEnum;

export const ERROR_CODES = {
  GENERAL: {
    UNKNOWN_ERROR: -1,
    NOT_FOUND: 404,
  },
  LUNCHPAD: {
    NOT_ENOUGH_KRC20_TOKENS: 10001,
    INVALID_LUNCHPAD_STATUS: 10002,
    INVALID_LUNCHPAD_ORDER_STATUS: 10003,
    INVALID_ORDER_UNITS: 10004,
    LUNCHPAD_UNITS_EXCEEDS: 10005,
    INVALID_ORDER_STATUS: 10006,
  },
};
