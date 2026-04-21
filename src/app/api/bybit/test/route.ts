import { NextRequest, NextResponse } from "next/server";
import { testBybitConnection } from "@/lib/fintrade/bybit";

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

    const result = await testBybitConnection({
      apiKey,
      apiSecret,
      isTestnet,
    });

    return NextResponse.json({
      ok: true,
      message: result.message || "Подключение к Bybit успешно проверено.",
      raw: result.raw,
    });
  } catch (error) {
    console.error("[BYBIT_TEST_ERROR]", error);

    const message =
      error instanceof Error
        ? error.message
        : "Не удалось проверить подключение к Bybit.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}