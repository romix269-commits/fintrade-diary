 "use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/lib/fintrade/store";
import {
  ExchangeConnection,
  ExchangeId,
  ExchangeStatus,
  EXCHANGES,
  createEmptyConnection,
  loadConnections,
  saveConnections,
  testConnection,
  fetchBalances,
  importTradesFromConnection,
} from "@/components/fintrade/exchanges";
import TigerImportButton from "@/components/fintrade/TigerImportButton";
import MetaTraderImportButton from "@/components/fintrade/MetaTraderImportButton";

type Props = {
  onImportTrades: (trades: Trade[]) => number;
  activeDiaryName?: string | null;
  activeDiaryConnectionId?: string | null;
  activeDiaryExchange?: string | null;
};

type NoticeType = "success" | "error" | "info";

type Notice = {
  type: NoticeType;
  text: string;
};

export default function ConnectionsView({
  onImportTrades,
  activeDiaryName,
  activeDiaryConnectionId,
  activeDiaryExchange,
}: Props) {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeId>("bybit");
  const [connectionName, setConnectionName] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isTestnet, setIsTestnet] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    setConnections(loadConnections());
  }, []);

  const exchangeOptions = useMemo(
    () =>
      EXCHANGES.filter(
        (exchange) => exchange.id === "bybit" || exchange.id === "binance"
      ),
    []
  );

  const selectedExchangeMeta = exchangeOptions.find((x) => x.id === selectedExchange);

  const updateConnections = (next: ExchangeConnection[]) => {
    setConnections(next);
    saveConnections(next);
  };

  const showNotice = (type: NoticeType, text: string) => {
    setNotice({ type, text });
  };

  const resetForm = () => {
    setConnectionName("");
    setProxyUrl("");
    setApiKey("");
    setApiSecret("");
    setIsTestnet(false);
    setEditingId(null);
    setSelectedExchange("bybit");
  };

  const handleOpenAdd = () => {
    resetForm();
    setNotice(null);
    setIsAddOpen(true);
  };

  const handleCancelAdd = () => {
    resetForm();
    setIsAddOpen(false);
  };

  const handleEditConnection = (connection: ExchangeConnection) => {
    setSelectedExchange(
      connection.exchange === "bybit" || connection.exchange === "binance"
        ? connection.exchange
        : "bybit"
    );
    setConnectionName(connection.name || "");
    setProxyUrl(connection.proxyUrl || "");
    setApiKey(connection.apiKey || "");
    setApiSecret(connection.apiSecret || "");
    setIsTestnet(Boolean(connection.isTestnet));
    setEditingId(connection.id);
    setNotice(null);
    setIsAddOpen(true);
  };

  const handleSubmitConnection = () => {
    const exchangeMeta = EXCHANGES.find((x) => x.id === selectedExchange);
    if (!exchangeMeta) return;

    const trimmedName = connectionName.trim();
    const trimmedKey = apiKey.trim();
    const trimmedSecret = apiSecret.trim();
    const trimmedProxyUrl = proxyUrl.trim();

    if (!trimmedKey || !trimmedSecret) {
      showNotice("error", "Введите API Key и API Secret.");
      return;
    }

    if (editingId) {
      const next = connections.map((connection) =>
        connection.id === editingId
          ? {
              ...connection,
              exchange: selectedExchange,
              name: trimmedName || exchangeMeta.name,
              apiKey: trimmedKey,
              apiSecret: trimmedSecret,
              proxyUrl: trimmedProxyUrl || undefined,
              isTestnet,
              updatedAt: new Date().toISOString(),
              errorMessage: undefined,
            }
          : connection
      );

      updateConnections(next);
      showNotice("success", "Подключение обновлено.");
    } else {
      const nextConnection = createEmptyConnection(selectedExchange);
      nextConnection.name = trimmedName || exchangeMeta.name;
      nextConnection.apiKey = trimmedKey;
      nextConnection.apiSecret = trimmedSecret;
      nextConnection.proxyUrl = trimmedProxyUrl || undefined;
      nextConnection.isTestnet = isTestnet;

      const next = [nextConnection, ...connections];
      updateConnections(next);
      showNotice("success", `Подключение ${nextConnection.name} добавлено.`);
    }

    resetForm();
    setIsAddOpen(false);
  };

  const handleDeleteConnection = (id: string) => {
    if (!confirm("Удалить подключение?")) return;

    const target = connections.find((c) => c.id === id);
    updateConnections(connections.filter((c) => c.id !== id));
    showNotice("info", `Подключение ${target?.name ?? ""} удалено.`.trim());
  };

  const handleTigerImportTrades = (importedTrades: Trade[]) => {
    const addedCount = onImportTrades(importedTrades);

    const diaryHint =
      addedCount > 0 && activeDiaryName ? ` в дневник "${activeDiaryName}"` : "";

    showNotice(
      addedCount > 0 ? "success" : "info",
      addedCount > 0
        ? `Импорт Tiger.com выполнен. Добавлено сделок: ${addedCount}${diaryHint}.`
        : "Tiger.com: новых сделок для импорта нет."
    );

    return addedCount;
  };

  const handleMetaTraderImportTrades = (importedTrades: Trade[]) => {
    const addedCount = onImportTrades(importedTrades);

    const diaryHint =
      addedCount > 0 && activeDiaryName ? ` в дневник "${activeDiaryName}"` : "";

    showNotice(
      addedCount > 0 ? "success" : "info",
      addedCount > 0
        ? `Импорт MetaTrader выполнен. Добавлено сделок: ${addedCount}${diaryHint}.`
        : "MetaTrader: новых сделок для импорта нет."
    );

    return addedCount;
  };

  const handleTestConnection = async (id: string) => {
    setLoadingId(id);
    setNotice(null);

    const syncingNext = connections.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "syncing" as ExchangeStatus,
            errorMessage: undefined,
          }
        : c
    );
    updateConnections(syncingNext);

    try {
      const result = await testConnection(id);

      const next = syncingNext.map((c) =>
        c.id === id
          ? {
              ...c,
              status: (result.ok ? "connected" : "error") as ExchangeStatus,
              lastCheckedAt: new Date().toISOString(),
              errorMessage: result.ok
                ? undefined
                : result.message || "Не удалось проверить подключение.",
            }
          : c
      );

      updateConnections(next);

      showNotice(
        result.ok ? "success" : "error",
        result.ok
          ? "Подключение успешно проверено."
          : result.message || "Не удалось проверить подключение."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось проверить подключение.";

      const next = syncingNext.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "error" as ExchangeStatus,
              errorMessage: message,
              lastCheckedAt: new Date().toISOString(),
            }
          : c
      );

      updateConnections(next);
      showNotice("error", message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleLoadBalances = async (id: string) => {
    setLoadingId(id);
    setNotice(null);

    const syncingNext = connections.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "syncing" as ExchangeStatus,
            errorMessage: undefined,
          }
        : c
    );
    updateConnections(syncingNext);

    try {
      const balances = await fetchBalances(id);

      const next = syncingNext.map((c) =>
        c.id === id
          ? {
              ...c,
              balances,
              status: "connected" as ExchangeStatus,
              lastSyncedAt: new Date().toISOString(),
              errorMessage: undefined,
            }
          : c
      );

      updateConnections(next);

      showNotice(
        "success",
        balances.length > 0
          ? `Балансы успешно загружены: ${balances.length}`
          : "Балансы загружены, активы не найдены."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить балансы.";

      const next = syncingNext.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "error" as ExchangeStatus,
              errorMessage: message,
            }
          : c
      );

      updateConnections(next);
      showNotice("error", message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleImportTrades = async (id: string) => {
    setLoadingId(id);
    setNotice(null);

    const syncingNext = connections.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "syncing" as ExchangeStatus,
            errorMessage: undefined,
          }
        : c
    );
    updateConnections(syncingNext);

    try {
      const importedTrades = await importTradesFromConnection(id);
      const addedCount = onImportTrades(importedTrades);

      const next = syncingNext.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "connected" as ExchangeStatus,
              lastImportedAt: new Date().toISOString(),
              errorMessage: undefined,
            }
          : c
      );

      updateConnections(next);

      const importedConnection = connections.find((c) => c.id === id) ?? null;
      const importedExchange = importedConnection?.exchange ?? null;
      const diaryExchangeMatches =
        !activeDiaryExchange || !importedExchange || activeDiaryExchange === importedExchange;
      const diaryConnectionMatches =
        !activeDiaryConnectionId || activeDiaryConnectionId === id;

      const diaryHint =
        addedCount > 0 && activeDiaryName
          ? ` · в дневник "${activeDiaryName}"`
          : "";

      const warningHint =
        addedCount > 0 && (!diaryExchangeMatches || !diaryConnectionMatches)
          ? " Проверьте, что активный дневник привязан к нужному подключению."
          : "";

      showNotice(
        addedCount > 0 ? "success" : "info",
        addedCount > 0
          ? `Добавлено сделок: ${addedCount}${diaryHint}.${warningHint}`.trim()
          : "Нет новых сделок для импорта."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось импортировать сделки.";

      const next = syncingNext.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "error" as ExchangeStatus,
              errorMessage: message,
            }
          : c
      );

      updateConnections(next);
      showNotice("error", message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="grid gap-4">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[32px] leading-none font-bold text-white">
              Подключения к биржам
            </h2>
            <div className="mt-3 text-base text-[#8aa6c7]">
              Binance · Bybit — подключите API для импорта сделок и отслеживания
              балансов
            </div>
          </div>

          <button className="btn" onClick={handleOpenAdd}>
            + Добавить подключение
          </button>
        </div>

        {activeDiaryName && (
          <div className="rounded-[20px] border border-[rgba(56,189,248,.25)] bg-[rgba(56,189,248,.08)] px-5 py-4 text-[15px] text-[#7dd3fc]">
            Импорт сделок будет выполнен в активный дневник:{" "}
            <strong className="text-white">{activeDiaryName}</strong>
          </div>
        )}

        {notice && (
          <div
            className={`rounded-[20px] border px-5 py-4 text-[15px] ${
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

        <div className="rounded-[24px] border border-[rgba(56,189,248,.12)] bg-[rgba(7,17,31,.72)] px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="pt-0.5 text-[24px] leading-none">🔐</div>

            <div className="min-w-0">
              <div className="text-[17px] font-bold text-white">
                Безопасное подключение биржи
              </div>

              <div className="mt-2 text-[15px] leading-7 text-[#9fb2cc]">
                Подключите биржу, чтобы импортировать сделки и загружать балансы прямо в
                ФинТрейд.
              </div>

              <div className="mt-2 text-[15px] leading-7 text-[#9fb2cc]">
                Используйте только API-ключи с правами{" "}
                <span className="font-semibold text-white">только на чтение (read-only)</span>.
              </div>

              <div className="mt-2 text-[15px] leading-7 text-[#9fb2cc]">
                Все ключи и данные сохраняются{" "}
                <span className="font-semibold text-white">локально в вашем браузере</span>.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-[18px] font-bold text-white">
                Импорт из терминала Tiger.com
              </h3>
              <p className="mt-2 text-[15px] leading-7 text-[#9fb2cc]">
                Загрузите CSV или TXT файл, экспортированный из Tiger.com.
                Сделки будут добавлены в активный торговый дневник.
              </p>

              {activeDiaryName && (
                <div className="mt-2 text-sm text-[#7dd3fc]">
                  Активный дневник:{" "}
                  <strong className="text-white">{activeDiaryName}</strong>
                </div>
              )}
            </div>
          </div>

          <TigerImportButton
            onImportTrades={handleTigerImportTrades}
            className="btn"
          />
        </div>

        <div className="card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-[18px] font-bold text-white">
                Импорт из MetaTrader
              </h3>
              <p className="mt-2 text-[15px] leading-7 text-[#9fb2cc]">
                Загрузите HTML-отчёт из MetaTrader 4/5. Сделки будут добавлены
                в активный торговый дневник, а дубли будут пропущены автоматически.
              </p>

              {activeDiaryName && (
                <div className="mt-2 text-sm text-[#7dd3fc]">
                  Активный дневник:{" "}
                  <strong className="text-white">{activeDiaryName}</strong>
                </div>
              )}
            </div>
          </div>

          <MetaTraderImportButton
            onImportTrades={handleMetaTraderImportTrades}
            className="btn"
          />
        </div>
      </section>

      {isAddOpen ? (
        <section className="card p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="m-0 text-[18px] font-bold text-white">
              {editingId ? "Редактирование подключения" : "Новое подключение"}
            </h3>

            <button className="btn btn-secondary" onClick={handleCancelAdd}>
              Отмена
            </button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {exchangeOptions.map((exchange) => {
              const active = selectedExchange === exchange.id;

              return (
                <button
                  key={exchange.id}
                  type="button"
                  onClick={() => setSelectedExchange(exchange.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? "border-[rgba(245,204,21,.95)] bg-[rgba(245,204,21,.08)] shadow-[0_0_24px_rgba(245,204,21,.06)]"
                      : "border-[rgba(56,189,248,.14)] bg-[rgba(7,17,31,.45)] hover:border-[rgba(56,189,248,.3)]"
                  }`}
                >
                  <div className="text-[16px] font-semibold text-white">
                    {exchange.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Название">
              <input
                className="h-[46px] w-full rounded-[14px] border border-[rgba(56,189,248,.14)] bg-[#0a1424] px-4 text-white outline-none placeholder:text-[#6f8198]"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder={
                  selectedExchangeMeta ? `Мой ${selectedExchangeMeta.name} аккаунт` : "Название"
                }
              />
            </Field>

            <Field label="Proxy URL (опционально)">
              <input
                className="h-[46px] w-full rounded-[14px] border border-[rgba(56,189,248,.14)] bg-[#0a1424] px-4 text-white outline-none placeholder:text-[#6f8198]"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="https://your-proxy.com/"
              />
            </Field>

            <Field label="API Key">
              <input
                className="h-[46px] w-full rounded-[14px] border border-[rgba(56,189,248,.14)] bg-[#0a1424] px-4 text-white outline-none placeholder:text-[#6f8198]"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Вставьте API Key"
              />
            </Field>

            <Field label="API Secret">
              <input
                className="h-[46px] w-full rounded-[14px] border border-[rgba(56,189,248,.14)] bg-[#0a1424] px-4 text-white outline-none placeholder:text-[#6f8198]"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Вставьте API Secret"
                type="password"
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-col items-start gap-3">
            <label
              htmlFor="testnet-mode"
              className="flex cursor-pointer select-none items-start gap-4 pl-9 text-[#9fb2cc]"
            >
              <input
                id="testnet-mode"
                type="checkbox"
                checked={isTestnet}
                onChange={(e) => setIsTestnet(e.target.checked)}
                className="mt-[5px] h-4 w-4 shrink-0 rounded border border-[rgba(148,163,184,.45)] bg-[#0a1424] accent-sky-500"
              />
              <span className="max-w-[90px] text-[14px] font-semibold leading-[1.35]">
                Testnet /<br />
                Демо-<br />
                режим
              </span>
            </label>

            <button className="btn" onClick={handleSubmitConnection}>
              {editingId ? "Сохранить изменения" : "Добавить подключение"}
            </button>
          </div>
        </section>
      ) : connections.length === 0 ? (
        <section className="card min-h-[250px] flex items-center justify-center text-center">
          <div className="max-w-[640px]">
            <div className="mb-4 text-[64px] leading-none">🔗</div>
            <div className="text-[22px] font-bold text-white">Нет подключений</div>
            <div className="mt-3 text-[17px] text-[#8aa6c7]">
              Подключите API ключи Binance и Bybit для автоматического импорта
              сделок
            </div>
            <div className="mt-6">
              <button className="btn" onClick={handleOpenAdd}>
                Добавить первое подключение
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {connections.length > 0 && (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-bold">Список подключений</h2>
            <div className="text-sm text-[#8aa6c7]">Всего: {connections.length}</div>
          </div>

          <div className="grid gap-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="rounded-2xl border border-[rgba(56,189,248,.12)] bg-[rgba(7,17,31,.72)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[17px]">{connection.name}</strong>

                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${
                          connection.status === "connected"
                            ? "border-[rgba(34,197,94,.25)] bg-[rgba(34,197,94,.08)] text-[#7CFFB2]"
                            : connection.status === "error"
                            ? "border-[rgba(239,68,68,.25)] bg-[rgba(239,68,68,.08)] text-[#ff8f8f]"
                            : connection.status === "syncing"
                            ? "border-[rgba(56,189,248,.25)] bg-[rgba(56,189,248,.08)] text-[#7dd3fc]"
                            : "border-[rgba(148,163,184,.25)] bg-[rgba(148,163,184,.08)] text-[#b9c8da]"
                        }`}
                      >
                        {connection.status === "connected"
                          ? "Подключено"
                          : connection.status === "error"
                          ? "Ошибка"
                          : connection.status === "syncing"
                          ? "Синхронизация..."
                          : "Не проверено"}
                      </span>

                      {connection.isTestnet && (
                        <span className="inline-flex items-center rounded-full border border-[rgba(245,158,11,.25)] bg-[rgba(245,158,11,.08)] px-2.5 py-1 text-xs text-[#ffbf47]">
                          Testnet / Demo
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-[#8aa6c7]">
                      {connection.exchange.toUpperCase()} · API Key: {maskKey(connection.apiKey)}
                    </div>

                    {connection.proxyUrl && (
                      <div className="mt-1 text-sm text-[#8aa6c7]">
                        Proxy: {connection.proxyUrl}
                      </div>
                    )}

                    {connection.errorMessage && (
                      <div className="mt-2 text-sm text-[#ff8f8f]">
                        {connection.errorMessage}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleEditConnection(connection)}
                    >
                      Редактировать
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteConnection(connection.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleTestConnection(connection.id)}
                    disabled={loadingId === connection.id}
                  >
                    {loadingId === connection.id ? "Проверка..." : "Проверить"}
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => handleLoadBalances(connection.id)}
                    disabled={loadingId === connection.id}
                  >
                    {loadingId === connection.id ? "Загрузка..." : "Загрузить балансы"}
                  </button>

                  <button
                    className="btn"
                    onClick={() => handleImportTrades(connection.id)}
                    disabled={loadingId === connection.id}
                  >
                    {loadingId === connection.id ? "Импорт..." : "Импортировать сделки"}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="item">
                    <div className="text-sm text-[#8aa6c7]">Последняя проверка</div>
                    <div className="mt-2 font-semibold">
                      {formatDateTime(connection.lastCheckedAt)}
                    </div>
                  </div>

                  <div className="item">
                    <div className="text-sm text-[#8aa6c7]">Последняя синхронизация</div>
                    <div className="mt-2 font-semibold">
                      {formatDateTime(connection.lastSyncedAt)}
                    </div>
                  </div>

                  <div className="item">
                    <div className="text-sm text-[#8aa6c7]">Последний импорт</div>
                    <div className="mt-2 font-semibold">
                      {formatDateTime(connection.lastImportedAt)}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm text-[#8aa6c7]">Балансы</div>

                  {!connection.balances || connection.balances.length === 0 ? (
                    <div className="item">Нет загруженных балансов.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {connection.balances.map((balance) => (
                        <div key={balance.asset} className="item">
                          <div className="text-sm text-[#8aa6c7]">{balance.asset}</div>
                          <div className="mt-2 text-lg font-bold">{balance.free}</div>
                          <div className="mt-1 text-xs text-[#8aa6c7]">
                            Locked: {balance.locked}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3 className="mb-5 m-0 text-[18px] font-bold text-white">Как получить API ключи</h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GuideCard
            title="Binance"
            accent="yellow"
            steps={[
              "Перейдите на binance.com → API Management",
              "Нажмите «Create API» → System Generated",
              "Скопируйте API Key и Secret Key",
              "Включите только Enable Reading",
              "Рекомендуется настроить IP whitelist",
            ]}
          />

          <GuideCard
            title="Bybit"
            accent="orange"
            steps={[
              "Перейдите на bybit.com → API",
              "Нажмите «Create New Key»",
              "Выберите System-generated API Keys",
              "Разрешите только Read-Only",
              "Скопируйте API Key и Secret",
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-[#8aa6c7]">{label}</div>
      {children}
    </div>
  );
}

function GuideCard({
  title,
  steps,
  accent,
}: {
  title: string;
  steps: string[];
  accent: "yellow" | "orange" | "white";
}) {
  const titleClass =
    accent === "yellow"
      ? "text-[#facc15]"
      : accent === "orange"
      ? "text-[#ffb347]"
      : "text-white";

  return (
    <div className="rounded-[24px] border border-[rgba(245,158,11,.18)] bg-[rgba(7,17,31,.62)] p-4">
      <div className={`mb-4 text-[18px] font-bold ${titleClass}`}>{title}</div>

      <ul className="space-y-1.5 leading-7 text-[#d3deea]">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </div>
  );
}

function maskKey(value: string) {
  if (!value) return "—";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU");
  } catch {
    return value;
  }
}                                      