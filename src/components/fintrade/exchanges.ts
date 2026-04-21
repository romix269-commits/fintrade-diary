import type { Trade } from "@/lib/fintrade/store";

export type ExchangeId = "bybit" | "binance" | "okx" | "kucoin";
export type ExchangeStatus = "idle" | "connected" | "error" | "syncing";

export type ExchangeBalance = {
  asset: string;
  free: string;
  locked: string;
};

export type ExchangeConnection = {
  id: string;
  exchange: ExchangeId;
  name: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  proxyUrl?: string;
  isTestnet?: boolean;
  status: ExchangeStatus;
  errorMessage?: string;
  balances?: ExchangeBalance[];
  lastCheckedAt?: string;
  lastSyncedAt?: string;
  lastImportedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const EXCHANGES: { id: ExchangeId; name: string }[] = [
  { id: "bybit", name: "Bybit" },
  { id: "binance", name: "Binance" },
  { id: "okx", name: "OKX" },
  { id: "kucoin", name: "KuCoin" },
];

const STORAGE_KEY = "fintrade_exchange_connections";

export function createEmptyConnection(exchange: ExchangeId): ExchangeConnection {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    exchange,
    name: EXCHANGES.find((x) => x.id === exchange)?.name || exchange,
    apiKey: "",
    apiSecret: "",
    passphrase: "",
    proxyUrl: "",
    isTestnet: false,
    status: "idle",
    errorMessage: undefined,
    balances: [],
    lastCheckedAt: undefined,
    lastSyncedAt: undefined,
    lastImportedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeConnection(value: unknown): ExchangeConnection | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<ExchangeConnection>;

  if (!raw.id || !raw.exchange || !raw.name) return null;
  if (typeof raw.apiKey !== "string" || typeof raw.apiSecret !== "string") return null;

  const now = new Date().toISOString();

  return {
    id: String(raw.id),
    exchange: raw.exchange,
    name: String(raw.name),
    apiKey: raw.apiKey,
    apiSecret: raw.apiSecret,
    passphrase: raw.passphrase || undefined,
    proxyUrl: raw.proxyUrl || undefined,
    isTestnet: Boolean(raw.isTestnet),
    status: raw.status ?? "idle",
    errorMessage: raw.errorMessage || undefined,
    balances: Array.isArray(raw.balances) ? raw.balances : [],
    lastCheckedAt: raw.lastCheckedAt || undefined,
    lastSyncedAt: raw.lastSyncedAt || undefined,
    lastImportedAt: raw.lastImportedAt || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
  };
}

export function loadConnections(): ExchangeConnection[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeConnection)
      .filter((item): item is ExchangeConnection => item !== null);
  } catch {
    return [];
  }
}

export function saveConnections(connections: ExchangeConnection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Ошибка запроса.");
  }

  return data;
}

export async function testConnection(id: string): Promise<{ ok: boolean; message?: string }> {
  const connections = loadConnections();
  const connection = connections.find((c) => c.id === id);

  await delay(300);

  if (!connection) {
    return { ok: false, message: "Подключение не найдено." };
  }

  if (!connection.apiKey || !connection.apiSecret) {
    return { ok: false, message: "API Key или API Secret не заполнены." };
  }

  if (connection.exchange === "okx" && !connection.passphrase) {
    return { ok: false, message: "Для OKX требуется Passphrase." };
  }

  try {
    if (connection.exchange === "bybit") {
      const data = await postJson("/api/bybit/test", {
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
        isTestnet: connection.isTestnet,
      });

      return {
        ok: Boolean(data?.ok),
        message:
          data?.message || (data?.ok ? "Подключение успешно проверено." : "Ошибка проверки."),
      };
    }

    if (connection.exchange === "binance") {
      const data = await postJson("/api/binance/test", {
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
        isTestnet: connection.isTestnet,
      });

      return {
        ok: Boolean(data?.ok),
        message:
          data?.message || (data?.ok ? "Подключение успешно проверено." : "Ошибка проверки."),
      };
    }

    if (connection.exchange === "okx") {
      return {
        ok: false,
        message: "Проверка OKX будет добавлена следующим этапом.",
      };
    }

    return {
      ok: false,
      message: "Эта биржа пока не поддерживается.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось выполнить проверку подключения.",
    };
  }
}

export async function fetchBalances(id: string): Promise<ExchangeBalance[]> {
  const connections = loadConnections();
  const connection = connections.find((c) => c.id === id);

  await delay(400);

  if (!connection) {
    throw new Error("Подключение не найдено.");
  }

  try {
    if (connection.exchange === "bybit") {
      const data = await postJson("/api/bybit/balances", {
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
        isTestnet: connection.isTestnet,
      });

      return Array.isArray(data?.balances) ? data.balances : [];
    }

    if (connection.exchange === "binance") {
      const data = await postJson("/api/binance/balances", {
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
        isTestnet: connection.isTestnet,
      });

      return Array.isArray(data?.balances) ? data.balances : [];
    }

    if (connection.exchange === "okx") {
      throw new Error("Загрузка балансов OKX будет добавлена следующим этапом.");
    }

    throw new Error("Загрузка балансов для этой биржи пока не поддерживается.");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Не удалось загрузить балансы."
    );
  }
}

export async function importTradesFromConnection(id: string): Promise<Trade[]> {
  const connections = loadConnections();
  const connection = connections.find((c) => c.id === id);

  await delay(500);

  if (!connection) {
    throw new Error("Подключение не найдено.");
  }

  try {
    if (connection.exchange === "bybit") {
      const data = await postJson("/api/bybit/import", {
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
        isTestnet: connection.isTestnet,
        connectionId: connection.id,
        limit: 50,
      });

      return Array.isArray(data?.trades) ? data.trades : [];
    }

    if (connection.exchange === "binance") {
      const data = await postJson("/api/binance/import", {
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
        isTestnet: connection.isTestnet,
        connectionId: connection.id,
        limit: 1000,
      });

      return Array.isArray(data?.trades) ? data.trades : [];
    }

    if (connection.exchange === "okx") {
      throw new Error("Импорт сделок OKX будет добавлен следующим этапом.");
    }

    throw new Error("Импорт для этой биржи пока не поддерживается.");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Не удалось импортировать сделки."
    );
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}