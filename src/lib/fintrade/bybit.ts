import crypto from "crypto";
import type { Trade } from "@/lib/fintrade/store";

export type BybitCredentials = {
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
};

export type BybitSignedGetParams = Record<string, string | number | undefined>;

export function getBybitBaseUrl(isTestnet?: boolean) {
  return isTestnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
}

export function buildBybitQuery(params: BybitSignedGetParams) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });

  return search.toString();
}

export function createBybitSignature(options: {
  timestamp: string;
  apiKey: string;
  recvWindow: string;
  queryString: string;
  apiSecret: string;
}) {
  const payload =
    options.timestamp +
    options.apiKey +
    options.recvWindow +
    options.queryString;

  return crypto
    .createHmac("sha256", options.apiSecret)
    .update(payload)
    .digest("hex");
}

export async function bybitSignedGet<T>(options: {
  path: string;
  credentials: BybitCredentials;
  params?: BybitSignedGetParams;
}) {
  const apiKey = options.credentials.apiKey.trim();
  const apiSecret = options.credentials.apiSecret.trim();

  if (!apiKey || !apiSecret) {
    throw new Error("API Key или API Secret не заполнены.");
  }

  const baseUrl = getBybitBaseUrl(options.credentials.isTestnet);
  const timestamp = String(Date.now());
  const recvWindow = "5000";
  const queryString = buildBybitQuery(options.params || {});
  const signature = createBybitSignature({
    timestamp,
    apiKey,
    recvWindow,
    queryString,
    apiSecret,
  });

  const url = `${baseUrl}${options.path}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": signature,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Bybit HTTP error: ${response.status}`);
  }

  return data as T;
}

export type BybitWalletBalanceResponse = {
  retCode: number;
  retMsg: string;
  result?: {
    list?: Array<{
      accountType?: string;
      totalEquity?: string;
      totalWalletBalance?: string;
      totalMarginBalance?: string;
      coin?: Array<{
        coin?: string;
        walletBalance?: string;
        locked?: string;
        availableToWithdraw?: string;
        equity?: string;
        usdValue?: string;
      }>;
    }>;
  };
  time?: number;
};

export type BybitBalanceItem = {
  asset: string;
  free: string;
  locked: string;
};

export type BybitClosedPnlItem = {
  symbol?: string;
  side?: "Buy" | "Sell" | string;
  qty?: string;
  closedPnl?: string;
  avgEntryPrice?: string;
  avgExitPrice?: string;
  createdTime?: string;
  updatedTime?: string;
  orderId?: string;
  execType?: string;
  category?: "linear" | "spot" | "inverse" | "option" | string;
};

export type BybitClosedPnlResponse = {
  retCode: number;
  retMsg: string;
  result?: {
    category?: string;
    list?: BybitClosedPnlItem[];
    nextPageCursor?: string;
  };
  time?: number;
};

type BybitAccountType = "UNIFIED" | "CONTRACT" | "SPOT";
type BybitCategory = "linear" | "spot" | "inverse" | "option";

const BYBIT_BALANCE_MIN_USD_VALUE = 0.01;
const BYBIT_MAX_EXECUTION_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const BYBIT_IMPORT_LIMIT = 100;

export async function testBybitConnection(credentials: BybitCredentials) {
  const data = await bybitSignedGet<BybitWalletBalanceResponse>({
    path: "/v5/account/wallet-balance",
    credentials,
    params: {
      accountType: "UNIFIED",
    },
  });

  if (data.retCode !== 0) {
    throw new Error(data.retMsg || "Bybit вернул ошибку.");
  }

  return {
    ok: true,
    message: "Подключение к Bybit успешно проверено.",
    raw: data,
  };
}

async function getBybitBalancesByAccountType(
  credentials: BybitCredentials,
  accountType: BybitAccountType
): Promise<BybitBalanceItem[]> {
  const data = await bybitSignedGet<BybitWalletBalanceResponse>({
    path: "/v5/account/wallet-balance",
    credentials,
    params: {
      accountType,
    },
  });

  if (data.retCode !== 0) {
    throw new Error(
      data.retMsg || `Bybit вернул ошибку при загрузке балансов (${accountType}).`
    );
  }

  const coins = data.result?.list?.flatMap((account) => account.coin || []) || [];

  return coins
    .map((coin) => {
      const walletBalance = Number(coin.walletBalance ?? 0);
      const locked = Number(coin.locked ?? 0);
      const usdValue = Number(coin.usdValue ?? 0);

      if (!Number.isFinite(walletBalance) || walletBalance <= 0) {
        return null;
      }

      if (Number.isFinite(usdValue) && usdValue < BYBIT_BALANCE_MIN_USD_VALUE) {
        return null;
      }

      const free = Math.max(walletBalance - locked, 0);

      return {
        asset: coin.coin || "UNKNOWN",
        free: formatBalanceNumber(free),
        locked: formatBalanceNumber(locked),
      };
    })
    .filter((item): item is BybitBalanceItem => item !== null);
}

