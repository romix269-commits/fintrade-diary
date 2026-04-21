export interface TradeCustomFilter {
  key: string;
  value: string;
}

export interface Trade {
  id: string;
  date: string;
  time?: string;
  symbol: string;
  direction: string;
  strategy: string;
  signal?: string;
  entry: number;
  exit: number;
  size: number;
  pnl: number;
  rating: number;
  planned: string;
  emotion: string;
  psychology: string;
  notes: string;
  screenshots: string[];

  source?: "manual" | "imported";
  exchange?: string;
  connectionId?: string;
  importedAt?: string;
  externalId?: string;
  diaryId?: string;

  customFilters?: TradeCustomFilter[];
}

export interface JournalFolder {
  id: string;
  name: string;
  system?: boolean;
}

export interface JournalNote {
  id: string;
  journalId: string;
  title: string;
  text: string;
  createdAt: string;
  images: string[];
  diaryId?: string;
}

const TRADES_KEY = "fintrade_trades_v2";
const JOURNAL_KEY = "fintrade_notes_v3";
const JOURNAL_FOLDERS_KEY = "fintrade_journal_folders_v1";

export const DEMO_START_BALANCE = 10000;

export const DEFAULT_JOURNAL_FOLDERS: JournalFolder[] = [
  { id: "journal-plan", name: "Торговый план", system: true },
  { id: "journal-review", name: "Разбор недели", system: true },
  { id: "journal-mistakes", name: "Ошибки", system: true },
];

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
  localStorage.setItem(key, JSON.stringify(value));
}

export function createId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function normalizeTradeCustomFilters(value: unknown): TradeCustomFilter[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Partial<TradeCustomFilter>;
      const key = typeof raw.key === "string" ? raw.key.trim() : "";
      const val = typeof raw.value === "string" ? raw.value.trim() : "";

      if (!key || !val) return null;

      return {
        key,
        value: val,
      };
    })
    .filter((item): item is TradeCustomFilter => item !== null);
}

function normalizeTrade(value: unknown): Trade | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<Trade>;

  if (!raw.id || !raw.date || !raw.symbol) return null;

  return {
    id: String(raw.id),
    date: String(raw.date),
    time: typeof raw.time === "string" ? raw.time : undefined,
    symbol: String(raw.symbol),
    direction: String(raw.direction ?? ""),
    strategy: String(raw.strategy ?? ""),
    signal: typeof raw.signal === "string" ? raw.signal : undefined,
    entry: Number(raw.entry ?? 0),
    exit: Number(raw.exit ?? 0),
    size: Number(raw.size ?? 0),
    pnl: Number(raw.pnl ?? 0),
    rating: Number(raw.rating ?? 0),
    planned: String(raw.planned ?? "yes"),
    emotion: String(raw.emotion ?? ""),
    psychology: String(raw.psychology ?? ""),
    notes: String(raw.notes ?? ""),
    screenshots: Array.isArray(raw.screenshots) ? raw.screenshots : [],

    source:
      raw.source === "manual" || raw.source === "imported" ? raw.source : undefined,
    exchange:
      typeof raw.exchange === "string" && raw.exchange.trim()
        ? raw.exchange.trim()
        : undefined,
    connectionId: typeof raw.connectionId === "string" ? raw.connectionId : undefined,
    importedAt: typeof raw.importedAt === "string" ? raw.importedAt : undefined,
    externalId: typeof raw.externalId === "string" ? raw.externalId : undefined,
    diaryId: typeof raw.diaryId === "string" && raw.diaryId.trim() ? raw.diaryId : undefined,

    customFilters: normalizeTradeCustomFilters(raw.customFilters),
  };
}

export function loadTrades(): Trade[] {
  const raw = load<unknown[]>(TRADES_KEY, []);
  return raw.map(normalizeTrade).filter((item): item is Trade => item !== null);
}

export function saveTrades(trades: Trade[]) {
  save(TRADES_KEY, trades);
}

