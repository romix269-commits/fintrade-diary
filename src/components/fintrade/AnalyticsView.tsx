"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Trade } from "@/lib/fintrade/store";
import {
  avg,
  sum,
  fmt,
  colorClass,
  getEquityCurve,
  calculateMaxDrawdown,
  calculateStreaks,
} from "@/lib/fintrade/store";
import { drawDonut, drawEquityChart } from "@/lib/fintrade/charts";

type AnalyticsViewProps = {
  trades: Trade[];
  onOpenTrade?: (id: string) => void;
  diaryStats?: {
    currentBalance: number;
    currency: string;
    balanceSourceLabel: string;
    startBalance: number;
    growthPercent: number;
  };
};

type ActiveFilterChip = {
  group: string;
  value: string;
  label: string;
  subGroup?: string;
};

const ANALYTICS_FILTERS_KEY = "fintrade_analytics_filters_v1";

const DEFAULT_OPEN_SECTIONS: Record<string, boolean> = {
  symbols: true,
  strategies: false,
  signals: false,
  emotions: false,
  directions: false,
  planned: false,
  sources: false,
  exchanges: false,
  dates: false,
  years: false,
  months: false,
  weekdays: false,
  hours: false,
  customFiltersGroup: false,
};

const WEEKDAY_OPTIONS = [
  { label: "Пн", value: 1 },
  { label: "Вт", value: 2 },
  { label: "Ср", value: 3 },
  { label: "Чт", value: 4 },
  { label: "Пт", value: 5 },
  { label: "Сб", value: 6 },
  { label: "Вс", value: 0 },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

const MONTH_OPTIONS = [
  { label: "Январь", value: "01" },
  { label: "Февраль", value: "02" },
  { label: "Март", value: "03" },
  { label: "Апрель", value: "04" },
  { label: "Май", value: "05" },
  { label: "Июнь", value: "06" },
  { label: "Июль", value: "07" },
  { label: "Август", value: "08" },
  { label: "Сентябрь", value: "09" },
  { label: "Октябрь", value: "10" },
  { label: "Ноябрь", value: "11" },
  { label: "Декабрь", value: "12" },
];

const SOURCE_OPTIONS = [
  { label: "Ручные", value: "manual" },
  { label: "Импортированные", value: "imported" },
];

function getWeekday(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

function getHourFromTime(time?: string) {
  if (!time) return null;
  const hour = time.split(":")[0];
  if (!hour) return null;
  return hour.padStart(2, "0");
}

function getYearFromDate(dateStr: string) {
  if (!dateStr) return null;
  const year = dateStr.split("-")[0];
  return year || null;
}

function getMonthFromDate(dateStr: string) {
  if (!dateStr) return null;
  const month = dateStr.split("-")[1];
  return month || null;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((v) => (v || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
}

function uniqueDatesSorted(values: string[]) {
  return [...new Set(values.map((v) => (v || "").trim()).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a)
  );
}

function toggleStringValue(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function toggleNumberValue(current: number[], value: number): number[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

function previewSelected(values: string[], fallback = "Ничего не выбрано") {
  if (!values.length) return fallback;
  if (values.length <= 2) return values.join(", ");
  return `${values[0]}, ${values[1]} +${values.length - 2}`;
}

function getExchangeLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "manual") return "Без биржи";
  if (normalized === "bybit") return "Bybit";
  if (normalized === "binance") return "Binance";
  if (normalized === "okx") return "OKX";

  return value;
}

function formatDateLabel(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}.${month}.${year}`;
}

function FilterSection({
  title,
  count,
  preview,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  preview: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(8,15,28,.35)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#dff3ff]">{title}</div>
          <div className="mt-1 truncate text-xs text-[#8aa6c7]">{preview}</div>
        </div>

        <div className="flex items-center gap-3">
          {count > 0 && (
            <span className="rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.75)] px-2 py-1 text-xs font-bold text-[#8cefff]">
              {count}
            </span>
          )}
          <span className="text-[#8cefff]">{isOpen ? "−" : "+"}</span>
        </div>
      </button>

      {isOpen && <div className="border-t border-[rgba(56,189,248,.08)] px-4 py-4">{children}</div>}
    </div>
  );
}

function CustomFilterGroupSection({
  title,
  values,
  selectedValues,
  isOpen,
  onToggle,
  onToggleValue,
}: {
  title: string;
  values: string[];
  selectedValues: string[];
  isOpen: boolean;
  onToggle: () => void;
  onToggleValue: (value: string) => void;
}) {
  return (
    <FilterSection
      title={title}
      count={selectedValues.length}
      preview={previewSelected(selectedValues)}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => (
            <button
              key={value}
              type="button"
              className={`seg-btn ${selectedValues.includes(value) ? "active" : ""}`}
              onClick={() => onToggleValue(value)}
            >
              {value}
            </button>
          ))
        ) : (
          <div className="text-sm text-[#8aa6c7]">Значений пока нет</div>
        )}
      </div>
    </FilterSection>
  );
}

export default function AnalyticsView({
  trades,
  onOpenTrade,
  diaryStats,
}: AnalyticsViewProps) {
  const donutRef = useRef<HTMLCanvasElement>(null);
  const equityRef = useRef<HTMLCanvasElement>(null);

  const [showEquityPoints, setShowEquityPoints] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);
  const [selectedPlanned, setSelectedPlanned] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [selectedHours, setSelectedHours] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCustomFilters, setSelectedCustomFilters] = useState<Record<string, string[]>>({});

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(DEFAULT_OPEN_SECTIONS);

  const customFilterGroups = useMemo(() => {
    const map = new Map<string, Set<string>>();

    trades.forEach((trade) => {
      (trade.customFilters || []).forEach((item) => {
        const key = (item.key || "").trim();
        const value = (item.value || "").trim();

        if (!key || !value) return;

        if (!map.has(key)) {
          map.set(key, new Set());
        }

        map.get(key)!.add(value);
      });
    });

    return Array.from(map.entries())
      .map(([key, values]) => ({
        key,
        values: Array.from(values).sort((a, b) => a.localeCompare(b, "ru")),
      }))
      .sort((a, b) => a.key.localeCompare(b.key, "ru"));
  }, [trades]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ANALYTICS_FILTERS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      setSelectedSymbols(Array.isArray(parsed.selectedSymbols) ? parsed.selectedSymbols : []);
      setSelectedStrategies(Array.isArray(parsed.selectedStrategies) ? parsed.selectedStrategies : []);
      setSelectedSignals(Array.isArray(parsed.selectedSignals) ? parsed.selectedSignals : []);
      setSelectedEmotions(Array.isArray(parsed.selectedEmotions) ? parsed.selectedEmotions : []);
      setSelectedDirections(Array.isArray(parsed.selectedDirections) ? parsed.selectedDirections : []);
      setSelectedPlanned(Array.isArray(parsed.selectedPlanned) ? parsed.selectedPlanned : []);
      setSelectedSources(Array.isArray(parsed.selectedSources) ? parsed.selectedSources : []);
      setSelectedExchanges(Array.isArray(parsed.selectedExchanges) ? parsed.selectedExchanges : []);
      setSelectedDates(Array.isArray(parsed.selectedDates) ? parsed.selectedDates : []);
      setSelectedWeekdays(Array.isArray(parsed.selectedWeekdays) ? parsed.selectedWeekdays : []);
      setSelectedHours(Array.isArray(parsed.selectedHours) ? parsed.selectedHours : []);
      setSelectedYears(Array.isArray(parsed.selectedYears) ? parsed.selectedYears : []);
      setSelectedMonths(Array.isArray(parsed.selectedMonths) ? parsed.selectedMonths : []);
      setSelectedCustomFilters(
        parsed.selectedCustomFilters && typeof parsed.selectedCustomFilters === "object"
          ? parsed.selectedCustomFilters
          : {}
      );

      setOpenSections(
        parsed.openSections && typeof parsed.openSections === "object"
          ? parsed.openSections
          : DEFAULT_OPEN_SECTIONS
      );
      setFiltersOpen(Boolean(parsed.filtersOpen));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        ANALYTICS_FILTERS_KEY,
        JSON.stringify({
          selectedSymbols,
          selectedStrategies,
          selectedSignals,
          selectedEmotions,
          selectedDirections,
          selectedPlanned,
          selectedSources,
          selectedExchanges,
          selectedDates,
          selectedWeekdays,
          selectedHours,
          selectedYears,
          selectedMonths,
          selectedCustomFilters,
          openSections,
          filtersOpen,
        })
      );
    } catch {
      // ignore
    }
  }, [
    selectedSymbols,
    selectedStrategies,
    selectedSignals,
    selectedEmotions,
    selectedDirections,
    selectedPlanned,
    selectedSources,
    selectedExchanges,
    selectedDates,
    selectedWeekdays,
    selectedHours,
    selectedYears,
    selectedMonths,
    selectedCustomFilters,
    openSections,
    filtersOpen,
  ]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleCustomFilterValue = (filterKey: string, value: string) => {
    setSelectedCustomFilters((prev) => {
      const current = prev[filterKey] || [];
      const nextValues = toggleStringValue(current, value);

      if (nextValues.length === 0) {
        const { [filterKey]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [filterKey]: nextValues,
      };
    });
  };

  const openAllSections = () => {
    const next: Record<string, boolean> = {
      symbols: true,
      strategies: true,
      signals: true,
      emotions: true,
      directions: true,
      planned: true,
      sources: true,
      exchanges: true,
      dates: true,
      years: true,
      months: true,
      weekdays: true,
      hours: true,
      customFiltersGroup: true,
    };

    customFilterGroups.forEach((group) => {
      next[`custom-${group.key}`] = true;
    });

    setOpenSections(next);
  };

  const closeAllSections = () => {
    const next: Record<string, boolean> = {
      symbols: false,
      strategies: false,
      signals: false,
      emotions: false,
      directions: false,
      planned: false,
      sources: false,
      exchanges: false,
      dates: false,
      years: false,
      months: false,
      weekdays: false,
      hours: false,
      customFiltersGroup: false,
    };

    customFilterGroups.forEach((group) => {
      next[`custom-${group.key}`] = false;
    });

    setOpenSections(next);
  };

  const symbolOptions = useMemo(() => uniqueSorted(trades.map((t) => t.symbol)), [trades]);
  const strategyOptions = useMemo(() => uniqueSorted(trades.map((t) => t.strategy)), [trades]);
  const signalOptions = useMemo(() => uniqueSorted(trades.map((t) => t.signal || "")), [trades]);
  const emotionOptions = useMemo(() => uniqueSorted(trades.map((t) => t.emotion)), [trades]);
  const directionOptions = useMemo(() => uniqueSorted(trades.map((t) => t.direction)), [trades]);

  const exchangeOptions = useMemo(() => {
    const uniqueExchanges = uniqueSorted(
      trades.map((t) => (t.exchange || "manual").trim() || "manual")
    );

    return uniqueExchanges.map((value) => ({
      value,
      label: getExchangeLabel(value),
    }));
  }, [trades]);

  const dateOptions = useMemo(() => uniqueDatesSorted(trades.map((t) => t.date)), [trades]);

  const yearOptions = useMemo(
    () =>
      uniqueSorted(trades.map((t) => getYearFromDate(t.date) || "").filter(Boolean)).sort((a, b) =>
        b.localeCompare(a, "ru")
      ),
    [trades]
  );

  const monthOptions = useMemo(() => {
    const usedMonths = new Set(trades.map((t) => getMonthFromDate(t.date)).filter(Boolean));
    return MONTH_OPTIONS.filter((month) => usedMonths.has(month.value));
  }, [trades]);

  const plannedOptions = [
    { label: "По плану", value: "yes" },
    { label: "Вне плана", value: "no" },
  ];

  const selectedCustomFiltersCount = useMemo(() => {
    return Object.values(selectedCustomFilters).reduce((acc, arr) => acc + arr.length, 0);
  }, [selectedCustomFilters]);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const weekday = getWeekday(t.date);
      const hour = getHourFromTime(t.time);
      const year = getYearFromDate(t.date);
      const month = getMonthFromDate(t.date);

      const normalizedSource = t.source ?? "manual";
      const normalizedExchange = (t.exchange || "manual").trim() || "manual";

      const matchSymbol = selectedSymbols.length === 0 || selectedSymbols.includes(t.symbol);
      const matchStrategy = selectedStrategies.length === 0 || selectedStrategies.includes(t.strategy);
      const matchSignal = selectedSignals.length === 0 || selectedSignals.includes(t.signal || "");
      const matchEmotion = selectedEmotions.length === 0 || selectedEmotions.includes(t.emotion);
      const matchDirection = selectedDirections.length === 0 || selectedDirections.includes(t.direction);
      const matchPlanned = selectedPlanned.length === 0 || selectedPlanned.includes(t.planned);
      const matchSource = selectedSources.length === 0 || selectedSources.includes(normalizedSource);
      const matchExchange = selectedExchanges.length === 0 || selectedExchanges.includes(normalizedExchange);
      const matchDate = selectedDates.length === 0 || selectedDates.includes(t.date);
      const matchWeekday =
        selectedWeekdays.length === 0 ||
        (weekday !== null && selectedWeekdays.includes(weekday));
      const matchHour =
        selectedHours.length === 0 || (hour !== null && selectedHours.includes(hour));
      const matchYear =
        selectedYears.length === 0 || (year !== null && selectedYears.includes(year));
      const matchMonth =
        selectedMonths.length === 0 || (month !== null && selectedMonths.includes(month));

      const tradeCustomFilters = t.customFilters || [];
      const matchCustomFilters = Object.entries(selectedCustomFilters).every(([key, selectedValues]) => {
        if (!selectedValues.length) return true;

        return tradeCustomFilters.some(
          (item) => item.key === key && selectedValues.includes(item.value)
        );
      });

      return (
        matchSymbol &&
        matchStrategy &&
        matchSignal &&
        matchEmotion &&
        matchDirection &&
        matchPlanned &&
        matchSource &&
        matchExchange &&
        matchDate &&
        matchWeekday &&
        matchHour &&
        matchYear &&
        matchMonth &&
        matchCustomFilters
      );
    });
  }, [
    trades,
    selectedSymbols,
    selectedStrategies,
    selectedSignals,
    selectedEmotions,
    selectedDirections,
    selectedPlanned,
    selectedSources,
    selectedExchanges,
    selectedDates,
    selectedWeekdays,
    selectedHours,
    selectedYears,
    selectedMonths,
    selectedCustomFilters,
  ]);

  const drawCharts = useCallback(() => {
    if (donutRef.current) {
      drawDonut(donutRef.current, filteredTrades);
    }

    if (equityRef.current) {
      drawEquityChart(
        equityRef.current,
        getEquityCurve(filteredTrades),
        filteredTrades,
        (trade) => {
          if (!trade?.id) return;
          onOpenTrade?.(trade.id);
        },
        showEquityPoints
      );
    }
  }, [filteredTrades, onOpenTrade, showEquityPoints]);

  useEffect(() => {
    const timer = window.setTimeout(drawCharts, 100);
    window.addEventListener("resize", drawCharts);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", drawCharts);
    };
  }, [drawCharts]);

  const wins = filteredTrades.filter((t) => t.pnl > 0);
  const losses = filteredTrades.filter((t) => t.pnl < 0);
  const planned = filteredTrades.filter((t) => t.planned === "yes");
  const unplanned = filteredTrades.filter((t) => t.planned === "no");

  const avgWin = wins.length ? avg(wins.map((t) => t.pnl)) : 0;
  const avgLoss = losses.length ? avg(losses.map((t) => t.pnl)) : 0;
  const avgTrade = filteredTrades.length ? avg(filteredTrades.map((t) => t.pnl)) : 0;
  const winRate = filteredTrades.length ? wins.length / filteredTrades.length : 0;
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;
  const maxDrawdown = calculateMaxDrawdown(filteredTrades);
  const streaks = calculateStreaks(filteredTrades);
  const plannedPnl = sum(planned.map((t) => t.pnl));
  const unplannedPnl = sum(unplanned.map((t) => t.pnl));
  const gp = sum(wins.map((t) => t.pnl));
  const gl = Math.abs(sum(losses.map((t) => t.pnl)));
  const pf = gl === 0 ? gp : gp / gl;
  const totalPnl = sum(filteredTrades.map((t) => t.pnl));

  const topCards = [
    {
      label: "Найдено сделок",
      value: String(filteredTrades.length),
      color: "text-[#ecf6ff]",
    },
    {
      label: "Общий P/L",
      value: `${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`,
      color: colorClass(totalPnl),
    },
    {
      label: "Средний результат",
      value: `${avgTrade >= 0 ? "+" : ""}${fmt(avgTrade)}`,
      color: colorClass(avgTrade),
    },
    {
      label: "Ожидание на сделку",
      value: `${expectancy >= 0 ? "+" : ""}${fmt(expectancy)}`,
      color: colorClass(expectancy),
    },
  ];

  const metrics = [
    { label: "Win rate", value: `${(winRate * 100).toFixed(1)}%`, color: "text-[#8cefff]" },
    { label: "Средняя прибыль", value: `+${fmt(avgWin)}`, color: "text-[#4de2c5]" },
    { label: "Средний убыток", value: fmt(avgLoss), color: "text-[#ff6b81]" },
    { label: "Profit Factor", value: fmt(pf || 0), color: "text-[#8cefff]" },
    { label: "Max Drawdown", value: fmt(maxDrawdown), color: "text-[#ff6b81]" },
    { label: "Макс. серия побед", value: String(streaks.maxWins), color: "text-[#4de2c5]" },
    { label: "Макс. серия убытков", value: String(streaks.maxLosses), color: "text-[#ff6b81]" },
    { label: streaks.currentLabel, value: String(streaks.currentSeries), color: "text-[#ecf6ff]" },
    {
      label: "P/L по плану",
      value: `${plannedPnl >= 0 ? "+" : ""}${fmt(plannedPnl)}`,
      color: colorClass(plannedPnl),
    },
    {
      label: "P/L вне плана",
      value: `${unplannedPnl >= 0 ? "+" : ""}${fmt(unplannedPnl)}`,
      color: colorClass(unplannedPnl),
    },
  ];

  const customFilterChips: ActiveFilterChip[] = Object.entries(selectedCustomFilters).flatMap(
    ([key, values]) =>
      values.map((value) => ({
        group: "customFilters",
        subGroup: key,
        value,
        label: `${key}: ${value}`,
      }))
  );

  const activeFilterChips: ActiveFilterChip[] = [
    ...selectedSymbols.map((v) => ({ group: "symbols", value: v, label: v })),
    ...selectedStrategies.map((v) => ({ group: "strategies", value: v, label: v })),
    ...selectedSignals.map((v) => ({ group: "signals", value: v, label: v })),
    ...selectedEmotions.map((v) => ({ group: "emotions", value: v, label: v })),
    ...selectedDirections.map((v) => ({ group: "directions", value: v, label: v })),
    ...selectedPlanned.map((v) => ({
      group: "planned",
      value: v,
      label: v === "yes" ? "По плану" : "Вне плана",
    })),
    ...selectedSources.map((v) => ({
      group: "sources",
      value: v,
      label: v === "manual" ? "Ручные" : "Импортированные",
    })),
    ...selectedExchanges.map((v) => ({
      group: "exchanges",
      value: v,
      label: getExchangeLabel(v),
    })),
    ...selectedDates.map((v) => ({
      group: "dates",
      value: v,
      label: formatDateLabel(v),
    })),
    ...selectedWeekdays.map((v) => ({
      group: "weekdays",
      value: String(v),
      label: WEEKDAY_OPTIONS.find((d) => d.value === v)?.label || String(v),
    })),
    ...selectedHours.map((v) => ({ group: "hours", value: v, label: `${v}:00` })),
    ...selectedYears.map((v) => ({ group: "years", value: v, label: v })),
    ...selectedMonths.map((v) => ({
      group: "months",
      value: v,
      label: MONTH_OPTIONS.find((m) => m.value === v)?.label || v,
    })),
    ...customFilterChips,
  ];

  const removeChip = (group: string, value: string, subGroup?: string) => {
    if (group === "symbols") {
      setSelectedSymbols((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "strategies") {
      setSelectedStrategies((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "signals") {
      setSelectedSignals((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "emotions") {
      setSelectedEmotions((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "directions") {
      setSelectedDirections((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "planned") {
      setSelectedPlanned((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "sources") {
      setSelectedSources((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "exchanges") {
      setSelectedExchanges((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "dates") {
      setSelectedDates((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "weekdays") {
      const numValue = Number(value);
      setSelectedWeekdays((prev) => prev.filter((v) => v !== numValue));
      return;
    }
    if (group === "hours") {
      setSelectedHours((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "years") {
      setSelectedYears((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "months") {
      setSelectedMonths((prev) => prev.filter((v) => v !== value));
      return;
    }
    if (group === "customFilters" && subGroup) {
      setSelectedCustomFilters((prev) => {
        const current = prev[subGroup] || [];
        const nextValues = current.filter((v) => v !== value);

        if (!nextValues.length) {
          const { [subGroup]: _, ...rest } = prev;
          return rest;
        }

        return {
          ...prev,
          [subGroup]: nextValues,
        };
      });
    }
  };

  const resetFilters = () => {
    setSelectedSymbols([]);
    setSelectedStrategies([]);
    setSelectedSignals([]);
    setSelectedEmotions([]);
    setSelectedDirections([]);
    setSelectedPlanned([]);
    setSelectedSources([]);
    setSelectedExchanges([]);
    setSelectedDates([]);
    setSelectedWeekdays([]);
    setSelectedHours([]);
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedCustomFilters({});
  };

  const weekdayPreview = previewSelected(
    selectedWeekdays.map(
      (value) => WEEKDAY_OPTIONS.find((d) => d.value === value)?.label || String(value)
    )
  );

  const plannedPreview = previewSelected(
    selectedPlanned.map((value) => (value === "yes" ? "По плану" : "Вне плана"))
  );

  const sourcePreview = previewSelected(
    selectedSources.map((value) => (value === "manual" ? "Ручные" : "Импортированные"))
  );

  const exchangePreview = previewSelected(selectedExchanges.map((value) => getExchangeLabel(value)));
  const datesPreview = previewSelected(selectedDates.map((value) => formatDateLabel(value)));
  const hoursPreview = previewSelected(selectedHours.map((h) => `${h}:00`));
  const yearsPreview = previewSelected(selectedYears);
  const monthsPreview = previewSelected(
    selectedMonths.map((value) => MONTH_OPTIONS.find((m) => m.value === value)?.label || value)
  );

  const customFiltersPreview = useMemo(() => {
    const labels = Object.entries(selectedCustomFilters).flatMap(([key, values]) =>
      values.map((value) => `${key}: ${value}`)
    );

    return previewSelected(labels);
  }, [selectedCustomFilters]);

  return (
    <section>
      <div className="card">
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="m-0 text-lg font-bold">Фильтры аналитики</h2>

              {activeFilterChips.length > 0 && (
                <span className="rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.75)] px-2.5 py-1 text-xs font-bold text-[#8cefff]">
                  {activeFilterChips.length} активно
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-[#8aa6c7]">
              {filtersOpen
                ? "Выбери нужные параметры и комбинируй фильтры между собой"
                : "Нажми, чтобы открыть фильтры аналитики"}
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.55)] text-xl font-bold text-[#8cefff] transition">
            {filtersOpen ? "−" : "+"}
          </div>
        </button>

        {filtersOpen && (
          <>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgba(56,189,248,.08)] pt-4">
              <button className="btn btn-secondary" onClick={openAllSections} type="button">
                Открыть все
              </button>
              <button className="btn btn-secondary" onClick={closeAllSections} type="button">
                Свернуть все
              </button>
              <button className="btn btn-secondary" onClick={resetFilters} type="button">
                Сбросить фильтры
              </button>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="mt-4 rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(8,15,28,.3)] p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8aa6c7]">
                  Активные фильтры
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={`${chip.group}-${chip.subGroup || ""}-${chip.value}`}
                      type="button"
                      onClick={() => removeChip(chip.group, chip.value, chip.subGroup)}
                      className="rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.75)] px-3 py-1 text-sm text-[#dff3ff] transition hover:border-[rgba(56,189,248,.28)] hover:bg-[rgba(24,46,78,.85)]"
                    >
                      {chip.label} ×
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3">
              <FilterSection
                title="Инструменты"
                count={selectedSymbols.length}
                preview={previewSelected(selectedSymbols)}
                isOpen={openSections.symbols}
                onToggle={() => toggleSection("symbols")}
              >
                <div className="flex flex-wrap gap-2">
                  {symbolOptions.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      className={`seg-btn ${selectedSymbols.includes(symbol) ? "active" : ""}`}
                      onClick={() => setSelectedSymbols((prev) => toggleStringValue(prev, symbol))}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title="Сетапы"
                count={selectedStrategies.length}
                preview={previewSelected(selectedStrategies)}
                isOpen={openSections.strategies}
                onToggle={() => toggleSection("strategies")}
              >
                <div className="flex flex-wrap gap-2">
                  {strategyOptions.length ? (
                    strategyOptions.map((strategy) => (
                      <button
                        key={strategy}
                        type="button"
                        className={`seg-btn ${selectedStrategies.includes(strategy) ? "active" : ""}`}
                        onClick={() =>
                          setSelectedStrategies((prev) => toggleStringValue(prev, strategy))
                        }
                      >
                        {strategy}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Сетапов пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Сигналы"
                count={selectedSignals.length}
                preview={previewSelected(selectedSignals)}
                isOpen={openSections.signals}
                onToggle={() => toggleSection("signals")}
              >
                <div className="flex flex-wrap gap-2">
                  {signalOptions.length ? (
                    signalOptions.map((signal) => (
                      <button
                        key={signal}
                        type="button"
                        className={`seg-btn ${selectedSignals.includes(signal) ? "active" : ""}`}
                        onClick={() => setSelectedSignals((prev) => toggleStringValue(prev, signal))}
                      >
                        {signal}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Сигналов пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Эмоции"
                count={selectedEmotions.length}
                preview={previewSelected(selectedEmotions)}
                isOpen={openSections.emotions}
                onToggle={() => toggleSection("emotions")}
              >
                <div className="flex flex-wrap gap-2">
                  {emotionOptions.length ? (
                    emotionOptions.map((emotion) => (
                      <button
                        key={emotion}
                        type="button"
                        className={`seg-btn ${selectedEmotions.includes(emotion) ? "active" : ""}`}
                        onClick={() => setSelectedEmotions((prev) => toggleStringValue(prev, emotion))}
                      >
                        {emotion}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Эмоций пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Направление"
                count={selectedDirections.length}
                preview={previewSelected(selectedDirections)}
                isOpen={openSections.directions}
                onToggle={() => toggleSection("directions")}
              >
                <div className="flex flex-wrap gap-2">
                  {directionOptions.length ? (
                    directionOptions.map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        className={`seg-btn ${selectedDirections.includes(direction) ? "active" : ""}`}
                        onClick={() =>
                          setSelectedDirections((prev) => toggleStringValue(prev, direction))
                        }
                      >
                        {direction}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Направлений пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="План"
                count={selectedPlanned.length}
                preview={plannedPreview}
                isOpen={openSections.planned}
                onToggle={() => toggleSection("planned")}
              >
                <div className="flex flex-wrap gap-2">
                  {plannedOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`seg-btn ${selectedPlanned.includes(item.value) ? "active" : ""}`}
                      onClick={() => setSelectedPlanned((prev) => toggleStringValue(prev, item.value))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title="Источник"
                count={selectedSources.length}
                preview={sourcePreview}
                isOpen={openSections.sources}
                onToggle={() => toggleSection("sources")}
              >
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`seg-btn ${selectedSources.includes(item.value) ? "active" : ""}`}
                      onClick={() => setSelectedSources((prev) => toggleStringValue(prev, item.value))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title="Биржа"
                count={selectedExchanges.length}
                preview={exchangePreview}
                isOpen={openSections.exchanges}
                onToggle={() => toggleSection("exchanges")}
              >
                <div className="flex flex-wrap gap-2">
                  {exchangeOptions.length ? (
                    exchangeOptions.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`seg-btn ${selectedExchanges.includes(item.value) ? "active" : ""}`}
                        onClick={() =>
                          setSelectedExchanges((prev) => toggleStringValue(prev, item.value))
                        }
                      >
                        {item.label}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Бирж пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Дата/Даты"
                count={selectedDates.length}
                preview={datesPreview}
                isOpen={openSections.dates}
                onToggle={() => toggleSection("dates")}
              >
                <div className="flex flex-wrap gap-2">
                  {dateOptions.length ? (
                    dateOptions.map((date) => (
                      <button
                        key={date}
                        type="button"
                        className={`seg-btn ${selectedDates.includes(date) ? "active" : ""}`}
                        onClick={() => setSelectedDates((prev) => toggleStringValue(prev, date))}
                      >
                        {formatDateLabel(date)}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Дат пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Годы"
                count={selectedYears.length}
                preview={yearsPreview}
                isOpen={openSections.years}
                onToggle={() => toggleSection("years")}
              >
                <div className="flex flex-wrap gap-2">
                  {yearOptions.length ? (
                    yearOptions.map((year) => (
                      <button
                        key={year}
                        type="button"
                        className={`seg-btn ${selectedYears.includes(year) ? "active" : ""}`}
                        onClick={() => setSelectedYears((prev) => toggleStringValue(prev, year))}
                      >
                        {year}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Годов пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Месяцы"
                count={selectedMonths.length}
                preview={monthsPreview}
                isOpen={openSections.months}
                onToggle={() => toggleSection("months")}
              >
                <div className="flex flex-wrap gap-2">
                  {monthOptions.length ? (
                    monthOptions.map((month) => (
                      <button
                        key={month.value}
                        type="button"
                        className={`seg-btn ${selectedMonths.includes(month.value) ? "active" : ""}`}
                        onClick={() =>
                          setSelectedMonths((prev) => toggleStringValue(prev, month.value))
                        }
                      >
                        {month.label}
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">Месяцев пока нет</div>
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title="Дни недели"
                count={selectedWeekdays.length}
                preview={weekdayPreview}
                isOpen={openSections.weekdays}
                onToggle={() => toggleSection("weekdays")}
              >
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      className={`seg-btn ${selectedWeekdays.includes(day.value) ? "active" : ""}`}
                      onClick={() => setSelectedWeekdays((prev) => toggleNumberValue(prev, day.value))}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title="Часы"
                count={selectedHours.length}
                preview={hoursPreview}
                isOpen={openSections.hours}
                onToggle={() => toggleSection("hours")}
              >
                <div className="flex flex-wrap gap-2">
                  {HOUR_OPTIONS.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      className={`seg-btn ${selectedHours.includes(hour) ? "active" : ""}`}
                      onClick={() => setSelectedHours((prev) => toggleStringValue(prev, hour))}
                    >
                      {hour}:00
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title="Пользовательские фильтры"
                count={selectedCustomFiltersCount}
                preview={customFiltersPreview}
                isOpen={openSections.customFiltersGroup}
                onToggle={() => toggleSection("customFiltersGroup")}
              >
                <div className="grid gap-3">
                  {customFilterGroups.length ? (
                    customFilterGroups.map((group) => (
                      <CustomFilterGroupSection
                        key={group.key}
                        title={group.key}
                        values={group.values}
                        selectedValues={selectedCustomFilters[group.key] || []}
                        isOpen={Boolean(openSections[`custom-${group.key}`])}
                        onToggle={() => toggleSection(`custom-${group.key}`)}
                        onToggleValue={(value) => toggleCustomFilterValue(group.key, value)}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-[#8aa6c7]">
                      Пользовательских фильтров пока нет
                    </div>
                  )}
                </div>
              </FilterSection>
            </div>
          </>
        )}
      </div>

      <div className="h-4" />

      {diaryStats && (
        <>
          <div className="card border-[rgba(56,189,248,.18)] bg-[linear-gradient(180deg,rgba(10,18,34,.88),rgba(10,18,34,.72))]">
            <div className="mb-4">
              <h2 className="m-0 text-lg font-bold text-[#ecf6ff]">Состояние дневника</h2>
              <p className="mt-1 text-sm text-[#8aa6c7]">
                Показатели активного дневника. Они не зависят от фильтров аналитики.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-[1200px]:grid-cols-1">
              <div className="rounded-[18px] border border-[rgba(56,189,248,.12)] bg-[rgba(8,15,28,.38)] px-5 py-4">
                <div className="text-sm text-[#8aa6c7]">Текущий баланс</div>
                <div className="mt-[10px] text-[28px] font-extrabold text-[#8cefff]">
                  {fmt(diaryStats.currentBalance)} {diaryStats.currency}
                </div>
              </div>

              <div className="rounded-[18px] border border-[rgba(56,189,248,.12)] bg-[rgba(8,15,28,.38)] px-5 py-4">
                <div className="text-sm text-[#8aa6c7]">Рост к старту</div>
                <div
                  className={`mt-[10px] text-[28px] font-extrabold ${
                    diaryStats.startBalance > 0
                      ? diaryStats.growthPercent >= 0
                        ? "text-[#4de2c5]"
                        : "text-[#ff6b81]"
                      : "text-[#ecf6ff]"
                  }`}
                >
                  {diaryStats.startBalance > 0
                    ? `${diaryStats.growthPercent >= 0 ? "+" : ""}${fmt(diaryStats.growthPercent)}%`
                    : "—"}
                </div>
              </div>

              <div className="rounded-[18px] border border-[rgba(56,189,248,.12)] bg-[rgba(8,15,28,.38)] px-5 py-4">
                <div className="text-sm text-[#8aa6c7]">Стартовый баланс</div>
                <div className="mt-[10px] text-[28px] font-extrabold text-[#ecf6ff]">
                  {diaryStats.startBalance > 0
                    ? `${fmt(diaryStats.startBalance)} ${diaryStats.currency}`
                    : "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[16px] border border-[rgba(56,189,248,.1)] bg-[rgba(8,15,28,.28)] px-4 py-3 text-sm text-[#8aa6c7]">
              {diaryStats.balanceSourceLabel}
            </div>
          </div>

          <div className="h-4" />
        </>
      )}

      <div className="grid grid-cols-4 gap-4 max-[1200px]:grid-cols-1">
        {topCards.map((c, i) => (
          <div key={i} className="card">
            <div className="text-sm text-[#8aa6c7]">{c.label}</div>
            <div className={`mt-[10px] text-[26px] font-extrabold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="h-4" />

      <div className="grid grid-cols-2 gap-4 max-[1200px]:grid-cols-1">
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-bold">Кривая доходности по фильтрам</h2>

            <div className="flex flex-wrap items-center gap-2">
              <span className="chip">{filteredTrades.length} сделок</span>

              <button
                type="button"
                className={`btn ${showEquityPoints ? "" : "btn-secondary"}`}
                onClick={() => setShowEquityPoints((prev) => !prev)}
              >
                {showEquityPoints ? "Скрыть точки" : "Показать точки"}
              </button>
            </div>
          </div>

          <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(8,15,28,.35)] p-3">
            <div className="relative h-[280px] w-full min-[1400px]:h-[320px]">
              <canvas ref={equityRef} className="h-full w-full" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="m-0 mb-3 text-lg font-bold">Распределение сделок</h2>

          <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(8,15,28,.35)] p-3">
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 min-[1400px]:min-h-[320px]">
              <div className="relative flex h-[180px] w-[180px] items-center justify-center">
                <canvas ref={donutRef} className="h-full w-full" />
              </div>

              <div className="text-center">
                <div className="text-[28px] font-extrabold text-[#ecf6ff]">
                  {(winRate * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-[#8aa6c7]">Win rate</div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full border border-[rgba(77,226,197,.18)] bg-[rgba(77,226,197,.08)] px-3 py-1 text-sm font-semibold text-[#4de2c5]">
                  Прибыльных: {wins.length}
                </span>
                <span className="rounded-full border border-[rgba(255,107,129,.18)] bg-[rgba(255,107,129,.08)] px-3 py-1 text-sm font-semibold text-[#ff6b81]">
                  Убыточных: {losses.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-4" />

      <div className="grid grid-cols-2 gap-4 max-[1200px]:grid-cols-1">
        <div className="card">
          <h2 className="m-0 mb-3 text-lg font-bold">Ключевые метрики</h2>
          <div className="grid gap-3">
            {metrics.map((m, i) => (
              <div key={i} className="item">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong>{m.label}</strong>
                  <span className={m.color}>{m.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="m-0 mb-3 text-lg font-bold">Отфильтрованные сделки</h2>

          <div className="max-h-[620px] overflow-y-auto pr-1">
            <div className="grid gap-3">
              {filteredTrades.length ? (
                filteredTrades
                  .slice()
                  .sort((a, b) => {
                    const aTime = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
                    const bTime = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
                    return bTime - aTime;
                  })
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="item w-full text-left transition hover:border-[rgba(56,189,248,.18)] hover:bg-[rgba(19,36,63,.42)]"
                      onClick={() => onOpenTrade?.(t.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <strong>
                          {t.symbol} · {t.direction}
                        </strong>
                        <span className={colorClass(t.pnl)}>
                          {t.pnl >= 0 ? "+" : ""}
                          {fmt(t.pnl)}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-[#8aa6c7]">
                        {t.date}
                        {t.time ? ` · ${t.time}` : ""}
                        {" · "}
                        {t.strategy || "Без сетапа"}
                      </div>

                      <div className="mt-1 text-sm text-[#9db9d6]">
                        Сигнал: {t.signal || "—"} · Эмоция: {t.emotion || "—"}
                      </div>

                      <div className="mt-1 text-sm text-[#9db9d6]">
                        Источник: {t.source === "imported" ? "Импорт" : "Ручная"} · Биржа:{" "}
                        {t.exchange || "—"}
                      </div>

                      {t.customFilters && t.customFilters.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {t.customFilters.map((item, index) => (
                            <span
                              key={`${item.key}-${item.value}-${index}`}
                              className="rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.75)] px-2.5 py-1 text-xs text-[#dff3ff]"
                            >
                              {item.key}: {item.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))
              ) : (
                <div className="item text-[#8aa6c7]">По выбранным фильтрам сделок нет</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}