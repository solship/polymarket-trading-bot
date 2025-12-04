import { PolymarketAPI } from '../services/polymarket-api';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import {
  Market,
  Position,
  CreateOrderParams,
  OrderResponse,
  OrderBook,
} from '../types/polymarket';
import Big from 'big.js';

export abstract class BaseTradingBot {
  protected api: PolymarketAPI;
  protected accountAddress: string;
  protected positions: Map<string, Position>;
  protected isRunning: boolean;

  constructor(accountAddress: string) {
    this.api = new PolymarketAPI();
    this.accountAddress = accountAddress;
    this.positions = new Map();
    this.isRunning = false;
  }

  /**
   * Start the bot
   */
  abstract start(): Promise<void>;

  /**
   * Stop the bot
   */
  abstract stop(): Promise<void>;

  /**
   * Get current positions
   */
  async refreshPositions(): Promise<void> {
    try {
      const positions = await this.api.getPositions(this.accountAddress);
      this.positions.clear();
      positions.forEach((pos) => {
        const key = `${pos.market}-${pos.outcome}`;
        this.positions.set(key, pos);
      });
      logger.debug(`Refreshed ${positions.length} positions`);
    } catch (error) {
      logger.error('Failed to refresh positions:', error);
      throw error;
    }
  }

  /**
   * Get position for a specific market and outcome
   */
  getPosition(market: string, outcome: string): Position | undefined {
    const key = `${market}-${outcome}`;
    return this.positions.get(key);
  }

  /**
   * Place a buy order
   */
  async buy(
    market: string,
    outcome: 'yes' | 'no',
    price: string,
    size: string
  ): Promise<OrderResponse> {
    return this.placeOrder({
      market,
      outcome,
      side: 'buy',
      price,
      size,
    });
  }

  /**
   * Place a sell order
   */
  async sell(
    market: string,
    outcome: 'yes' | 'no',
    price: string,
    size: string
  ): Promise<OrderResponse> {
    return this.placeOrder({
      market,
      outcome,
      side: 'sell',
      price,
      size,
    });
  }

  /**
   * Place an order with validation
   */
  protected async placeOrder(params: CreateOrderParams): Promise<OrderResponse> {
    try {
      // Validate order size
      const size = new Big(params.size);
      if (size.lt(config.trading.minOrderSize)) {
        throw new Error(
          `Order size ${params.size} is below minimum ${config.trading.minOrderSize}`
        );
      }
      if (size.gt(config.trading.maxOrderSize)) {
        throw new Error(
          `Order size ${params.size} exceeds maximum ${config.trading.maxOrderSize}`
        );
      }

      // Validate price (should be between 0 and 1 for prediction markets)
      const price = new Big(params.price);
      if (price.lt(0) || price.gt(1)) {
        throw new Error(`Invalid price ${params.price}. Must be between 0 and 1`);
      }

      logger.info(`Placing ${params.side} order:`, {
        market: params.market,
        outcome: params.outcome,
        price: params.price,
        size: params.size,
      });

      const response = await this.api.createOrder(params);

      // Refresh positions after order
      await this.refreshPositions();

      return response;
    } catch (error) {
      logger.error('Failed to place order:', error);
      throw error;
    }
  }

  /**
   * Get best bid and ask prices from order book
   */
  async getBestPrices(
    market: string,
    outcome: 'yes' | 'no'
  ): Promise<{ bestBid: string; bestAsk: string } | null> {
    try {
      const orderBook = await this.api.getOrderBook(market, outcome);
      const bestBid =
        orderBook.bids.length > 0
          ? orderBook.bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))[0]
              .price
          : null;
      const bestAsk =
        orderBook.asks.length > 0
          ? orderBook.asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]
              .price
          : null;

      if (!bestBid || !bestAsk) {
        return null;
      }

      return { bestBid, bestAsk };
    } catch (error) {
      logger.error(`Failed to get best prices for ${market}:`, error);
      return null;
    }
  }

  /**
   * Calculate position size based on risk management
   */
  protected calculatePositionSize(
    accountBalance: string,
    riskPercent: number = 1
  ): string {
    const balance = new Big(accountBalance);
    const riskAmount = balance.mul(riskPercent / 100);
    return riskAmount.toString();
  }

  /**
   * Check if we can open a new position
   */
  protected canOpenPosition(): boolean {
    return this.positions.size < config.trading.maxPositions;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<string> {
    try {
      const account = await this.api.getAccount(this.accountAddress);
      return account.balance;
    } catch (error) {
      logger.error('Failed to get account balance:', error);
      throw error;
    }
  }
}

