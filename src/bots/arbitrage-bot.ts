import { BaseTradingBot } from './base-trading-bot';
import { PolymarketAPI } from '../services/polymarket-api';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { Market, ArbitrageOpportunity, OrderBook } from '../types/polymarket';
import Big from 'big.js';

export class ArbitrageBot extends BaseTradingBot {
  private opportunityCheckInterval?: NodeJS.Timeout;
  private activeOpportunities: Map<string, ArbitrageOpportunity>;
  private markets: Market[];

  constructor(accountAddress: string) {
    super(accountAddress);
    this.activeOpportunities = new Map();
    this.markets = [];
  }

  /**
   * Start the arbitrage bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Arbitrage bot is already running');
      return;
    }

    logger.info('Starting arbitrage bot...');
    this.isRunning = true;

    // Load markets
    await this.loadMarkets();

    // Start checking for opportunities
    this.opportunityCheckInterval = setInterval(
      () => this.scanForOpportunities(),
      config.arbitrage.checkInterval
    );

    logger.info('Arbitrage bot started');
  }

  /**
   * Stop the arbitrage bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping arbitrage bot...');
    this.isRunning = false;

    if (this.opportunityCheckInterval) {
      clearInterval(this.opportunityCheckInterval);
      this.opportunityCheckInterval = undefined;
    }

    logger.info('Arbitrage bot stopped');
  }

  /**
   * Load active markets
   */
  private async loadMarkets(): Promise<void> {
    try {
      this.markets = await this.api.getMarkets();
      this.markets = this.markets.filter((m) => m.active);
      logger.info(`Loaded ${this.markets.length} active markets`);
    } catch (error) {
      logger.error('Failed to load markets:', error);
      throw error;
    }
  }

  /**
   * Scan for arbitrage opportunities
   */
  private async scanForOpportunities(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Refresh markets periodically
      if (Math.random() < 0.1) {
        // 10% chance to refresh markets
        await this.loadMarkets();
      }

      // Check each market for arbitrage opportunities
      for (const market of this.markets.slice(0, 50)) {
        // Limit to first 50 markets to avoid too many API calls
        try {
          await this.checkMarketOpportunities(market);
        } catch (error) {
          logger.debug(`Error checking market ${market.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error scanning for opportunities:', error);
    }
  }

  /**
   * Check a specific market for arbitrage opportunities
   */
  private async checkMarketOpportunities(market: Market): Promise<void> {
    try {
      // Check both outcomes (yes and no)
      const yesOpportunity = await this.findArbitrageOpportunity(market.id, 'yes');
      const noOpportunity = await this.findArbitrageOpportunity(market.id, 'no');

      if (yesOpportunity) {
        await this.executeArbitrage(yesOpportunity);
      }

      if (noOpportunity) {
        await this.executeArbitrage(noOpportunity);
      }
    } catch (error) {
      logger.debug(`Error checking opportunities for market ${market.id}:`, error);
    }
  }

  /**
   * Find arbitrage opportunity in a market outcome
   */
  private async findArbitrageOpportunity(
    marketId: string,
    outcome: 'yes' | 'no'
  ): Promise<ArbitrageOpportunity | null> {
    try {
      const orderBook = await this.api.getOrderBook(marketId, outcome);

      if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
        return null;
      }

      // Get best bid and ask
      const bestBid = orderBook.bids.sort(
        (a, b) => parseFloat(b.price) - parseFloat(a.price)
      )[0];
      const bestAsk = orderBook.asks.sort(
        (a, b) => parseFloat(a.price) - parseFloat(b.price)
      )[0];

      const bidPrice = new Big(bestBid.price);
      const askPrice = new Big(bestAsk.price);

      // Check if there's an arbitrage opportunity (bid > ask)
      if (bidPrice.gt(askPrice)) {
        const profitMargin = bidPrice.minus(askPrice).div(askPrice).toNumber();

        if (profitMargin >= config.arbitrage.minProfitMargin) {
          // Calculate the size we can trade (min of bid and ask sizes)
          const bidSize = new Big(bestBid.size);
          const askSize = new Big(bestAsk.size);
          const maxSize = Big.min(bidSize, askSize);
          const maxPositionSize = new Big(config.arbitrage.maxPositionSize);
          const tradeSize = Big.min(maxSize, maxPositionSize).toString();

          const opportunity: ArbitrageOpportunity = {
            market: marketId,
            outcome,
            buyPrice: askPrice.toString(),
            sellPrice: bidPrice.toString(),
            profitMargin,
            buyOrder: bestAsk,
            sellOrder: bestBid,
          };

          logger.info(`Found arbitrage opportunity:`, {
            market: marketId,
            outcome,
            buyPrice: opportunity.buyPrice,
            sellPrice: opportunity.sellPrice,
            profitMargin: `${(profitMargin * 100).toFixed(2)}%`,
            size: tradeSize,
          });

          return opportunity;
        }
      }

      return null;
    } catch (error) {
      logger.debug(`Error finding arbitrage opportunity:`, error);
      return null;
    }
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      // Check if we already have an active opportunity for this market/outcome
      const key = `${opportunity.market}-${opportunity.outcome}`;
      if (this.activeOpportunities.has(key)) {
        logger.debug(`Already executing arbitrage for ${key}`);
        return;
      }

      // Check if we can open a position
      if (!this.canOpenPosition()) {
        logger.warn('Cannot execute arbitrage: max positions reached');
        return;
      }

      // Calculate trade size
      const buySize = new Big(opportunity.buyOrder.size);
      const sellSize = new Big(opportunity.sellOrder.size);
      const maxSize = Big.min(buySize, sellSize);
      const maxPositionSize = new Big(config.arbitrage.maxPositionSize);
      const tradeSize = Big.min(maxSize, maxPositionSize).toString();

      logger.info(`Executing arbitrage:`, {
        market: opportunity.market,
        outcome: opportunity.outcome,
        buyPrice: opportunity.buyPrice,
        sellPrice: opportunity.sellPrice,
        size: tradeSize,
        profitMargin: `${(opportunity.profitMargin * 100).toFixed(2)}%`,
      });

      // Mark opportunity as active
      this.activeOpportunities.set(key, opportunity);

      // Execute both legs simultaneously
      // Buy at the ask price
      const buyOrder = await this.buy(
        opportunity.market,
        opportunity.outcome,
        opportunity.buyPrice,
        tradeSize
      );

      // Sell at the bid price
      const sellOrder = await this.sell(
        opportunity.market,
        opportunity.outcome,
        opportunity.sellPrice,
        tradeSize
      );

      logger.info(`Arbitrage executed successfully:`, {
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        expectedProfit: new Big(opportunity.sellPrice)
          .minus(opportunity.buyPrice)
          .times(tradeSize)
          .toString(),
      });

      // Remove from active opportunities
      this.activeOpportunities.delete(key);
    } catch (error) {
      logger.error('Failed to execute arbitrage:', error);
      const key = `${opportunity.market}-${opportunity.outcome}`;
      this.activeOpportunities.delete(key);
    }
  }

  /**
   * Get current arbitrage opportunities
   */
  getActiveOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.activeOpportunities.values());
  }
}

