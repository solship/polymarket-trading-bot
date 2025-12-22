# Polymarket Trading Bot

A lightweight **TypeScript/Node.js trading bot** for **Polymarket prediction markets**, supporting **copy trading** and **arbitrage strategies** with configurable risk controls.

---

## Features

* Core trading functionality (orders, positions, balances)
* Copy trading from selected high-performing traders
* Arbitrage detection across markets
* Environment-based configuration
* Built-in logging, retries, and graceful shutdown

---

## Requirements

* Node.js **18+**
* npm or yarn
* Polymarket API credentials
* Funded wallet address

---

## Installation

```bash
git clone https://github.com/michalstefanow/polymarket-trading-bot.git
cd polymarket-trading-bot
npm install
cp .env.example .env
```

Configure your `.env` file with API keys and settings.

---

## Configuration (Key Variables)

* `POLYMARKET_API_KEY`
* `POLYMARKET_PRIVATE_KEY`
* `ACCOUNT_ADDRESS`
* `COPY_TRADING_ENABLED`
* `ARBITRAGE_ENABLED`
* `TRADER_ADDRESSES`
* `MIN_CONFIDENCE`
* `MIN_PROFIT_MARGIN`
* `MAX_POSITION_SIZE`
* `LOG_LEVEL`

---

## Bot Modes

### Copy Trading

Automatically mirrors trades from specified traders when confidence and risk limits are met.

Key settings:

* `TRADER_ADDRESSES`
* `MIN_CONFIDENCE`
* `MAX_POSITION_SIZE`

### Arbitrage

Scans markets for price discrepancies and executes trades when profit thresholds are reached.

Key settings:

* `MIN_PROFIT_MARGIN`
* `ARBITRAGE_CHECK_INTERVAL`

---

## Project Structure

```
src/
├── bots/        # Trading strategies
├── services/    # Polymarket API client
├── config/      # Configuration loader
├── utils/       # Logger & helpers
└── index.ts     # Entry point
```

---

## Security Notes

* Never commit `.env` or private keys
* Use a dedicated wallet for automation
* Rotate API keys regularly

---

## Contact

* Telegram: [@mooneagle](https://t.me/mooneagle1_1)
* WhatsApp: +44 7832 607596

---

## Disclaimer

This project is for educational purposes only. Trading involves financial risk. Use at your own discretion.
