"use client";

import React, { useRef, useState } from "react";
import type { Trade } from "@/lib/fintrade/store";
import { parseMetaTraderTrades } from "@/lib/fintrade/metatrader-import";

type Props = {
  onImportTrades: (trades: Trade[]) => number;
  className?: string;
};

export default function MetaTraderImportButton({
  onImportTrades,
  className = "btn",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsImporting(true);
    setMessage("");

    try {
      const text = await file.text();
      const trades = parseMetaTraderTrades(text);

      if (!trades.length) {
        setMessage(
          "Не удалось найти сделки в файле MetaTrader. Проверьте, что это отчёт торговой истории MT4/MT5."
        );
        return;
      }

      const addedCount = onImportTrades(trades);

      setMessage(
        addedCount > 0
          ? `MetaTrader: найдено ${trades.length}, добавлено новых сделок: ${addedCount}.`
          : `MetaTrader: найдено ${trades.length}, но новых сделок нет — дубли уже были импортированы.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ошибка импорта MetaTrader.";

      setMessage(errorMessage);
    } finally {
      setIsImporting(false);

      if (event.target) {
        event.target.value = "";
      }
    }
  };

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className={className}
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
      >
        {isImporting ? "Импорт MetaTrader..." : "Импортировать MetaTrader"}
      </button>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".html,.htm,.csv,.txt,.xls"
        onChange={handleFileChange}
      />

      {message && <div className="text-sm text-[#8aa6c7]">{message}</div>}
    </div>
  );
}