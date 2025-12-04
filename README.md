# Polymarket Trading Bot

A comprehensive TypeScript/Node.js trading bot for Polymarket prediction markets with copy trading and arbitrage capabilities.

## Contact

If you have any qestions or feedback for dev, you can contact to dev via whatsApp (+44 7832607596) or telegram - [mooneagle](https://t.me/mooneagle1_1)

## Features

- **Base Trading Bot**: Core functionality for placing orders, managing positions, and interacting with Polymarket
- **Copy Trading Bot**: Automatically follows and replicates trades from successful traders
- **Arbitrage Bot**: Detects and exploits price differences across markets for risk-free profit

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Polymarket API credentials
- Wallet address with funds

## Installation

1. Clone the repository:
```bash
git clone https://github.com/michalstefanow/polymarket-trading-bot.git
cd polymarket-trading-bot
```

2. Install dependencies:
```bash
npm install
```

3. Copy the example environment file:
```bash
cp .env.example .env
```

4. Configure your `.env` file with your Polymarket API credentials and settings.

## Configuration

Edit the `.env` file with your settings:

- `POLYMARKET_API_KEY`: Your Polymarket API key
- `POLYMARKET_PRIVATE_KEY`: Your private key for signing transactions
- `ACCOUNT_ADDRESS`: Your wallet address
- `COPY_TRADING_ENABLED`: Enable/disable copy trading bot
- `ARBITRAGE_ENABLED`: Enable/disable arbitrage bot
- `TRADER_ADDRESSES`: Comma-separated list of trader addresses to follow (for copy trading)
- `MIN_CONFIDENCE`: Minimum win rate threshold for copying trades (0-1)
- `MIN_PROFIT_MARGIN`: Minimum profit margin for arbitrage opportunities (as decimal, e.g., 0.02 = 2%)

## Bot Types

### Copy Trading Bot

The copy trading bot monitors specified traders and automatically replicates their trades when:
- The trader's win rate meets the confidence threshold
- The trade is within configured size limits
- Maximum position limits haven't been reached

**Configuration:**
- `TRADER_ADDRESSES`: List of trader addresses to follow
- `MIN_CONFIDENCE`: Minimum win rate (0-1) to copy trades
- `MAX_POSITION_SIZE`: Maximum size for copied positions
- `FOLLOW_DELAY`: Delay between trade checks (milliseconds)

### Arbitrage Bot

The arbitrage bot continuously scans markets for price discrepancies where you can:
- Buy at a lower price and immediately sell at a higher price
- Profit from the price difference with minimal risk

**Configuration:**
- `MIN_PROFIT_MARGIN`: Minimum profit margin required (as decimal)
- `MAX_POSITION_SIZE`: Maximum position size for arbitrage trades
- `ARBITRAGE_CHECK_INTERVAL`: How often to scan for opportunities (milliseconds)

## Project Structure

```
polymarket-trading-bot/
├── src/
│   ├── bots/
│   │   ├── base-trading-bot.ts      # Base class for all bots
│   │   ├── copy-trading-bot.ts       # Copy trading implementation
│   │   └── arbitrage-bot.ts          # Arbitrage implementation
│   ├── services/
│   │   └── polymarket-api.ts         # Polymarket API client
│   ├── config/
│   │   └── config.ts                 # Configuration management
│   ├── types/
│   │   └── polymarket.ts             # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts                 # Logging utility
│   └── index.ts                      # Main entry point
├── .env.example                      # Example environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

The bot uses the Polymarket CLOB (Central Limit Order Book) API. Key endpoints:

- `GET /markets` - Get all markets
- `GET /markets/:id/orderbook` - Get order book for a market
- `GET /markets/:id/trades` - Get recent trades
- `GET /accounts/:address` - Get account information
- `GET /accounts/:address/positions` - Get positions
- `POST /orders` - Create a new order
- `DELETE /orders/:id` - Cancel an order

## Risk Management

The bot includes several risk management features:

- **Position Limits**: Maximum number of concurrent positions
- **Size Limits**: Minimum and maximum order sizes
- **Slippage Protection**: Default slippage tolerance for orders
- **Confidence Thresholds**: Copy trading only follows traders above a certain win rate

## Logging

Logs are output to the console and optionally to a file. Log levels:
- `error`: Errors that need attention
- `warn`: Warnings about potential issues
- `info`: General information about bot operations
- `debug`: Detailed debugging information

Set the log level in your `.env` file with `LOG_LEVEL`.

## Error Handling

The bot includes comprehensive error handling:
- API request failures are logged and retried where appropriate
- Invalid orders are rejected with clear error messages
- WebSocket connections automatically reconnect on failure
- Graceful shutdown on SIGINT/SIGTERM signals

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys and private keys secure
- Use environment variables for sensitive configuration
- Regularly rotate your API credentials

