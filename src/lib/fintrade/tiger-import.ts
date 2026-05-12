import type { Trade } from "@/lib/fintrade/store";

export type TigerCsvRow = Record<string, string>;

type ParsedDateTime = {
  date: string;
  time: string;
};

const DEFAULT_EMOTION = "Нейтрально";
const DEFAULT_PSYCHOLOGY = "Импортировано из Tiger.com";

const HEADER_ALIASES = {
  account: [
    "account",
    "account id",
    "account no",
    "account number",
    "счет",
    "счёт",
    "аккаунт",
  ],
  symbol: [
    "symbol",
    "ticker",
    "instrument",
    "contract",
    "security",
    "underlying",
    "код",
    "тикер",
    "инструмент",
    "символ",
    "бумага",
    "контракт",
  ],
  direction: [
    "direction",
    "side",
    "action",
    "operation",
    "trade direction",
    "buy/sell",
    "long/short",
    "направление",
    "сторона",
    "операция",
    "действие",
    "покупка продажа",
  ],
  entry: [
    "entry",
    "entry price",
    "open price",
    "average open price",
    "avg open price",
    "price",
    "open",
    "цена откр",
    "цена откр.",
    "цена открытия",
    "цена входа",
    "вход",
    "средняя цена входа",
    "цена",
  ],
  exit: [
    "exit",
    "exit price",
    "close price",
    "average close price",
    "avg close price",
    "close",
    "цена закр",
    "цена закр.",
    "цена закрытия",
    "цена выхода",
    "выход",
    "средняя цена выхода",
  ],
  size: [
    "size",
    "quantity",
    "qty",
    "volume",
    "amount",
    "filled quantity",
    "filled qty",
    "max volume",
    "max size",
    "макс объем",
    "макс. объем",
    "макс объём",
    "макс. объём",
    "максимальный объем",
    "максимальный объём",
    "количество",
    "объем",
    "объём",
    "размер",
    "лот",
    "лоты",
  ],
  pnl: [
    "чист приб",
    "чист. приб.",
    "чистая прибыль",
    "чистая прибыль убыток",
    "чистый результат",
    "net pnl",
    "net profit",
    "net profit loss",
    "realized pnl",
    "realised pnl",
    "pnl",
    "p/l",
    "profit",
    "profit/loss",
    "прибыль",
    "прибыль/убыток",
    "п/у",
    "финрез",
    "результат",
  ],
  grossPnl: [
    "прибыль",
    "прибыль / объем",
    "прибыль / объём",
    "gross pnl",
    "gross profit",
    "gross realized",
    "gross realised",
    "gross realized pnl",
    "gross realised pnl",
    "валовая прибыль",
    "грязная прибыль",
  ],
  commission: [
    "commission",
    "fee",
    "fees",
    "brokerage",
    "комиссия",
    "комиссии",
    "сбор",
  ],
  openedAt: [
    "время откр",
    "время откр.",
    "дата откр",
    "дата откр.",
    "дата открытия",
    "время открытия",
    "opened at",
    "open time",
    "open date",
    "entry time",
    "entry date",
    "trade time",
    "trade date",
    "date",
    "time",
    "created at",
    "fill time",
    "filled time",
    "execution time",
    "дата",
    "время",
    "дата сделки",
    "время сделки",
  ],
  closedAt: [
    "время закр",
    "время закр.",
    "дата закр",
    "дата закр.",
    "дата закрытия",
    "время закрытия",
    "closed at",
    "close time",
    "close date",
    "exit time",
    "exit date",
  ],
  points: [
    "points",
    "point",
    "пункты",
    "пунктов",
    "points pnl",
  ],
  pointsPerVolume: [
    "пункты / объем",
    "пункты / объём",
    "points per volume",
    "points / volume",
  ],
  pnlPerVolume: [
    "прибыль / объем",
    "прибыль / объём",
    "profit / volume",
    "pnl / volume",
  ],
  netPnlPerVolume: [
    "чист приб / объем",
    "чист. приб. / объем",
    "чист приб / объём",
    "чист. приб. / объём",
    "net profit / volume",
    "net pnl / volume",
  ],
  tags: [
    "tags",
    "tag",
    "labels",
    "label",
    "теги",
    "метки",
  ],
  description: [
    "description",
    "comment",
    "comments",
    "note",
    "notes",
    "remark",
    "remarks",
    "описание",
    "комментарий",
    "заметка",
    "примечание",
  ],
};

function normalizeHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[ё]/g, "е")
    .replace(/[№#]/g, "no")
    .replace(/[\s_\-./\\()[\]{}:;'"`]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizeValue(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function pick(row: TigerCsvRow, aliases: string[]): string {
  const keys = Object.keys(row);
  const normalizedKeys = keys.map((key) => ({
    original: key,
    normalized: normalizeHeader(key),
  }));

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);

    const exact = normalizedKeys.find((key) => key.normalized === normalizedAlias);
    if (exact) return normalizeValue(row[exact.original]);
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);

    if (normalizedAlias.length < 4) continue;

    const fuzzy = normalizedKeys.find(
      (key) =>
        key.normalized.includes(normalizedAlias) ||
        normalizedAlias.includes(key.normalized)
    );

    if (fuzzy) return normalizeValue(row[fuzzy.original]);
  }

  return "";
}

function detectDelimiter(line: string): string {
  const candidates = [";", ",", "\t", "|"];
  let bestDelimiter = ";";
  let bestCount = 0;

  for (const delimiter of candidates) {
    const count = line.split(delimiter).length;
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseCsvLine(line: string, delimiter: string): string[] {
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
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result.map((item) => item.replace(/^"|"$/g, "").trim());
}

function parseCsv(text: string): TigerCsvRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row: TigerCsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function parseJsonRows(text: string): TigerCsvRow[] {
  try {
    const data = JSON.parse(text);

    if (Array.isArray(data)) {
      return data.map((item) => objectToRow(item));
    }

    if (Array.isArray(data?.trades)) {
      return data.trades.map((item: unknown) => objectToRow(item));
    }

    if (Array.isArray(data?.data)) {
      return data.data.map((item: unknown) => objectToRow(item));
    }

    if (Array.isArray(data?.items)) {
      return data.items.map((item: unknown) => objectToRow(item));
    }

    if (Array.isArray(data?.rows)) {
      return data.rows.map((item: unknown) => objectToRow(item));
    }

    return [];
  } catch {
    return [];
  }
}

function objectToRow(item: unknown): TigerCsvRow {
  if (!item || typeof item !== "object") return {};

  const row: TigerCsvRow = {};

  Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
    row[key] = normalizeValue(value);
  });

  return row;
}

function parseRows(text: string): TigerCsvRow[] {
  const raw = text.trim();

  if (!raw) return [];

  if (raw.startsWith("{") || raw.startsWith("[")) {
    const jsonRows = parseJsonRows(raw);
    if (jsonRows.length) return jsonRows;
  }

  return parseCsv(raw);
}

function parseNumber(value: unknown): number {
  let raw = normalizeValue(value);

  if (!raw) return 0;

  const isNegativeByBrackets = raw.startsWith("(") && raw.endsWith(")");

  raw = raw
    .replace(/\s/g, "")
    .replace(/\u00A0/g, "")
    .replace(/[₽$€£¥₸₴]/g, "")
    .replace(/[A-ZА-Я]+/gi, "")
    .replace(/[()]/g, "");

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

function parseDateTime(value: string): ParsedDateTime | null {
  const raw = normalizeValue(value);

  if (!raw) return null;

  const isoMatch = raw.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    const hour = (isoMatch[4] || "00").padStart(2, "0");
    const minute = (isoMatch[5] || "00").padStart(2, "0");

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

  const usMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];

    const hour = (usMatch[4] || "00").padStart(2, "0");
    const minute = (usMatch[5] || "00").padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }

  const parsedDate = new Date(raw);

  if (!Number.isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const hour = String(parsedDate.getHours()).padStart(2, "0");
    const minute = String(parsedDate.getMinutes()).padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }

  return null;
}

