"use client";

import React, { useRef, useState } from "react";
import type { Trade } from "@/lib/fintrade/store";
import { parseTigerTrades } from "@/lib/fintrade/tiger-import";

type Props = {
  onImportTrades: (trades: Trade[]) => number;
  className?: string;
};

export default function TigerImportButton({
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
      const trades = parseTigerTrades(text);

      if (!trades.length) {
        setMessage(
          "Tiger.com: не удалось найти сделки в файле. Проверьте, что это CSV/TXT экспорт из терминала Tiger.com."
        );
        return;
      }

      const addedCount = onImportTrades(trades);

      setMessage(
        addedCount > 0
          ? `Tiger.com: найдено ${trades.length}, добавлено новых сделок: ${addedCount}.`
          : `Tiger.com: найдено ${trades.length}, но новых сделок нет — дубли уже были импортированы.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ошибка импорта Tiger.com.";

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
        {isImporting ? "Импорт Tiger.com..." : "Импортировать CSV Tiger.com"}
      </button>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".csv,.txt,.tsv"
        onChange={handleFileChange}
      />

      {message && <div className="text-sm text-[#8aa6c7]">{message}</div>}
    </div>
  );
}
