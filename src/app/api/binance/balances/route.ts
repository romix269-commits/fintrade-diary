import { NextRequest, NextResponse } from "next/server";
import { getBinanceBalances } from "@/lib/fintrade/binance";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey =
      typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiSecret =
      typeof body.apiSecret === "string" ? body.apiSecret.trim() : "";
    const isTestnet = Boolean(body.isTestnet);

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "API Key и API Secret обязательны.",
        },
        { status: 400 }
      );
    }

    const balances = await getBinanceBalances({
      apiKey,
      apiSecret,
      isTestnet,
    });

    return NextResponse.json({
      ok: true,
      message: balances.length
        ? `Загружено балансов: ${balances.length}`
        : "Балансы загружены, активы не найдены.",
      balances,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось загрузить балансы Binance.";

    console.error("[BINANCE_BALANCES_ERROR]", message);

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}