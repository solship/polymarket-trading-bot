import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  polymarket: {
    apiUrl: string;
    wsUrl: string;
    apiKey?: string;
    privateKey?: string;
  };
  trading: {
    minOrderSize: number;
    maxOrderSize: number;
    defaultSlippage: number;
    maxPositions: number;
  };
  copyTrading: {
    enabled: boolean;
    traderAddresses: string[];
    minConfidence: number;
    maxPositionSize: number;
    followDelay: number; // milliseconds
  };
  arbitrage: {
    enabled: boolean;
    minProfitMargin: number; // percentage
    maxPositionSize: number;
    checkInterval: number; // milliseconds
  };
  logging: {
    level: string;
    file?: string;
  };
}

export const config: Config = {
  polymarket: {
    apiUrl: process.env.POLYMARKET_API_URL || 'https://clob.polymarket.com',
    wsUrl: process.env.POLYMARKET_WS_URL || 'wss://clob.polymarket.com',
    apiKey: process.env.POLYMARKET_API_KEY,
    privateKey: process.env.POLYMARKET_PRIVATE_KEY,
  },
  trading: {
    minOrderSize: parseFloat(process.env.MIN_ORDER_SIZE || '0.01'),
    maxOrderSize: parseFloat(process.env.MAX_ORDER_SIZE || '1000'),
    defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || '0.01'),
    maxPositions: parseInt(process.env.MAX_POSITIONS || '10', 10),
  },
  copyTrading: {
    enabled: process.env.COPY_TRADING_ENABLED === 'true',
    traderAddresses: process.env.TRADER_ADDRESSES?.split(',') || [],
    minConfidence: parseFloat(process.env.MIN_CONFIDENCE || '0.6'),
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '100'),
    followDelay: parseInt(process.env.FOLLOW_DELAY || '1000', 10),
  },
  arbitrage: {
    enabled: process.env.ARBITRAGE_ENABLED === 'true',
    minProfitMargin: parseFloat(process.env.MIN_PROFIT_MARGIN || '0.02'),
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '500'),
    checkInterval: parseInt(process.env.ARBITRAGE_CHECK_INTERVAL || '5000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE,
  },
};