export async function getBybitBalances(
  credentials: BybitCredentials
): Promise<BybitBalanceItem[]> {
  const accountTypes: BybitAccountType[] = ["UNIFIED", "CONTRACT", "SPOT"];
  const errors: string[] = [];

  for (const accountType of accountTypes) {
    try {
      const balances = await getBybitBalancesByAccountType(credentials, accountType);

      if (balances.length > 0) {
        return balances;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Ошибка загрузки балансов Bybit (${accountType}).`;

      errors.push(`${accountType}: ${message}`);
    }
  }

  if (errors.length > 0) {
    console.warn("[BYBIT_BALANCES_WARN]", errors);
  }

  return [];
}

function splitTimeRangeIntoChunks(startTime: number, endTime: number, chunkMs: number) {
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

function formatBalanceNumber(value: number) {
  return value.toFixed(8).replace(/\.?0+$/, "");
}

function mapBybitClosedTradeDirection(side?: string): string {
  if (side === "Sell") return "Лонг";
  if (side === "Buy") return "Шорт";
  return "Лонг";
}

async function getBybitClosedPnlPage(options: BybitCredentials & {
  category: BybitCategory;
  startTime?: number;
  endTime?: number;
  limit?: number;
  cursor?: string;
}) {
  const data = await bybitSignedGet<BybitClosedPnlResponse>({
    path: "/v5/position/closed-pnl",
    credentials: {
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      isTestnet: options.isTestnet,
    },
    params: {
      category: options.category,
      limit: options.limit ?? BYBIT_IMPORT_LIMIT,
      startTime: options.startTime,
      endTime: options.endTime,
      cursor: options.cursor,
    },
  });

  if (data.retCode !== 0) {
    throw new Error(
      `${data.retMsg || "Bybit вернул ошибку при получении closed pnl."} [category=${options.category}]`
    );
  }

  const list = (data.result?.list ?? []).map((item) => ({
    ...item,
    category: options.category,
  }));

  return {
    list,
    nextPageCursor: data.result?.nextPageCursor || "",
  };
}

async function getBybitClosedPnlByCategory(options: BybitCredentials & {
  category: BybitCategory;
  startTime?: number;
  endTime?: number;
  limit?: number;
}) {
  const allItems: BybitClosedPnlItem[] = [];
  let cursor = "";
  let page = 0;

  while (true) {
    page += 1;

    const result = await getBybitClosedPnlPage({
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      isTestnet: options.isTestnet,
      category: options.category,
      startTime: options.startTime,
      endTime: options.endTime,
      limit: options.limit ?? BYBIT_IMPORT_LIMIT,
      cursor: cursor || undefined,
    });

    if (result.list.length > 0) {
      allItems.push(...result.list);
    }

    if (!result.nextPageCursor || result.nextPageCursor === cursor) {
      break;
    }

    cursor = result.nextPageCursor;
  }

  return allItems;
}

export async function getBybitClosedPnl(
  options: BybitCredentials & {
    limit?: number;
    days?: number;
  }
) {
  const categories: BybitCategory[] = ["linear", "spot", "inverse", "option"];
  const errors: string[] = [];
  const allClosed: BybitClosedPnlItem[] = [];

  const days = options.days ?? 90;
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  const chunks = splitTimeRangeIntoChunks(
    startTime,
    endTime,
    BYBIT_MAX_EXECUTION_RANGE_MS
  );

  console.log("[Bybit] closed-pnl import period:", {
    startTime,
    endTime,
    days,
    startIso: new Date(startTime).toISOString(),
    endIso: new Date(endTime).toISOString(),
    chunks: chunks.length,
  });

  for (const category of categories) {
    for (const chunk of chunks) {
      try {
        const list = await getBybitClosedPnlByCategory({
          apiKey: options.apiKey,
          apiSecret: options.apiSecret,
          isTestnet: options.isTestnet,
          limit: options.limit ?? BYBIT_IMPORT_LIMIT,
          category,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
        });

        console.log("[Bybit] closed-pnl category chunk result:", {
          category,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          startIso: new Date(chunk.startTime).toISOString(),
          endIso: new Date(chunk.endTime).toISOString(),
          count: list.length,
        });

        if (list.length > 0) {
          allClosed.push(...list);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Ошибка category=${category}`;

        errors.push(
          `${message} [${new Date(chunk.startTime).toISOString()} - ${new Date(
            chunk.endTime
          ).toISOString()}]`
        );

        console.error("[Bybit] closed-pnl category chunk error:", {
          category,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          error: message,
        });
      }
    }
  }

  if (allClosed.length === 0 && errors.length > 0) {
    throw new Error(`Не удалось получить closed pnl Bybit. ${errors.join(" | ")}`);
  }

  const uniqueMap = new Map<string, BybitClosedPnlItem>();

  for (const item of allClosed) {
    const ts = item.updatedTime || item.createdTime || "0";
    const key =
      `${item.category || "unknown"}::` +
      `${item.orderId || "no-order"}::` +
      `${item.symbol || "UNKNOWN"}::` +
      `${ts}::${item.side || "UNKNOWN"}::${item.closedPnl || "0"}`;

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  const result = Array.from(uniqueMap.values()).sort((a, b) => {
    const aTime = Number(a.updatedTime || a.createdTime || 0);
    const bTime = Number(b.updatedTime || b.createdTime || 0);
    return bTime - aTime;
  });

  console.log("[Bybit] closed-pnl summary:", {
    raw: allClosed.length,
    unique: result.length,
    errorsCount: errors.length,
    sample: result[0],
  });

  return result;
}

export async function importBybitTrades(
  options: BybitCredentials & {
    connectionId: string;
    limit?: number;
    days?: number;
  }
): Promise<Trade[]> {
  const closedTrades = await getBybitClosedPnl({
    apiKey: options.apiKey,
    apiSecret: options.apiSecret,
    isTestnet: options.isTestnet,
    limit: options.limit,
    days: options.days,
  });

  const importedAt = new Date().toISOString();

  const trades = closedTrades.map((item) => {
    const entry = Number(item.avgEntryPrice ?? 0);
    const exit = Number(item.avgExitPrice ?? 0);
    const size = Number(item.qty ?? 0);
    const pnl = Number(item.closedPnl ?? 0);

    const timestampRaw = item.updatedTime || item.createdTime;
    const timestamp = timestampRaw ? Number(timestampRaw) : Date.now();
    const tradeTime = new Date(timestamp);
    const isoDate = tradeTime.toISOString().slice(0, 10);
    const hhmm = tradeTime.toISOString().slice(11, 16);

    const stableExternalId =
      item.orderId
        ? `bybit-${options.connectionId}-${item.category || "unknown"}-${item.orderId}`
        : `bybit-${options.connectionId}-${item.category || "unknown"}-${item.symbol || "UNKNOWN"}-${timestamp}-${item.side || "UNKNOWN"}-${item.closedPnl || "0"}`;

    return {
      id: crypto.randomUUID(),
      externalId: stableExternalId,
      source: "imported",
      exchange: "bybit",
      connectionId: options.connectionId,
      importedAt,
      date: isoDate,
      time: hhmm,
      symbol: item.symbol || "UNKNOWN",
      direction: mapBybitClosedTradeDirection(item.side),
      entry: Number.isFinite(entry) ? entry : 0,
      exit: Number.isFinite(exit) ? exit : 0,
      size: Number.isFinite(size) ? size : 0,
      pnl: Number.isFinite(pnl) ? pnl : 0,
      strategy: "",
      planned: "no",
      emotion: "Нейтрально",
      psychology: `Импортировано из Bybit Closed PnL${item.category ? ` (${item.category})` : ""}.`,
      notes: `Bybit closed-pnl import${options.isTestnet ? " (testnet)" : ""}${item.category ? ` [${item.category}]` : ""}`,
      screenshots: [],
      rating: 3,
      signal: item.execType || "Trade",
    } satisfies Trade;
  });

  console.log("[Bybit] import trades summary:", {
    trades: trades.length,
    sample: trades[0],
  });

  return trades;
}