import crypto from "crypto";
import type { Trade } from "@/lib/fintrade/store";

export type BinanceCredentials = {
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
};

export type BinanceSignedParams = Record<string, string | number | undefined>;

export function getBinanceBaseUrl(isTestnet?: boolean) {
  return isTestnet
    ? "https://testnet.binancefuture.com"
    : "https://fapi.binance.com";
}

export function buildBinanceQuery(params: BinanceSignedParams) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });

  return search.toString();
}

export function createBinanceSignature(queryString: string, apiSecret: string) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

function getFetchErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || "fetch failed";
  }

  return "fetch failed";
}

function roundPrice(value: number, digits = 8) {
  return Number(value.toFixed(digits));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function toSafeNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeSymbol(value?: string) {
  const symbol = typeof value === "string" ? value.trim() : "";
  return symbol || "UNKNOWN";
}

function normalizeAsset(value?: string) {
  return (value || "").trim().toUpperCase();
}

function formatBalanceNumber(value: number) {
  return value.toFixed(8).replace(/\.?0+$/, "");
}

function splitTimeRangeIntoChunks(
  startTime: number,
  endTime: number,
  chunkMs: number
) {
  const chunks: Array<{ startTime: number; endTime: number }> = [];
  let currentStart = startTime;

  while (currentStart < endTime) {
    const currentEnd = Math.min(currentStart + chunkMs, endTime);
    chunks.push({
      startTime: currentStart,
      endTime: currentEnd,
    });
    currentStart = currentEnd;
  }

  return chunks;
}

export async function binanceSignedGet<T>(options: {
  path: string;
  credentials: BinanceCredentials;
  params?: BinanceSignedParams;
}) {
  const apiKey = options.credentials.apiKey.trim();
  const apiSecret = options.credentials.apiSecret.trim();

  if (!apiKey || !apiSecret) {
    throw new Error("API Key или API Secret не заполнены.");
  }

  const baseUrl = getBinanceBaseUrl(options.credentials.isTestnet);
  const timestamp = Date.now();
  const recvWindow = 5000;

  const queryString = buildBinanceQuery({
    ...(options.params || {}),
    timestamp,
    recvWindow,
  });

  const signature = createBinanceSignature(queryString, apiSecret);
  const url = `${baseUrl}${options.path}?${queryString}&signature=${signature}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);

    const fetchMessage = getFetchErrorMessage(error);
    throw new Error(
      `Не удалось подключиться к Binance API (${options.path}). ${fetchMessage}`
    );
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.msg ||
      data?.message ||
      `Binance HTTP error: ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

export type BinanceAccountResponse = {
  feeTier?: number;
  canTrade?: boolean;
  canDeposit?: boolean;
  canWithdraw?: boolean;
  totalWalletBalance?: string;
  totalUnrealizedProfit?: string;
  totalMarginBalance?: string;
  assets?: Array<{
    asset?: string;
    walletBalance?: string;
    unrealizedProfit?: string;
    marginBalance?: string;
    availableBalance?: string;
  }>;
};

export type BinanceFuturesBalanceItemRaw = {
  accountAlias?: string;
  asset?: string;
  balance?: string;
  withdrawAvailable?: string;
  availableBalance?: string;
  crossWalletBalance?: string;
  crossUnPnl?: string;
  updateTime?: number;
};

export type BinanceBalanceItem = {
  asset: string;
  free: string;
  locked: string;
};

export type BinanceUserTrade = {
  buyer?: boolean;
  commission?: string;
  commissionAsset?: string;
  id?: number;
  maker?: boolean;
  orderId?: number;
  price?: string;
  qty?: string;
  quoteQty?: string;
  realizedPnl?: string;
  side?: "BUY" | "SELL" | string;
  positionSide?: "BOTH" | "LONG" | "SHORT" | string;
  symbol?: string;
  time?: number;
};

type BinancePositionFill = {
  id: number | string;
  orderId: number | string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  quoteQty: number;
  commission: number;
  commissionAsset: string;
  realizedPnl: number;
  time: number;
};

type BinanceClosedTradeGroup = {
  symbol: string;
  direction: "Лонг" | "Шорт";
  openTime: number;
  closeTime: number;
  entry: number;
  exit: number;
  size: number;
  pnl: number;
  grossPnl: number;
  commission: number;
  fills: BinancePositionFill[];
  externalSeed: string;
};

const BINANCE_BALANCE_MIN = 0.00000001;
const BINANCE_MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const BINANCE_DEFAULT_DAYS = 90;
const BINANCE_USER_TRADES_LIMIT = 1000;
const EPS = 1e-10;

export async function testBinanceConnection(credentials: BinanceCredentials) {
  const data = await binanceSignedGet<BinanceAccountResponse>({
    path: "/fapi/v2/account",
    credentials,
  });

  return {
    ok: true,
    message: "Подключение к Binance успешно проверено.",
    raw: data,
  };
}

export async function getBinanceBalances(
  credentials: BinanceCredentials
): Promise<BinanceBalanceItem[]> {
  const data = await binanceSignedGet<BinanceFuturesBalanceItemRaw[]>({
    path: "/fapi/v2/balance",
    credentials,
  });

  if (!Array.isArray(data)) {
    throw new Error("Binance вернул некорректный формат балансов.");
  }

  return data
    .filter((item) => (item.asset || "").toUpperCase() === "USDT")
    .map((item) => {
      const total = Number(item.balance ?? 0);
      const free = Number(item.availableBalance ?? item.withdrawAvailable ?? 0);
      const locked = Math.max(total - free, 0);

      if (!Number.isFinite(total) || total < BINANCE_BALANCE_MIN) {
        return null;
      }

      return {
        asset: item.asset || "USDT",
        free: formatBalanceNumber(Number.isFinite(free) ? free : 0),
        locked: formatBalanceNumber(Number.isFinite(locked) ? locked : 0),
      };
    })
    .filter((item): item is BinanceBalanceItem => item !== null);
}

async function getBinanceUserTradesForSymbolChunk(options: BinanceCredentials & {
  symbol: string;
  startTime: number;
  endTime: number;
  limit?: number;
}) {
  const data = await binanceSignedGet<BinanceUserTrade[]>({
    path: "/fapi/v1/userTrades",
    credentials: {
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      isTestnet: options.isTestnet,
    },
    params: {
      symbol: options.symbol,
      startTime: options.startTime,
      endTime: options.endTime,
      limit: options.limit ?? BINANCE_USER_TRADES_LIMIT,
    },
  });

  if (!Array.isArray(data)) {
    throw new Error(
      `Binance вернул некорректный формат userTrades (${options.symbol}).`
    );
  }

  return data;
}

async function getBinanceSymbolsWithTrades(credentials: BinanceCredentials) {
  const account = await binanceSignedGet<BinanceAccountResponse>({
    path: "/fapi/v2/account",
    credentials,
  });

  const assets = Array.isArray(account.assets) ? account.assets : [];
  const hasUsdt = assets.some(
    (asset) => normalizeAsset(asset.asset) === "USDT"
  );

  if (!hasUsdt) {
    return [] as string[];
  }

  const income = await binanceSignedGet<
    Array<{ symbol?: string; asset?: string; income?: string; time?: number }>
  >({
    path: "/fapi/v1/income",
    credentials,
    params: {
      limit: 1000,
      startTime: Date.now() - 90 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
    },
  });

  const symbols = Array.from(
    new Set(
      (Array.isArray(income) ? income : [])
        .map((item) => normalizeSymbol(item.symbol))
        .filter((symbol) => symbol !== "UNKNOWN")
    )
  ).sort();

  return symbols;
}

async function getBinanceUserTradesHistory(options: BinanceCredentials & {
  limit?: number;
  days?: number;
}) {
  const days = options.days ?? BINANCE_DEFAULT_DAYS;
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  const symbols = await getBinanceSymbolsWithTrades({
    apiKey: options.apiKey,
    apiSecret: options.apiSecret,
    isTestnet: options.isTestnet,
  });

  if (!symbols.length) {
    return [] as BinancePositionFill[];
  }

  const chunks = splitTimeRangeIntoChunks(
    startTime,
    endTime,
    BINANCE_MAX_RANGE_MS
  );

  const all: BinancePositionFill[] = [];
  const dedupe = new Set<string>();
  const errors: string[] = [];

  console.log("[Binance] userTrades import period:", {
    startTime,
    endTime,
    days,
    startIso: new Date(startTime).toISOString(),
    endIso: new Date(endTime).toISOString(),
    symbols,
    chunks: chunks.length,
  });

  for (const symbol of symbols) {
    for (const chunk of chunks) {
      try {
        const list = await getBinanceUserTradesForSymbolChunk({
          apiKey: options.apiKey,
          apiSecret: options.apiSecret,
          isTestnet: options.isTestnet,
          symbol,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          limit: options.limit ?? BINANCE_USER_TRADES_LIMIT,
        });

        for (const raw of list) {
          const fill: BinancePositionFill = {
            id: raw.id ?? `${raw.orderId ?? "no-order"}-${raw.time ?? 0}`,
            orderId: raw.orderId ?? "no-order",
            symbol: normalizeSymbol(raw.symbol),
            side: raw.side === "SELL" ? "SELL" : "BUY",
            qty: toSafeNumber(raw.qty),
            price: toSafeNumber(raw.price),
            quoteQty: toSafeNumber(raw.quoteQty),
            commission: toSafeNumber(raw.commission),
            commissionAsset: normalizeAsset(raw.commissionAsset),
            realizedPnl: toSafeNumber(raw.realizedPnl),
            time: Number(raw.time || 0),
          };

          const key = `${fill.symbol}|${fill.id}|${fill.orderId}|${fill.time}|${fill.qty}|${fill.price}`;
          if (dedupe.has(key)) continue;
          dedupe.add(key);
          all.push(fill);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Ошибка загрузки userTrades Binance.";

        errors.push(
          `${symbol}: ${message} [${new Date(
            chunk.startTime
          ).toISOString()} - ${new Date(chunk.endTime).toISOString()}]`
        );

        console.error("[Binance] userTrades chunk error:", {
          symbol,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          error: message,
        });
      }
    }
  }

  if (!all.length && errors.length) {
    throw new Error(
      `Не удалось получить userTrades Binance. ${errors.join(" | ")}`
    );
  }

  return all.sort((a, b) => a.time - b.time);
}

function weightedAveragePrice(fills: BinancePositionFill[]) {
  const totalQty = fills.reduce((sum, fill) => sum + fill.qty, 0);
  if (totalQty <= EPS) return 0;

  const totalNotional = fills.reduce(
    (sum, fill) => sum + fill.qty * fill.price,
    0
  );

  return totalNotional / totalQty;
}

function buildClosedTradesFromUserTrades(
  fills: BinancePositionFill[]
): BinanceClosedTradeGroup[] {
  const bySymbol = new Map<string, BinancePositionFill[]>();

  for (const fill of fills) {
    if (!bySymbol.has(fill.symbol)) {
      bySymbol.set(fill.symbol, []);
    }
    bySymbol.get(fill.symbol)!.push(fill);
  }

  const result: BinanceClosedTradeGroup[] = [];

  for (const [symbol, symbolFills] of bySymbol.entries()) {
    const ordered = [...symbolFills].sort((a, b) => a.time - b.time);

    let positionQty = 0;
    let entryFills: BinancePositionFill[] = [];
    let closingFills: BinancePositionFill[] = [];
    let openTime = 0;
    let grossRealized = 0;
    let commissionSum = 0;
    let direction: "Лонг" | "Шорт" | null = null;

    const flushTrade = (closeTime: number) => {
      if (!entryFills.length && !closingFills.length) return;

      const entry = weightedAveragePrice(entryFills);
      const exit = weightedAveragePrice(closingFills);
      const size = closingFills.reduce((sum, fill) => sum + fill.qty, 0);

      const grossPnlRounded = roundMoney(grossRealized);
      const commissionRounded = roundMoney(commissionSum);
      const netPnlRounded = roundMoney(grossRealized - commissionSum);

      result.push({
        symbol,
        direction: direction || "Лонг",
        openTime,
        closeTime,
        entry: roundPrice(entry),
        exit: roundPrice(exit),
        size: roundPrice(size),
        pnl: netPnlRounded,
        grossPnl: grossPnlRounded,
        commission: commissionRounded,
        fills: [...entryFills, ...closingFills],
        externalSeed: `${symbol}-${openTime}-${closeTime}-${direction || "LONG"}`,
      });

      entryFills = [];
      closingFills = [];
      openTime = 0;
      grossRealized = 0;
      commissionSum = 0;
      direction = null;
    };

    for (const fill of ordered) {
      const signedQty = fill.side === "BUY" ? fill.qty : -fill.qty;

      if (Math.abs(positionQty) <= EPS) {
        positionQty = signedQty;
        entryFills = [fill];
        closingFills = [];
        openTime = fill.time;
        grossRealized = fill.realizedPnl;
        commissionSum = fill.commissionAsset === "USDT" ? fill.commission : 0;
        direction = signedQty > 0 ? "Лонг" : "Шорт";

        if (Math.abs(positionQty) <= EPS) {
          flushTrade(fill.time);
          positionQty = 0;
        }

        continue;
      }

      const sameDirection =
        (positionQty > 0 && signedQty > 0) || (positionQty < 0 && signedQty < 0);

      if (sameDirection) {
        positionQty += signedQty;
        entryFills.push(fill);
        grossRealized += fill.realizedPnl;
        if (fill.commissionAsset === "USDT") {
          commissionSum += fill.commission;
        }

        if (positionQty > 0) {
          direction = "Лонг";
        } else if (positionQty < 0) {
          direction = "Шорт";
        }

        continue;
      }

      closingFills.push(fill);
      grossRealized += fill.realizedPnl;
      if (fill.commissionAsset === "USDT") {
        commissionSum += fill.commission;
      }

      positionQty += signedQty;

      if (Math.abs(positionQty) <= EPS) {
        flushTrade(fill.time);
        positionQty = 0;
        continue;
      }

      const reversedDirection = positionQty > 0 ? "Лонг" : "Шорт";

      flushTrade(fill.time);

      positionQty = positionQty;
      entryFills = [fill];
      closingFills = [];
      openTime = fill.time;
      grossRealized = 0;
      commissionSum = fill.commissionAsset === "USDT" ? fill.commission : 0;
      direction = reversedDirection;
    }

    if (Math.abs(positionQty) <= EPS) {
      continue;
    }
  }

  return result.sort((a, b) => b.closeTime - a.closeTime);
}

function buildExternalId(
  group: BinanceClosedTradeGroup,
  connectionId: string
) {
  return `binance-${connectionId}-${group.externalSeed}`;
}

export async function importBinanceTrades(
  options: BinanceCredentials & {
    connectionId: string;
    limit?: number;
    days?: number;
  }
): Promise<Trade[]> {
  if (!options.connectionId?.trim()) {
    throw new Error("Binance import: connectionId отсутствует.");
  }

  const fills = await getBinanceUserTradesHistory({
    apiKey: options.apiKey,
    apiSecret: options.apiSecret,
    isTestnet: options.isTestnet,
    limit: options.limit,
    days: options.days,
  });

  const closedTrades = buildClosedTradesFromUserTrades(fills);
  const importedAt = new Date().toISOString();

  const trades = closedTrades
    .filter((group) => Math.abs(group.pnl) > 0 || group.size > 0)
    .map((group) => {
      const closeDate = new Date(group.closeTime || Date.now());
      const isoDate = closeDate.toISOString().slice(0, 10);
      const hhmm = closeDate.toISOString().slice(11, 16);

      return {
        id: crypto.randomUUID(),
        externalId: buildExternalId(group, options.connectionId),
        source: "imported",
        exchange: "binance",
        connectionId: options.connectionId,
        importedAt,
        date: isoDate,
        time: hhmm,
        symbol: group.symbol,
        direction: group.direction,
        entry: Number.isFinite(group.entry) ? group.entry : 0,
        exit: Number.isFinite(group.exit) ? group.exit : 0,
        size: Number.isFinite(group.size) ? group.size : 0,
        pnl: Number.isFinite(group.pnl) ? group.pnl : 0,
        strategy: "",
        planned: "no",
        emotion: "Нейтрально",
        psychology: "Импортировано из Binance Futures userTrades.",
        notes:
          `Binance futures import${options.isTestnet ? " (testnet)" : ""}` +
          ` | grossRealized=${group.grossPnl}` +
          ` | commission=${group.commission}` +
          ` | netPnl=${group.pnl}` +
          ` | fills=${group.fills.length}` +
          ` | openTime=${new Date(group.openTime).toISOString()}` +
          ` | closeTime=${new Date(group.closeTime).toISOString()}`,
        screenshots: [],
        rating: 3,
        signal: "BINANCE_USER_TRADES",
      } satisfies Trade;
    });

  console.log("[Binance] fills count:", fills.length);
  console.log("[Binance] closed trades count:", closedTrades.length);
  console.log("[Binance] import trades summary:", {
    fills: fills.length,
    closedTrades: closedTrades.length,
    trades: trades.length,
    sample: trades[0],
  });

  return trades;
}