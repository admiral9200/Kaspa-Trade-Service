import { ServiceTypeEnum } from '../core/enums/service-type.enum';

export const MONGO_DATABASE_CONNECTIONS = {
  P2P: 'p2p',
};

export const SERVICE_TYPE: ServiceTypeEnum = (process.env.SERVICE_TYPE || ServiceTypeEnum.API).trim() as ServiceTypeEnum;

export const PAGINATION_LIMIT_DEFAULT = 10;
export const PAGINATION_LIMIT_MAX = 50;

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
    TRANSACTION_DB_UPDATE_FAILED: 20008,
    INVALID_USER_WALLET: 20009,
    INVALID_SENDER_WALLET_KASPA_AMOUNT: 20010,
  },
  BATCH_MINT: {
    INVALID_KASPA_AMOUNT: 30001,
    INVALID_BATCH_MINT_STATUS: 30002,
  },
};
