import type { Trade } from "@/lib/fintrade/store";
import { createClient } from "@/lib/supabase/client";

type TradeRow = {
  id: string;
  diary_id: string | null;
  date: string;
  time: string | null;
  symbol: string;
  direction: string;
  entry: number | null;
  exit: number | null;
  size: number | null;
  pnl: number | null;
  strategy: string | null;
  signal: string | null;
  emotion: string | null;
  psychology: string | null;
  notes: string | null;
  planned: string | null;
  rating: number | null;
  screenshots: string[] | null;
  source: string | null;
  exchange: string | null;
  external_id: string | null;
  imported_at: string | null;
  connection_id: string | null;
  custom_filters: Array<{ key: string; value: string }> | null;
  created_at: string | null;
  updated_at: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function toCustomFilters(
  value: unknown
): Array<{ key: string; value: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;
      const key = typeof raw.key === "string" ? raw.key : "";
      const val = typeof raw.value === "string" ? raw.value : "";

      if (!key && !val) return null;

      return { key, value: val };
    })
    .filter(Boolean) as Array<{ key: string; value: string }>;
}

function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    diaryId: row.diary_id ?? "",
    date: row.date,
    time: row.time ?? "",
    symbol: row.symbol,
    direction: row.direction,
    entry: toNumber(row.entry),
    exit: toNumber(row.exit),
    size: toNumber(row.size),
    pnl: toNumber(row.pnl),
    strategy: row.strategy ?? "",
    signal: row.signal ?? "",
    emotion: row.emotion ?? "",
    psychology: row.psychology ?? "",
    notes: row.notes ?? "",
    planned: row.planned === "yes" ? "yes" : "no",
    rating: toNumber(row.rating, 3),
    screenshots: toStringArray(row.screenshots),
    source:
      row.source === "imported" || row.source === "manual"
        ? row.source
        : "manual",
    exchange: row.exchange ?? "",
    externalId: row.external_id ?? "",
    importedAt: row.imported_at ?? "",
    connectionId: row.connection_id ?? "",
    customFilters: toCustomFilters(row.custom_filters),
  };
}

function tradeToRow(trade: Trade) {
  const now = new Date().toISOString();

  return {
    id: trade.id,
    diary_id: trade.diaryId || null,
    date: trade.date,
    time: trade.time || null,
    symbol: trade.symbol,
    direction: trade.direction,
    entry: toNumber(trade.entry),
    exit: toNumber(trade.exit),
    size: toNumber(trade.size),
    pnl: toNumber(trade.pnl),
    strategy: trade.strategy || null,
    signal: trade.signal || null,
    emotion: trade.emotion || null,
    psychology: trade.psychology || null,
    notes: trade.notes || null,
    planned: trade.planned === "yes" ? "yes" : "no",
    rating: toNumber(trade.rating, 3),
    screenshots: Array.isArray(trade.screenshots) ? trade.screenshots : [],
    source: trade.source || "manual",
    exchange: trade.exchange || null,
    external_id: trade.externalId || null,
    imported_at: trade.importedAt || null,
    connection_id: trade.connectionId || null,
    custom_filters: Array.isArray(trade.customFilters) ? trade.customFilters : [],
    updated_at: now,
  };
}

export async function loadTradesFromSupabase(): Promise<Trade[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Ошибка загрузки trades из Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    throw error;
  }

  const rows = (data ?? []) as TradeRow[];
  return rows.map(rowToTrade);
}

export async function saveTradesToSupabase(trades: Trade[]): Promise<void> {
  const supabase = createClient();
  const rows = trades.map(tradeToRow);

  const { error } = await supabase
    .from("trades")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Ошибка сохранения trades в Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    console.error("rows sample:", rows[0]);
    throw error;
  }
}