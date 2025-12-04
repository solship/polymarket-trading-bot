import { logger } from './utils/logger';
import { config } from './config/config';
import { CopyTradingBot } from './bots/copy-trading-bot';
import { ArbitrageBot } from './bots/arbitrage-bot';

// Get account address from environment or use default
const accountAddress = process.env.ACCOUNT_ADDRESS || '';

if (!accountAddress) {
  logger.error('ACCOUNT_ADDRESS environment variable is required');
  process.exit(1);
}

// Initialize bots
const copyTradingBot = config.copyTrading.enabled
  ? new CopyTradingBot(accountAddress)
  : null;

const arbitrageBot = config.arbitrage.enabled
  ? new ArbitrageBot(accountAddress)
  : null;

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    if (copyTradingBot) {
      await copyTradingBot.stop();
    }
    if (arbitrageBot) {
      await arbitrageBot.stop();
    }
    logger.info('All bots stopped successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Main function
async function main() {
  logger.info('Starting Polymarket Trading Bot...');
  logger.info('Configuration:', {
    copyTradingEnabled: config.copyTrading.enabled,
    arbitrageEnabled: config.arbitrage.enabled,
    accountAddress,
  });

  try {
    // Start copy trading bot if enabled
    if (copyTradingBot) {
      await copyTradingBot.start();
      logger.info('Copy trading bot started');
    } else {
      logger.info('Copy trading bot is disabled');
    }

    // Start arbitrage bot if enabled
    if (arbitrageBot) {
      await arbitrageBot.start();
      logger.info('Arbitrage bot started');
    } else {
      logger.info('Arbitrage bot is disabled');
    }

    if (!copyTradingBot && !arbitrageBot) {
      logger.warn('No bots are enabled. Please enable at least one bot in configuration.');
      process.exit(1);
    }

    logger.info('All enabled bots are running');
  } catch (error) {
    logger.error('Failed to start bots:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

