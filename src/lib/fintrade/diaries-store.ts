export type TradingDiaryType = "exchange" | "broker" | "manual";

export interface TradingDiary {
  id: string;
  name: string;
  type: TradingDiaryType;
  exchange?: string;
  connectionId?: string;
  startBalance?: number;
  manualBalance?: number;
  currency?: string;
  createdAt: string;
  updatedAt: string;
}

const DIARIES_KEY = "fintrade_diaries_v1";
const ACTIVE_DIARY_KEY = "fintrade_active_diary_v1";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function createDiaryId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function normalizeDiary(value: unknown): TradingDiary | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<TradingDiary>;

  if (!raw.id || !raw.name || !raw.type) return null;

  const type =
    raw.type === "exchange" || raw.type === "broker" || raw.type === "manual"
      ? raw.type
      : "manual";

  return {
    id: String(raw.id),
    name: String(raw.name).trim(),
    type,
    exchange:
      typeof raw.exchange === "string" && raw.exchange.trim()
        ? raw.exchange.trim()
        : undefined,
    connectionId:
      typeof raw.connectionId === "string" && raw.connectionId.trim()
        ? raw.connectionId.trim()
        : undefined,
    startBalance:
      typeof raw.startBalance === "number" && Number.isFinite(raw.startBalance)
        ? raw.startBalance
        : undefined,
    manualBalance:
      typeof raw.manualBalance === "number" && Number.isFinite(raw.manualBalance)
        ? raw.manualBalance
        : undefined,
    currency:
      typeof raw.currency === "string" && raw.currency.trim()
        ? raw.currency.trim()
        : undefined,
    createdAt:
      typeof raw.createdAt === "string" && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function loadDiaries(): TradingDiary[] {
  const raw = load<unknown[]>(DIARIES_KEY, []);
  return raw.map(normalizeDiary).filter((item): item is TradingDiary => item !== null);
}

export function saveDiaries(diaries: TradingDiary[]) {
  save(DIARIES_KEY, diaries);
}

export function loadActiveDiaryId(): string | null {
  const raw = load<string | null>(ACTIVE_DIARY_KEY, null);
  return typeof raw === "string" && raw.trim() ? raw : null;
}

export function saveActiveDiaryId(diaryId: string) {
  save(ACTIVE_DIARY_KEY, diaryId);
}

export function createDefaultDiary(): TradingDiary {
  const now = new Date().toISOString();

  return {
    id: createDiaryId(),
    name: "Основной дневник",
    type: "manual",
    startBalance: 10000,
    currency: "USD",
    createdAt: now,
    updatedAt: now,
  };
}

export function createDiaryName(diaries: TradingDiary[]): string {
  let index = 1;
  const existingNames = new Set(diaries.map((d) => d.name.trim().toLowerCase()));

  while (existingNames.has(`дневник ${index}`)) {
    index += 1;
  }

  return `Дневник ${index}`;
}

export function createDiary(
  diaries: TradingDiary[],
  partial?: Partial<TradingDiary>
): TradingDiary {
  const now = new Date().toISOString();

  return {
    id: createDiaryId(),
    name: partial?.name?.trim() || createDiaryName(diaries),
    type:
      partial?.type === "exchange" ||
      partial?.type === "broker" ||
      partial?.type === "manual"
        ? partial.type
        : "manual",
    exchange: partial?.exchange?.trim() || undefined,
    connectionId: partial?.connectionId?.trim() || undefined,
    startBalance:
      typeof partial?.startBalance === "number" && Number.isFinite(partial.startBalance)
        ? partial.startBalance
        : undefined,
    manualBalance:
      typeof partial?.manualBalance === "number" && Number.isFinite(partial.manualBalance)
        ? partial.manualBalance
        : undefined,
    currency: partial?.currency?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function renameDiary(
  diaries: TradingDiary[],
  diaryId: string,
  nextName: string
): TradingDiary[] {
  const trimmedName = nextName.trim();
  if (!trimmedName) return diaries;

  return diaries.map((diary) =>
    diary.id === diaryId
      ? {
          ...diary,
          name: trimmedName,
          updatedAt: new Date().toISOString(),
        }
      : diary
  );
}

export function updateDiary(
  diaries: TradingDiary[],
  diaryId: string,
  patch: Partial<TradingDiary>
): TradingDiary[] {
  return diaries.map((diary) =>
    diary.id === diaryId
      ? {
          ...diary,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
      : diary
  );
}

export function removeDiary(diaries: TradingDiary[], diaryId: string): TradingDiary[] {
  return diaries.filter((diary) => diary.id !== diaryId);
}