export function loadJournal(): JournalNote[] {
  const raw = load<any[]>(JOURNAL_KEY, []);

  return raw.map((note) => ({
    id: String(note.id ?? createId()),
    journalId:
      typeof note.journalId === "string" && note.journalId.trim()
        ? note.journalId
        : "journal-plan",
    title: String(note.title ?? ""),
    text: String(note.text ?? ""),
    createdAt:
      typeof note.createdAt === "string" && note.createdAt
        ? note.createdAt
        : new Date().toISOString(),
    images: Array.isArray(note.images) ? note.images : [],
    diaryId: typeof note.diaryId === "string" && note.diaryId.trim() ? note.diaryId : undefined,
  }));
}

export function saveJournal(notes: JournalNote[]) {
  save(JOURNAL_KEY, notes);
}

export function loadJournalFolders(): JournalFolder[] {
  const folders = load<JournalFolder[]>(JOURNAL_FOLDERS_KEY, []);

  if (!folders.length) return DEFAULT_JOURNAL_FOLDERS;

  const existingIds = new Set(folders.map((folder) => folder.id));
  const missingSystemFolders = DEFAULT_JOURNAL_FOLDERS.filter(
    (folder) => !existingIds.has(folder.id)
  );

  return [...folders, ...missingSystemFolders];
}

export function saveJournalFolders(folders: JournalFolder[]) {
  save(JOURNAL_FOLDERS_KEY, folders);
}

