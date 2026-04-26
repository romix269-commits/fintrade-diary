"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trade,
  JournalNote,
  JournalFolder,
  loadTrades,
  saveTrades,
  loadJournal,
  saveJournal,
  loadJournalFolders,
  saveJournalFolders,
  getDemoTrades,
  getDemoJournal,
  getDemoJournalFolders,
  fmt,
  colorClass,
  stars,
  getTradeStats,
  calculateStreaks,
} from "@/lib/fintrade/store";
import {
  TradingDiary,
  loadDiaries,
  saveDiaries,
  loadActiveDiaryId,
  saveActiveDiaryId,
  createDefaultDiary,
  createDiary,
  renameDiary,
  removeDiary,
  updateDiary,
} from "@/lib/fintrade/diaries-store";
import { drawEquityChart, drawWeekdayBars } from "@/lib/fintrade/charts";
import { loadConnections } from "@/components/fintrade/exchanges";
import type { ExchangeConnection } from "@/components/fintrade/exchanges";
import ConnectionsView from "@/components/fintrade/ConnectionsView";
import JournalView from "@/components/fintrade/JournalView";
import TradesView from "@/components/fintrade/TradesView";
import AnalyticsView from "@/components/fintrade/AnalyticsView";
import PsychologyView from "@/components/fintrade/PsychologyView";
import NeuroAssistantView from "@/components/fintrade/NeuroAssistantView";

import {
  loadTradesFromSupabase,
  saveTradesToSupabase,
} from "@/lib/fintrade/trades-supabase";
import {
  loadDiariesFromSupabase,
  saveDiariesToSupabase,
} from "@/lib/fintrade/diaries-supabase";
import {
  loadJournalFromSupabase,
  saveJournalToSupabase,
} from "@/lib/fintrade/journal-supabase";
import {
  loadJournalFoldersFromSupabase,
  saveJournalFoldersToSupabase,
} from "@/lib/fintrade/journal-folders-supabase";

type ViewId =
  | "overview"
  | "trades"
  | "analytics"
  | "journal"
  | "psychology"
  | "neuro"
  | "connections";

type AppMode = "demo" | "user";
type NoticeType = "success" | "error" | "info";

type Notice = {
  type: NoticeType;
  text: string;
};

type CalendarTradeDay = {
  date: string;
  day: number;
  pnl: number;
  trades: Trade[];
  inCurrentMonth: boolean;
};

type CalendarMonthData = {
  title: string;
  subtitle: string;
  days: CalendarTradeDay[];
  year: number;
  month: number;
};

type BalanceEditMode = "manual" | "start";

type OverviewGroupModal =
  | { type: "symbol"; value: string }
  | { type: "emotion"; value: string }
  | null;

const APP_MODE_KEY = "fintrade_app_mode_v1";

const NAV_ITEMS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Главная",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "trades",
    label: "Сделки",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19h16" />
        <path d="M6 17V7" />
        <path d="M12 17V4" />
        <path d="M18 17v-9" />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Аналитика",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-7" />
      </svg>
    ),
  },
  {
    id: "journal",
    label: "Журнал",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: "psychology",
    label: "Психология",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <path d="M9 9h.01" />
        <path d="M15 9h.01" />
      </svg>
    ),
  },
  {
    id: "neuro",
    label: "Нейропомощник",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3a3 3 0 0 0-3 3v1H8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h1v1a3 3 0 0 0 6 0v-1h1a3 3 0 0 0 3-3v-2a3 3 0 0 0-3-3h-1V6a3 3 0 0 0-3-3z" />
        <path d="M9 15h6" />
        <path d="M10 18h4" />
      </svg>
    ),
  },
  {
    id: "connections",
    label: "Подключения",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
];

