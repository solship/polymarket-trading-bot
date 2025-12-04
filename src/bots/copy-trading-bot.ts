import { BaseTradingBot } from './base-trading-bot';
import { PolymarketAPI } from '../services/polymarket-api';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { Trade, Position } from '../types/polymarket';
import Big from 'big.js';

interface TraderActivity {
  address: string;
  recentTrades: Trade[];
  winRate: number;
  totalTrades: number;
  lastTradeTime: number;
}

export class CopyTradingBot extends BaseTradingBot {
  private traderActivities: Map<string, TraderActivity>;
  private tradeCheckInterval?: NodeJS.Timeout;
  private followedTraders: Set<string>;

  constructor(accountAddress: string) {
    super(accountAddress);
    this.traderActivities = new Map();
    this.followedTraders = new Set(config.copyTrading.traderAddresses);
  }

  /**
   * Start the copy trading bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Copy trading bot is already running');
      return;
    }

    logger.info('Starting copy trading bot...');
    this.isRunning = true;

    // Initialize trader activities
    await this.initializeTraderActivities();

    // Start monitoring trades
    this.tradeCheckInterval = setInterval(
      () => this.monitorTrades(),
      config.copyTrading.followDelay
    );

    logger.info('Copy trading bot started');
  }

  /**
   * Stop the copy trading bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping copy trading bot...');
    this.isRunning = false;

    if (this.tradeCheckInterval) {
      clearInterval(this.tradeCheckInterval);
      this.tradeCheckInterval = undefined;
    }

    logger.info('Copy trading bot stopped');
  }

  /**
   * Initialize trader activities by fetching their recent trades
   */
  private async initializeTraderActivities(): Promise<void> {
    for (const traderAddress of this.followedTraders) {
      try {
        const positions = await this.api.getPositions(traderAddress);
        const recentTrades = await this.getRecentTradesForTrader(traderAddress);

        const activity: TraderActivity = {
          address: traderAddress,
          recentTrades,
          winRate: this.calculateWinRate(traderAddress, recentTrades),
          totalTrades: recentTrades.length,
          lastTradeTime: recentTrades.length > 0 ? recentTrades[0].timestamp : 0,
        };

        this.traderActivities.set(traderAddress, activity);
        logger.info(`Initialized activity for trader ${traderAddress}:`, {
          winRate: activity.winRate,
          totalTrades: activity.totalTrades,
        });
      } catch (error) {
        logger.error(`Failed to initialize activity for trader ${traderAddress}:`, error);
      }
    }
  }