export function getDemoTrades(): Trade[] {
  return [
    {
      id: createId(),
      date: "2026-03-01",
      time: "09:15",
      symbol: "XAUUSDb",
      direction: "Лонг",
      strategy: "Пробой H1",
      signal: "Закрепление выше уровня",
      entry: 2898.4,
      exit: 2909.8,
      size: 0.01,
      pnl: 11.4,
      rating: 4,
      planned: "yes",
      emotion: "Спокойствие",
      psychology: "Вход по плану после закрепления выше уровня. Без спешки.",
      notes: "Чистый пробой азиатского диапазона с подтверждением импульса.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [
        { key: "Сессия", value: "Лондон" },
        { key: "Таймфрейм", value: "M15" },
      ],
    },
    {
      id: createId(),
      date: "2026-03-02",
      time: "11:40",
      symbol: "XAUUSDb",
      direction: "Шорт",
      strategy: "Ложный пробой",
      signal: "Возврат под уровень",
      entry: 2912.3,
      exit: 2904.5,
      size: 0.02,
      pnl: 15.6,
      rating: 5,
      planned: "yes",
      emotion: "Уверенность",
      psychology: "Дождался возврата под уровень, вход аккуратный.",
      notes: "Хороший вход по тренду после неудачного выноса.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [
        { key: "Сессия", value: "Европа" },
        { key: "Контекст", value: "Ложный пробой" },
      ],
    },
    {
      id: createId(),
      date: "2026-03-04",
      time: "14:10",
      symbol: "EURUSD",
      direction: "Лонг",
      strategy: "Откат к EMA",
      signal: "Тест EMA",
      entry: 1.0824,
      exit: 1.0799,
      size: 0.1,
      pnl: -25.0,
      rating: 2,
      planned: "yes",
      emotion: "Нервозность",
      psychology: "Сценарий был корректный, но рынок его не подтвердил.",
      notes: "Стоп по системе. Ошибки в исполнении нет.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [
        { key: "Таймфрейм", value: "H1" },
        { key: "Волатильность", value: "Низкая" },
      ],
    },
    {
      id: createId(),
      date: "2026-03-05",
      time: "16:25",
      symbol: "BTCUSDT",
      direction: "Лонг",
      strategy: "Импульсный пробой",
      signal: "Рост объёма",
      entry: 84200,
      exit: 85680,
      size: 0.01,
      pnl: 48.0,
      rating: 5,
      planned: "yes",
      emotion: "Концентрация",
      psychology: "Позиция удержана по плану, без преждевременного выхода.",
      notes: "Один из лучших трейдов недели.",
      screenshots: [],
      source: "manual",
      exchange: "Bybit",
      customFilters: [
        { key: "Сессия", value: "Нью-Йорк" },
        { key: "Тип входа", value: "Импульс" },
      ],
    },
    {
      id: createId(),
      date: "2026-03-06",
      time: "10:05",
      symbol: "XAUUSDb",
      direction: "Шорт",
      strategy: "Разворот от сопротивления",
      signal: "Касание сопротивления",
      entry: 2920.2,
      exit: 2924.4,
      size: 0.01,
      pnl: -4.2,
      rating: 3,
      planned: "no",
      emotion: "FOMO",
      psychology: "Вошёл без нормального подтверждения, из страха упустить движение.",
      notes: "Импульсивная сделка, лучше было пропустить.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [{ key: "Дисциплина", value: "Нарушение" }],
    },
    {
      id: createId(),
      date: "2026-03-08",
      time: "15:00",
      symbol: "NAS100",
      direction: "Лонг",
      strategy: "Продолжение тренда",
      signal: "Ретест импульса",
      entry: 20340,
      exit: 20495,
      size: 0.05,
      pnl: 31.0,
      rating: 4,
      planned: "yes",
      emotion: "Спокойствие",
      psychology: "Понятный сетап, уверенное сопровождение позиции.",
      notes: "Рынок дал хорошее продолжение импульса.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [
        { key: "Фаза рынка", value: "Тренд" },
        { key: "Таймфрейм", value: "M5" },
      ],
    },
    {
      id: createId(),
      date: "2026-03-10",
      time: "09:50",
      symbol: "XAUUSDb",
      direction: "Лонг",
      strategy: "ATR breakout",
      signal: "Пробой ATR-диапазона",
      entry: 2931.1,
      exit: 2944.6,
      size: 0.03,
      pnl: 40.5,
      rating: 5,
      planned: "yes",
      emotion: "Уверенность",
      psychology: "Один из эталонных входов. Всё выполнено строго по системе.",
      notes: "Показательная сделка для презентации ценности дневника.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [
        { key: "Модель", value: "Breakout" },
        { key: "Сессия", value: "Лондон" },
      ],
    },
    {
      id: createId(),
      date: "2026-03-11",
      time: "13:20",
      symbol: "EURUSD",
      direction: "Шорт",
      strategy: "Пробой минимума дня",
      signal: "Выход ниже минимума",
      entry: 1.078,
      exit: 1.0801,
      size: 0.1,
      pnl: -21.0,
      rating: 2,
      planned: "no",
      emotion: "Импульсивность",
      psychology: "Поздно зашёл в движение, не было качественной точки.",
      notes: "Классический пример плохого места для входа.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [{ key: "Дисциплина", value: "Опоздание во вход" }],
    },
    {
      id: createId(),
      date: "2026-03-12",
      time: "08:35",
      symbol: "XAUUSDb",
      direction: "Лонг",
      strategy: "Пробой диапазона",
      signal: "Выход из флэта",
      entry: 2948.3,
      exit: 2956.7,
      size: 0.02,
      pnl: 16.8,
      rating: 4,
      planned: "yes",
      emotion: "Спокойствие",
      psychology: "Чистый рабочий вход, без лишних эмоций.",
      notes: "Обычная дисциплинированная сделка.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [
        { key: "Фаза рынка", value: "Флэт" },
        { key: "Тип входа", value: "Пробой" },
      ],
    },
    {
      id: createId(),
      date: "2026-03-13",
      time: "17:10",
      symbol: "XAUUSDb",
      direction: "Шорт",
      strategy: "Контртренд от экстремума",
      signal: "Отбой от экстремума",
      entry: 2962.0,
      exit: 2968.4,
      size: 0.01,
      pnl: -6.4,
      rating: 2,
      planned: "no",
      emotion: "Жадность",
      psychology: "Контртренд без достаточного подтверждения. Хотел поймать вершину.",
      notes: "Подходит как пример нарушения торгового плана.",
      screenshots: [],
      source: "manual",
      exchange: "Forex",
      customFilters: [
        { key: "Контекст", value: "Контртренд" },
        { key: "Риск-профиль", value: "Агрессивный" },
      ],
    },
  ];
}

