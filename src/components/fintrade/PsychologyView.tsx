"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/lib/fintrade/store";
import { colorClass, fmt } from "@/lib/fintrade/store";

type Props = {
  trades: Trade[];
  onOpenTrade?: (tradeId: string) => void;
};

type EmotionTradeFilter = "all" | "wins" | "losses" | "with-psychology";

type PreMarketMood =
  | "Спокоен"
  | "Сконцентрирован"
  | "Нейтрален"
  | "Устал"
  | "Напряжён"
  | "Есть FOMO"
  | "Раздражён"
  | "Не готов к торговле";

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

type RedFlagItem = {
  id: string;
  label: string;
  checked: boolean;
};

const PRE_MARKET_KEY = "fintrade_psy_pre_market_v1";
const CHECKLIST_KEY = "fintrade_psy_checklist_v1";
const RED_FLAGS_KEY = "fintrade_psy_red_flags_v1";
const FOCUS_KEY = "fintrade_psy_focus_v1";

const PRE_MARKET_OPTIONS: PreMarketMood[] = [
  "Спокоен",
  "Сконцентрирован",
  "Нейтрален",
  "Устал",
  "Напряжён",
  "Есть FOMO",
  "Раздражён",
  "Не готов к торговле",
];

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "calm", label: "Я спокоен", checked: false },
  { id: "not-rushing", label: "Я не тороплюсь", checked: false },
  { id: "have-plan", label: "У меня есть сценарий", checked: false },
  { id: "can-skip", label: "Я готов пропустить сделку без сигнала", checked: false },
  { id: "no-revenge", label: "Я не пытаюсь отыграться", checked: false },
  { id: "accept-stop", label: "Я заранее принимаю стоп", checked: false },
  { id: "no-fomo-entry", label: "Я не вхожу из страха упустить движение", checked: false },
];

const DEFAULT_RED_FLAGS: RedFlagItem[] = [
  { id: "revenge", label: "Хочу отыграться", checked: false },
  { id: "fomo", label: "Чувствую FOMO", checked: false },
  { id: "anger", label: "Есть злость после убытка", checked: false },
  { id: "tired", label: "Устал / сонный", checked: false },
  { id: "rush-entry", label: "Хочу войти немедленно без сигнала", checked: false },
  { id: "broke-rules", label: "Уже нарушал правила сегодня", checked: false },
  { id: "too-emotional", label: "Слишком эмоционально реагирую на рынок", checked: false },
];

const FOCUS_SUGGESTIONS = [
  "Сегодня не спешить",
  "Только сделки по подтверждённому сценарию",
  "Не гнаться за движением",
  "Качество важнее количества",
  "Пропуск сделки лучше импульсивного входа",
  "Не торговать после двух ошибок подряд",
];

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function mergeChecklist(saved: ChecklistItem[] | null | undefined): ChecklistItem[] {
  if (!Array.isArray(saved) || !saved.length) return DEFAULT_CHECKLIST;

  return DEFAULT_CHECKLIST.map((defaultItem) => {
    const existing = saved.find((item) => item.id === defaultItem.id);
    return existing
      ? { ...defaultItem, checked: Boolean(existing.checked) }
      : defaultItem;
  });
}

function mergeRedFlags(saved: RedFlagItem[] | null | undefined): RedFlagItem[] {
  if (!Array.isArray(saved) || !saved.length) return DEFAULT_RED_FLAGS;

  return DEFAULT_RED_FLAGS.map((defaultItem) => {
    const existing = saved.find((item) => item.id === defaultItem.id);
    return existing
      ? { ...defaultItem, checked: Boolean(existing.checked) }
      : defaultItem;
  });
}

function moodTone(mood: string) {
  if (mood === "Спокоен" || mood === "Сконцентрирован") {
    return "border-[rgba(77,226,197,.22)] bg-[rgba(14,36,33,.55)] text-[#4de2c5]";
  }

  if (mood === "Нейтрален") {
    return "border-[rgba(251,191,36,.22)] bg-[rgba(42,33,14,.45)] text-[#fbbf24]";
  }

  return "border-[rgba(255,107,129,.22)] bg-[rgba(40,18,25,.45)] text-[#ff6b81]";
}