  /**
   * Monitor trades from followed traders
   */
  private async monitorTrades(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      for (const traderAddress of this.followedTraders) {
        await this.checkTraderTrades(traderAddress);
      }
    } catch (error) {
      logger.error('Error monitoring trades:', error);
    }
  }

  /**
   * Check for new trades from a specific trader
   */
  private async checkTraderTrades(traderAddress: string): Promise<void> {
    try {
      const activity = this.traderActivities.get(traderAddress);
      if (!activity) {
        return;
      }

      const recentTrades = await this.getRecentTradesForTrader(traderAddress);

      // Find new trades
      const newTrades = recentTrades.filter(
        (trade) =>
          trade.timestamp > activity.lastTradeTime &&
          (trade.maker === traderAddress || trade.taker === traderAddress)
      );

      if (newTrades.length === 0) {
        return;
      }

      logger.info(`Found ${newTrades.length} new trades from trader ${traderAddress}`);

      // Process each new trade
      for (const trade of newTrades) {
        await this.processTraderTrade(traderAddress, trade);
      }

      // Update activity
      activity.recentTrades = recentTrades;
      activity.lastTradeTime = Math.max(
        ...recentTrades.map((t) => t.timestamp),
        activity.lastTradeTime
      );
      activity.winRate = this.calculateWinRate(traderAddress, recentTrades);
      activity.totalTrades = recentTrades.length;
    } catch (error) {
      logger.error(`Error checking trades for trader ${traderAddress}:`, error);
    }
  }

  /**
   * Process a trade from a followed trader and potentially copy it
   */
  private async processTraderTrade(
    traderAddress: string,
    trade: Trade
  ): Promise<void> {
    try {
      const activity = this.traderActivities.get(traderAddress);
      if (!activity) {
        return;
      }

      // Check if trader meets confidence threshold
      if (activity.winRate < config.copyTrading.minConfidence) {
        logger.debug(
          `Skipping trade from ${traderAddress}: win rate ${activity.winRate} below threshold`
        );
        return;
      }

      // Determine if trader is buying or selling
      const isTraderBuying = trade.taker === traderAddress && trade.side === 'buy';
      const isTraderSelling = trade.taker === traderAddress && trade.side === 'sell';

      if (!isTraderBuying && !isTraderSelling) {
        return; // Trader was the maker, not the taker
      }

      // Check if we can open a new position
      if (!this.canOpenPosition()) {
        logger.warn('Cannot open new position: max positions reached');
        return;
      }

      // Determine our action (copy the trade)
      const side = isTraderBuying ? 'buy' : 'sell';
      const outcome = trade.outcome as 'yes' | 'no';

      // Calculate position size (scaled down from trader's size)
      const traderSize = new Big(trade.size);
      const maxSize = new Big(config.copyTrading.maxPositionSize);
      const ourSize = Big.min(traderSize, maxSize).toString();

      // Use the trade price or slightly better
      const price = new Big(trade.price);
      const slippage = new Big(config.trading.defaultSlippage);
      const ourPrice =
        side === 'buy'
          ? price.plus(slippage).toString()
          : price.minus(slippage).toString();

      logger.info(`Copying trade from ${traderAddress}:`, {
        market: trade.market,
        outcome,
        side,
        price: ourPrice,
        size: ourSize,
        traderWinRate: activity.winRate,
      });

      // Place the order
      await this.placeOrder({
        market: trade.market,
        outcome,
        side,
        price: ourPrice,
        size: ourSize,
      });

      logger.info(`Successfully copied trade from ${traderAddress}`);
    } catch (error) {
      logger.error(`Failed to process trader trade:`, error);
    }
  }

  /**
   * Get recent trades for a trader
   */
  private async getRecentTradesForTrader(traderAddress: string): Promise<Trade[]> {
    try {
      // Get all markets and check trades
      const markets = await this.api.getMarkets();
      const allTrades: Trade[] = [];

      // Check trades in active markets (limit to avoid too many API calls)
      const activeMarkets = markets.filter((m) => m.active).slice(0, 20);

      for (const market of activeMarkets) {
        try {
          const trades = await this.api.getTrades(market.id, 100);
          const traderTrades = trades.filter(
            (trade) => trade.maker === traderAddress || trade.taker === traderAddress
          );
          allTrades.push(...traderTrades);
        } catch (error) {
          // Continue if one market fails
          logger.debug(`Failed to get trades for market ${market.id}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      return allTrades.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error(`Failed to get trades for trader ${traderAddress}:`, error);
      return [];
    }
  }

  /**
   * Calculate win rate for a trader (simplified - based on profitable positions)
   */
  private calculateWinRate(traderAddress: string, trades: Trade[]): number {
    if (trades.length === 0) {
      return 0;
    }

    // This is a simplified calculation
    // In a real implementation, you'd track closed positions and their P&L
    // For now, we'll use a heuristic based on trade frequency and recency
    const recentTrades = trades.filter(
      (t) => Date.now() - t.timestamp < 7 * 24 * 60 * 60 * 1000
    ); // Last 7 days

    if (recentTrades.length === 0) {
      return 0.5; // Default to neutral if no recent trades
    }

    // Simple heuristic: more recent trades = higher confidence
    // In production, you'd want to track actual P&L
    return Math.min(0.95, 0.5 + recentTrades.length / 100);
  }

  /**
   * Add a trader to follow
   */
  addTrader(address: string): void {
    this.followedTraders.add(address);
    logger.info(`Added trader ${address} to follow list`);
  }

  /**
   * Remove a trader from follow list
   */
  removeTrader(address: string): void {
    this.followedTraders.delete(address);
    this.traderActivities.delete(address);
    logger.info(`Removed trader ${address} from follow list`);
  }

  /**
   * Get list of followed traders
   */
  getFollowedTraders(): string[] {
    return Array.from(this.followedTraders);
  }
}