export function getDemoJournalFolders(): JournalFolder[] {
  return [...DEFAULT_JOURNAL_FOLDERS];
}

export function getDemoJournal(): JournalNote[] {
  return [
    {
      id: createId(),
      journalId: "journal-plan",
      title: "Торговый план недели",
      text: "Фокус на XAUUSDb и NAS100. Не входить в рынок без подтверждения по H1. Ограничение: максимум 2 сделки в день и только по понятному сценарию.",
      createdAt: new Date().toISOString(),
      images: [],
    },
    {
      id: createId(),
      journalId: "journal-mistakes",
      title: "Ключевая ошибка",
      text: "Есть склонность входить после сильного движения из страха упустить импульс. Нужно ждать ретест, подтверждение или пропускать рынок.",
      createdAt: new Date().toISOString(),
      images: [],
    },
    {
      id: createId(),
      journalId: "journal-review",
      title: "Что работает лучше всего",
      text: "Пробой диапазона на золоте с фильтром по тренду и входом после закрытия H1. Эти сделки самые стабильные по качеству исполнения.",
      createdAt: new Date().toISOString(),
      images: [],
    },
  ];
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}

export function avg(arr: number[]): number {
  return arr.length ? sum(arr) / arr.length : 0;
}

export function fmt(v: number): string {
  return Number(v || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function cls(v: number): string {
  if (v > 0) return "green";
  if (v < 0) return "red";
  return "yellow";
}

export function colorClass(v: number): string {
  if (v > 0) return "text-[#4de2c5]";
  if (v < 0) return "text-[#ff6b81]";
  return "text-[#fbbf24]";
}

export function stars(n: number): string {
  return "★".repeat(Number(n || 0)) + "☆".repeat(5 - Number(n || 0));
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

export function getEquityCurve(trades: Trade[]): number[] {
  const ordered = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let acc = DEMO_START_BALANCE;

  return ordered.map((t) => {
    acc += Number(t.pnl) || 0;
    return acc;
  });
}

export function getTradeStats(trades: Trade[]) {
  const totalPnl = sum(trades.map((t) => t.pnl));
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const total = trades.length;
  const winRate = total ? (wins.length / total) * 100 : 0;
  const gp = sum(wins.map((t) => t.pnl));
  const gl = Math.abs(sum(losses.map((t) => t.pnl)));
  const pf = gl === 0 ? gp : gp / gl;
  const best = trades.length ? Math.max(...trades.map((t) => Number(t.pnl) || 0)) : 0;
  const worst = trades.length ? Math.min(...trades.map((t) => Number(t.pnl) || 0)) : 0;

  return { totalPnl, wins, losses, total, winRate, gp, gl, pf, best, worst };
}

export function calculateMaxDrawdown(trades: Trade[]): number {
  const curve = getEquityCurve(trades);
  let peak = curve.length ? curve[0] : DEMO_START_BALANCE;
  let maxDd = 0;

  for (const value of curve) {
    if (value > peak) peak = value;
    const dd = peak - value;
    if (dd > maxDd) maxDd = dd;
  }

  return maxDd;
}

export function calculateStreaks(trades: Trade[]) {
  const ordered = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentType: string | null = null;
  let currentCount = 0;
  let maxWins = 0;
  let maxLosses = 0;
  let currentLabel = "Нет серии";
  let currentSeries = 0;

  ordered.forEach((t) => {
    const type = t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : "flat";
    if (type === "flat") return;

    if (type === currentType) currentCount++;
    else {
      currentType = type;
      currentCount = 1;
    }

    if (type === "win" && currentCount > maxWins) maxWins = currentCount;
    if (type === "loss" && currentCount > maxLosses) maxLosses = currentCount;

    currentLabel = type === "win" ? "Победы" : "Убытки";
    currentSeries = currentCount;
  });

  return { maxWins, maxLosses, currentLabel, currentSeries };
}