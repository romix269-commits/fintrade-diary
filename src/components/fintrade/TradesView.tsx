"use client";

import { useMemo, useState } from "react";
import type { Trade, TradeCustomFilter } from "@/lib/fintrade/store";
import { createId, fmt, colorClass, stars } from "@/lib/fintrade/store";

type TradesViewProps = {
  trades: Trade[];
  allTrades: Trade[];
  activeDiaryId: string | null;
  updateTrades: (trades: Trade[]) => void;
  onOpenTrade: (id: string) => void;
  onOpenImage: (src: string) => void;
};

type LocalNoticeType = "success" | "error" | "info";

type LocalNotice = {
  type: LocalNoticeType;
  text: string;
};

const PRESET_EXCHANGES = ["bybit", "binance", "okx"] as const;

export default function TradesView({
  trades,
  allTrades,
  activeDiaryId,
  updateTrades,
  onOpenTrade,
  onOpenImage,
}: TradesViewProps) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [plannedFilter, setPlannedFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [exchangeFilter, setExchangeFilter] = useState("all");

  const [editId, setEditId] = useState<string | null>(null);
  const [expandedCustomFiltersTradeId, setExpandedCustomFiltersTradeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<LocalNotice | null>(null);

  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState("");
  const [formSymbol, setFormSymbol] = useState("");
  const [formDirection, setFormDirection] = useState("Лонг");
  const [formExchangeMode, setFormExchangeMode] = useState("");
  const [formCustomExchange, setFormCustomExchange] = useState("");
  const [formStrategy, setFormStrategy] = useState("");
  const [formSignal, setFormSignal] = useState("");
  const [formEntry, setFormEntry] = useState("");
  const [formExit, setFormExit] = useState("");
  const [formSize, setFormSize] = useState("");
  const [formPnl, setFormPnl] = useState("");
  const [formRating, setFormRating] = useState("3");
  const [formPlanned, setFormPlanned] = useState<"yes" | "no">("yes");
  const [formEmotion, setFormEmotion] = useState("");
  const [formPsychology, setFormPsychology] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [pendingScreens, setPendingScreens] = useState<string[]>([]);

  const [formCustomFilters, setFormCustomFilters] = useState<TradeCustomFilter[]>([]);
  const [customFilterKey, setCustomFilterKey] = useState("");
  const [customFilterValue, setCustomFilterValue] = useState("");

  const showNotice = (type: LocalNoticeType, text: string) => {
    setNotice({ type, text });
  };

  const resetForm = () => {
    setEditId(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTime("");
    setFormSymbol("");
    setFormDirection("Лонг");
    setFormExchangeMode("");
    setFormCustomExchange("");
    setFormStrategy("");
    setFormSignal("");
    setFormEntry("");
    setFormExit("");
    setFormSize("");
    setFormPnl("");
    setFormRating("3");
    setFormPlanned("yes");
    setFormEmotion("");
    setFormPsychology("");
    setFormNotes("");
    setPendingScreens([]);
    setFormCustomFilters([]);
    setCustomFilterKey("");
    setCustomFilterValue("");
  };

  const exchangeOptions = useMemo(() => {
    const existing = Array.from(
      new Set(
        trades
          .map((t) => (t.exchange || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "ru"));

    return existing;
  }, [trades]);

  const uniqueTrades = useMemo(() => {
    const map = new Map<string, Trade>();

    for (const trade of trades) {
      const dedupeKey =
        trade.source === "imported" && trade.externalId
          ? `${trade.diaryId || "no-diary"}::${trade.connectionId || "no-connection"}::${trade.externalId}`
          : trade.id;

      map.set(dedupeKey, trade);
    }

    return Array.from(map.values());
  }, [trades]);

  const filteredTrades = useMemo(() => {
    return uniqueTrades
      .filter((t) => {
        const matchDir = directionFilter === "all" || t.direction === directionFilter;

        const normalizedSource = t.source ?? "manual";
        const matchSource = sourceFilter === "all" || normalizedSource === sourceFilter;

        const normalizedExchange = (t.exchange || "").trim();

        const matchExchange =
          exchangeFilter === "all" ||
          (exchangeFilter === "manual"
            ? !normalizedExchange
            : normalizedExchange.toLowerCase() === exchangeFilter.toLowerCase());

        const customFiltersText = (t.customFilters || [])
          .map((item) => `${item.key} ${item.value}`)
          .join(" ");

        const blob = [
          t.date,
          t.time,
          t.symbol,
          t.direction,
          t.strategy,
          t.signal,
          t.emotion,
          t.notes,
          t.psychology,
          t.source,
          t.exchange,
          t.connectionId,
          customFiltersText,
        ]
          .join(" ")
          .toLowerCase();

        const q = search.trim().toLowerCase();
        const matchSearch = !q || blob.includes(q);

        const matchFrom = !dateFrom || (t.date || "") >= dateFrom;
        const matchTo = !dateTo || (t.date || "") <= dateTo;

        const matchPlanned =
          plannedFilter === "all" ||
          (plannedFilter === "yes" ? t.planned === "yes" : t.planned === "no");

        return (
          matchDir &&
          matchSource &&
          matchExchange &&
          matchSearch &&
          matchFrom &&
          matchTo &&
          matchPlanned
        );
      })
      .sort((a, b) => {
        const aTime = new Date(`${a.date || ""}T${a.time || "00:00"}`).getTime();
        const bTime = new Date(`${b.date || ""}T${b.time || "00:00"}`).getTime();
        return bTime - aTime;
      });
  }, [
    uniqueTrades,
    directionFilter,
    sourceFilter,
    exchangeFilter,
    search,
    dateFrom,
    dateTo,
    plannedFilter,
  ]);

  const resolveManualExchange = () => {
    if (formExchangeMode === "custom") {
      const custom = formCustomExchange.trim();
      return custom || undefined;
    }

    const preset = formExchangeMode.trim();
    return preset || undefined;
  };

  const addCustomFilter = () => {
    const key = customFilterKey.trim();
    const value = customFilterValue.trim();

    if (!key || !value) {
      showNotice("error", "Чтобы добавить пользовательский фильтр, заполни и название, и значение.");
      return;
    }

    let wasAdded = false;

    setFormCustomFilters((prev) => {
      const exists = prev.some(
        (item) =>
          item.key.toLowerCase() === key.toLowerCase() &&
          item.value.toLowerCase() === value.toLowerCase()
      );

      if (exists) {
        return prev;
      }

      wasAdded = true;
      return [...prev, { key, value }];
    });

    if (!wasAdded) {
      showNotice("info", "Такой пользовательский фильтр уже добавлен.");
      return;
    }

    setCustomFilterKey("");
    setCustomFilterValue("");
    setNotice(null);
  };

  const removeCustomFilter = (index: number) => {
    setFormCustomFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeDiaryId) {
      showNotice("error", "Сначала выбери активный торговый дневник.");
      return;
    }

    const entry = parseFloat(formEntry);
    const exit = parseFloat(formExit);
    const size = parseFloat(formSize);
    const pnl = parseFloat(formPnl);

    if (
      !formDate ||
      !formSymbol ||
      Number.isNaN(entry) ||
      Number.isNaN(exit) ||
      Number.isNaN(size) ||
      Number.isNaN(pnl)
    ) {
      showNotice("error", "Заполни обязательные поля сделки: дата, инструмент, вход, выход, объём и P/L.");
      return;
    }

    const existingTrade = editId ? allTrades.find((t) => t.id === editId) : null;
    const manualExchange = resolveManualExchange();

    const trade: Trade = {
      id: editId || createId(),
      date: formDate,
      time: formTime.trim(),
      symbol: formSymbol.trim().toUpperCase(),
      direction: formDirection,
      strategy: formStrategy.trim(),
      signal: formSignal.trim(),
      entry,
      exit,
      size,
      pnl,
      rating: parseInt(formRating, 10) || 3,
      planned: formPlanned,
      emotion: formEmotion.trim(),
      psychology: formPsychology.trim(),
      notes: formNotes.trim(),
      screenshots: pendingScreens.slice(),
      source: existingTrade?.source ?? "manual",
      exchange: existingTrade?.source === "imported" ? existingTrade.exchange : manualExchange,
      connectionId: existingTrade?.connectionId,
      importedAt: existingTrade?.importedAt,
      externalId: existingTrade?.externalId,
      diaryId: existingTrade?.diaryId ?? activeDiaryId,
      customFilters: formCustomFilters.slice(),
    };

    if (editId) {
      updateTrades(allTrades.map((t) => (t.id === editId ? trade : t)));
      showNotice("success", "Сделка успешно обновлена.");
    } else {
      updateTrades([trade, ...allTrades]);
      showNotice("success", "Сделка успешно сохранена.");
    }

    resetForm();
  };

  const handleEdit = (id: string) => {
    const t = allTrades.find((x) => x.id === id);
    if (!t) return;

    setEditId(id);
    setFormDate(t.date || "");
    setFormTime(t.time || "");
    setFormSymbol(t.symbol || "");
    setFormDirection(t.direction || "Лонг");

    if (t.source === "imported") {
      setFormExchangeMode("");
      setFormCustomExchange("");
    } else {
      const normalizedExchange = (t.exchange || "").trim();

      if (!normalizedExchange) {
        setFormExchangeMode("");
        setFormCustomExchange("");
      } else if (
        PRESET_EXCHANGES.includes(
          normalizedExchange.toLowerCase() as (typeof PRESET_EXCHANGES)[number]
        )
      ) {
        setFormExchangeMode(normalizedExchange.toLowerCase());
        setFormCustomExchange("");
      } else {
        setFormExchangeMode("custom");
        setFormCustomExchange(normalizedExchange);
      }
    }

    setFormStrategy(t.strategy || "");
    setFormSignal(t.signal || "");
    setFormEntry(String(t.entry ?? ""));
    setFormExit(String(t.exit ?? ""));
    setFormSize(String(t.size ?? ""));
    setFormPnl(String(t.pnl ?? ""));
    setFormRating(String(t.rating || 3));
    setFormPlanned((t.planned || "yes") as "yes" | "no");
    setFormEmotion(t.emotion || "");
    setFormPsychology(t.psychology || "");
    setFormNotes(t.notes || "");
    setPendingScreens((t.screenshots || []).slice());
    setFormCustomFilters((t.customFilters || []).slice());
    setCustomFilterKey("");
    setCustomFilterValue("");
    setNotice(null);

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Удалить сделку?")) return;

    updateTrades(allTrades.filter((t) => t.id !== id));

    if (expandedCustomFiltersTradeId === id) {
      setExpandedCustomFiltersTradeId(null);
    }

    if (editId === id) {
      resetForm();
    }

    showNotice("info", "Сделка удалена.");
  };

  const handleScreenshots = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files || [])];

    const results = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Ошибка чтения файла"));
            reader.readAsDataURL(file);
          })
      )
    );

    setPendingScreens((prev) => [...prev, ...results]);
    e.target.value = "";
  };

  const editingImportedTrade =
    editId !== null && allTrades.find((t) => t.id === editId)?.source === "imported";

  return (
    <section className="grid gap-4">
      <div className="card trades-journal-card">
        <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-bold">Журнал сделок</h2>
          <div className="chip">{filteredTrades.length} сделок</div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-[10px]">
          <input
            className="min-w-[220px] flex-1"
            type="text"
            placeholder="Поиск по символу, сетапу, сигналу, эмоции, бирже, своим фильтрам"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

          <select value={plannedFilter} onChange={(e) => setPlannedFilter(e.target.value)}>
            <option value="all">Все сделки</option>
            <option value="yes">По плану</option>
            <option value="no">Не по плану</option>
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">Все источники</option>
            <option value="manual">Ручные</option>
            <option value="imported">Импортированные</option>
          </select>

          <select value={exchangeFilter} onChange={(e) => setExchangeFilter(e.target.value)}>
            <option value="all">Все биржи</option>
            <option value="bybit">Bybit</option>
            <option value="binance">Binance</option>
            <option value="okx">OKX</option>
            {exchangeOptions
              .filter((exchange) => !["bybit", "binance", "okx"].includes(exchange.toLowerCase()))
              .map((exchange) => (
                <option key={exchange} value={exchange}>
                  {exchange}
                </option>
              ))}
            <option value="manual">Без биржи</option>
          </select>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "Все", value: "all" },
              { label: "Long", value: "Лонг" },
              { label: "Short", value: "Шорт" },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                className={`seg-btn ${directionFilter === f.value ? "active" : ""}`}
                onClick={() => setDirectionFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 text-sm text-[#8aa6c7]">
          Прокручивается весь блок журнала сделок: фильтры и таблица.
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Время</th>
                <th>Символ</th>
                <th>Источник</th>
                <th>Биржа</th>
                <th>Side</th>
                <th>Сигнал</th>
                <th>P/L</th>
                <th>Вход</th>
                <th>Выход</th>
                <th>Объём</th>
                <th>Сетап</th>
                <th>План</th>
                <th>Эмоции</th>
                <th>Импорт</th>
                <th>Рейтинг</th>
                <th>Фильтры</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length ? (
                filteredTrades.flatMap((t) => {
                  const hasCustomFilters = Boolean(t.customFilters && t.customFilters.length > 0);
                  const isExpanded = expandedCustomFiltersTradeId === t.id;

                  return [
                    <tr key={t.id} className="trade-row" onClick={() => onOpenTrade(t.id)}>
                      <td>
                        <strong>{t.date}</strong>
                      </td>
                      <td>{t.time || "—"}</td>
                      <td>
                        <strong>{t.symbol}</strong>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs ${
                            t.source === "imported"
                              ? "border-[rgba(56,189,248,.25)] bg-[rgba(56,189,248,.08)] text-[#7dd3fc]"
                              : "border-[rgba(148,163,184,.25)] bg-[rgba(148,163,184,.08)] text-[#cbd5e1]"
                          }`}
                        >
                          {t.source === "imported" ? "Импорт" : "Ручная"}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-[#9fb2cc]">
                          {t.exchange ? t.exchange.toUpperCase() : "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`side-badge ${
                            t.direction === "Лонг" ? "side-long" : "side-short"
                          }`}
                        >
                          <span className="side-badge-icon" aria-hidden="true">
                            {t.direction === "Лонг" ? "↑" : "↓"}
                          </span>
                          <span className="side-badge-text">
                            {t.direction === "Лонг" ? "LONG" : "SHORT"}
                          </span>
                        </span>
                      </td>
                      <td>{t.signal || "—"}</td>
                      <td className={colorClass(t.pnl)}>
                        <strong>
                          {t.pnl >= 0 ? "+" : ""}
                          {fmt(t.pnl)}
                        </strong>
                      </td>
                      <td>{fmt(t.entry)}</td>
                      <td>{fmt(t.exit)}</td>
                      <td>{fmt(t.size)}</td>
                      <td>{t.strategy || "—"}</td>
                      <td>
                        <span
                          className={`plan-badge ${t.planned === "yes" ? "plan-yes" : "plan-no"}`}
                        >
                          {t.planned === "yes" ? "По плану" : "Вне плана"}
                        </span>
                      </td>
                      <td>{t.emotion || "—"}</td>
                      <td>
                        <span className="text-sm text-[#9fb2cc]">
                          {t.importedAt ? formatImportedDateTime(t.importedAt) : "—"}
                        </span>
                      </td>
                      <td className="tracking-widest text-[#ffd66b]">{stars(t.rating || 3)}</td>

                      <td onClick={(e) => e.stopPropagation()}>
                        {hasCustomFilters ? (
                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() =>
                              setExpandedCustomFiltersTradeId((prev) => (prev === t.id ? null : t.id))
                            }
                          >
                            {isExpanded ? "Скрыть" : "Откр."}
                          </button>
                        ) : (
                          <span className="text-sm text-[#8aa6c7]">—</span>
                        )}
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="mini-btn" onClick={() => handleEdit(t.id)}>
                            Ред.
                          </button>
                          <button
                            type="button"
                            className="mini-btn mini-btn-del"
                            onClick={() => handleDelete(t.id)}
                          >
                            Удал.
                          </button>
                        </div>
                      </td>
                    </tr>,

                    ...(hasCustomFilters && isExpanded
                      ? [
                          <tr key={`${t.id}-custom-filters`}>
                            <td colSpan={18} className="bg-[rgba(8,15,28,.35)]">
                              <div className="px-3 py-3">
                                <div className="mb-2 text-sm font-bold text-[#8cefff]">
                                  Пользовательские фильтры
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {(t.customFilters || []).map((item, index) => (
                                    <span
                                      key={`${item.key}-${item.value}-${index}`}
                                      className="rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.75)] px-3 py-1 text-sm text-[#dff3ff]"
                                    >
                                      <strong>{item.key}:</strong> {item.value}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>,
                        ]
                      : []),
                  ];
                })
              ) : (
                <tr>
                  <td colSpan={18} className="text-[#8aa6c7]">
                    Сделок пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-bold">
            {editId ? "Редактировать сделку" : "Добавить сделку"}
          </h2>

          {notice && (
            <div
              className={`w-full rounded-[18px] border px-4 py-3 text-sm sm:w-auto sm:max-w-[720px] ${
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
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3 max-[1200px]:grid-cols-1">
            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">Дата</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">Время</label>
              <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Инструмент
              </label>
              <input
                type="text"
                placeholder="XAUUSDb"
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Направление
              </label>
              <select value={formDirection} onChange={(e) => setFormDirection(e.target.value)}>
                <option value="Лонг">Лонг</option>
                <option value="Шорт">Шорт</option>
              </select>
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">Биржа</label>
              <select
                value={formExchangeMode}
                onChange={(e) => {
                  setFormExchangeMode(e.target.value);
                  if (e.target.value !== "custom") {
                    setFormCustomExchange("");
                  }
                }}
                disabled={editingImportedTrade}
              >
                <option value="">Не указана</option>
                <option value="bybit">Bybit</option>
                <option value="binance">Binance</option>
                <option value="okx">OKX</option>
                <option value="custom">Другое</option>
              </select>
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Сетап / стратегия
              </label>
              <input
                type="text"
                placeholder="Пробой, откат"
                value={formStrategy}
                onChange={(e) => setFormStrategy(e.target.value)}
              />
            </div>

            {formExchangeMode === "custom" && !editingImportedTrade && (
              <div className="col-span-full">
                <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                  Своя биржа / брокер / рынок
                </label>
                <input
                  type="text"
                  placeholder="Forex, MOEX, CME, Тинькофф..."
                  value={formCustomExchange}
                  onChange={(e) => setFormCustomExchange(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">Сигнал</label>
              <input
                type="text"
                placeholder="Ретест уровня, пробой диапазона"
                value={formSignal}
                onChange={(e) => setFormSignal(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Цена входа
              </label>
              <input
                type="number"
                step="0.0001"
                value={formEntry}
                onChange={(e) => setFormEntry(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Цена выхода
              </label>
              <input
                type="number"
                step="0.0001"
                value={formExit}
                onChange={(e) => setFormExit(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">Объём</label>
              <input
                type="number"
                step="0.0001"
                value={formSize}
                onChange={(e) => setFormSize(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">P/L</label>
              <input
                type="number"
                step="0.01"
                value={formPnl}
                onChange={(e) => setFormPnl(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">Рейтинг</label>
              <select value={formRating} onChange={(e) => setFormRating(e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                По плану?
              </label>
              <select
                value={formPlanned}
                onChange={(e) => setFormPlanned(e.target.value as "yes" | "no")}
              >
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </div>

            <div className="col-span-full">
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">Эмоции</label>
              <input
                type="text"
                placeholder="Спокойствие, тревога, FOMO"
                value={formEmotion}
                onChange={(e) => setFormEmotion(e.target.value)}
              />
            </div>

            <div className="col-span-full rounded-[18px] border border-[rgba(56,189,248,.08)] bg-[rgba(8,15,28,.28)] p-4">
              <div className="mb-3">
                <label className="block text-sm font-bold text-[#8aa6c7]">
                  Пользовательские фильтры
                </label>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  Добавляй свои пары: название фильтра и его значение
                </div>
              </div>

              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 max-[900px]:grid-cols-1">
                <input
                  type="text"
                  placeholder="Название фильтра, например: Сессия"
                  value={customFilterKey}
                  onChange={(e) => setCustomFilterKey(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Значение, например: Лондон"
                  value={customFilterValue}
                  onChange={(e) => setCustomFilterValue(e.target.value)}
                />
                <button type="button" className="btn btn-secondary" onClick={addCustomFilter}>
                  Добавить
                </button>
              </div>

              {formCustomFilters.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {formCustomFilters.map((item, index) => (
                    <div
                      key={`${item.key}-${item.value}-${index}`}
                      className="flex items-center gap-2 rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(19,36,63,.75)] px-3 py-1 text-sm text-[#dff3ff]"
                    >
                      <span>
                        <strong>{item.key}:</strong> {item.value}
                      </span>
                      <button
                        type="button"
                        className="text-[#8cefff] transition hover:text-white"
                        onClick={() => removeCustomFilter(index)}
                        aria-label="Удалить пользовательский фильтр"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-[#8aa6c7]">
                  Пока нет пользовательских фильтров
                </div>
              )}
            </div>

            <div className="col-span-full">
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Психология
              </label>
              <textarea
                value={formPsychology}
                onChange={(e) => setFormPsychology(e.target.value)}
              />
            </div>

            <div className="col-span-full">
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Комментарий
              </label>
              <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
            </div>

            <div className="col-span-full">
              <label className="mb-[6px] block text-sm font-bold text-[#8aa6c7]">
                Скриншоты
              </label>
              <input type="file" accept="image/*" multiple onChange={handleScreenshots} />
            </div>

            {pendingScreens.length > 0 && (
              <div className="col-span-full flex flex-wrap gap-2">
                {pendingScreens.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      alt={`screenshot-${i}`}
                      className="h-[74px] w-[74px] cursor-pointer rounded-xl border border-[rgba(56,189,248,.14)] object-cover"
                      onClick={() => onOpenImage(src)}
                    />
                    <button
                      type="button"
                      className="mini-btn mini-btn-del absolute -right-2 -top-2 px-[7px] py-1"
                      onClick={() => setPendingScreens((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="col-span-full">
              <button className="btn" type="submit">
                {editId ? "Обновить сделку" : "Сохранить сделку"}
              </button>

              {editId && (
                <button type="button" className="btn btn-secondary ml-2" onClick={resetForm}>
                  Отмена
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

function formatImportedDateTime(value?: string) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("ru-RU");
}