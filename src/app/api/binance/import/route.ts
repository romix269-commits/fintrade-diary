import { NextRequest, NextResponse } from "next/server";
import { importBinanceTrades } from "@/lib/fintrade/binance";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey =
      typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiSecret =
      typeof body.apiSecret === "string" ? body.apiSecret.trim() : "";
    const isTestnet = Boolean(body.isTestnet);
    const connectionId =
      typeof body.connectionId === "string" ? body.connectionId.trim() : "";
    const limit =
      typeof body.limit === "number" && body.limit > 0 ? body.limit : 1000;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "API Key и API Secret обязательны.",
        },
        { status: 400 }
      );
    }

    if (!connectionId) {
      return NextResponse.json(
        {
          ok: false,
          message: "connectionId обязателен.",
        },
        { status: 400 }
      );
    }

    const trades = await importBinanceTrades({
      apiKey,
      apiSecret,
      isTestnet,
      connectionId,
      limit,
    });

    return NextResponse.json({
      ok: true,
      message: `Импортировано сделок: ${trades.length}`,
      trades,
    });
  } catch (error) {
    console.error("[BINANCE_IMPORT_ERROR]", error);

    const message =
      error instanceof Error
        ? error.message
        : "Не удалось импортировать сделки из Binance.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}