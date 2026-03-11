/**
 * Real-time dual price monitor: Kalshi + Polymarket (Bitcoin 15m up/down).
 */
import { spawn } from "child_process";
import { Configuration, MarketApi } from "kalshi-typescript"
import { config } from "../core/config";
import { getBitcoinUpDownMarkets } from "../kalshi/bot";
import { releaseMonitorLock } from "../core/monitor-lock";
import { getPolymarketAskPrices, type PolymarketPrices } from "../polymarket/prices";

export interface MarketPrices {
  ticker: string;
  upAskCents: number;
  downAskCents: number;
  lastPriceCents: number;
  fetchedAt: Date;
}

function buildConfiguration(): Configuration {
  return new Configuration({
    apiKey: config.apiKey,
    basePath: config.basePath,
    ...(config.privateKeyPath
      ? { privateKeyPath: config.privateKeyPath }
      : config.privateKeyPem
        ? { privateKeyPem: config.privateKeyPem }
        : {}),
  });
}

let cachedMarketApi: MarketApi | null = null;
function getMarketApi(): MarketApi {
  if (!cachedMarketApi) cachedMarketApi = new MarketApi(buildConfiguration());
  return cachedMarketApi;
}

function dollarsToCents(dollars: string | undefined): number {
  if (dollars == null || dollars === "") return 0;
  const n = parseFloat(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

async function getMarketPrices(ticker: string): Promise<MarketPrices | null> {
  const marketApi = getMarketApi();
  try {
    const res = await marketApi.getMarket(ticker);
    const m = res.data.market;
    if (!m) return null;
    return {
      ticker: m.ticker,
      upAskCents: m.yes_ask ?? dollarsToCents(m.yes_ask_dollars),
      downAskCents: m.no_ask ?? dollarsToCents(m.no_ask_dollars),
      lastPriceCents: m.last_price ?? dollarsToCents(m.last_price_dollars),
      fetchedAt: new Date(),
    };
  } catch {
    return null;
  }
}

const DEFAULT_POLL_MS = 2000;

function spawnAndExit(): void {
  releaseMonitorLock();
  const [node, ...args] = process.argv;
  const child = spawn(node, args, { detached: true, stdio: "ignore", env: process.env, cwd: process.cwd() });
  child.unref();
  process.exit(0);
}

function current15mSlot(): string {
  const d = new Date();
  const y = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = Math.floor(d.getMinutes() / 15) * 15;
  const minStr = String(min).padStart(2, "0");
  return `${y}-${month}-${day}_${h}-${minStr}`;
}

export interface DualMarketPrices {
  kalshiTicker: string;
  kalshi: MarketPrices | null;
  polymarket: PolymarketPrices | null;
  fetchedAt: Date;
}

async function getDualPrices(options: { kalshiTicker: string; polymarketMarket?: string }): Promise<DualMarketPrices> {
  const fetchedAt = new Date();
  const [kalshiResult, polymarketResult] = await Promise.all([
    getMarketPrices(options.kalshiTicker),
    getPolymarketAskPrices(options.polymarketMarket ?? "btc"),
  ]);
  return {
    kalshiTicker: options.kalshiTicker,
    kalshi: kalshiResult,
    polymarket: polymarketResult,
    fetchedAt,
  };
}

export async function startDualPriceMonitor(options: {
  kalshiTicker?: string;
  polymarketMarket?: string;
  intervalMs?: number;
  restartProcessOnQuarterHour?: boolean;
  onPrices: (prices: DualMarketPrices) => void;
  onError?: (err: unknown) => void;
}): Promise<() => void> {
  let kalshiTicker = options.kalshiTicker;
  let lastSlot = current15mSlot();
  if (!kalshiTicker) {
    const markets = await getBitcoinUpDownMarkets();
    if (markets.length === 0) throw new Error("No open Bitcoin up/down markets found.");
    kalshiTicker = markets[0].ticker;
  }
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_MS;
  const useAutoRefresh = !options.kalshiTicker;
  const restartOnQuarterHour = options.restartProcessOnQuarterHour ?? useAutoRefresh;
  const polymarketMarket = options.polymarketMarket ?? "btc";
  let stopped = false;
  let pollInProgress = false;

  const scheduleNext = (startedAt: number) => {
    if (stopped) return;
    setTimeout(poll, Math.max(0, intervalMs - (Date.now() - startedAt)));
  };

  const poll = async () => {
    if (pollInProgress) return;
    pollInProgress = true;
    const startedAt = Date.now();
    try {
      if (stopped) return;
      if (useAutoRefresh) {
        const slot = current15mSlot();
        if (slot !== lastSlot) {
          lastSlot = slot;
          if (restartOnQuarterHour) {
            spawnAndExit();
            return;
          }
          const markets = await getBitcoinUpDownMarkets();
          if (markets.length > 0) kalshiTicker = markets[0].ticker;
        }
      }
      if (stopped || !kalshiTicker) {
        scheduleNext(startedAt);
        return;
      }
      const dual = await getDualPrices({ kalshiTicker, polymarketMarket });
      if (stopped) return;
      try {
        options.onPrices(dual);
      } catch (e) {
        options.onError?.(e);
      }
      scheduleNext(startedAt);
    } finally {
      pollInProgress = false;
    }
  };
  setTimeout(poll, 0);
  return () => { stopped = true; };
}

/** True if Kalshi cents is a real price (finite, 0–100 cents). */
function isRealKalshiPrice(cents: number | null | undefined): boolean {
  if (cents == null || !Number.isFinite(cents)) return false;
  const d = cents / 100;
  return d >= 0 && d <= 1;
}

/** True if Polymarket decimal price is real (finite, 0–1). */
function isRealPolyPrice(price: number | null | undefined): boolean {
  return price != null && Number.isFinite(price) && price >= 0 && price <= 1;
}

/**
 * Format one log line only when all four prices are real; otherwise return null (skip the line).
 */
export function formatDualPricesLine(p: DualMarketPrices): string | null {
  if (!p.kalshi || !p.polymarket) return null;
  if (!isRealKalshiPrice(p.kalshi.upAskCents) || !isRealKalshiPrice(p.kalshi.downAskCents)) return null;
  if (!isRealPolyPrice(p.polymarket.upAsk) || !isRealPolyPrice(p.polymarket.downAsk)) return null;
  const time = p.fetchedAt.toISOString();
  const kUp = (p.kalshi.upAskCents / 100).toFixed(2);
  const kDown = (p.kalshi.downAskCents / 100).toFixed(2);
  const pUp = p.polymarket.upAsk.toFixed(2);
  const pDown = p.polymarket.downAsk.toFixed(2);
  return `[${time}] Kalshi UP ${kUp} DOWN ${kDown}  |  Polymarket UP ${pUp} DOWN ${pDown}`;
}
