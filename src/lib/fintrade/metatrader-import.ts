import type { Trade } from "@/lib/fintrade/store";

type ParsedDateTime = {
  date: string;
  time: string;
};

type HtmlRow = {
  section: string;
  cells: string[];
};

type MetaTraderDealRaw = {
  timeRaw: string;
  dealId: string;
  symbol: string;
  sideRaw: string;
  directionRaw: string;
  volumeRaw: string;
  priceRaw: string;
  orderId: string;
  commissionRaw: string;
  feeRaw: string;
  swapRaw: string;
  profitRaw: string;
  balanceRaw: string;
  commentRaw: string;
};

type MetaTraderPositionRaw = {
  ticket: string;
  openTimeRaw: string;
  closeTimeRaw: string;
  symbol: string;
  side: string;
  sizeRaw: string;
  entryRaw: string;
  exitRaw: string;
  commissionRaw: string;
  swapRaw: string;
  profitRaw: string;
};

type OpenLot = {
  dealId: string;
  orderId: string;
  opened: ParsedDateTime;
  symbol: string;
  direction: Trade["direction"];
  volumeTotal: number;
  volumeLeft: number;
  entry: number;
  commission: number;
  fee: number;
  swap: number;
};

export type MetaTraderImportResult = {
  trades: Trade[];
  rowsFound: number;
  dealsFound: number;
  closeDealsFound: number;
  positionsFound: number;
  importedMode: "deals" | "positions" | "none";
};

const DEFAULT_EMOTION = "Нейтрально";
const DEFAULT_PSYCHOLOGY = "Импортировано из MetaTrader";

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#160;/gi, " ");
}

function stripHtml(value: string): string {
  return cleanText(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/td>/gi, " ")
        .replace(/<\/th>/gi, " ")
        .replace(/<[^>]*>/g, " ")
    )
  );
}

function parseNumber(value: unknown): number {
  let raw = cleanText(value);

  if (!raw || raw === "—" || raw === "-") return 0;

  const isNegativeByBrackets = raw.startsWith("(") && raw.endsWith(")");

  raw = raw
    .replace(/\u2212/g, "-")
    .replace(/\s/g, "")
    .replace(/\u00A0/g, "")
    .replace(/[₽$€£¥₸₴]/g, "")
    .replace(/[A-ZА-Я]+/gi, "")
    .replace(/[()]/g, "");

  if (!raw) return 0;

  if (raw.includes(",") && raw.includes(".")) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");

    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) return 0;

  return isNegativeByBrackets ? -Math.abs(parsed) : parsed;
}