function emotionBadgeTone(emotion: string) {
  const value = emotion.trim().toLowerCase();

  if (!value) {
    return "border-[rgba(125,211,252,.14)] bg-[rgba(19,36,63,.55)] text-[#d8ebff]";
  }

  if (
    value.includes("спокой") ||
    value.includes("увер") ||
    value.includes("концент") ||
    value.includes("нейтрал")
  ) {
    return "border-[rgba(77,226,197,.18)] bg-[rgba(10,27,24,.5)] text-[#4de2c5]";
  }

  if (
    value.includes("fomo") ||
    value.includes("жад") ||
    value.includes("импуль") ||
    value.includes("нервоз") ||
    value.includes("раздраж")
  ) {
    return "border-[rgba(255,107,129,.18)] bg-[rgba(40,15,22,.5)] text-[#ff8ea1]";
  }

  return "border-[rgba(251,191,36,.18)] bg-[rgba(40,31,10,.45)] text-[#fbbf24]";
}

function ToggleRow({
  label,
  checked,
  onToggle,
  activeColor,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  activeColor: "cyan" | "rose";
}) {
  const activeClasses =
    activeColor === "cyan"
      ? "border-[#22d3ee] bg-[#22d3ee] text-[#06111f]"
      : "border-[#fb7185] bg-[#fb7185] text-[#1a0a0e]";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="item flex w-full items-center gap-3 text-left"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border text-[12px] font-bold transition ${
          checked
            ? activeClasses
            : "border-[rgba(125,211,252,.26)] bg-[rgba(10,18,34,.55)] text-transparent"
        }`}
      >
        ✓
      </span>

      <span className="min-w-0 flex-1 whitespace-normal break-words text-[15px] leading-[1.5] text-[#d8ebff]">
        {label}
      </span>
    </button>
  );
}

function openTradeDetail(tradeId: string, onOpenTrade?: (tradeId: string) => void) {
  onOpenTrade?.(tradeId);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("fintrade:open-trade", {
        detail: { tradeId },
      })
    );
  }
}

function normalizeEmotion(value: string) {
  return value.trim().toLowerCase();
}

export default function PsychologyView({ trades, onOpenTrade }: Props) {
  const [preMarketMood, setPreMarketMood] = useState<PreMarketMood>("Нейтрален");
  const [preMarketNote, setPreMarketNote] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [redFlags, setRedFlags] = useState<RedFlagItem[]>(DEFAULT_RED_FLAGS);
  const [focus, setFocus] = useState("");
  const [tradeFilter, setTradeFilter] = useState<EmotionTradeFilter>("all");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);

  useEffect(() => {
    const savedPreMarket = loadLocal<{ mood?: PreMarketMood; note?: string }>(PRE_MARKET_KEY, {
      mood: "Нейтрален",
      note: "",
    });

    const savedChecklist = loadLocal<ChecklistItem[]>(CHECKLIST_KEY, DEFAULT_CHECKLIST);
    const savedRedFlags = loadLocal<RedFlagItem[]>(RED_FLAGS_KEY, DEFAULT_RED_FLAGS);
    const savedFocus = loadLocal<string>(FOCUS_KEY, "");

    setPreMarketMood(savedPreMarket.mood || "Нейтрален");
    setPreMarketNote(savedPreMarket.note || "");
    setChecklist(mergeChecklist(savedChecklist));
    setRedFlags(mergeRedFlags(savedRedFlags));
    setFocus(savedFocus || "");
  }, []);

  useEffect(() => {
    saveLocal(PRE_MARKET_KEY, {
      mood: preMarketMood,
      note: preMarketNote,
    });
  }, [preMarketMood, preMarketNote]);

  useEffect(() => {
    saveLocal(CHECKLIST_KEY, checklist);
  }, [checklist]);

  useEffect(() => {
    saveLocal(RED_FLAGS_KEY, redFlags);
  }, [redFlags]);

  useEffect(() => {
    saveLocal(FOCUS_KEY, focus);
  }, [focus]);

  const checkedChecklistCount = checklist.filter((item) => item.checked).length;
  const checkedRedFlags = redFlags.filter((item) => item.checked);
  const redFlagCount = checkedRedFlags.length;

  const riskMessage = useMemo(() => {
    if (redFlagCount === 0) {
      return {
        title: "Состояние под контролем",
        text: "Явных красных флагов не отмечено. Всё равно сохраняйте дисциплину и не спешите с входами.",
        tone: "border-[rgba(77,226,197,.18)] bg-[rgba(10,27,24,.55)] text-[#4de2c5]",
      };
    }

    if (redFlagCount <= 2) {
      return {
        title: "Повышенное внимание",
        text: "Есть сигналы риска. Снизьте активность, уменьшите спешку и проверьте себя перед каждой сделкой.",
        tone: "border-[rgba(251,191,36,.18)] bg-[rgba(40,31,10,.45)] text-[#fbbf24]",
      };
    }

    return {
      title: "Состояние риска",
      text: "Отмечено несколько красных флагов. Лучше сделать паузу, сократить торговлю или пропустить сессию.",
      tone: "border-[rgba(255,107,129,.18)] bg-[rgba(40,15,22,.5)] text-[#ff6b81]",
    };
  }, [redFlagCount]);

  const basePsychologyTrades = useMemo(() => {
    return [...trades]
      .filter((trade) => trade.emotion || trade.psychology)
      .sort((a, b) => {
        const aTime = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
        const bTime = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
        return bTime - aTime;
      });
  }, [trades]);

  const allEmotionTradeCount = basePsychologyTrades.length;
  const winsCount = basePsychologyTrades.filter((trade) => Number(trade.pnl) > 0).length;
  const lossesCount = basePsychologyTrades.filter((trade) => Number(trade.pnl) < 0).length;
  const withPsychologyCount = basePsychologyTrades.filter((trade) =>
    Boolean((trade.psychology || "").trim())
  ).length;

  const selectedEmotionSet = useMemo(
    () => new Set(selectedEmotions.map((emotion) => normalizeEmotion(emotion))),
    [selectedEmotions]
  );

  const filteredPsychologyTrades = useMemo(() => {
    let result = [...basePsychologyTrades];

    if (tradeFilter === "wins") {
      result = result.filter((trade) => Number(trade.pnl) > 0);
    }

    if (tradeFilter === "losses") {
      result = result.filter((trade) => Number(trade.pnl) < 0);
    }

    if (tradeFilter === "with-psychology") {
      result = result.filter((trade) => Boolean((trade.psychology || "").trim()));
    }

    if (selectedEmotionSet.size > 0) {
      result = result.filter((trade) =>
        selectedEmotionSet.has(normalizeEmotion(trade.emotion || ""))
      );
    }

    return result;
  }, [basePsychologyTrades, tradeFilter, selectedEmotionSet]);

  const filteredStats = useMemo(() => {
    const total = filteredPsychologyTrades.length;
    const totalPnl = filteredPsychologyTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
    const wins = filteredPsychologyTrades.filter((trade) => Number(trade.pnl) > 0).length;
    const withPsychology = filteredPsychologyTrades.filter((trade) =>
      Boolean((trade.psychology || "").trim())
    ).length;
    const winRate = total ? (wins / total) * 100 : 0;

    return {
      total,
      totalPnl,
      wins,
      winRate,
      withPsychology,
    };
  }, [filteredPsychologyTrades]);

  const emotionSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        emotion: string;
        count: number;
        pnl: number;
      }
    >();

    for (const trade of trades) {
      const emotion = (trade.emotion || "").trim();
      if (!emotion) continue;

      const current = map.get(emotion) || { emotion, count: 0, pnl: 0 };
      current.count += 1;
      current.pnl += Number(trade.pnl) || 0;
      map.set(emotion, current);
    }

    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [trades]);

  const resetPsychologyControls = () => {
    if (!window.confirm("Сбросить состояние, чек-лист, красные флаги и фокус дня?")) return;

    setPreMarketMood("Нейтрален");
    setPreMarketNote("");
    setChecklist(DEFAULT_CHECKLIST.map((item) => ({ ...item, checked: false })));
    setRedFlags(DEFAULT_RED_FLAGS.map((item) => ({ ...item, checked: false })));
    setFocus("");
  };

  const resetEmotionFilters = () => {
    setTradeFilter("all");
    setSelectedEmotions([]);
  };

  const hasActiveEmotionFilters = tradeFilter !== "all" || selectedEmotions.length > 0;

  const toggleEmotionSelection = (emotion: string) => {
    const normalized = normalizeEmotion(emotion);

    setSelectedEmotions((prev) => {
      const exists = prev.some((item) => normalizeEmotion(item) === normalized);

      if (exists) {
        return prev.filter((item) => normalizeEmotion(item) !== normalized);
      }

      return [...prev, emotion];
    });
  };

  return (
    <div className="grid gap-5">
      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="grid gap-5">
          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-bold">Состояние перед торговлей</h3>
                <p className="mt-1 text-sm text-[#8aa6c7]">
                  Отметьте своё текущее состояние до начала работы с рынком
                </p>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${moodTone(
                  preMarketMood
                )}`}
              >
                {preMarketMood}
              </span>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-[8px] block text-sm font-bold text-[#8aa6c7]">
                  Текущее состояние
                </label>
                <select
                  value={preMarketMood}
                  onChange={(e) => setPreMarketMood(e.target.value as PreMarketMood)}
                >
                  {PRE_MARKET_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-[8px] block text-sm font-bold text-[#8aa6c7]">
                  Короткая заметка
                </label>
                <textarea
                  className="min-h-[110px]"
                  value={preMarketNote}
                  onChange={(e) => setPreMarketNote(e.target.value)}
                  placeholder="Например: плохо спал, хочется быстрее вернуть минус, сегодня спокоен и не тороплюсь..."
                />
              </div>

              <div className="item text-sm text-[#9db9d6]">
                Этот блок нужен, чтобы сначала оценить себя, а уже потом принимать торговые решения.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-bold">Чек-лист самоконтроля</h3>
                <p className="mt-1 text-sm text-[#8aa6c7]">
                  Быстрая проверка дисциплины перед входом в рынок
                </p>
              </div>

              <span className="chip">
                {checkedChecklistCount} / {checklist.length}
              </span>
            </div>

            <div className="grid gap-3">
              {checklist.map((item) => (
                <ToggleRow
                  key={item.id}
                  label={item.label}
                  checked={item.checked}
                  activeColor="cyan"
                  onToggle={() =>
                    setChecklist((prev) =>
                      prev.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, checked: !entry.checked }
                          : entry
                      )
                    )
                  }
                />
              ))}
            </div>

            <div className="mt-4 item text-sm text-[#9db9d6]">
              Если по основным пунктам нет уверенного “да”, лучше снизить активность и не спешить с открытием сделки.
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-bold">Красные флаги</h3>
                <p className="mt-1 text-sm text-[#8aa6c7]">
                  Отметьте признаки состояния, при котором торговать опасно
                </p>
              </div>

              <span className={`chip ${redFlagCount > 0 ? "text-[#ff6b81]" : ""}`}>
                {redFlagCount} отмечено
              </span>
            </div>

            <div className="grid gap-3">
              {redFlags.map((item) => (
                <ToggleRow
                  key={item.id}
                  label={item.label}
                  checked={item.checked}
                  activeColor="rose"
                  onToggle={() =>
                    setRedFlags((prev) =>
                      prev.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, checked: !entry.checked }
                          : entry
                      )
                    )
                  }
                />
              ))}
            </div>

            <div className={`mt-4 rounded-[18px] border p-4 ${riskMessage.tone}`}>
              <div className="text-base font-extrabold">{riskMessage.title}</div>
              <div className="mt-2 text-sm leading-[1.6] text-[#d8ebff]">{riskMessage.text}</div>

              {checkedRedFlags.length > 0 && (
                <div className="mt-3 text-sm text-[#d8ebff]">
                  Отмечено: {checkedRedFlags.map((item) => item.label).join(", ")}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-bold">Фокус дня</h3>
                <p className="mt-1 text-sm text-[#8aa6c7]">
                  Одно главное правило, которое вы держите в центре внимания сегодня
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-[8px] block text-sm font-bold text-[#8aa6c7]">
                  Выберите готовую установку
                </label>
                <select value="" onChange={(e) => e.target.value && setFocus(e.target.value)}>
                  <option value="">Выбрать вариант...</option>
                  {FOCUS_SUGGESTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-[8px] block text-sm font-bold text-[#8aa6c7]">
                  Или напишите свой фокус
                </label>
                <textarea
                  className="min-h-[110px]"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="Например: сегодня не входить без подтверждения и не пытаться догонять движение..."
                />
              </div>

              <div className="item">
                <div className="text-sm text-[#8aa6c7]">Текущий фокус</div>
                <div className="mt-2 text-[17px] font-bold leading-[1.6] text-[#dcecff]">
                  {focus.trim() || "Фокус дня пока не задан"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn btn-secondary" onClick={resetPsychologyControls}>
              Сбросить психологические настройки
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-lg font-bold">Дневник эмоций</h3>
              <p className="mt-1 text-sm text-[#8aa6c7]">
                Последние сделки с эмоциональным и психологическим контекстом
              </p>
            </div>

            <span className="chip">{filteredPsychologyTrades.length}</span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn ${tradeFilter === "all" ? "" : "btn-secondary"}`}
              onClick={() => setTradeFilter("all")}
            >
              Все ({allEmotionTradeCount})
            </button>

            <button
              type="button"
              className={`btn ${tradeFilter === "wins" ? "" : "btn-secondary"}`}
              onClick={() => setTradeFilter("wins")}
            >
              Только прибыльные ({winsCount})
            </button>

            <button
              type="button"
              className={`btn ${tradeFilter === "losses" ? "" : "btn-secondary"}`}
              onClick={() => setTradeFilter("losses")}
            >
              Только убыточные ({lossesCount})
            </button>

            <button
              type="button"
              className={`btn ${tradeFilter === "with-psychology" ? "" : "btn-secondary"}`}
              onClick={() => setTradeFilter("with-psychology")}
            >
              Только с заполненной психологией ({withPsychologyCount})
            </button>

            {hasActiveEmotionFilters && (
              <button type="button" className="btn btn-secondary" onClick={resetEmotionFilters}>
                Сбросить фильтры
              </button>
            )}
          </div>

          {hasActiveEmotionFilters && (
            <div className="mb-4 flex flex-wrap gap-2">
              {tradeFilter !== "all" && (
                <span className="chip">
                  Фильтр:{" "}
                  {tradeFilter === "wins"
                    ? "только прибыльные"
                    : tradeFilter === "losses"
                      ? "только убыточные"
                      : "только с заполненной психологией"}
                </span>
              )}

              {selectedEmotions.length > 0 && (
                <span className="chip">Эмоции: {selectedEmotions.join(", ")}</span>
              )}
            </div>
          )}

          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(10,18,34,.62)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-[#6f8aa8]">
                Сделок
              </div>
              <div className="mt-2 text-[22px] font-extrabold text-white">
                {filteredStats.total}
              </div>
            </div>

            <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(10,18,34,.62)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-[#6f8aa8]">
                Суммарный P/L
              </div>
              <div className={`mt-2 text-[22px] font-extrabold ${colorClass(filteredStats.totalPnl)}`}>
                {filteredStats.totalPnl >= 0 ? "+" : ""}
                {fmt(filteredStats.totalPnl)}
              </div>
            </div>

            <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(10,18,34,.62)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-[#6f8aa8]">
                Win rate
              </div>
              <div className="mt-2 text-[22px] font-extrabold text-[#8cefff]">
                {filteredStats.winRate.toFixed(0)}%
              </div>
            </div>

            <div className="rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(10,18,34,.62)] px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-[#6f8aa8]">
                С психологией
              </div>
              <div className="mt-2 text-[22px] font-extrabold text-white">
                {filteredStats.withPsychology}
              </div>
            </div>
          </div>

          <div className="max-h-[720px] overflow-y-auto pr-1">
            <div className="grid gap-3">
              {filteredPsychologyTrades.length ? (
                filteredPsychologyTrades.map((trade) => (
                  <div
                    key={trade.id}
                    role="button"
                    tabIndex={0}
                    className="item cursor-pointer text-left transition hover:border-[rgba(56,189,248,.18)] hover:bg-[rgba(19,36,63,.42)]"
                    onClick={() => openTradeDetail(trade.id, onOpenTrade)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openTradeDetail(trade.id, onOpenTrade);
                      }
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[16px] font-bold text-white">
                            {trade.symbol} · {trade.direction}
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${emotionBadgeTone(
                              trade.emotion || ""
                            )}`}
                          >
                            {trade.emotion || "Без эмоции"}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-[#8aa6c7]">
                          {trade.date}
                          {trade.time ? ` · ${trade.time}` : ""}
                          {trade.strategy ? ` · ${trade.strategy}` : ""}
                        </div>
                      </div>

                      <div className={`text-[18px] font-extrabold ${colorClass(trade.pnl)}`}>
                        {trade.pnl >= 0 ? "+" : ""}
                        {fmt(trade.pnl)}
                      </div>
                    </div>

                    <div className="mt-3 text-[15px] text-[#d8ebff]">
                      <strong>Эмоции:</strong> {trade.emotion || "—"}
                    </div>

                    <div className="mt-2 text-[15px] text-[#d8ebff]">
                      <strong>Психология:</strong> {trade.psychology || "—"}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#9db9d6]">
                      <span>Рейтинг: {trade.rating || 0}/5</span>
                      <span>{trade.planned === "yes" ? "По плану" : "Вне плана"}</span>
                      {trade.exchange && <span>Биржа: {trade.exchange}</span>}
                      {trade.source === "imported" && <span>Источник: импорт</span>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="item text-[#8aa6c7]">
                  По текущим фильтрам сделки не найдены
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-lg font-bold">Сводка по состояниям</h3>
              <p className="mt-1 text-sm text-[#8aa6c7]">
                Обзор эмоциональных состояний по истории сделок
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {emotionSummary.length ? (
              emotionSummary.map((item) => {
                const isSelected = selectedEmotionSet.has(normalizeEmotion(item.emotion));

                return (
                  <button
                    key={item.emotion}
                    type="button"
                    className={`rounded-[18px] border p-4 text-left transition ${
                      isSelected
                        ? "border-[rgba(56,189,248,.30)] bg-[linear-gradient(180deg,rgba(20,42,72,.92),rgba(12,26,47,.9))] shadow-[0_0_0_1px_rgba(56,189,248,.08),0_10px_30px_rgba(15,118,203,.14)]"
                        : "border-[rgba(56,189,248,.08)] bg-[rgba(10,18,34,.62)] hover:border-[rgba(56,189,248,.18)]"
                    }`}
                    onClick={() => toggleEmotionSelection(item.emotion)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${emotionBadgeTone(
                            item.emotion
                          )}`}
                        >
                          {item.emotion}
                        </span>

                        {isSelected && (
                          <span className="rounded-full border border-[rgba(56,189,248,.18)] bg-[rgba(56,189,248,.12)] px-2.5 py-1 text-xs font-bold text-[#8cefff]">
                            Активно
                          </span>
                        )}
                      </div>

                      <div className={`text-[16px] font-extrabold ${colorClass(item.pnl)}`}>
                        {item.pnl > 0 ? "+" : ""}
                        {fmt(item.pnl)}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-[#8aa6c7]">Сделок: {item.count}</div>
                      <div className="text-xs text-[#8cefff]">
                        {isSelected ? "Нажмите, чтобы убрать из фильтра" : "Нажмите, чтобы добавить в фильтр"}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="item text-[#8aa6c7]">
                Недостаточно данных для сводки по состояниям
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}