function normalizeSymbol(value: string): string {
  return normalizeValue(value)
    .replace(/\s+/g, "")
    .replace(/\//g, "")
    .toUpperCase();
}

function normalizeDirection(value: string): Trade["direction"] {
  const raw = normalizeValue(value).toLowerCase();

  if (
    raw.includes("short") ||
    raw.includes("sell") ||
    raw.includes("прод") ||
    raw.includes("шорт")
  ) {
    return "SHORT" as Trade["direction"];
  }

  return "LONG" as Trade["direction"];
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
    .map((part) => normalizeValue(part))
    .filter(Boolean)
    .join("|");
}

function tigerRowToTrade(row: TigerCsvRow, index: number): Trade | null {
  const account = pick(row, HEADER_ALIASES.account);
  const symbolRaw = pick(row, HEADER_ALIASES.symbol);
  const directionRaw = pick(row, HEADER_ALIASES.direction);

  const entryRaw = pick(row, HEADER_ALIASES.entry);
  const exitRaw = pick(row, HEADER_ALIASES.exit);
  const sizeRaw = pick(row, HEADER_ALIASES.size);

  const pnlRaw = pick(row, HEADER_ALIASES.pnl);
  const grossPnlRaw = pick(row, HEADER_ALIASES.grossPnl);
  const commissionRaw = pick(row, HEADER_ALIASES.commission);

  const openedRaw = pick(row, HEADER_ALIASES.openedAt);
  const closedRaw = pick(row, HEADER_ALIASES.closedAt);

  const pointsRaw = pick(row, HEADER_ALIASES.points);
  const pointsPerVolumeRaw = pick(row, HEADER_ALIASES.pointsPerVolume);
  const pnlPerVolumeRaw = pick(row, HEADER_ALIASES.pnlPerVolume);
  const netPnlPerVolumeRaw = pick(row, HEADER_ALIASES.netPnlPerVolume);

  const tagsRaw = pick(row, HEADER_ALIASES.tags);
  const descriptionRaw = pick(row, HEADER_ALIASES.description);

  const symbol = normalizeSymbol(symbolRaw);

  if (!symbol) return null;

  const opened = parseDateTime(openedRaw) || parseDateTime(closedRaw);

  if (!opened) return null;

  const direction = normalizeDirection(directionRaw);
  const entry = parseNumber(entryRaw);
  const exit = parseNumber(exitRaw);
  const size = parseNumber(sizeRaw) || 1;

  const pnl = parseNumber(pnlRaw);
  const grossPnl = parseNumber(grossPnlRaw);
  const commission = Math.abs(parseNumber(commissionRaw));

  const netPnl =
    pnl !== 0
      ? pnl
      : grossPnl !== 0
        ? grossPnl - commission
        : 0;

  const externalId = makeExternalId([
    account,
    symbol,
    direction,
    opened.date,
    opened.time,
    closedRaw,
    entryRaw,
    exitRaw,
    sizeRaw,
    netPnl,
    grossPnlRaw,
    commissionRaw,
    pointsRaw,
    pointsPerVolumeRaw,
    pnlPerVolumeRaw,
    netPnlPerVolumeRaw,
  ]);

  const notesParts = [
    "Tiger.com import",
    account ? `account=${account}` : "",
    openedRaw ? `opened=${openedRaw}` : "",
    closedRaw ? `closed=${closedRaw}` : "",
    pointsRaw ? `points=${pointsRaw}` : "",
    pointsPerVolumeRaw ? `pointsPerVolume=${pointsPerVolumeRaw}` : "",
    pnlPerVolumeRaw ? `pnlPerVolume=${pnlPerVolumeRaw}` : "",
    netPnlPerVolumeRaw ? `netPnlPerVolume=${netPnlPerVolumeRaw}` : "",
    commissionRaw ? `commission=${commissionRaw}` : "",
    tagsRaw ? `tags=${tagsRaw}` : "",
    descriptionRaw ? `description=${descriptionRaw}` : "",
  ].filter(Boolean);

  return {
    id: `tiger_${stableHash(externalId)}_${index}`,
    date: opened.date,
    time: opened.time,
    symbol,
    direction,
    entry,
    exit,
    size,
    pnl: netPnl,
    rating: 3,
    emotion: DEFAULT_EMOTION,
    psychology: DEFAULT_PSYCHOLOGY,
    planned: "no",
    strategy: "Tiger.com import",
    notes: notesParts.join(" | "),
    screenshots: [],
    source: "imported",
    exchange: "TIGER",
    importedAt: new Date().toISOString(),
    externalId,
  };
}

export function parseTigerTrades(text: string): Trade[] {
  const rows = parseRows(text);

  const trades = rows
    .map((row, index) => tigerRowToTrade(row, index))
    .filter((trade): trade is Trade => Boolean(trade));

  const uniqueTrades = new Map<string, Trade>();

  for (const trade of trades) {
    const key = trade.externalId || trade.id;

    if (!uniqueTrades.has(key)) {
      uniqueTrades.set(key, trade);
    }
  }

  return Array.from(uniqueTrades.values());
}

export function parseTigerCsvToTrades(text: string): Trade[] {
  return parseTigerTrades(text);
}

export function parseTigerTradesFromCsv(text: string): Trade[] {
  return parseTigerTrades(text);
}

export function parseTigerTradesFromText(text: string): Trade[] {
  return parseTigerTrades(text);
}

export function parseTigerTradesFile(text: string): Trade[] {
  return parseTigerTrades(text);
}

export function importTigerTrades(text: string): Trade[] {
  return parseTigerTrades(text);
}

export function importTigerTradesFromText(text: string): Trade[] {
  return parseTigerTrades(text);
}

export function tigerCsvToTrades(text: string): Trade[] {
  return parseTigerTrades(text);
}

export default parseTigerTrades;