const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}.${month}.${year}`;
}

function sumConnectionBalances(connection: ExchangeConnection | null): number | null {
  if (!connection?.balances || !connection.balances.length) return null;

  const total = connection.balances.reduce((acc, item) => {
    const free = Number(item.free || 0);
    const locked = Number(item.locked || 0);
    return acc + (Number.isFinite(free) ? free : 0) + (Number.isFinite(locked) ? locked : 0);
  }, 0);

  return Number.isFinite(total) ? total : null;
}

function getCalendarMonthData(trades: Trade[], year: number, month: number): CalendarMonthData {
  const currentMonthIndex = month - 1;

  const monthTrades = trades.filter((trade) => {
    const [y, m] = trade.date.split("-").map(Number);
    return y === year && m === month;
  });

  const monthPnl = monthTrades.reduce((sum, trade) => sum + trade.pnl, 0);

  const tradeMap = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const key = trade.date;
    const list = tradeMap.get(key) || [];
    list.push(trade);
    tradeMap.set(key, list);
  });

  const firstDay = new Date(year, currentMonthIndex, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, currentMonthIndex, 1 - startWeekday);

  const days: CalendarTradeDay[] = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const dateKey = toDateKey(date);
    const dayTrades = (tradeMap.get(dateKey) || []).slice().sort((a, b) => {
      const aTime = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
      const bTime = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
      return aTime - bTime;
    });

    const pnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);

    return {
      date: dateKey,
      day: date.getDate(),
      pnl,
      trades: dayTrades,
      inCurrentMonth:
        date.getFullYear() === year && date.getMonth() === currentMonthIndex,
    };
  });

  return {
    title: "Календарь торговли",
    subtitle: `${monthTrades.length} сделок · P/L ${monthPnl >= 0 ? "+" : ""}${fmt(monthPnl)}`,
    days,
    year,
    month,
  };
}

function calendarPnlClass(value: number | null) {
  if (value == null) return "text-[#f6c85f]";
  if (value > 0) return "text-[#4de2c5]";
  if (value < 0) return "text-[#ff6b81]";
  return "text-[#9db9d6]";
}

function getSymbolStats(trades: Trade[]) {
  const map = new Map<string, number>();

  for (const trade of trades) {
    map.set(trade.symbol, (map.get(trade.symbol) ?? 0) + trade.pnl);
  }

  return [...map.entries()]
    .map(([symbol, pnl]) => ({ symbol, pnl }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}

function StatIcon({
  kind,
}: {
  kind: "pnl" | "rate" | "pf" | "count" | "best" | "worst";
}) {
  const icons = {
    pnl: "◔",
    rate: "◉",
    pf: "▥",
    count: "▤",
    best: "↗",
    worst: "↘",
  };

  return <span className="metric-icon">{icons[kind]}</span>;
}

function OverviewMetricCard({
  label,
  value,
  valueClassName = "text-white",
  subtext,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(10,18,34,.62)] px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-[#6f8aa8]">{label}</div>
      <div className={`mt-2 text-[22px] font-extrabold leading-none ${valueClassName}`}>{value}</div>
      {subtext && <div className="mt-2 text-xs text-[#8aa6c7]">{subtext}</div>}
    </div>
  );
}

function getSavedMode(): AppMode {
  if (typeof window === "undefined") return "demo";

  try {
    const raw = localStorage.getItem(APP_MODE_KEY);
    return raw === "user" ? "user" : "demo";
  } catch {
    return "demo";
  }
}

function saveMode(mode: AppMode) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(APP_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

function createRecoveredDiary(options: {
  id: string;
  index: number;
  trades: Trade[];
  connections: ExchangeConnection[];
}): TradingDiary {
  const now = new Date().toISOString();
  const relatedTrades = options.trades.filter((trade) => trade.diaryId === options.id);
  const firstTradeWithConnection = relatedTrades.find((trade) => trade.connectionId);
  const firstTrade = relatedTrades[0];

  const matchedConnection = firstTradeWithConnection?.connectionId
    ? options.connections.find((c) => c.id === firstTradeWithConnection.connectionId) ?? null
    : null;

  const exchange = matchedConnection?.exchange || firstTrade?.exchange || undefined;
  const connectionId = matchedConnection?.id || firstTradeWithConnection?.connectionId || undefined;

  const baseName =
    matchedConnection?.name ||
    (exchange ? `Дневник ${String(exchange).toUpperCase()}` : `Дневник ${options.index}`);

  return {
    id: options.id,
    name: baseName,
    type: connectionId ? "exchange" : "manual",
    exchange,
    connectionId,
    currency:
      matchedConnection?.exchange === "binance" || matchedConnection?.exchange === "bybit"
        ? "USDT"
        : "USD",
    createdAt: now,
    updatedAt: now,
  };
}

function ensureDiariesCoverStoredData(
  diaries: TradingDiary[],
  trades: Trade[],
  journal: JournalNote[],
  connections: ExchangeConnection[]
) {
  const result = [...diaries];
  const existingIds = new Set(result.map((d) => d.id));

  const referencedIds = Array.from(
    new Set(
      [
        ...trades.map((trade) => trade.diaryId).filter(Boolean),
        ...journal.map((note) => note.diaryId).filter(Boolean),
      ] as string[]
    )
  );

  let counter = result.length + 1;

  for (const id of referencedIds) {
    if (existingIds.has(id)) continue;

    const recovered = createRecoveredDiary({
      id,
      index: counter,
      trades,
      connections,
    });

    result.push(recovered);
    existingIds.add(id);
    counter += 1;
  }

  if (!result.length) {
    result.push(createDefaultDiary());
  }

  return result;
}

function resolveTradeDiaryId(
  trade: Trade,
  diaries: TradingDiary[],
  fallbackDiaryId: string
) {
  if (trade.diaryId && diaries.some((d) => d.id === trade.diaryId)) {
    return trade.diaryId;
  }

  if (trade.connectionId) {
    const matchedDiary = diaries.find(
      (d) => d.connectionId && d.connectionId === trade.connectionId
    );

    if (matchedDiary) {
      return matchedDiary.id;
    }
  }

  if (diaries.length === 1) {
    return diaries[0].id;
  }

  return fallbackDiaryId;
}

function resolveJournalDiaryId(
  note: JournalNote,
  diaries: TradingDiary[],
  fallbackDiaryId: string
) {
  if (note.diaryId && diaries.some((d) => d.id === note.diaryId)) {
    return note.diaryId;
  }

  return fallbackDiaryId;
}

type HydratedAppData = {
  trades: Trade[];
  journal: JournalNote[];
  folders: JournalFolder[];
  diaries: TradingDiary[];
  activeDiaryId: string | null;
  mode: AppMode;
};

function buildHydratedAppData(params: {
  mode: AppMode;
  trades: Trade[];
  journal: JournalNote[];
  folders: JournalFolder[];
  diaries: TradingDiary[];
  loadedActiveDiaryId: string | null;
  connections: ExchangeConnection[];
}): HydratedAppData {
  let t = [...params.trades];
  let j = [...params.journal];
  let f = [...params.folders];
  let loadedDiaries = [...params.diaries];

  if (t.length === 0 && params.mode === "demo") {
    t = getDemoTrades();
    j = getDemoJournal();
    f = getDemoJournalFolders();

    if (!loadedDiaries.length) {
      loadedDiaries = loadDiaries();
    }
  }

  loadedDiaries = ensureDiariesCoverStoredData(loadedDiaries, t, j, params.connections);

  const safeActiveDiaryId =
    params.loadedActiveDiaryId && loadedDiaries.some((d) => d.id === params.loadedActiveDiaryId)
      ? params.loadedActiveDiaryId
      : loadedDiaries[0]?.id ?? null;

  const fallbackDiaryId =
    loadedDiaries[0]?.id ?? safeActiveDiaryId ?? createDefaultDiary().id;

  const normalizedTrades = t.map((trade) => ({
    ...trade,
    diaryId: resolveTradeDiaryId(trade, loadedDiaries, fallbackDiaryId),
  }));

  const normalizedJournal = j.map((note) => ({
    ...note,
    diaryId: resolveJournalDiaryId(note, loadedDiaries, fallbackDiaryId),
  }));

  return {
    trades: normalizedTrades,
    journal: normalizedJournal,
    folders: f,
    diaries: loadedDiaries,
    activeDiaryId: safeActiveDiaryId,
    mode: params.mode,
  };
}

export default function AppClient() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [journal, setJournal] = useState<JournalNote[]>([]);
  const [journalFolders, setJournalFolders] = useState<JournalFolder[]>([]);
  const [tradeModalId, setTradeModalId] = useState<string | null>(null);
  const [imageViewerSrc, setImageViewerSrc] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("demo");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [diaries, setDiaries] = useState<TradingDiary[]>([]);
  const [activeDiaryId, setActiveDiaryId] = useState<string | null>(null);
  const [connectionsVersion, setConnectionsVersion] = useState(0);

  const [isRenameDiaryModalOpen, setIsRenameDiaryModalOpen] = useState(false);
  const [renameDiaryValue, setRenameDiaryValue] = useState("");

  const [isDeleteDiaryModalOpen, setIsDeleteDiaryModalOpen] = useState(false);

  const [isBalanceDiaryModalOpen, setIsBalanceDiaryModalOpen] = useState(false);
  const [balanceEditMode, setBalanceEditMode] = useState<BalanceEditMode>("manual");
  const [balanceValueInput, setBalanceValueInput] = useState("");
  const [balanceCurrencyInput, setBalanceCurrencyInput] = useState("USD");

  const [isAttachConnectionModalOpen, setIsAttachConnectionModalOpen] = useState(false);
  const [selectedAttachConnectionId, setSelectedAttachConnectionId] = useState<string>("");

  const showNotice = useCallback((type: NoticeType, text: string) => {
    setNotice({ type, text });
  }, []);

  const persistTrades = useCallback(async (nextTrades: Trade[]) => {
    setTrades(nextTrades);
    saveTrades(nextTrades);

    try {
      await saveTradesToSupabase(nextTrades);
    } catch (error) {
      console.error("Ошибка сохранения сделок в Supabase:", error);
    }
  }, []);

  const persistJournal = useCallback(async (nextJournal: JournalNote[]) => {
    setJournal(nextJournal);
    saveJournal(nextJournal);

    try {
      await saveJournalToSupabase(nextJournal);
    } catch (error) {
      console.error("Ошибка сохранения journal_notes в Supabase:", error);
    }
  }, []);

  const persistJournalFolders = useCallback(async (nextFolders: JournalFolder[]) => {
    setJournalFolders(nextFolders);
    saveJournalFolders(nextFolders);

    try {
      await saveJournalFoldersToSupabase(nextFolders);
    } catch (error) {
      console.error("Ошибка сохранения journal_folders в Supabase:", error);
    }
  }, []);

  const persistDiaries = useCallback(async (nextDiaries: TradingDiary[]) => {
    setDiaries(nextDiaries);
    saveDiaries(nextDiaries);

    try {
      await saveDiariesToSupabase(nextDiaries);
    } catch (error) {
      console.error("Ошибка сохранения дневников в Supabase:", error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const mode = getSavedMode();
    setAppMode(mode);

    const connections = loadConnections();

    const localHydrated = buildHydratedAppData({
      mode,
      trades: loadTrades(),
      journal: loadJournal(),
      folders: loadJournalFolders(),
      diaries: loadDiaries(),
      loadedActiveDiaryId: loadActiveDiaryId(),
      connections,
    });

    saveTrades(localHydrated.trades);
    saveJournal(localHydrated.journal);
    saveJournalFolders(localHydrated.folders);
    saveDiaries(localHydrated.diaries);
    if (localHydrated.activeDiaryId) {
      saveActiveDiaryId(localHydrated.activeDiaryId);
    }

    setTrades(localHydrated.trades);
    setJournal(localHydrated.journal);
    setJournalFolders(localHydrated.folders);
    setDiaries(localHydrated.diaries);
    setActiveDiaryId(localHydrated.activeDiaryId);

    const syncFromSupabase = async () => {
      try {
        const [supabaseTrades, supabaseJournal, supabaseFolders, supabaseDiaries] =
          await Promise.all([
            loadTradesFromSupabase(),
            loadJournalFromSupabase(),
            loadJournalFoldersFromSupabase(),
            loadDiariesFromSupabase(),
          ]);

        if (!mounted) return;

        const supabaseHydrated = buildHydratedAppData({
          mode,
          trades: supabaseTrades,
          journal: supabaseJournal,
          folders: supabaseFolders,
          diaries: supabaseDiaries,
          loadedActiveDiaryId: loadActiveDiaryId(),
          connections,
        });

        saveTrades(supabaseHydrated.trades);
        saveJournal(supabaseHydrated.journal);
        saveJournalFolders(supabaseHydrated.folders);
        saveDiaries(supabaseHydrated.diaries);
        if (supabaseHydrated.activeDiaryId) {
          saveActiveDiaryId(supabaseHydrated.activeDiaryId);
        }

        setTrades(supabaseHydrated.trades);
        setJournal(supabaseHydrated.journal);
        setJournalFolders(supabaseHydrated.folders);
        setDiaries(supabaseHydrated.diaries);
        setActiveDiaryId(supabaseHydrated.activeDiaryId);
      } catch (error) {
        console.error("Ошибка фоновой загрузки данных из Supabase:", error);
      }
    };

    void syncFromSupabase();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleOpenTrade = (event: Event) => {
      const customEvent = event as CustomEvent<{ tradeId?: string }>;
      const tradeId = customEvent.detail?.tradeId;

      if (!tradeId) return;
      setTradeModalId(tradeId);
    };

    const handleConnectionsChanged = () => {
      setConnectionsVersion((prev) => prev + 1);
    };

    window.addEventListener("fintrade:open-trade", handleOpenTrade as EventListener);
    window.addEventListener("storage", handleConnectionsChanged);

    return () => {
      window.removeEventListener("fintrade:open-trade", handleOpenTrade as EventListener);
      window.removeEventListener("storage", handleConnectionsChanged);
    };
  }, []);

  const connections = useMemo(() => loadConnections(), [connectionsVersion, activeView]);

  const activeDiary = useMemo(
    () => diaries.find((diary) => diary.id === activeDiaryId) ?? null,
    [diaries, activeDiaryId]
  );

  const activeConnection = useMemo(() => {
    if (!activeDiary?.connectionId) return null;
    return connections.find((connection) => connection.id === activeDiary.connectionId) ?? null;
  }, [connections, activeDiary]);

  const scopedTrades = useMemo(() => {
    if (!activeDiaryId) return [];
    return trades.filter((trade) => trade.diaryId === activeDiaryId);
  }, [trades, activeDiaryId]);

  const scopedJournal = useMemo(() => {
    if (!activeDiaryId) return [];
    return journal.filter((note) => note.diaryId === activeDiaryId);
  }, [journal, activeDiaryId]);

  const scopedJournalFolders = useMemo(() => {
    if (!activeDiaryId) return journalFolders;
    return journalFolders.filter((folder) => {
      const anyFolder = folder as unknown as Record<string, unknown>;
      const diaryId =
        typeof anyFolder.diaryId === "string"
          ? anyFolder.diaryId
          : typeof anyFolder.diary_id === "string"
            ? String(anyFolder.diary_id)
            : null;

      return !diaryId || diaryId === activeDiaryId;
    });
  }, [journalFolders, activeDiaryId]);

  const stats = getTradeStats(scopedTrades);
  const streaks = calculateStreaks(scopedTrades);
  const plannedCount = scopedTrades.filter((t) => t.planned === "yes").length;

  const diaryPnl = stats.totalPnl;
  const connectionBalance = useMemo(() => sumConnectionBalances(activeConnection), [activeConnection]);

  const startBalance = activeDiary?.startBalance ?? 0;
  const manualBalance = activeDiary?.manualBalance;

  const currentBalance = useMemo(() => {
    if (connectionBalance != null) return connectionBalance;
    if (typeof manualBalance === "number" && Number.isFinite(manualBalance)) return manualBalance;
    return startBalance + diaryPnl;
  }, [connectionBalance, manualBalance, startBalance, diaryPnl]);

  const balanceCurrency = activeDiary?.currency || "USD";

  const balanceSourceLabel = useMemo(() => {
    if (connectionBalance != null && activeConnection) {
      return `Источник: ${activeConnection.name}`;
    }

    if (typeof manualBalance === "number" && Number.isFinite(manualBalance)) {
      return "Источник: ручной текущий баланс";
    }

    if (typeof startBalance === "number" && Number.isFinite(startBalance) && startBalance > 0) {
      return "Источник: стартовый баланс + P/L";
    }

    return "Источник: P/L";
  }, [connectionBalance, activeConnection, manualBalance, startBalance]);

  const growthPercent = useMemo(() => {
    if (!startBalance) return 0;

    const growthBase =
      connectionBalance != null
        ? connectionBalance - startBalance
        : typeof manualBalance === "number" && Number.isFinite(manualBalance)
          ? manualBalance - startBalance
          : diaryPnl;

    return (growthBase / startBalance) * 100;
  }, [startBalance, connectionBalance, manualBalance, diaryPnl]);

  const equityStartBalance = useMemo(() => {
    if (connectionBalance != null && startBalance > 0) return startBalance;
    if (typeof manualBalance === "number" && Number.isFinite(manualBalance) && startBalance > 0) {
      return startBalance;
    }
    return startBalance > 0 ? startBalance : 0;
  }, [connectionBalance, manualBalance, startBalance]);

  const handleCreateDiary = useCallback(() => {
    const nextDiary = createDiary(diaries);
    const nextDiaries = [...diaries, nextDiary];

    void persistDiaries(nextDiaries);
    setActiveDiaryId(nextDiary.id);
    saveActiveDiaryId(nextDiary.id);

    showNotice("success", `Создан новый дневник: ${nextDiary.name}`);
  }, [diaries, persistDiaries, showNotice]);

  const handleChangeDiary = useCallback((diaryId: string) => {
    setActiveDiaryId(diaryId);
    saveActiveDiaryId(diaryId);
  }, []);

  const handleRenameDiary = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    setRenameDiaryValue(activeDiary.name);
    setIsRenameDiaryModalOpen(true);
  }, [activeDiary, showNotice]);

  const handleConfirmRenameDiary = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    const trimmedName = renameDiaryValue.trim();

    if (!trimmedName) {
      showNotice("error", "Введите название дневника.");
      return;
    }

    if (
      diaries.some(
        (diary) =>
          diary.id !== activeDiary.id &&
          diary.name.trim().toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      showNotice("error", "Дневник с таким названием уже существует.");
      return;
    }

    const nextDiaries = renameDiary(diaries, activeDiary.id, trimmedName);
    void persistDiaries(nextDiaries);
    setIsRenameDiaryModalOpen(false);
    setRenameDiaryValue("");
    showNotice("success", `Дневник переименован: ${trimmedName}`);
  }, [activeDiary, diaries, renameDiaryValue, persistDiaries, showNotice]);

  const handleDeleteDiary = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    if (diaries.length <= 1) {
      showNotice("error", "Нельзя удалить последний дневник.");
      return;
    }

    setIsDeleteDiaryModalOpen(true);
  }, [activeDiary, diaries.length, showNotice]);

  const handleConfirmDeleteDiary = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    if (diaries.length <= 1) {
      showNotice("error", "Нельзя удалить последний дневник.");
      setIsDeleteDiaryModalOpen(false);
      return;
    }

    const nextDiaries = removeDiary(diaries, activeDiary.id);
    const nextActiveDiaryId = nextDiaries[0]?.id ?? null;

    const nextTrades = trades.filter((trade) => trade.diaryId !== activeDiary.id);
    const nextJournal = journal.filter((note) => note.diaryId !== activeDiary.id);
    const nextFolders = journalFolders.filter((folder) => {
      const anyFolder = folder as unknown as Record<string, unknown>;
      const folderDiaryId =
        typeof anyFolder.diaryId === "string"
          ? anyFolder.diaryId
          : typeof anyFolder.diary_id === "string"
            ? String(anyFolder.diary_id)
            : null;
      return folderDiaryId !== activeDiary.id;
    });

    void persistDiaries(nextDiaries);
    void persistTrades(nextTrades);
    void persistJournal(nextJournal);
    void persistJournalFolders(nextFolders);

    if (nextActiveDiaryId) {
      setActiveDiaryId(nextActiveDiaryId);
      saveActiveDiaryId(nextActiveDiaryId);
    } else {
      setActiveDiaryId(null);
    }

    setTradeModalId((prev) => {
      if (!prev) return prev;
      const exists = nextTrades.some((trade) => trade.id === prev);
      return exists ? prev : null;
    });

    setIsDeleteDiaryModalOpen(false);
    showNotice("info", `Дневник "${activeDiary.name}" удалён.`);
  }, [
    activeDiary,
    diaries,
    trades,
    journal,
    journalFolders,
    persistDiaries,
    persistTrades,
    persistJournal,
    persistJournalFolders,
    showNotice,
  ]);

  const handleEditDiaryBalance = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    const initialMode: BalanceEditMode =
      typeof activeDiary.manualBalance === "number" && Number.isFinite(activeDiary.manualBalance)
        ? "manual"
        : "start";

    setBalanceEditMode(initialMode);
    setBalanceValueInput(
      initialMode === "manual"
        ? String(activeDiary.manualBalance ?? "")
        : String(activeDiary.startBalance ?? "")
    );
    setBalanceCurrencyInput(activeDiary.currency || "USD");
    setIsBalanceDiaryModalOpen(true);
  }, [activeDiary, showNotice]);

  const handleConfirmEditDiaryBalance = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    const parsedBalance = Number(String(balanceValueInput).replace(",", "."));

    if (!Number.isFinite(parsedBalance)) {
      showNotice("error", "Баланс должен быть числом.");
      return;
    }

    const currency = balanceCurrencyInput.trim().toUpperCase() || "USD";

    const nextDiaries = updateDiary(
      diaries,
      activeDiary.id,
      balanceEditMode === "manual"
        ? {
            manualBalance: parsedBalance,
            currency,
          }
        : {
            startBalance: parsedBalance,
            currency,
          }
    );

    void persistDiaries(nextDiaries);
    setIsBalanceDiaryModalOpen(false);
    setBalanceValueInput("");
    setBalanceCurrencyInput("USD");

    showNotice(
      "success",
      balanceEditMode === "manual"
        ? `Ручной баланс обновлён: ${fmt(parsedBalance)} ${currency}`
        : `Стартовый баланс обновлён: ${fmt(parsedBalance)} ${currency}`
    );
  }, [
    activeDiary,
    balanceValueInput,
    balanceCurrencyInput,
    balanceEditMode,
    diaries,
    persistDiaries,
    showNotice,
  ]);

  const handleAttachConnectionToDiary = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    if (!connections.length) {
      showNotice("error", "Нет доступных подключений.");
      return;
    }

    setSelectedAttachConnectionId(activeDiary.connectionId || connections[0]?.id || "");
    setIsAttachConnectionModalOpen(true);
  }, [activeDiary, connections, showNotice]);

  const handleConfirmAttachConnectionToDiary = useCallback(() => {
    if (!activeDiary) {
      showNotice("error", "Активный дневник не найден.");
      return;
    }

    const selectedConnection =
      connections.find((connection) => connection.id === selectedAttachConnectionId) ?? null;

    if (!selectedConnection) {
      showNotice("error", "Выберите подключение.");
      return;
    }

    const nextDiaries = updateDiary(diaries, activeDiary.id, {
      connectionId: selectedConnection.id,
      exchange: selectedConnection.exchange,
      currency: activeDiary.currency || "USDT",
    });

    void persistDiaries(nextDiaries);
    setIsAttachConnectionModalOpen(false);
    setSelectedAttachConnectionId("");
    showNotice("success", `Дневник привязан к подключению: ${selectedConnection.name}`);
  }, [activeDiary, connections, selectedAttachConnectionId, diaries, persistDiaries, showNotice]);

  const handleLoadDemo = () => {
    if (!confirm("Загрузить демонстрационные данные? Текущие локальные данные будут заменены.")) return;

    const t = getDemoTrades();
    const j = getDemoJournal();
    const f = getDemoJournalFolders();

    const ensuredDiaryId = activeDiaryId || (diaries[0]?.id ?? null);
    const nextTrades = ensuredDiaryId ? t.map((trade) => ({ ...trade, diaryId: ensuredDiaryId })) : t;
    const nextJournal = ensuredDiaryId ? j.map((note) => ({ ...note, diaryId: ensuredDiaryId })) : j;

    saveMode("demo");
    setAppMode("demo");
    void persistTrades(nextTrades);
    void persistJournal(nextJournal);
    void persistJournalFolders(f);
    setTradeModalId(null);
    setImageViewerSrc(null);
    showNotice("success", "Демо-данные успешно загружены.");
  };

  const handleStartWithOwnData = () => {
    if (
      !confirm(
        "Очистить демо-данные и перейти к работе со своими данными? После этого приложение останется пустым, пока вы не добавите свои сделки."
      )
    ) {
      return;
    }

    saveMode("user");
    setAppMode("user");
    void persistTrades([]);
    void persistJournal([]);
    void persistJournalFolders(getDemoJournalFolders());
    setTradeModalId(null);
    setImageViewerSrc(null);
    setActiveView("overview");
    showNotice("info", "Демо-данные очищены. Теперь можно работать со своими данными.");
  };

  const handleExportJson = () => {
    const payload = {
      trades,
      journalNotes: journal,
      journalFolders,
      diaries,
      activeDiaryId,
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fintrade-data.json";
    a.click();
    URL.revokeObjectURL(url);
    showNotice("success", "JSON успешно экспортирован.");
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const importedTrades = Array.isArray(data.trades) ? data.trades : [];
        const importedJournal = Array.isArray(data.journalNotes) ? data.journalNotes : [];
        const importedFolders = Array.isArray(data.journalFolders)
          ? data.journalFolders
          : getDemoJournalFolders();

        let importedDiaries = Array.isArray(data.diaries) ? data.diaries : loadDiaries();
        const importedConnections = loadConnections();

        importedDiaries = ensureDiariesCoverStoredData(
          importedDiaries,
          importedTrades,
          importedJournal,
          importedConnections
        );

        const nextDiaries = importedDiaries.length ? importedDiaries : [createDefaultDiary()];

        const importedActiveDiaryId =
          typeof data.activeDiaryId === "string" ? data.activeDiaryId : null;

        const safeActiveDiaryId =
          importedActiveDiaryId && nextDiaries.some((d: TradingDiary) => d.id === importedActiveDiaryId)
            ? importedActiveDiaryId
            : nextDiaries[0].id;

        const fallbackDiaryId = nextDiaries[0]?.id ?? safeActiveDiaryId;

        const normalizedTrades = importedTrades.map((trade: Trade) => ({
          ...trade,
          diaryId: resolveTradeDiaryId(trade, nextDiaries, fallbackDiaryId),
        }));

        const normalizedJournal = importedJournal.map((note: JournalNote) => ({
          ...note,
          diaryId: resolveJournalDiaryId(note, nextDiaries, fallbackDiaryId),
        }));

        saveMode("user");
        setAppMode("user");
        void persistTrades(normalizedTrades);
        void persistJournal(normalizedJournal);
        void persistJournalFolders(importedFolders);
        void persistDiaries(nextDiaries);
        setActiveDiaryId(safeActiveDiaryId);
        saveActiveDiaryId(safeActiveDiaryId);
        showNotice("success", "JSON успешно импортирован.");
      } catch {
        showNotice("error", "Ошибка импорта JSON.");
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    if (!confirm("Удалить все данные пользователя?")) return;

    saveMode("user");
    setAppMode("user");
    void persistTrades([]);
    void persistJournal([]);
    void persistJournalFolders(getDemoJournalFolders());
    setTradeModalId(null);
    setImageViewerSrc(null);
    showNotice("info", "Все пользовательские данные удалены.");
  };

  const handleImportTradesFromConnections = useCallback(
    (importedTrades: Trade[]) => {
      if (!importedTrades.length) {
        return 0;
      }

      if (!activeDiaryId) {
        return 0;
      }

      const existingIds = new Set(
        trades
          .filter((t) => t.diaryId === activeDiaryId)
          .map((t) => t.id)
      );

      const existingExternalIds = new Set(
        trades
          .filter(
            (t) =>
              t.diaryId === activeDiaryId &&
              t.source === "imported" &&
              t.externalId
          )
          .map((t) => t.externalId as string)
      );

      const uniqueImportedTrades = importedTrades
        .map((trade) => ({
          ...trade,
          diaryId: activeDiaryId,
        }))
        .filter((trade) => {
          if (trade.source === "imported" && trade.externalId) {
            return !existingExternalIds.has(trade.externalId);
          }

          return !existingIds.has(trade.id);
        });

      if (!uniqueImportedTrades.length) {
        return 0;
      }

      const nextTrades = [...uniqueImportedTrades, ...trades];

      saveMode("user");
      setAppMode("user");
      void persistTrades(nextTrades);
      setConnectionsVersion((prev) => prev + 1);

      return uniqueImportedTrades.length;
    },
    [trades, persistTrades, activeDiaryId]
  );

  const tradeModal = trades.find((t) => t.id === tradeModalId);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="36" width="5" height="10" rx="2.5" fill="rgba(255,255,255,.65)" />
              <rect x="24" y="29" width="5" height="17" rx="2.5" fill="rgba(255,255,255,.78)" />
              <rect x="33" y="22" width="5" height="24" rx="2.5" fill="rgba(255,255,255,.88)" />
              <path
                d="M16 38 L26 31 L35 24 L46 16"
                stroke="white"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              />
              <circle cx="16" cy="38" r="3.4" fill="white" />
              <circle cx="26" cy="31" r="3.4" fill="white" />
              <circle cx="35" cy="24" r="3.4" fill="white" />
              <circle cx="46" cy="16" r="3.4" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">ФинТрейд</h1>
            <p className="brand-subtitle">Дневник трейдера и аналитика торговли</p>
          </div>
        </div>

        <div className="brand-banner">
          <strong className="brand-banner-title">Дисциплина создаёт результат</strong>
          <span className="brand-banner-subtitle">Сделки · Психология · Аналитика</span>
        </div>

        <div className="grid gap-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-btn ${activeView === item.id ? "active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center text-[#7ed8ff]">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-auto grid gap-2 border-t border-[rgba(56,189,248,.08)] pt-4">
          <button className="btn btn-secondary w-full" onClick={handleStartWithOwnData}>
            Работать со своими данными
          </button>

          <button className="btn btn-secondary w-full" onClick={handleLoadDemo}>
            Загрузить демо
          </button>

          <button className="btn btn-secondary w-full" onClick={handleExportJson}>
            Экспорт JSON
          </button>

          <label className="btn btn-secondary flex w-full cursor-pointer items-center justify-center">
            Импорт JSON
            <input type="file" accept=".json" hidden onChange={handleImportJson} />
          </label>

          <button className="btn btn-danger w-full" onClick={handleClearAll}>
            Очистить данные
          </button>
        </div>
      </aside>

      <main className="relative p-5">
        {notice && (
          <div
            className={`mb-4 rounded-[20px] border px-5 py-4 text-[15px] ${
              notice.type === "success"
                ? "border-[rgba(34,197,94,.25)] bg-[rgba(34,197,94,.08)] text-[#7CFFB2]"
                : notice.type === "error"
                  ? "border-[rgba(239,68,68,.25)] bg-[rgba(239,68,68,.08)] text-[#ff8f8f]"
                  : "border-[rgba(56,189,248,.25)] bg-[rgba(56,189,248,.08)] text-[#7dd3fc]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>{notice.text}</div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 text-xs opacity-80 transition hover:opacity-100"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4 pt-[10px]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="account-card">
              <strong className="block text-[15px]">
                {appMode === "demo" ? "Демо-режим" : "Торговый кабинет"}
              </strong>
              <span className="mt-[3px] block text-[13px] text-[#8aa6c7]">
                {appMode === "demo"
                  ? "Тестовые данные для знакомства с возможностями платформы"
                  : "Ваши сделки, аналитика и журнал торговли"}
              </span>
            </div>

            {appMode !== "demo" && (
              <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(10,18,34,.62)] px-4 py-3">
                <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#6f8aa8]">
                  Торговый дневник
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={activeDiaryId ?? ""}
                    onChange={(e) => handleChangeDiary(e.target.value)}
                    className="min-w-[220px]"
                  >
                    {diaries.map((diary) => (
                      <option key={diary.id} value={diary.id}>
                        {diary.name}
                      </option>
                    ))}
                  </select>

                  <button type="button" className="btn btn-secondary" onClick={handleCreateDiary}>
                    + Создать
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRenameDiary}
                    disabled={!activeDiary}
                  >
                    Переименовать
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleEditDiaryBalance}
                    disabled={!activeDiary}
                  >
                    Баланс
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAttachConnectionToDiary}
                    disabled={!activeDiary}
                  >
                    Привязать API
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteDiary}
                    disabled={!activeDiary || diaries.length <= 1}
                  >
                    Удалить
                  </button>
                </div>

                {activeDiary && (
                  <div className="mt-2 text-xs text-[#8aa6c7]">
                    Активный дневник: {activeDiary.name}
                    {activeDiary.currency ? ` · ${activeDiary.currency}` : ""}
                    {activeDiary.connectionId ? " · API привязан" : ""}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-[10px]">
            <div className="chip">{appMode === "demo" ? "Режим ознакомления" : "Ваши данные"}</div>

            <button className="btn" onClick={() => setActiveView("trades")}>
              Новая сделка
            </button>
          </div>
        </div>

        {activeView === "overview" && (
          <OverviewView
            trades={scopedTrades}
            stats={stats}
            currentBalance={currentBalance}
            currentPnl={diaryPnl}
            balanceCurrency={balanceCurrency}
            balanceSourceLabel={balanceSourceLabel}
            startBalance={startBalance}
            streaks={streaks}
            plannedCount={plannedCount}
            onNavigate={setActiveView}
            onOpenTrade={setTradeModalId}
            appMode={appMode}
            growthPercent={growthPercent}
            equityStartBalance={equityStartBalance}
          />
        )}

        {activeView === "trades" && (
          <TradesView
            trades={scopedTrades}
            allTrades={trades}
            activeDiaryId={activeDiaryId}
            updateTrades={(nextTrades) => {
              saveMode("user");
              setAppMode("user");
              void persistTrades(nextTrades);
            }}
            onOpenTrade={setTradeModalId}
            onOpenImage={setImageViewerSrc}
          />
        )}

        {activeView === "analytics" && (
          <AnalyticsView
            trades={scopedTrades}
            onOpenTrade={setTradeModalId}
            diaryStats={{
              currentBalance,
              currency: balanceCurrency,
              balanceSourceLabel,
              startBalance,
              growthPercent,
            }}
          />
        )}

        {activeView === "journal" && (
          <JournalView
            journal={scopedJournal}
            allJournal={journal}
            activeDiaryId={activeDiaryId}
            folders={scopedJournalFolders}
            updateJournal={(nextJournal) => {
              saveMode("user");
              setAppMode("user");
              void persistJournal(nextJournal);
            }}
            updateFolders={(nextFolders) => {
              saveMode("user");
              setAppMode("user");
              void persistJournalFolders(nextFolders);
            }}
          />
        )}

        {activeView === "psychology" && (
          <PsychologyView trades={scopedTrades} onOpenTrade={setTradeModalId} />
        )}

        {activeView === "neuro" && <NeuroAssistantView trades={scopedTrades} />}

        {activeView === "connections" && (
          <ConnectionsView
            onImportTrades={handleImportTradesFromConnections}
            activeDiaryName={activeDiary?.name || null}
            activeDiaryConnectionId={activeDiary?.connectionId || null}
            activeDiaryExchange={activeDiary?.exchange || null}
          />
        )}
      </main>

      {isRenameDiaryModalOpen && activeDiary && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsRenameDiaryModalOpen(false);
            setRenameDiaryValue("");
          }}
        >
          <div className="modal-card max-w-[520px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold">Переименовать дневник</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  Текущее название: {activeDiary.name}
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsRenameDiaryModalOpen(false);
                  setRenameDiaryValue("");
                }}
              >
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              <div className="item">
                <label className="mb-2 block text-sm text-[#8aa6c7]">Новое название</label>
                <input
                  type="text"
                  value={renameDiaryValue}
                  onChange={(e) => setRenameDiaryValue(e.target.value)}
                  placeholder="Например: Дневник Binance"
                  className="w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmRenameDiary();
                    }
                  }}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsRenameDiaryModalOpen(false);
                    setRenameDiaryValue("");
                  }}
                >
                  Отмена
                </button>
                <button className="btn" onClick={handleConfirmRenameDiary}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteDiaryModalOpen && activeDiary && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsDeleteDiaryModalOpen(false);
          }}
        >
          <div className="modal-card max-w-[560px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold text-[#ffb4bf]">Удалить дневник</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  Это действие нельзя отменить
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsDeleteDiaryModalOpen(false);
                }}
              >
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              <div className="item">
                <div className="text-sm text-[#8aa6c7]">
                  Вы действительно хотите удалить дневник:
                </div>
                <div className="mt-2 text-lg font-extrabold text-white">
                  {activeDiary.name}
                </div>
              </div>

              <div className="item border-[rgba(239,68,68,.18)] bg-[rgba(239,68,68,.06)]">
                <div className="text-sm text-[#ffb4bf]">
                  Вместе с дневником будут удалены:
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-[#ffd7de]">
                  <li>все сделки этого дневника</li>
                  <li>все записи журнала этого дневника</li>
                  <li>все папки журнала этого дневника</li>
                </ul>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsDeleteDiaryModalOpen(false);
                  }}
                >
                  Отмена
                </button>
                <button className="btn btn-danger" onClick={handleConfirmDeleteDiary}>
                  Удалить дневник
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBalanceDiaryModalOpen && activeDiary && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsBalanceDiaryModalOpen(false);
            setBalanceValueInput("");
            setBalanceCurrencyInput("USD");
          }}
        >
          <div className="modal-card max-w-[560px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold">Баланс дневника</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  Дневник: {activeDiary.name}
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsBalanceDiaryModalOpen(false);
                  setBalanceValueInput("");
                  setBalanceCurrencyInput("USD");
                }}
              >
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              <div className="item">
                <label className="mb-2 block text-sm text-[#8aa6c7]">Режим баланса</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={`btn ${balanceEditMode === "manual" ? "" : "btn-secondary"}`}
                    onClick={() => setBalanceEditMode("manual")}
                  >
                    Ручной текущий баланс
                  </button>
                  <button
                    type="button"
                    className={`btn ${balanceEditMode === "start" ? "" : "btn-secondary"}`}
                    onClick={() => setBalanceEditMode("start")}
                  >
                    Стартовый баланс
                  </button>
                </div>
              </div>

              <div className="item">
                <label className="mb-2 block text-sm text-[#8aa6c7]">
                  {balanceEditMode === "manual" ? "Текущий баланс" : "Стартовый баланс"}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={balanceValueInput}
                  onChange={(e) => setBalanceValueInput(e.target.value)}
                  placeholder="Например: 10000"
                  className="w-full"
                />
              </div>

              <div className="item">
                <label className="mb-2 block text-sm text-[#8aa6c7]">Валюта</label>
                <input
                  type="text"
                  value={balanceCurrencyInput}
                  onChange={(e) => setBalanceCurrencyInput(e.target.value.toUpperCase())}
                  placeholder="Например: USDT, USD, RUB"
                  className="w-full"
                  maxLength={10}
                />
              </div>

              <div className="item">
                <div className="text-sm text-[#8aa6c7]">
                  Текущий сохранённый источник баланса:
                </div>
                <div className="mt-2 text-sm text-white">{balanceSourceLabel}</div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsBalanceDiaryModalOpen(false);
                    setBalanceValueInput("");
                    setBalanceCurrencyInput("USD");
                  }}
                >
                  Отмена
                </button>
                <button className="btn" onClick={handleConfirmEditDiaryBalance}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAttachConnectionModalOpen && activeDiary && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsAttachConnectionModalOpen(false);
            setSelectedAttachConnectionId("");
          }}
        >
          <div className="modal-card max-w-[680px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold">Привязать API</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  Дневник: {activeDiary.name}
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsAttachConnectionModalOpen(false);
                  setSelectedAttachConnectionId("");
                }}
              >
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              {connections.length ? (
                connections.map((connection) => {
                  const isSelected = selectedAttachConnectionId === connection.id;
                  const balanceTotal = sumConnectionBalances(connection);

                  return (
                    <button
                      key={connection.id}
                      type="button"
                      onClick={() => setSelectedAttachConnectionId(connection.id)}
                      className={`item text-left transition ${
                        isSelected
                          ? "border-[rgba(56,189,248,.28)] bg-[rgba(19,36,63,.55)]"
                          : "hover:border-[rgba(56,189,248,.18)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-bold text-white">{connection.name}</div>
                          <div className="mt-1 text-sm text-[#8aa6c7]">
                            Биржа: {connection.exchange.toUpperCase()}
                          </div>
                          {connection.status && (
                            <div className="mt-1 text-sm text-[#8aa6c7]">
                              Статус: {connection.status}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div className="rounded-full border border-[rgba(56,189,248,.18)] bg-[rgba(56,189,248,.12)] px-3 py-1 text-xs font-bold text-[#8cefff]">
                            Выбрано
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#9db9d6]">
                        <span>ID: {connection.id}</span>
                        <span>
                          Балансы: {balanceTotal != null ? fmt(balanceTotal) : "нет данных"}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="item text-[#8aa6c7]">Нет доступных подключений</div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsAttachConnectionModalOpen(false);
                    setSelectedAttachConnectionId("");
                  }}
                >
                  Отмена
                </button>
                <button className="btn" onClick={handleConfirmAttachConnectionToDiary}>
                  Привязать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tradeModal && (
        <div className="modal-overlay" onClick={() => setTradeModalId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-xl font-bold">Детали сделки</h2>
              <button className="btn btn-secondary" onClick={() => setTradeModalId(null)}>
                Закрыть
              </button>
            </div>
            <TradeDetailContent trade={tradeModal} onOpenImage={setImageViewerSrc} />
          </div>
        </div>
      )}

      {imageViewerSrc && (
        <div className="modal-overlay" onClick={() => setImageViewerSrc(null)}>
          <img
            src={imageViewerSrc}
            alt="Скриншот"
            className="max-h-[90vh] max-w-[95vw] rounded-2xl border border-[rgba(56,189,248,.16)]"
            style={{ boxShadow: "0 0 40px rgba(29,155,240,.15)" }}
          />
        </div>
      )}
    </div>
  );
}

function TradeDetailContent({
  trade: t,
  onOpenImage,
}: {
  trade: Trade;
  onOpenImage: (s: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Дата</div>
          <div className="mt-2 text-xl font-extrabold">{t.date}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Время</div>
          <div className="mt-2 text-xl font-extrabold">{t.time || "—"}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Инструмент</div>
          <div className="mt-2 text-xl font-extrabold">{t.symbol}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Направление</div>
          <div className="mt-2 text-xl font-extrabold">{t.direction}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Сигнал</div>
          <div className="mt-2 text-xl font-extrabold">{t.signal || "—"}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">P/L</div>
          <div className={`mt-2 text-xl font-extrabold ${colorClass(t.pnl)}`}>
            {t.pnl >= 0 ? "+" : ""}
            {fmt(t.pnl)}
          </div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Вход</div>
          <div className="mt-2 text-xl font-extrabold">{fmt(t.entry)}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Выход</div>
          <div className="mt-2 text-xl font-extrabold">{fmt(t.exit)}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Объём</div>
          <div className="mt-2 text-xl font-extrabold">{fmt(t.size)}</div>
        </div>

        <div className="item">
          <div className="text-sm text-[#8aa6c7]">Рейтинг</div>
          <div className="mt-2 text-xl font-extrabold text-[#ffd66b]">{stars(t.rating || 3)}</div>
        </div>
      </div>

      <div className="h-[14px]" />

      <div className="grid gap-3">
        <div className="item">
          <strong>Сетап:</strong> {t.strategy || "—"}
        </div>

        <div className="item">
          <strong>По плану:</strong>{" "}
          <span className={`plan-badge ${t.planned === "yes" ? "plan-yes" : "plan-no"}`}>
            {t.planned === "yes" ? "По плану" : "Вне плана"}
          </span>
        </div>

        <div className="item">
          <strong>Эмоции:</strong> {t.emotion || "—"}
        </div>

        <div className="item">
          <strong>Психология:</strong>
          <div className="mt-2 whitespace-pre-wrap">{t.psychology || "—"}</div>
        </div>

        <div className="item">
          <strong>Комментарий:</strong>
          <div className="mt-2 whitespace-pre-wrap">{t.notes || "—"}</div>
        </div>

        {(t.source || t.exchange || t.importedAt) && (
          <div className="item">
            <strong>Источник:</strong>
            <div className="mt-2 text-[#8aa6c7]">
              {t.source === "imported" ? "Импортирована" : t.source === "manual" ? "Ручная" : "—"}
              {t.exchange ? ` · ${t.exchange.toUpperCase()}` : ""}
              {t.importedAt ? ` · ${new Date(t.importedAt).toLocaleString("ru-RU")}` : ""}
            </div>
          </div>
        )}

        {t.customFilters && t.customFilters.length > 0 && (
          <div className="item">
            <strong>Пользовательские фильтры:</strong>
            <div className="mt-3 flex flex-wrap gap-2">
              {t.customFilters.map((item, index) => (
                <span
                  key={`${item.key}-${item.value}-${index}`}
                  className="rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.75)] px-3 py-1 text-sm text-[#dff3ff]"
                >
                  <strong>{item.key}:</strong> {item.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {t.screenshots && t.screenshots.length > 0 && (
        <>
          <div className="h-[14px]" />
          <div className="item">
            <strong>Скриншоты</strong>
            <div className="mt-[10px] flex flex-wrap gap-2">
              {t.screenshots.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`trade-shot-${i}`}
                  className="h-[74px] w-[74px] cursor-pointer rounded-xl border border-[rgba(56,189,248,.14)] object-cover"
                  onClick={() => onOpenImage(src)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function OverviewView({
  trades,
  stats,
  currentBalance,
  currentPnl,
  balanceCurrency,
  balanceSourceLabel,
  startBalance,
  streaks,
  plannedCount,
  onNavigate,
  onOpenTrade,
  appMode,
  growthPercent,
  equityStartBalance,
}: {
  trades: Trade[];
  stats: ReturnType<typeof getTradeStats>;
  currentBalance: number;
  currentPnl: number;
  balanceCurrency: string;
  balanceSourceLabel: string;
  startBalance: number;
  streaks: ReturnType<typeof calculateStreaks>;
  plannedCount: number;
  onNavigate: (v: ViewId) => void;
  onOpenTrade: (id: string) => void;
  appMode: AppMode;
  growthPercent: number;
  equityStartBalance: number;
}) {
  const equityRef = useRef<HTMLCanvasElement>(null);
  const weekdayRef = useRef<HTMLCanvasElement>(null);

  const latestTradeDate = useMemo(() => {
    if (!trades.length) {
      const today = new Date();
      return {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      };
    }

    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const [year, month] = latest.date.split("-").map(Number);

    return {
      year,
      month,
    };
  }, [trades]);

  const [calendarYear, setCalendarYear] = useState(latestTradeDate.year);
  const [calendarMonth, setCalendarMonth] = useState(latestTradeDate.month);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<OverviewGroupModal>(null);

  useEffect(() => {
    setCalendarYear(latestTradeDate.year);
    setCalendarMonth(latestTradeDate.month);
  }, [latestTradeDate.year, latestTradeDate.month]);

  const equityCurve = useMemo(() => {
    const ordered = [...trades].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let acc = equityStartBalance;

    return ordered.map((t) => {
      acc += Number(t.pnl) || 0;
      return acc;
    });
  }, [trades, equityStartBalance]);

  useEffect(() => {
    const draw = () => {
      if (equityRef.current) {
        drawEquityChart(equityRef.current, equityCurve, trades, (trade) =>
          onOpenTrade(trade.id)
        );
      }
      if (weekdayRef.current) {
        drawWeekdayBars(weekdayRef.current, trades);
      }
    };

    const timer = window.setTimeout(draw, 100);
    window.addEventListener("resize", draw);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", draw);
    };
  }, [equityCurve, trades, onOpenTrade]);

  const recentTrades = [...trades];
  const calendar = useMemo(
    () => getCalendarMonthData(trades, calendarYear, calendarMonth),
    [trades, calendarYear, calendarMonth]
  );

  const selectedDayTrades = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return trades
      .filter((trade) => trade.date === selectedCalendarDate)
      .slice()
      .sort((a, b) => {
        const aTime = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
        const bTime = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
        return aTime - bTime;
      });
  }, [selectedCalendarDate, trades]);

  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(
        trades
          .map((trade) => Number(trade.date.split("-")[0]))
          .filter((year) => Number.isFinite(year))
      )
    ).sort((a, b) => b - a);

    if (!years.length) {
      return [new Date().getFullYear()];
    }

    return years;
  }, [trades]);

  const symbolStats = getSymbolStats(trades);
  const maxSymbolAbs = Math.max(...symbolStats.map((s) => Math.abs(s.pnl)), 1);

  const emotionStats = [...trades]
    .reduce((acc, trade) => {
      const emotionKey = (trade.emotion || "").trim() || "Без эмоции";
      const existing = acc.find((item) => item.emotion === emotionKey);

      if (existing) {
        existing.count += 1;
        existing.pnl += trade.pnl;
      } else {
        acc.push({
          emotion: emotionKey,
          count: 1,
          pnl: trade.pnl,
        });
      }

      return acc;
    }, [] as Array<{ emotion: string; count: number; pnl: number }>)
    .sort((a, b) => b.count - a.count);

  const groupModalTrades = useMemo(() => {
    if (!groupModal) return [];

    let result =
      groupModal.type === "symbol"
        ? trades.filter((trade) => trade.symbol === groupModal.value)
        : trades.filter(
            (trade) => (trade.emotion || "").trim() === groupModal.value
          );

    return result
      .slice()
      .sort((a, b) => {
        const aTime = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
        const bTime = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
        return bTime - aTime;
      });
  }, [groupModal, trades]);

  const weekdayLabels = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];

  const weekdayMap = trades.reduce<Record<number, number>>((acc, trade) => {
    const dayIndex = new Date(trade.date).getDay();
    acc[dayIndex] = (acc[dayIndex] || 0) + trade.pnl;
    return acc;
  }, {});

  const bestDayEntry =
    Object.entries(weekdayMap)
      .map(([day, pnl]) => ({
        day: Number(day),
        pnl,
      }))
      .sort((a, b) => b.pnl - a.pnl)[0] || null;

  const bestDayLabel =
    bestDayEntry && bestDayEntry.pnl !== 0 ? weekdayLabels[bestDayEntry.day] : "Нет данных";

  const symbolCountMap = trades.reduce<Record<string, number>>((acc, trade) => {
    const key = (trade.symbol || "").trim() || "Без инструмента";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topSymbolEntry = Object.entries(symbolCountMap).sort((a, b) => b[1] - a[1])[0] || null;
  const topSymbol = topSymbolEntry ? topSymbolEntry[0] : "Нет данных";

  const plannedRate = trades.length ? Math.round((plannedCount / trades.length) * 100) : 0;
  const topEmotion = emotionStats.length ? emotionStats[0].emotion : "Нет данных";

  const maxEquity = equityCurve.length ? Math.max(...equityCurve) : equityStartBalance;

  const maxDrawdown = useMemo(() => {
    let peak = equityCurve.length ? equityCurve[0] : equityStartBalance;
    let maxDd = 0;

    for (const value of equityCurve) {
      if (value > peak) peak = value;
      const dd = peak - value;
      if (dd > maxDd) maxDd = dd;
    }

    return maxDd;
  }, [equityCurve, equityStartBalance]);

  const flatTradesCount = trades.filter((t) => Number(t.pnl) === 0).length;

  const goPrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((prev) => prev - 1);
      return;
    }

    setCalendarMonth((prev) => prev - 1);
  };

  const goNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((prev) => prev + 1);
      return;
    }

    setCalendarMonth((prev) => prev + 1);
  };

  return (
    <div className="grid gap-5">
      <section className="hero-card relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/hero-network.png.avif')" }}
        />
        <div className="absolute inset-0 bg-[rgba(6,14,28,.0.1)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,14,26,.92)_0%,rgba(7,14,26,.72)_42%,rgba(7,14,26,.45)_68%,rgba(7,14,26,.65)_100%)]" />

        <div className="hero-grid relative z-[1]">
          <div>
            <span className="hero-badge">
              {appMode === "demo" ? "Режим ознакомления" : "Обзор торговли"}
            </span>
            <h2 className="hero-title">Аналитика, дисциплина и контроль торговых решений</h2>
            <p className="hero-subtitle">
              {appMode === "demo"
                ? "Ознакомьтесь с возможностями платформы на тестовых данных, а затем перейдите к работе со своими сделками."
                : "Контролируйте статистику, анализируйте сделки и отслеживайте результаты на основе своих данных."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn" onClick={() => onNavigate("trades")}>
                Открыть сделки
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate("journal")}>
                Открыть журнал
              </button>
            </div>
          </div>

          <div className="card h-full relative z-[1] bg-[rgba(10,18,34,.78)] backdrop-blur-[4px]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-lg font-bold">Инсайты</h3>
              <span className="text-xs text-[#8aa6c7]">по текущим сделкам</span>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="item">
                <div className="text-sm text-[#8aa6c7]">Лучший день</div>
                <div className="mt-1 text-base font-extrabold text-white">{bestDayLabel}</div>
              </div>

              <div className="item">
                <div className="text-sm text-[#8aa6c7]">Основной инструмент</div>
                <div className="mt-1 text-base font-extrabold text-white">{topSymbol}</div>
              </div>

              <div className="item">
                <div className="text-sm text-[#8aa6c7]">По плану</div>
                <div className="mt-1 text-base font-extrabold text-[#8cefff]">{plannedRate}%</div>
              </div>

              <div className="item">
                <div className="text-sm text-[#8aa6c7]">Чаще эмоция</div>
                <div className="mt-1 text-base font-extrabold text-white">{topEmotion}</div>
              </div>
            </div>

            <div className="mt-4 text-xs text-[#6f8aa8]">Сводка формируется по истории сделок</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="stat-card stat-card-icon">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="stat-label m-0">Общий P/L</span>
            <StatIcon kind="pnl" />
          </div>
          <div className={`stat-value stat-glow ${colorClass(currentPnl)}`}>
            {currentPnl >= 0 ? "+" : ""}
            {fmt(currentPnl)}
          </div>
        </div>

        <div className="stat-card stat-card-icon">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="stat-label m-0">Win rate</span>
            <StatIcon kind="rate" />
          </div>
          <div className="stat-value stat-glow text-[#8cefff]">{stats.winRate.toFixed(0)}%</div>
        </div>

        <div className="stat-card stat-card-icon">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="stat-label m-0">Profit factor</span>
            <StatIcon kind="pf" />
          </div>
          <div className="stat-value stat-glow text-[#8cefff]">{stats.pf.toFixed(2)}</div>
        </div>

        <div className="stat-card stat-card-icon">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="stat-label m-0">Сделок</span>
            <StatIcon kind="count" />
          </div>
          <div className="stat-value">{stats.total}</div>
        </div>

        <div className="stat-card stat-card-icon">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="stat-label m-0">Лучшая</span>
            <StatIcon kind="best" />
          </div>
          <div className="stat-value stat-glow text-[#4de2c5]">
            {stats.best >= 0 ? "+" : ""}
            {fmt(stats.best)}
          </div>
        </div>

        <div className="stat-card stat-card-icon">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="stat-label m-0">Худшая</span>
            <StatIcon kind="worst" />
          </div>
          <div className="stat-value stat-glow text-[#ff6b81]">{fmt(stats.worst)}</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.95fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-lg font-bold">Кривая доходности</h3>
              <p className="mt-1 text-sm text-[#8aa6c7]">Динамика счёта на основе истории сделок</p>
            </div>
          </div>

          <div className="rounded-[20px] border border-[rgba(56,189,248,.08)] bg-[rgba(8,15,28,.55)] p-3">
            <canvas ref={equityRef} className="h-[320px] w-full" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetricCard
              label="Текущий баланс"
              value={`${fmt(currentBalance)} ${balanceCurrency}`}
              valueClassName="text-[#8cefff]"
              subtext={balanceSourceLabel}
            />
            <OverviewMetricCard
              label="P/L"
              value={`${currentPnl >= 0 ? "+" : ""}${fmt(currentPnl)} ${balanceCurrency}`}
              valueClassName={currentPnl >= 0 ? "text-[#4de2c5]" : "text-[#ff6b81]"}
            />
            <OverviewMetricCard
              label="Рост к старту"
              value={startBalance > 0 ? `${growthPercent >= 0 ? "+" : ""}${fmt(growthPercent)}%` : "—"}
              valueClassName={growthPercent >= 0 ? "text-[#4de2c5]" : "text-[#ff6b81]"}
            />
            <OverviewMetricCard
              label="Макс. equity"
              value={`${fmt(maxEquity)} ${balanceCurrency}`}
              valueClassName="text-white"
            />
            <OverviewMetricCard
              label="Макс. просадка"
              value={`-${fmt(maxDrawdown)} ${balanceCurrency}`}
              valueClassName="text-[#ff6b81]"
            />
            <OverviewMetricCard
              label="Прибыльных"
              value={String(stats.wins.length)}
              valueClassName="text-[#4de2c5]"
            />
            <OverviewMetricCard
              label="Убыточных"
              value={String(stats.losses.length)}
              valueClassName="text-[#ff6b81]"
            />
            <OverviewMetricCard
              label="Без результата"
              value={String(flatTradesCount)}
              valueClassName="text-[#f6c85f]"
            />
            <OverviewMetricCard
              label="Win rate"
              value={`${stats.winRate.toFixed(0)}%`}
              valueClassName="text-[#8cefff]"
            />
          </div>
        </div>

        <div className="card">
          <div className="mb-2">
            <h3 className="m-0 text-lg font-bold">{calendar.title}</h3>
          </div>

          <div className="mb-4 text-sm text-[#8aa6c7]">{calendar.subtitle}</div>

          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary h-[42px] min-w-[42px] px-0"
              onClick={goPrevMonth}
              aria-label="Предыдущий месяц"
            >
              ←
            </button>

            <button
              type="button"
              className="btn btn-secondary h-[42px] min-w-[42px] px-0"
              onClick={goNextMonth}
              aria-label="Следующий месяц"
            >
              →
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <select value={calendarMonth} onChange={(e) => setCalendarMonth(Number(e.target.value))}>
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>

            <select value={calendarYear} onChange={(e) => setCalendarYear(Number(e.target.value))}>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3 grid grid-cols-7 gap-2">
            {WEEKDAY_SHORT.map((day) => (
              <div
                key={day}
                className="rounded-[14px] border border-[rgba(56,189,248,.06)] bg-[rgba(8,15,28,.25)] px-2 py-2 text-center text-xs font-bold text-[#8aa6c7]"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {calendar.days.map((item) => {
              const hasTrades = item.trades.length > 0;
              const isSelected = selectedCalendarDate === item.date;

              return (
                <button
                  key={item.date}
                  type="button"
                  className={`calendar-cell text-left transition ${
                    item.inCurrentMonth ? "" : "opacity-45"
                  } ${hasTrades ? "hover:border-[rgba(56,189,248,.18)]" : "cursor-default"} ${
                    isSelected ? "border-[rgba(56,189,248,.28)] bg-[rgba(19,36,63,.55)]" : ""
                  }`}
                  onClick={() => {
                    if (!hasTrades) return;
                    setSelectedCalendarDate(item.date);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="calendar-day-num">{item.day}</div>
                    {hasTrades && (
                      <div className="rounded-full border border-[rgba(56,189,248,.14)] px-2 py-0.5 text-[10px] font-bold text-[#8cefff]">
                        {item.trades.length}
                      </div>
                    )}
                  </div>

                  <div className={`calendar-pnl ${calendarPnlClass(hasTrades ? item.pnl : null)}`}>
                    {hasTrades ? `${item.pnl > 0 ? "+" : ""}${fmt(item.pnl)}` : "–"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <div className="card">
          <h3 className="m-0 mb-3 text-lg font-bold">P/L по дням недели</h3>
          <div className="rounded-[20px] border border-[rgba(56,189,248,.08)] bg-[rgba(8,15,28,.55)] p-3">
            <canvas ref={weekdayRef} className="h-[320px] w-full" />
          </div>
        </div>

        <div className="card">
          <h3 className="m-0 mb-5 text-lg font-bold">P/L по инструментам</h3>

          <div className="max-h-[360px] overflow-y-auto pr-1">
            <div className="grid gap-4">
              {symbolStats.length ? (
                symbolStats.map((item) => {
                  const width = `${(Math.abs(item.pnl) / maxSymbolAbs) * 100}%`;
                  const positive = item.pnl >= 0;

                  return (
                    <button
                      key={item.symbol}
                      type="button"
                      className="symbol-row cursor-pointer rounded-[16px] border border-transparent p-2 text-left transition hover:border-[rgba(56,189,248,.14)] hover:bg-[rgba(19,36,63,.35)]"
                      onClick={() => setGroupModal({ type: "symbol", value: item.symbol })}
                    >
                      <div className="symbol-name">{item.symbol}</div>

                      <div className="symbol-bar-track">
                        <div
                          className={`symbol-bar-fill ${positive ? "positive" : "negative"}`}
                          style={{ width }}
                        />
                      </div>

                      <div className={`symbol-value ${positive ? "positive" : "negative"}`}>
                        {item.pnl > 0 ? "+" : ""}
                        {fmt(item.pnl)}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="item text-[#8aa6c7]">Нет данных по инструментам</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="m-0 mb-4 text-lg font-bold">Психология / эмоции</h3>

          <div className="max-h-[360px] overflow-y-auto pr-1">
            <div className="grid gap-3">
              {emotionStats.length ? (
                emotionStats.map((item) => (
                  <button
                    key={item.emotion}
                    type="button"
                    className="item cursor-pointer text-left transition hover:border-[rgba(56,189,248,.18)] hover:bg-[rgba(19,36,63,.35)]"
                    onClick={() => setGroupModal({ type: "emotion", value: item.emotion })}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-bold text-white">{item.emotion}</div>
                      <div className={`text-sm font-extrabold ${colorClass(item.pnl)}`}>
                        {item.pnl > 0 ? "+" : ""}
                        {fmt(item.pnl)}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-[#8aa6c7]">Сделок: {item.count}</div>
                  </button>
                ))
              ) : (
                <div className="item text-[#8aa6c7]">Данных по эмоциям пока нет</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="m-0 text-lg font-bold">Последние сделки</h3>
            <button className="btn btn-secondary" onClick={() => onNavigate("trades")}>
              Все сделки
            </button>
          </div>

          <div className="max-h-[620px] overflow-y-auto pr-1">
            <div className="grid gap-3">
              {recentTrades.length ? (
                recentTrades.map((trade) => (
                  <button
                    key={trade.id}
                    className="item text-left transition hover:border-[rgba(56,189,248,.18)]"
                    onClick={() => onOpenTrade(trade.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-white">
                          {trade.symbol} · {trade.direction}
                        </div>
                        <div className="mt-1 text-sm text-[#8aa6c7]">
                          {trade.date}
                          {trade.time ? ` · ${trade.time}` : ""}
                          {trade.strategy ? ` · ${trade.strategy}` : " · Без сетапа"}
                        </div>
                      </div>

                      <div className={`text-lg font-extrabold ${colorClass(trade.pnl)}`}>
                        {trade.pnl >= 0 ? "+" : ""}
                        {fmt(trade.pnl)}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#9db9d6]">
                      <span>Рейтинг: {stars(trade.rating || 3)}</span>
                      <span>Эмоция: {trade.emotion || "—"}</span>
                      <span>Сигнал: {trade.signal || "—"}</span>
                      {trade.source === "imported" && (
                        <span>
                          Источник: {trade.exchange ? trade.exchange.toUpperCase() : "импорт"}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="item text-[#8aa6c7]">
                  {appMode === "demo"
                    ? "Сделок пока нет"
                    : "Добавьте первую сделку, чтобы увидеть статистику и аналитику"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="m-0 mb-4 text-lg font-bold">Серии и дисциплина</h3>

          <div className="grid gap-3">
            <div className="item">
              <div className="text-sm text-[#8aa6c7]">Текущая серия</div>
              <div className="mt-2 text-xl font-extrabold text-white">
                {streaks.currentLabel}: {streaks.currentSeries}
              </div>
            </div>

            <div className="item">
              <div className="text-sm text-[#8aa6c7]">Макс. серия побед</div>
              <div className="mt-2 text-xl font-extrabold text-[#4de2c5]">{streaks.maxWins}</div>
            </div>

            <div className="item">
              <div className="text-sm text-[#8aa6c7]">Макс. серия убытков</div>
              <div className="mt-2 text-xl font-extrabold text-[#ff6b81]">{streaks.maxLosses}</div>
            </div>

            <div className="item">
              <div className="text-sm text-[#8aa6c7]">Плановых сделок</div>
              <div className="mt-2 text-xl font-extrabold text-white">
                {plannedCount} / {trades.length}
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedCalendarDate && (
        <div className="modal-overlay" onClick={() => setSelectedCalendarDate(null)}>
          <div className="modal-card max-w-[760px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold">Сделки за {formatDateLabel(selectedCalendarDate)}</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  {selectedDayTrades.length} {selectedDayTrades.length === 1 ? "сделка" : "сделок"}
                </div>
              </div>

              <button className="btn btn-secondary" onClick={() => setSelectedCalendarDate(null)}>
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              {selectedDayTrades.length ? (
                selectedDayTrades.map((trade) => (
                  <button
                    key={trade.id}
                    type="button"
                    className="item text-left transition hover:border-[rgba(56,189,248,.18)]"
                    onClick={() => {
                      setSelectedCalendarDate(null);
                      onOpenTrade(trade.id);
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold text-white">
                          {trade.symbol} · {trade.direction}
                        </div>
                        <div className="mt-1 text-sm text-[#8aa6c7]">
                          {trade.time || "—"}
                          {trade.strategy ? ` · ${trade.strategy}` : " · Без сетапа"}
                        </div>
                      </div>

                      <div className={`text-lg font-extrabold ${colorClass(trade.pnl)}`}>
                        {trade.pnl >= 0 ? "+" : ""}
                        {fmt(trade.pnl)}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#9db9d6]">
                      <span>Рейтинг: {stars(trade.rating || 3)}</span>
                      <span>Эмоция: {trade.emotion || "—"}</span>
                      <span>Сигнал: {trade.signal || "—"}</span>
                      {trade.source === "imported" && (
                        <span>
                          Источник: {trade.exchange ? trade.exchange.toUpperCase() : "импорт"}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="item text-[#8aa6c7]">На эту дату сделок нет</div>
              )}
            </div>
          </div>
        </div>
      )}

      {groupModal && (
        <div className="modal-overlay" onClick={() => setGroupModal(null)}>
          <div className="modal-card max-w-[860px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold">
                  {groupModal.type === "symbol"
                    ? `Сделки по инструменту: ${groupModal.value}`
                    : `Сделки по эмоции: ${groupModal.value}`}
                </h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  Найдено сделок: {groupModalTrades.length}
                </div>
              </div>

              <button className="btn btn-secondary" onClick={() => setGroupModal(null)}>
                Закрыть
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid gap-3">
                {groupModalTrades.length ? (
                  groupModalTrades.map((trade) => (
                    <button
                      key={trade.id}
                      type="button"
                      className="item text-left transition hover:border-[rgba(56,189,248,.18)] hover:bg-[rgba(19,36,63,.35)]"
                      onClick={() => {
                        setGroupModal(null);
                        onOpenTrade(trade.id);
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-bold text-white">
                            {trade.symbol} · {trade.direction}
                          </div>
                          <div className="mt-1 text-sm text-[#8aa6c7]">
                            {trade.date}
                            {trade.time ? ` · ${trade.time}` : ""}
                            {trade.strategy ? ` · ${trade.strategy}` : " · Без сетапа"}
                          </div>
                        </div>

                        <div className={`text-lg font-extrabold ${colorClass(trade.pnl)}`}>
                          {trade.pnl >= 0 ? "+" : ""}
                          {fmt(trade.pnl)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#9db9d6]">
                        <span>Рейтинг: {stars(trade.rating || 3)}</span>
                        <span>Эмоция: {trade.emotion || "—"}</span>
                        <span>Психология: {trade.psychology || "—"}</span>
                        <span>{trade.planned === "yes" ? "По плану" : "Вне плана"}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="item text-[#8aa6c7]">Подходящих сделок не найдено</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}