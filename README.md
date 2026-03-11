# Polymarket–Kalshi Endside Trading Bot

TypeScript application that monitors **Bitcoin 15-minute up/down** markets on [Kalshi](https://kalshi.com) and [Polymarket](https://polymarket.com), and runs a **Kalshi‑1.00 → Polymarket** strategy: when Kalshi’s same-side (UP or DOWN) reaches 1.00, it buys the same side on Polymarket and exits when Polymarket price falls below a threshold. Supports optional auto-redemption of resolved Polymarket positions (including via Gnosis Safe).

---

## Overview

| Component | Description |
|-----------|-------------|
| **Dual price monitor** | Polls Kalshi and Polymarket for the current 15m BTC up/down slot; logs best ask for UP/DOWN. Can auto-restart at quarter-hour boundaries. |
| **Kalshi 1 → Poly strategy** | **Entry:** When Kalshi same-side ≥ 1.00 and Polymarket same-side ≥ `POLY_BUY_MIN`, place a limit buy on Polymarket (one position per market). **Exit:** When Polymarket same-side &lt; `POLY_SELL_BELOW` (with optional buffer when Kalshi = 1.00). |
| **Auto-redeem** | Optional script that periodically checks `data/token-holding.json`, redeems resolved Polymarket positions (EOA or Safe), and clears holdings. |
| **Single-instance lock** | Only one monitor process may run; lock file: `logs/monitor.lock`. |

---

## Setup

```bash
cp .env.use .env
# Edit .env: set KALSHI_API_KEY and KALSHI_PRIVATE_KEY_PEM (or KALSHI_PRIVATE_KEY_PATH)
# For Polymarket trading: set POLYMARKET_PRIVATE_KEY and POLYMARKET_PROXY
npm install
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run endside` | **Main entry.** Starts the dual price monitor and runs the Kalshi 1 → Poly strategy on every tick. Validates env, acquires monitor lock, checks balances, then polls Kalshi + Polymarket and executes buy/sell logic. |
| `npm run auto-redeem` | Runs the auto-redeem service: every 120s checks holdings, redeems resolved markets (via EOA or Safe), clears redeemed/losing positions. |
| `npm run build` | Compiles TypeScript to `dist/`. |

---

## Environment

### Kalshi (required for monitor)

| Variable | Description |
|----------|-------------|
| `KALSHI_API_KEY` | Kalshi API key id. |
| `KALSHI_PRIVATE_KEY_PATH` | Path to RSA private key `.pem` file. |
| `KALSHI_PRIVATE_KEY_PEM` | Alternatively, the PEM string (e.g. from a secret manager). |
| `KALSHI_DEMO` | Set to `true` to use the demo API. |
| `KALSHI_BASE_PATH` | Optional override for API base URL. |

### Polymarket (required for placing/redeeming)

| Variable | Description |
|----------|-------------|
| `POLYMARKET_PRIVATE_KEY` | EOA private key (with or without `0x`). |
| `POLYMARKET_PROXY` | Gnosis Safe (proxy) address for trading/redeem when using Safe. |
| `POLYMARKET_CLOB_URL` | CLOB API base (default: `https://clob.polymarket.com`). |
| `POLYMARKET_CHAIN_ID` | Chain id (default: 137). |
| `POLYMARKET_TICK_SIZE` | `0.01` \| `0.001` \| `0.0001` (default: `0.01`). |
| `POLYMARKET_NEG_RISK` | Set to `true` for neg-risk markets. |
| `POLYMARKET_CREDENTIAL_PATH` | Optional path to JSON with `key`, `secret`, `passphrase` (skips `createOrDeriveApiKey` per run). |
| `RPC_URL` | Polygon RPC URL for redeem (on-chain CTF). |

### Strategy (Kalshi 1 → Poly)

| Variable | Description |
|----------|-------------|
| `POLY_BUY_MIN` | Min Polymarket same-side price to enter (default: `0.8`). |
| `POLY_SELL_BELOW` | Sell when Polymarket same-side &lt; this (default: `0.7`). |
| `POLY_SELL_RANGE_BUFFER` | When Kalshi same-side = 1.00, effective sell threshold = `POLY_SELL_BELOW - POLY_SELL_RANGE_BUFFER` (default: `0.15`). |
| `KALSHI_1_POLY_SIZE` | Default Polymarket buy size in shares (default: `5`). |
| `KALSHI_1_POLY_DRY_RUN` | Set to `true` to log only, no orders. |
| `MIN_BALANCE_USD` | Min balance (USD) on Kalshi and Polymarket to run monitor (default: `5`). |

### Monitor

| Variable | Description |
|----------|-------------|
| `KALSHI_MONITOR_INTERVAL_MS` | Poll interval in ms (default: `100`). |
| `KALSHI_MONITOR_TICKER` | Fixed Kalshi ticker; if unset, uses first open KXBTC15M market and can restart at :00/:15/:30/:45. |
| `KALSHI_MONITOR_NO_RESTART` | Set to `true` to disable process restart on quarter-hour. |

---

## Project structure

| Path | Purpose |
|------|---------|
| `src/monitor/run-kalshi-1-poly.ts` | Entry: env validation, lock, balances, dual monitor, strategy on each tick. |
| `src/monitor/dual-monitor.ts` | Dual price monitor: `startDualPriceMonitor`, `formatDualPricesLine`, `DualMarketPrices`. |
| `src/monitor/kalshi-1-poly-strategy.ts` | Strategy: Method 1 entry (Kalshi 1.00 + Poly ≥ polyBuyMin), exit (Poly &lt; threshold), one cycle per market. |
| `src/kalshi/bot.ts` | Kalshi: `placeOrder`, `placeSellOrder`, `getBitcoinUpDownMarkets`, `getKalshiBalanceCents`, `warmKalshiOrdersApi`. |
| `src/polymarket/order.ts` | Polymarket: `placePolymarketOrder`, `sellPolymarketOrder`, `getPolymarketBalanceUsd`, `warmPolymarketClient`. |
| `src/polymarket/prices.ts` | Polymarket: Gamma slug → token IDs, CLOB best ask; `getPolymarketAskPrices`, `primePolymarketTokenCacheForCurrentSlot`. |
| `src/polymarket/redeem.ts` | Redeem resolved positions (CTF); supports EOA or Safe execution. |
| `src/polymarket/holdings.ts` | In-memory + `data/token-holding.json` for positions (add/clear per condition). |
| `src/core/config.ts` | Central config from env (Kalshi, Polymarket, strategy, arb-related). |
| `src/core/validate-env.ts` | Validates required env before start. |
| `src/core/monitor-lock.ts` | Single-instance lock (`logs/monitor.lock`). |
| `src/core/monitor-logger.ts` | Append lines to `logs/monitor_YYYY-MM-DD_HH-{00,15,30,45}.log`. |
| `src/scripts/auto-redeem-copytrade.ts` | Auto-redeem script entry. |
| `data/token-holding.json` | Persisted Polymarket holdings (conditionId → token amounts). |
| `logs/` | Monitor logs and `monitor.lock`. |

---

## Usage examples

**Run the main strategy (monitor + Kalshi 1 → Poly):**
```bash
npm run endside
```

**Dry run (no orders):**
```bash
KALSHI_1_POLY_DRY_RUN=true npm run endside
```

**Run auto-redeem in parallel (e.g. in another terminal):**
```bash
npm run auto-redeem
```

---

## Programmatic use

- **Kalshi:** `placeOrder(ticker, side, count, priceCents)` and `placeSellOrder(ticker, side, count)` from `src/kalshi/bot.ts` (side: `"yes"` \| `"no"`).
- **Polymarket:** `placePolymarketOrder(tokenId, price, size, options?)` and `sellPolymarketOrder(tokenId, size, options?)` from `src/polymarket/order.ts`. Options: `tickSize`, `negRisk`, `forcePlace`, `conditionId`.
- **Dual monitor:** `startDualPriceMonitor` and `formatDualPricesLine` from `src/monitor/dual-monitor.ts`; callback receives `DualMarketPrices` (Kalshi + Polymarket best asks for current 15m slot).

---

## References

- [Kalshi API](https://docs.kalshi.com/)
- [Kalshi TypeScript SDK](https://docs.kalshi.com/sdks/typescript/quickstart)
- [Kalshi WebSockets](https://docs.kalshi.com/websockets/websocket-connection)