function parseDateTime(value: unknown): ParsedDateTime | null {
  const raw = cleanText(value);

  if (!raw) return null;

  const mtMatch = raw.match(
    /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (mtMatch) {
    const year = mtMatch[1];
    const month = mtMatch[2].padStart(2, "0");
    const day = mtMatch[3].padStart(2, "0");
    const hour = (mtMatch[4] || "00").padStart(2, "0");
    const minute = (mtMatch[5] || "00").padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }

  const ruMatch = raw.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (ruMatch) {
    const day = ruMatch[1].padStart(2, "0");
    const month = ruMatch[2].padStart(2, "0");
    const year = ruMatch[3].length === 2 ? `20${ruMatch[3]}` : ruMatch[3];
    const hour = (ruMatch[4] || "00").padStart(2, "0");
    const minute = (ruMatch[5] || "00").padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const hour = String(parsed.getHours()).padStart(2, "0");
    const minute = String(parsed.getMinutes()).padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }

  return null;
}

function dateTimeToMs(value: ParsedDateTime): number {
  return new Date(`${value.date}T${value.time || "00:00"}`).getTime();
}

function normalizeSymbol(value: unknown): string {
  return cleanText(value)
    .replace(/\s+/g, "")
    .replace(/\//g, "")
    .toUpperCase();
}

function getOpenDirectionFromSide(value: unknown): Trade["direction"] | null {
  const raw = cleanText(value).toLowerCase();

  if (raw === "buy" || raw === "покупка" || raw === "long" || raw === "лонг") {
    return "LONG" as Trade["direction"];
  }

  if (raw === "sell" || raw === "продажа" || raw === "short" || raw === "шорт") {
    return "SHORT" as Trade["direction"];
  }

  return null;
}

function getClosedPositionDirectionFromSide(value: unknown): Trade["direction"] | null {
  const raw = cleanText(value).toLowerCase();

  if (raw === "sell" || raw === "продажа") {
    return "LONG" as Trade["direction"];
  }

  if (raw === "buy" || raw === "покупка") {
    return "SHORT" as Trade["direction"];
  }

  return null;
}

function isTradeSide(value: unknown): boolean {
  return getOpenDirectionFromSide(value) !== null;
}

function isOpenDealDirection(value: unknown): boolean {
  const raw = cleanText(value).toLowerCase();

  return (
    raw === "in" ||
    raw === "in/out" ||
    raw === "open" ||
    raw === "вход" ||
    raw === "открытие"
  );
}

function isCloseDealDirection(value: unknown): boolean {
  const raw = cleanText(value).toLowerCase();

  return (
    raw === "out" ||
    raw === "out by" ||
    raw === "close" ||
    raw === "closed" ||
    raw === "выход" ||
    raw === "закрытие" ||
    raw.includes("out")
  );
}

function isBalanceOrServiceDeal(value: unknown): boolean {
  const raw = cleanText(value).toLowerCase();

  return (
    raw.includes("balance") ||
    raw.includes("deposit") ||
    raw.includes("withdraw") ||
    raw.includes("credit") ||
    raw.includes("correction") ||
    raw.includes("commission") ||
    raw.includes("баланс") ||
    raw.includes("пополнение") ||
    raw.includes("вывод") ||
    raw.includes("кредит") ||
    raw.includes("комиссия")
  );
}

function stableHash(value: string): string {
  let hash = 5381;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }

  return Math.abs(hash >>> 0).toString(36);
}

function makeExternalId(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join("|");
}

function getDelimiter(line: string): string {
  const candidates = [";", "\t", ",", "|"];
  let best = ";";
  let bestCount = 0;

  for (const delimiter of candidates) {
    const count = line.split(delimiter).length;

    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(cleanText(current).replace(/^"|"$/g, ""));
      current = "";
      continue;
    }

    current += char;
  }

  result.push(cleanText(current).replace(/^"|"$/g, ""));

  return result;
}

function parsePlainTextRows(text: string): HtmlRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const delimiter = getDelimiter(lines[0]);
  let currentSection = "plain";

  return lines.map((line) => {
    const cells = parseDelimitedLine(line, delimiter);
    const sectionTitle = isSectionTitle(cells);

    if (sectionTitle) {
      currentSection = sectionTitle;
    }

    return {
      section: currentSection,
      cells,
    };
  });
}

function isSectionTitle(cells: string[]): string | null {
  const text = cells.join(" ").toLowerCase();

  if (text.includes("позиции") || text.includes("positions")) return "positions";
  if (text.includes("ордера") || text.includes("orders")) return "orders";
  if (text.includes("сделки") || text.includes("deals")) return "deals";

  return null;
}

function parseHtmlRowsWithDomParser(text: string): HtmlRow[] {
  if (typeof DOMParser === "undefined") return [];

  try {
    const doc = new DOMParser().parseFromString(text, "text/html");
    let currentSection = "";

    return Array.from(doc.querySelectorAll("tr"))
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td, th"))
          .filter((cell) => !cell.classList.contains("hidden"))
          .map((cell) => cleanText(cell.textContent || ""))
          .filter(Boolean);

        const sectionTitle = isSectionTitle(cells);

        if (sectionTitle) {
          currentSection = sectionTitle;
        }

        return {
          section: currentSection,
          cells,
        };
      })
      .filter((row) => row.cells.length > 0);
  } catch {
    return [];
  }
}

