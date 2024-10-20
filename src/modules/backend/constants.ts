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
  KASPA: {
    HIGH_PRIORITY_FEE: 10001,
  },
  LUNCHPAD: {
    NOT_ENOUGH_KRC20_TOKENS: 20001,
    INVALID_LUNCHPAD_STATUS: 20002,
    INVALID_LUNCHPAD_ORDER_STATUS: 20003,
    INVALID_ORDER_UNITS: 20004,
    LUNCHPAD_UNITS_EXCEEDS: 20005,
    INVALID_ORDER_STATUS: 20006,
    TRANSACTION_VERIFICATION_FAILED: 20007,
  },
};
