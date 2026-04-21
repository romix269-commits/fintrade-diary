import type { TradingDiary } from "@/lib/fintrade/diaries-store";
import { createClient } from "@/lib/supabase/client";

type DiaryRow = {
  id: string;
  name: string;
  type: string;
  exchange: string | null;
  connection_id: string | null;
  currency: string | null;
  start_balance: number | string | null;
  manual_balance: number | string | null;
  created_at: string | null;
  updated_at: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rowToDiary(row: DiaryRow): TradingDiary {
  return {
    id: row.id,
    name: row.name,
    type: row.type === "exchange" ? "exchange" : "manual",
    exchange: row.exchange ?? undefined,
    connectionId: row.connection_id ?? undefined,
    currency: row.currency ?? "USD",
    startBalance: toNumber(row.start_balance, 0),
    manualBalance:
      row.manual_balance === null || row.manual_balance === undefined
        ? undefined
        : toNumber(row.manual_balance, 0),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

function diaryToRow(diary: TradingDiary) {
  const now = new Date().toISOString();

  return {
    id: diary.id,
    name: diary.name,
    type: diary.type || "manual",
    exchange: diary.exchange || null,
    connection_id: diary.connectionId || null,
    currency: diary.currency || "USD",
    start_balance: toNumber(diary.startBalance, 0),
    manual_balance:
      diary.manualBalance === undefined || diary.manualBalance === null
        ? null
        : toNumber(diary.manualBalance, 0),
    created_at: diary.createdAt || now,
    updated_at: now,
  };
}

export async function loadDiariesFromSupabase(): Promise<TradingDiary[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("diaries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Ошибка загрузки diaries из Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    throw error;
  }

  const rows = (data ?? []) as DiaryRow[];
  return rows.map(rowToDiary);
}

export async function saveDiariesToSupabase(diaries: TradingDiary[]): Promise<void> {
  const supabase = createClient();
  const rows = diaries.map(diaryToRow);

  const { error } = await supabase
    .from("diaries")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Ошибка сохранения diaries в Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    console.error("rows sample:", rows[0]);
    throw error;
  }
}

export async function deleteDiaryFromSupabase(diaryId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("diaries")
    .delete()
    .eq("id", diaryId);

  if (error) {
    console.error("Ошибка удаления diary из Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    throw error;
  }
}