function parseHtmlRowsWithRegex(text: string): HtmlRow[] {
  const trRows = text.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let currentSection = "";

  return trRows
    .map((rowHtml) => {
      const cellsHtml = rowHtml.match(/<(td|th)\b[\s\S]*?<\/(td|th)>/gi) || [];

      const cells = cellsHtml
        .filter((cellHtml) => !/\bclass\s*=\s*["'][^"']*\bhidden\b[^"']*["']/i.test(cellHtml))
        .map((cellHtml) => stripHtml(cellHtml))
        .filter(Boolean);

      const sectionTitle = isSectionTitle(cells);

      if (sectionTitle) {
        currentSection = sectionTitle;
      }

      return {
        section: currentSection,
        cells,
      };
    })
    .filter((row) => row.cells.length > 0);
}

function parseHtmlRows(text: string): HtmlRow[] {
  const domRows = parseHtmlRowsWithDomParser(text);

  if (domRows.length) return domRows;

  return parseHtmlRowsWithRegex(text);
}

function isHtmlReport(text: string): boolean {
  return /<html|<table|<tr|<td|<th/i.test(text);
}

function rowToDealRaw(row: HtmlRow): MetaTraderDealRaw | null {
  const compact = row.cells.map(cleanText).filter(Boolean);

  if (compact.length < 12) return null;

  const time = parseDateTime(compact[0]);

  if (!time) return null;

  // MT5 Deals / Сделки:
  // Время | Сделка | Символ | Тип | Направление | Объем | Цена | Ордер | Комиссия | Fee | Своп | Прибыль | Баланс | Комментарий
  if (
    (row.section === "deals" || row.section === "plain") &&
    isTradeSide(compact[3]) &&
    (isOpenDealDirection(compact[4]) || isCloseDealDirection(compact[4]))
  ) {
    return {
      timeRaw: compact[0] || "",
      dealId: compact[1] || "",
      symbol: compact[2] || "",
      sideRaw: compact[3] || "",
      directionRaw: compact[4] || "",
      volumeRaw: compact[5] || "",
      priceRaw: compact[6] || "",
      orderId: compact[7] || "",
      commissionRaw: compact[8] || "",
      feeRaw: compact[9] || "",
      swapRaw: compact[10] || "",
      profitRaw: compact[11] || "",
      balanceRaw: compact[12] || "",
      commentRaw: compact.slice(13).join(" "),
    };
  }

  return null;
}

function rowToPositionRaw(row: HtmlRow): MetaTraderPositionRaw | null {
  const compact = row.cells.map(cleanText).filter(Boolean);

  if (compact.length < 10) return null;

  if (row.section && row.section !== "positions" && row.section !== "plain") {
    return null;
  }

  const firstDate = parseDateTime(compact[0]);

  if (!firstDate) return null;

  // MT5 Positions / Позиции:
  // Время | Позиция | Символ | Тип | Объем | Цена | S/L | T/P | Время | Цена | Комиссия | Своп | Прибыль
  if (row.section === "positions" && isTradeSide(compact[3])) {
    const closeTime = parseDateTime(compact[8]);

    if (!closeTime) return null;

    return {
      openTimeRaw: compact[0],
      ticket: compact[1] || "",
      symbol: compact[2] || "",
      side: compact[3] || "",
      sizeRaw: compact[4] || "",
      entryRaw: compact[5] || "",
      closeTimeRaw: compact[8] || "",
      exitRaw: compact[9] || "",
      commissionRaw: compact[10] || "",
      swapRaw: compact[11] || "",
      profitRaw: compact[12] || compact[compact.length - 1] || "",
    };
  }

  // MT4 classic report:
  // Ticket | Open Time | Type | Size | Item | Price | S/L | T/P | Close Time | Price | Commission | Taxes | Swap | Profit
  if (row.section === "plain" && parseDateTime(compact[1]) && isTradeSide(compact[2])) {
    return {
      ticket: compact[0] || "",
      openTimeRaw: compact[1] || "",
      side: compact[2] || "",
      sizeRaw: compact[3] || "",
      symbol: compact[4] || "",
      entryRaw: compact[5] || "",
      closeTimeRaw: compact[8] || "",
      exitRaw: compact[9] || "",
      commissionRaw: compact[10] || "",
      swapRaw: compact[12] || "",
      profitRaw: compact[13] || compact[compact.length - 1] || "",
    };
  }

  // CSV/TXT MT5 Positions without HTML.
  if (row.section === "plain" && isTradeSide(compact[3]) && parseDateTime(compact[8])) {
    return {
      openTimeRaw: compact[0],
      ticket: compact[1] || "",
      symbol: compact[2] || "",
      side: compact[3] || "",
      sizeRaw: compact[4] || "",
      entryRaw: compact[5] || "",
      closeTimeRaw: compact[8] || "",
      exitRaw: compact[9] || "",
      commissionRaw: compact[10] || "",
      swapRaw: compact[11] || "",
      profitRaw: compact[12] || compact[compact.length - 1] || "",
    };
  }

  return null;
}

function makeDealTrade(params: {
  raw: MetaTraderDealRaw;
  opened: ParsedDateTime | null;
  closed: ParsedDateTime;
  symbol: string;
  direction: Trade["direction"];
  entry: number;
  exit: number;
  size: number;
  pnl: number;
  grossProfit: number;
  commission: number;
  fee: number;
  swap: number;
  matchedInfo: string;
  index: number;
}): Trade {
  const externalId = makeExternalId([
    "METATRADER_DEAL_CLOSE",
    params.raw.dealId,
    params.raw.orderId,
    params.symbol,
    params.direction,
    params.closed.date,
    params.closed.time,
    params.size,
    params.exit,
    params.grossProfit,
    params.commission,
    params.fee,
    params.swap,
  ]);

  const notesParts = [
    "MetaTrader import",
    params.raw.dealId ? `deal=${params.raw.dealId}` : "",
    params.raw.orderId ? `order=${params.raw.orderId}` : "",
    params.opened ? `open=${params.opened.date} ${params.opened.time}` : "",
    `close=${params.closed.date} ${params.closed.time}`,
    `grossProfit=${params.grossProfit}`,
    `commission=${params.commission}`,
    `fee=${params.fee}`,
    `swap=${params.swap}`,
    params.matchedInfo,
    params.raw.commentRaw ? `comment=${params.raw.commentRaw}` : "",
  ].filter(Boolean);

  return {
    id: `metatrader_${stableHash(externalId)}_${params.index}`,
    date: params.closed.date,
    time: params.closed.time,
    symbol: params.symbol,
    direction: params.direction,
    entry: params.entry,
    exit: params.exit,
    size: params.size || 1,
    pnl: params.pnl,
    rating: 3,
    emotion: DEFAULT_EMOTION,
    psychology: DEFAULT_PSYCHOLOGY,
    planned: "no",
    strategy: "MetaTrader import",
    notes: notesParts.join(" | "),
    screenshots: [],
    source: "imported",
    exchange: "METATRADER",
    importedAt: new Date().toISOString(),
    externalId,
  };
}

function parseDealsToTrades(deals: MetaTraderDealRaw[]): Trade[] {
  const openLots = new Map<string, OpenLot[]>();
  const trades: Trade[] = [];

  const normalizedDeals = deals
    .map((raw, index) => {
      const time = parseDateTime(raw.timeRaw);

      return {
        raw,
        index,
        time,
      };
    })
    .filter((item): item is { raw: MetaTraderDealRaw; index: number; time: ParsedDateTime } =>
      Boolean(item.time)
    )
    .sort((a, b) => dateTimeToMs(a.time) - dateTimeToMs(b.time));

  for (const item of normalizedDeals) {
    const raw = item.raw;
    const dealTime = item.time;
    const symbol = normalizeSymbol(raw.symbol);
    const sideDirection = getOpenDirectionFromSide(raw.sideRaw);
    const volume = Math.abs(parseNumber(raw.volumeRaw));
    const price = parseNumber(raw.priceRaw);
    const commission = parseNumber(raw.commissionRaw);
    const fee = parseNumber(raw.feeRaw);
    const swap = parseNumber(raw.swapRaw);
    const grossProfit = parseNumber(raw.profitRaw);

    if (!symbol || !sideDirection || volume <= 0) continue;

    if (isBalanceOrServiceDeal(raw.sideRaw) || isBalanceOrServiceDeal(raw.directionRaw)) {
      continue;
    }

    if (isOpenDealDirection(raw.directionRaw)) {
      const key = `${symbol}|${sideDirection}`;
      const nextLot: OpenLot = {
        dealId: raw.dealId,
        orderId: raw.orderId,
        opened: dealTime,
        symbol,
        direction: sideDirection,
        volumeTotal: volume,
        volumeLeft: volume,
        entry: price,
        commission,
        fee,
        swap,
      };

      const list = openLots.get(key) || [];
      list.push(nextLot);
      openLots.set(key, list);
      continue;
    }

    if (!isCloseDealDirection(raw.directionRaw)) {
      continue;
    }

    const closedPositionDirection = getClosedPositionDirectionFromSide(raw.sideRaw);

    if (!closedPositionDirection) continue;

    const key = `${symbol}|${closedPositionDirection}`;
    const lots = openLots.get(key) || [];

    let remaining = volume;
    let matchedVolume = 0;
    let weightedEntrySum = 0;
    let openCommissionPart = 0;
    let openFeePart = 0;
    let openSwapPart = 0;
    let opened: ParsedDateTime | null = null;

    while (remaining > 0 && lots.length) {
      const lot = lots[0];
      const consume = Math.min(lot.volumeLeft, remaining);
      const ratio = lot.volumeTotal > 0 ? consume / lot.volumeTotal : 0;

      if (!opened) {
        opened = lot.opened;
      }

      matchedVolume += consume;
      weightedEntrySum += lot.entry * consume;
      openCommissionPart += lot.commission * ratio;
      openFeePart += lot.fee * ratio;
      openSwapPart += lot.swap * ratio;

      lot.volumeLeft -= consume;
      remaining -= consume;

      if (lot.volumeLeft <= 0.00000001) {
        lots.shift();
      }
    }

    if (lots.length) {
      openLots.set(key, lots);
    } else {
      openLots.delete(key);
    }

    const entry =
      matchedVolume > 0
        ? weightedEntrySum / matchedVolume
        : 0;

    const totalCommission = commission + openCommissionPart;
    const totalFee = fee + openFeePart;
    const totalSwap = swap + openSwapPart;

    const pnl = grossProfit + totalCommission + totalFee + totalSwap;

    trades.push(
      makeDealTrade({
        raw,
        opened,
        closed: dealTime,
        symbol,
        direction: closedPositionDirection,
        entry,
        exit: price,
        size: volume,
        pnl,
        grossProfit,
        commission: totalCommission,
        fee: totalFee,
        swap: totalSwap,
        matchedInfo:
          matchedVolume > 0
            ? `matchedVolume=${matchedVolume}`
            : "open deal not found in report",
        index: trades.length,
      })
    );
  }

  return trades;
}

function positionRawToTrade(raw: MetaTraderPositionRaw, index: number): Trade | null {
  const opened = parseDateTime(raw.openTimeRaw);
  const closed = parseDateTime(raw.closeTimeRaw);
  const direction = getOpenDirectionFromSide(raw.side);
  const symbol = normalizeSymbol(raw.symbol);

  if (!opened || !closed || !direction || !symbol) return null;

  const entry = parseNumber(raw.entryRaw);
  const exit = parseNumber(raw.exitRaw);
  const size = parseNumber(raw.sizeRaw);
  const commission = parseNumber(raw.commissionRaw);
  const swap = parseNumber(raw.swapRaw);
  const profit = parseNumber(raw.profitRaw);

  const pnl = profit;

  const externalId = makeExternalId([
    "METATRADER_POSITION",
    raw.ticket,
    symbol,
    direction,
    opened.date,
    opened.time,
    closed.date,
    closed.time,
    entry,
    exit,
    size,
    profit,
    commission,
    swap,
  ]);

  const notesParts = [
    "MetaTrader import",
    raw.ticket ? `ticket=${raw.ticket}` : "",
    `open=${opened.date} ${opened.time}`,
    `close=${closed.date} ${closed.time}`,
    raw.profitRaw ? `profit=${raw.profitRaw}` : "",
    raw.commissionRaw ? `commission=${raw.commissionRaw}` : "",
    raw.swapRaw ? `swap=${raw.swapRaw}` : "",
  ].filter(Boolean);

  return {
    id: `metatrader_${stableHash(externalId)}_${index}`,
    date: closed.date,
    time: closed.time,
    symbol,
    direction,
    entry,
    exit,
    size: size || 1,
    pnl,
    rating: 3,
    emotion: DEFAULT_EMOTION,
    psychology: DEFAULT_PSYCHOLOGY,
    planned: "no",
    strategy: "MetaTrader import",
    notes: notesParts.join(" | "),
    screenshots: [],
    source: "imported",
    exchange: "METATRADER",
    importedAt: new Date().toISOString(),
    externalId,
  };
}

function uniqueTrades(trades: Trade[]): Trade[] {
  const unique = new Map<string, Trade>();

  for (const trade of trades) {
    const key = trade.externalId || trade.id;

    if (!unique.has(key)) {
      unique.set(key, trade);
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    const aTime = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
    const bTime = new Date(`${b.date}T${b.time || "00:00"}`).getTime();

    return aTime - bTime;
  });
}

export function parseMetaTraderImportResult(text: string): MetaTraderImportResult {
  const rawText = String(text || "").trim();

  if (!rawText) {
    return {
      trades: [],
      rowsFound: 0,
      dealsFound: 0,
      closeDealsFound: 0,
      positionsFound: 0,
      importedMode: "none",
    };
  }

  const rows = isHtmlReport(rawText) ? parseHtmlRows(rawText) : parsePlainTextRows(rawText);

  const dealRows = rows
    .map((row) => rowToDealRaw(row))
    .filter((raw): raw is MetaTraderDealRaw => Boolean(raw));

  const closeDeals = dealRows.filter((deal) => isCloseDealDirection(deal.directionRaw));

  if (closeDeals.length > 0) {
    return {
      trades: uniqueTrades(parseDealsToTrades(dealRows)),
      rowsFound: rows.length,
      dealsFound: dealRows.length,
      closeDealsFound: closeDeals.length,
      positionsFound: 0,
      importedMode: "deals",
    };
  }

  const positionRows = rows
    .map((row) => rowToPositionRaw(row))
    .filter((raw): raw is MetaTraderPositionRaw => Boolean(raw));

  const positionTrades = positionRows
    .map((raw, index) => positionRawToTrade(raw, index))
    .filter((trade): trade is Trade => Boolean(trade));

  return {
    trades: uniqueTrades(positionTrades),
    rowsFound: rows.length,
    dealsFound: dealRows.length,
    closeDealsFound: closeDeals.length,
    positionsFound: positionRows.length,
    importedMode: positionTrades.length ? "positions" : "none",
  };
}

export function parseMetaTraderTrades(text: string): Trade[] {
  return parseMetaTraderImportResult(text).trades;
}

export function parseMetaTraderReportToTrades(text: string): Trade[] {
  return parseMetaTraderTrades(text);
}

export function parseMetaTraderHtmlToTrades(text: string): Trade[] {
  return parseMetaTraderTrades(text);
}

export function parseMetaTraderCsvToTrades(text: string): Trade[] {
  return parseMetaTraderTrades(text);
}

export function importMetaTraderTrades(text: string): Trade[] {
  return parseMetaTraderTrades(text);
}

export default parseMetaTraderTrades;