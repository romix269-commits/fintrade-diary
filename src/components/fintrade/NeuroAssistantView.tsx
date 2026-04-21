"use client";

import React, { useMemo } from "react";
import type { Trade } from "@/lib/fintrade/store";
import { colorClass, fmt } from "@/lib/fintrade/store";

type Props = {
  trades: Trade[];
};

type StatEntry = [string, { count: number; pnl: number }];

function getWeekdayLabel(date: string) {
  const labels = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];
  const day = new Date(date).getDay();
  return labels[day] || "Неизвестно";
}

function getMonthLabel(date: string) {
  const labels = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  const month = new Date(date).getMonth();
  return labels[month] || "Неизвестно";
}

function getHourBucket(time?: string) {
  if (!time) return "Без времени";

  const hour = Number(time.split(":")[0]);
  if (Number.isNaN(hour)) return "Без времени";

  if (hour < 6) return "00:00–05:59";
  if (hour < 9) return "06:00–08:59";
  if (hour < 12) return "09:00–11:59";
  if (hour < 15) return "12:00–14:59";
  if (hour < 18) return "15:00–17:59";
  if (hour < 21) return "18:00–20:59";
  return "21:00–23:59";
}

function addToMap(
  map: Map<string, { count: number; pnl: number }>,
  key: string,
  pnl: number
) {
  const current = map.get(key) || { count: 0, pnl: 0 };
  current.count += 1;
  current.pnl += pnl;
  map.set(key, current);
}

function getBestWorst(map: Map<string, { count: number; pnl: number }>) {
  const arr = [...map.entries()];
  if (!arr.length) return { best: null as StatEntry | null, worst: null as StatEntry | null };

  const best = [...arr].sort((a, b) => b[1].pnl - a[1].pnl)[0] || null;
  const worst = [...arr].sort((a, b) => a[1].pnl - b[1].pnl)[0] || null;

  return { best, worst };
}

function selectBestTimeEntry(map: Map<string, { count: number; pnl: number }>) {
  const arr = [...map.entries()];
  if (!arr.length) return null;

  const withTime = arr.filter(([key]) => key !== "Без времени");
  const target = withTime.length ? withTime : arr;

  return [...target].sort((a, b) => b[1].pnl - a[1].pnl)[0] || null;
}

function selectWorstTimeEntry(map: Map<string, { count: number; pnl: number }>) {
  const arr = [...map.entries()];
  if (!arr.length) return null;

  const withTime = arr.filter(([key]) => key !== "Без времени");
  const target = withTime.length ? withTime : arr;

  return [...target].sort((a, b) => a[1].pnl - b[1].pnl)[0] || null;
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${fmt(value)}`;
}

function buildInsights(trades: Trade[]) {
  if (!trades.length) {
    return {
      summary:
        "Пока недостаточно данных. Добавьте сделки с временем, эмоциями, сетапами и соблюдением плана — тогда нейропомощник сможет показать сильные стороны, зоны риска и персональные рекомендации.",
      heroRisk: "Недостаточно истории для оценки рисков.",
      heroFocus: "Заполните первые сделки максимально подробно.",
      heroStrength: "Сильная сторона определится после накопления истории.",
      heroWeakness: "Слабая зона появится после анализа паттернов.",
      heroWeeklyFocus: "Фокус недели станет доступен после первых данных.",
      mainMistake: "Главная ошибка недели появится после накопления сделок.",
      bestWindow: "Лучшее торговое окно определится после появления истории.",
      removeNextFive: "Список ограничений на ближайшие сделки появится после анализа паттернов.",
      strengths: [
        "После появления истории система выделит ваши сильные инструменты, рабочие состояния и лучшие торговые часы.",
      ],
      risks: [
        "Когда накопятся данные, здесь появятся слабые паттерны, проблемные эмоции и интервалы с плохой статистикой.",
      ],
      behavior: [
        "Поведенческий профиль будет построен по результату сделок, дисциплине и психологии исполнения.",
      ],
      recommendations: [
        "Сейчас главное — фиксировать сделки подробно: инструмент, время, эмоцию, сетап, сигнал и соблюдение плана.",
      ],
      nextFocus: [
        "На ближайшие сделки сосредоточьтесь на качестве заполнения истории — это основа для точных рекомендаций.",
      ],
      bestCards: [],
      riskCards: [],
      plannedComparison: {
        plannedCount: 0,
        plannedPnl: 0,
        unplannedCount: 0,
        unplannedPnl: 0,
        note: "Сравнение по плану и вне плана станет доступно после появления сделок.",
      },
      timeCards: [],
      totalPnl: 0,
      totalTrades: 0,
    };
  }

  const symbolMap = new Map<string, { count: number; pnl: number }>();
  const strategyMap = new Map<string, { count: number; pnl: number }>();
  const emotionMap = new Map<string, { count: number; pnl: number }>();
  const weekdayMap = new Map<string, { count: number; pnl: number }>();
  const monthMap = new Map<string, { count: number; pnl: number }>();
  const hourMap = new Map<string, { count: number; pnl: number }>();
  const directionMap = new Map<string, { count: number; pnl: number }>();

  let plannedCount = 0;
  let plannedPnl = 0;
  let unplannedCount = 0;
  let unplannedPnl = 0;

  for (const trade of trades) {
    const pnl = Number(trade.pnl) || 0;

    addToMap(symbolMap, (trade.symbol || "").trim() || "Без инструмента", pnl);
    addToMap(strategyMap, (trade.strategy || "").trim() || "Без сетапа", pnl);
    addToMap(emotionMap, (trade.emotion || "").trim() || "Без эмоции", pnl);
    addToMap(weekdayMap, getWeekdayLabel(trade.date), pnl);
    addToMap(monthMap, getMonthLabel(trade.date), pnl);
    addToMap(hourMap, getHourBucket(trade.time), pnl);
    addToMap(directionMap, (trade.direction || "").trim() || "Без направления", pnl);

    if (trade.planned === "yes") {
      plannedCount += 1;
      plannedPnl += pnl;
    } else {
      unplannedCount += 1;
      unplannedPnl += pnl;
    }
  }

  const totalPnl = trades.reduce((acc, trade) => acc + (Number(trade.pnl) || 0), 0);

  const symbolStats = getBestWorst(symbolMap);
  const strategyStats = getBestWorst(strategyMap);
  const emotionStats = getBestWorst(emotionMap);
  const weekdayStats = getBestWorst(weekdayMap);
  const monthStats = getBestWorst(monthMap);
  const directionStats = getBestWorst(directionMap);

  const bestHour = selectBestTimeEntry(hourMap);
  const worstHour = selectWorstTimeEntry(hourMap);

  const strengths: string[] = [];
  const risks: string[] = [];
  const behavior: string[] = [];
  const recommendations: string[] = [];
  const nextFocus: string[] = [];
  const bestCards: Array<{ label: string; value: string; sub?: string; tone: string }> = [];
  const riskCards: Array<{ label: string; value: string; sub?: string; tone: string }> = [];
  const timeCards: Array<{ label: string; value: string; sub?: string; tone: string }> = [];

  if (symbolStats.best) {
    strengths.push(
      `Сейчас сильнее всего выглядит ${symbolStats.best[0]} — инструмент даёт ${formatSigned(
        symbolStats.best[1].pnl
      )} при ${symbolStats.best[1].count} сделках.`
    );
    bestCards.push({
      label: "Лучший инструмент",
      value: symbolStats.best[0],
      sub: formatSigned(symbolStats.best[1].pnl),
      tone: "text-[#5eead4]",
    });
  }

  if (strategyStats.best) {
    strengths.push(
      `Лучший сценарий на текущей истории — "${strategyStats.best[0]}": ${formatSigned(
        strategyStats.best[1].pnl
      )}.`
    );
    bestCards.push({
      label: "Лучший сетап",
      value: strategyStats.best[0],
      sub: formatSigned(strategyStats.best[1].pnl),
      tone: "text-[#7dd3fc]",
    });
  }

  if (emotionStats.best && emotionStats.best[0] !== "Без эмоции") {
    strengths.push(
      `Наиболее рабочее состояние — "${emotionStats.best[0]}": ${formatSigned(
        emotionStats.best[1].pnl
      )}.`
    );
    bestCards.push({
      label: "Лучшее состояние",
      value: emotionStats.best[0],
      sub: formatSigned(emotionStats.best[1].pnl),
      tone: "text-[#5eead4]",
    });
  }

  if (weekdayStats.best) {
    strengths.push(
      `Лучший день недели сейчас — ${weekdayStats.best[0]}: ${formatSigned(
        weekdayStats.best[1].pnl
      )}.`
    );
    timeCards.push({
      label: "Лучший день",
      value: weekdayStats.best[0],
      sub: formatSigned(weekdayStats.best[1].pnl),
      tone: "text-[#5eead4]",
    });
  }

  if (bestHour) {
    strengths.push(`Лучшее торговое окно — ${bestHour[0]}: ${formatSigned(bestHour[1].pnl)}.`);
    timeCards.push({
      label: "Лучшее окно",
      value: bestHour[0],
      sub: formatSigned(bestHour[1].pnl),
      tone: "text-[#7dd3fc]",
    });
  }

  if (monthStats.best) {
    strengths.push(
      `Наиболее сильный месяц по истории — ${monthStats.best[0]}: ${formatSigned(
        monthStats.best[1].pnl
      )}.`
    );
    timeCards.push({
      label: "Лучший месяц",
      value: monthStats.best[0],
      sub: formatSigned(monthStats.best[1].pnl),
      tone: "text-[#5eead4]",
    });
  }

  if (plannedCount > 0 && plannedPnl >= unplannedPnl) {
    strengths.push(
      `Плановые сделки сейчас сильнее: ${plannedCount} сделок на ${formatSigned(plannedPnl)}.`
    );
  }

  if (symbolStats.worst && symbolStats.worst[1].pnl < 0) {
    risks.push(
      `Слабее всего сейчас выглядит ${symbolStats.worst[0]}: инструмент даёт ${fmt(
        symbolStats.worst[1].pnl
      )}.`
    );
    riskCards.push({
      label: "Слабый инструмент",
      value: symbolStats.worst[0],
      sub: fmt(symbolStats.worst[1].pnl),
      tone: "text-[#fda4af]",
    });
  }

  if (strategyStats.worst && strategyStats.worst[1].pnl < 0) {
    risks.push(
      `Сценарий "${strategyStats.worst[0]}" пока не даёт нужного качества: ${fmt(
        strategyStats.worst[1].pnl
      )}.`
    );
    riskCards.push({
      label: "Слабый сетап",
      value: strategyStats.worst[0],
      sub: fmt(strategyStats.worst[1].pnl),
      tone: "text-[#fda4af]",
    });
  }

  if (emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0) {
    risks.push(
      `Эмоция "${emotionStats.worst[0]}" чаще всего сопровождает слабые решения и уже дала ${fmt(
        emotionStats.worst[1].pnl
      )}.`
    );
    riskCards.push({
      label: "Мешающая эмоция",
      value: emotionStats.worst[0],
      sub: fmt(emotionStats.worst[1].pnl),
      tone: "text-[#fda4af]",
    });
  }

  if (weekdayStats.worst && weekdayStats.worst[1].pnl < 0) {
    risks.push(
      `Самый слабый день недели — ${weekdayStats.worst[0]}: ${fmt(weekdayStats.worst[1].pnl)}.`
    );
    timeCards.push({
      label: "Слабый день",
      value: weekdayStats.worst[0],
      sub: fmt(weekdayStats.worst[1].pnl),
      tone: "text-[#fda4af]",
    });
  }

  if (worstHour && worstHour[1].pnl < 0) {
    risks.push(`Слабый торговый интервал — ${worstHour[0]}: ${fmt(worstHour[1].pnl)}.`);
    timeCards.push({
      label: "Слабый интервал",
      value: worstHour[0],
      sub: fmt(worstHour[1].pnl),
      tone: "text-[#fda4af]",
    });
  }

  if (monthStats.worst && monthStats.worst[1].pnl < 0) {
    risks.push(
      `Наиболее слабый месяц — ${monthStats.worst[0]}: ${fmt(monthStats.worst[1].pnl)}.`
    );
  }

  if (unplannedCount > 0 && unplannedPnl < plannedPnl) {
    risks.push(
      `Внеплановые входы ухудшают общую картину: ${unplannedCount} сделок на ${formatSigned(
        unplannedPnl
      )}.`
    );
    riskCards.push({
      label: "Вне плана",
      value: `${unplannedCount} сделок`,
      sub: formatSigned(unplannedPnl),
      tone: "text-[#fda4af]",
    });
  }

  if (emotionStats.best && emotionStats.best[0] !== "Без эмоции") {
    behavior.push(
      `Лучше всего вы торгуете в состоянии "${emotionStats.best[0]}", когда решения выглядят спокойнее и точнее.`
    );
  }

  if (emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0) {
    behavior.push(
      `Состояние "${emotionStats.worst[0]}" похоже на главный психологический триггер: в нём качество входов заметно проседает.`
    );
  }

  if (plannedPnl >= unplannedPnl) {
    behavior.push(
      "Когда вы следуете плану, торговля становится устойчивее, а результат — более предсказуемым."
    );
  }

  if (directionStats.best && directionStats.worst) {
    behavior.push(
      `По направлениям сильнее выглядит "${directionStats.best[0]}", а слабее — "${directionStats.worst[0]}".`
    );
  }

  if (symbolStats.best) {
    recommendations.push(
      `Держите основной фокус на ${symbolStats.best[0]} — сейчас этот инструмент выглядит наиболее надёжным.`
    );
  }

  if (strategyStats.best) {
    recommendations.push(
      `Стройте торговлю вокруг сценария "${strategyStats.best[0]}", потому что именно он показывает наиболее устойчивый профиль.`
    );
  }

  if (emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0) {
    recommendations.push(
      `При состоянии "${emotionStats.worst[0]}" лучше замедляться и не входить без повторной проверки сценария.`
    );
  }

  if (worstHour && worstHour[1].pnl < 0) {
    recommendations.push(
      `Снизьте активность в интервале ${worstHour[0]} — сейчас это слабая часть вашей сессии.`
    );
  }

  if (unplannedCount > 0 && unplannedPnl < plannedPnl) {
    recommendations.push(
      "Сделайте ближайшую серию сделок полностью плановой — это самый прямой способ улучшить качество торговли."
    );
  }

  if (symbolStats.worst && symbolStats.worst[1].pnl < 0) {
    nextFocus.push(
      `На ближайшие 5 сделок сократите ${symbolStats.worst[0]} и сосредоточьтесь на более стабильных инструментах.`
    );
  }

  if (strategyStats.worst && strategyStats.worst[1].pnl < 0) {
    nextFocus.push(
      `Исключите или резко ограничьте сетап "${strategyStats.worst[0]}", пока он не начнёт подтверждаться более качественными входами.`
    );
  }

  if (emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0) {
    nextFocus.push(
      `Если появляется "${emotionStats.worst[0]}", задача не заработать, а не сорваться в слабую сделку.`
    );
  }

  if (bestHour) {
    nextFocus.push(
      `Постарайтесь открывать основные сделки в интервале ${bestHour[0]}, где статистика сейчас выглядит сильнее всего.`
    );
  }

  const mainMistake =
    unplannedCount > 0 && unplannedPnl < plannedPnl
      ? "Главная ошибка недели — входы вне плана: именно они сейчас сильнее всего портят качество торговли."
      : emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0
      ? `Главная ошибка недели — торговля в состоянии "${emotionStats.worst[0]}", где результат заметно ухудшается.`
      : strategyStats.worst && strategyStats.worst[1].pnl < 0
      ? `Главная ошибка недели — слабый сценарий "${strategyStats.worst[0]}", который пока не даёт качественного результата.`
      : "Главная ошибка недели пока не выражена слишком явно — продолжайте собирать историю.";

  const bestWindow = bestHour
    ? `Лучшее торговое окно сейчас — ${bestHour[0]}. Именно в этот интервал ваши сделки выглядят наиболее сильными.`
    : "Лучшее торговое окно пока не определилось.";

  const removeNextFive =
    strategyStats.worst && strategyStats.worst[1].pnl < 0
      ? `На ближайшие 5 сделок лучше исключить сетап "${strategyStats.worst[0]}" и не использовать его без сильного подтверждения.`
      : symbolStats.worst && symbolStats.worst[1].pnl < 0
      ? `На ближайшие 5 сделок лучше убрать ${symbolStats.worst[0]} из активного фокуса.`
      : emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0
      ? `На ближайшие 5 сделок лучше исключить входы в состоянии "${emotionStats.worst[0]}".`
      : "На ближайшие 5 сделок исключите всё, что не соответствует заранее понятному сценарию и плану.";

  if (!strengths.length) {
    strengths.push("Сильные стороны станут заметнее после накопления более плотной истории сделок.");
  }

  if (!risks.length) {
    risks.push("Явные зоны риска пока не выделяются критично, но продолжайте фиксировать эмоции, время и соблюдение плана.");
  }

  if (!behavior.length) {
    behavior.push("Поведенческий профиль станет точнее по мере накопления истории и психологических комментариев.");
  }

  if (!recommendations.length) {
    recommendations.push("Сохраняйте фокус на простых сценариях, работайте по плану и продолжайте собирать качественную статистику.");
  }

  if (!nextFocus.length) {
    nextFocus.push("На ближайшие сделки держитесь только понятных входов и не расширяйте набор сценариев без статистического преимущества.");
  }

  const summaryParts: string[] = [];

  if (symbolStats.best) summaryParts.push(`${symbolStats.best[0]} сейчас выглядит сильнее всего`);
  if (strategyStats.best) summaryParts.push(`лучший сценарий — "${strategyStats.best[0]}"`);
  if (emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0) {
    summaryParts.push(`эмоция "${emotionStats.worst[0]}" мешает результату`);
  }
  if (unplannedCount > 0 && unplannedPnl < plannedPnl) {
    summaryParts.push("внеплановые входы ухудшают общую картину");
  }
  if (bestHour) {
    summaryParts.push(`лучшее окно — ${bestHour[0]}`);
  }

  const summary = summaryParts.length
    ? `По текущей картине ${summaryParts.join(", ")}. Главная задача — чаще использовать сильные зоны и жёстче ограничивать слабые сценарии.`
    : "Нейропомощник анализирует историю сделок и постепенно собирает ваш профиль сильных и слабых торговых паттернов.";

  const heroRisk =
    emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0
      ? `Главный риск сейчас — состояние "${emotionStats.worst[0]}".`
      : unplannedCount > 0 && unplannedPnl < plannedPnl
      ? "Главный риск сейчас — внеплановые сделки."
      : strategyStats.worst && strategyStats.worst[1].pnl < 0
      ? `Главный риск сейчас — сетап "${strategyStats.worst[0]}".`
      : "Главный риск сейчас — нестабильность слабых сценариев.";

  const heroFocus =
    symbolStats.best && strategyStats.best
      ? `Фокус: ${symbolStats.best[0]} + "${strategyStats.best[0]}".`
      : bestHour
      ? `Фокус: работать в окне ${bestHour[0]}.`
      : "Фокус: только понятные сделки по плану.";

  const heroStrength =
    symbolStats.best
      ? `Сильная сторона — ${symbolStats.best[0]}.`
      : strategyStats.best
      ? `Сильная сторона — "${strategyStats.best[0]}".`
      : "Сильная сторона уточняется по мере накопления истории.";

  const heroWeakness =
    emotionStats.worst && emotionStats.worst[0] !== "Без эмоции" && emotionStats.worst[1].pnl < 0
      ? `Слабая зона — "${emotionStats.worst[0]}".`
      : strategyStats.worst && strategyStats.worst[1].pnl < 0
      ? `Слабая зона — "${strategyStats.worst[0]}".`
      : symbolStats.worst && symbolStats.worst[1].pnl < 0
      ? `Слабая зона — ${symbolStats.worst[0]}.`
      : "Слабая зона ещё не выделена критично.";

  const heroWeeklyFocus =
    unplannedCount > 0 && unplannedPnl < plannedPnl
      ? "Фокус недели — убрать внеплановые входы."
      : bestHour
      ? `Фокус недели — работать в окне ${bestHour[0]}.`
      : strategyStats.best
      ? `Фокус недели — сценарий "${strategyStats.best[0]}".`
      : "Фокус недели — только понятные сделки по плану.";

  return {
    summary,
    heroRisk,
    heroFocus,
    heroStrength,
    heroWeakness,
    heroWeeklyFocus,
    mainMistake,
    bestWindow,
    removeNextFive,
    strengths,
    risks,
    behavior,
    recommendations,
    nextFocus,
    bestCards,
    riskCards,
    plannedComparison: {
      plannedCount,
      plannedPnl,
      unplannedCount,
      unplannedPnl,
      note:
        plannedPnl >= unplannedPnl
          ? "Плановые сделки выглядят заметно устойчивее и дают более качественный результат."
          : "Разница между планом и внепланом пока не в вашу пользу — дисциплину стоит усилить.",
    },
    timeCards,
    totalPnl,
    totalTrades: trades.length,
  };
}

function SectionList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: string;
  items: string[];
}) {
  return (
    <div className="card">
      <div className={`mb-3 text-[13px] font-bold uppercase tracking-[0.12em] ${tone}`}>{title}</div>

      <div className="grid gap-3">
        {items.map((text, index) => (
          <div key={index} className="text-[15px] leading-[1.7] text-[#d8ebff]">
            • {text}
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card stat-card-icon">
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="stat-label m-0">{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className={`text-[18px] font-extrabold leading-[1.25] ${tone}`}>{value}</div>
      {sub && <div className={`mt-2 text-sm font-bold ${tone}`}>{sub}</div>}
    </div>
  );
}

export default function NeuroAssistantView({ trades }: Props) {
  const insights = useMemo(() => buildInsights(trades), [trades]);

  return (
    <div className="grid gap-4">
      <section
        className="overflow-hidden rounded-[28px] border border-[rgba(56,189,248,.10)] bg-[linear-gradient(180deg,rgba(13,25,43,.96),rgba(7,13,26,.98))] p-4"
        style={{ boxShadow: "0 18px 50px rgba(0,0,0,.28)" }}
      >
        <div className="grid gap-4 xl:grid-cols-[1.25fr_.95fr]">
          <div className="grid content-start gap-3">
            <div className="inline-flex w-fit rounded-full border border-[rgba(56,189,248,.14)] bg-[rgba(14,28,48,.72)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7dd3fc]">
              AI summary · локальный анализ
            </div>

            <div>
              <h2 className="m-0 font-['Sora',sans-serif] text-[34px] font-extrabold tracking-tight text-[#f4fbff]">
                Нейропомощник
              </h2>
              <p className="mt-2 max-w-[760px] text-[15px] leading-[1.7] text-[#9fb8d4]">
                Интеллектуальный разбор торговли по всей истории сделок, времени, дисциплине, эмоциям и торговым паттернам
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(94,234,212,.16)] bg-[rgba(13,39,35,.55)] px-3 py-2 text-sm font-bold text-[#5eead4]">
                {insights.heroStrength}
              </span>
              <span className="rounded-full border border-[rgba(253,164,175,.16)] bg-[rgba(40,18,24,.45)] px-3 py-2 text-sm font-bold text-[#ffb0bd]">
                {insights.heroWeakness}
              </span>
              <span className="rounded-full border border-[rgba(125,211,252,.16)] bg-[rgba(14,27,43,.52)] px-3 py-2 text-sm font-bold text-[#8fe9ff]">
                {insights.heroWeeklyFocus}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="item py-3">
                <div className="text-sm text-[#8aa6c7]">Главный риск</div>
                <div className="mt-2 text-[16px] font-bold leading-[1.5] text-[#ffb0bd]">
                  {insights.heroRisk}
                </div>
              </div>

              <div className="item py-3">
                <div className="text-sm text-[#8aa6c7]">Текущий фокус</div>
                <div className="mt-2 text-[16px] font-bold leading-[1.5] text-[#8fe9ff]">
                  {insights.heroFocus}
                </div>
              </div>
            </div>
          </div>

          <div className="card h-fit bg-[rgba(10,18,34,.72)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-[18px] font-bold">Главный AI-вывод</h3>
              <span className="text-xs text-[#8aa6c7]">по всей истории</span>
            </div>

            <div className="mt-3 rounded-[18px] border border-[rgba(56,189,248,.12)] bg-[rgba(10,18,34,.46)] p-4">
              <div className="text-[15px] leading-[1.75] text-[#dcecff]">{insights.summary}</div>
            </div>

            <div className="mt-3 grid gap-3">
              <div className="item py-3">
                <div className="text-sm text-[#8aa6c7]">Главная ошибка недели</div>
                <div className="mt-2 text-[15px] font-bold leading-[1.6] text-[#ffb0bd]">
                  {insights.mainMistake}
                </div>
              </div>

              <div className="item py-3">
                <div className="text-sm text-[#8aa6c7]">Лучшее торговое окно</div>
                <div className="mt-2 text-[15px] font-bold leading-[1.6] text-[#8fe9ff]">
                  {insights.bestWindow}
                </div>
              </div>

              <div className="item py-3">
                <div className="text-sm text-[#8aa6c7]">Что исключить на ближайшие 5 сделок</div>
                <div className="mt-2 text-[15px] font-bold leading-[1.6] text-[#f6c76b]">
                  {insights.removeNextFive}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {insights.bestCards.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insights.bestCards.map((item, index) => (
            <InsightCard
              key={index}
              label={item.label}
              value={item.value}
              sub={item.sub}
              tone={item.tone}
              icon={index === 0 ? "◔" : index === 1 ? "▥" : index === 2 ? "◉" : "★"}
            />
          ))}
        </section>
      )}

      {(insights.riskCards.length > 0 || insights.timeCards.length > 0) && (
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="card">
            <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#ffb0bd]">
              Критические паттерны
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {insights.riskCards.length ? (
                insights.riskCards.map((item, index) => (
                  <div key={index} className="item py-3">
                    <div className="text-sm text-[#8aa6c7]">{item.label}</div>
                    <div className={`mt-2 text-[20px] font-extrabold leading-[1.25] ${item.tone}`}>
                      {item.value}
                    </div>
                    {item.sub && <div className={`mt-2 text-sm font-bold ${item.tone}`}>{item.sub}</div>}
                  </div>
                ))
              ) : (
                <div className="item text-[#8aa6c7]">Критические паттерны пока не выделяются явно</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#7dd3fc]">
              Временные паттерны
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {insights.timeCards.length ? (
                insights.timeCards.map((item, index) => (
                  <div key={index} className="item py-3">
                    <div className="text-sm text-[#8aa6c7]">{item.label}</div>
                    <div className={`mt-2 text-[20px] font-extrabold leading-[1.25] ${item.tone}`}>
                      {item.value}
                    </div>
                    {item.sub && <div className={`mt-2 text-sm font-bold ${item.tone}`}>{item.sub}</div>}
                  </div>
                ))
              ) : (
                <div className="item text-[#8aa6c7]">Временные паттерны пока не определены</div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="m-0 text-[18px] font-bold">Сравнение: по плану / вне плана</h3>
            <span className="chip">дисциплина</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="item py-3">
              <div className="text-sm text-[#8aa6c7]">По плану</div>
              <div className="mt-2 text-[22px] font-extrabold text-[#5eead4]">
                {insights.plannedComparison.plannedCount} сделок
              </div>
              <div className="mt-2 text-sm font-bold text-[#5eead4]">
                {formatSigned(insights.plannedComparison.plannedPnl)}
              </div>
            </div>

            <div className="item py-3">
              <div className="text-sm text-[#8aa6c7]">Вне плана</div>
              <div className="mt-2 text-[22px] font-extrabold text-[#fda4af]">
                {insights.plannedComparison.unplannedCount} сделок
              </div>
              <div className="mt-2 text-sm font-bold text-[#fda4af]">
                {formatSigned(insights.plannedComparison.unplannedPnl)}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-[18px] border border-[rgba(56,189,248,.10)] bg-[rgba(10,18,34,.42)] p-4 text-[15px] leading-[1.7] text-[#d8ebff]">
            {insights.plannedComparison.note}
          </div>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="m-0 text-[18px] font-bold">Снимок текущей статистики</h3>
            <span className="chip">история</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="item py-3">
              <div className="text-sm text-[#8aa6c7]">Всего сделок</div>
              <div className="mt-2 text-[22px] font-extrabold text-white">{insights.totalTrades}</div>
            </div>

            <div className="item py-3">
              <div className="text-sm text-[#8aa6c7]">Общий результат</div>
              <div className={`mt-2 text-[22px] font-extrabold ${colorClass(insights.totalPnl)}`}>
                {formatSigned(insights.totalPnl)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionList
          title="Что работает лучше"
          tone="text-[#5eead4]"
          items={insights.strengths}
        />

        <SectionList
          title="Что мешает результату"
          tone="text-[#ffb0bd]"
          items={insights.risks}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionList
          title="Поведенческий профиль"
          tone="text-[#7dd3fc]"
          items={insights.behavior}
        />

        <SectionList
          title="Практические рекомендации"
          tone="text-[#f6c76b]"
          items={insights.recommendations}
        />
      </section>

      <section className="card">
        <div className="mb-3">
          <h3 className="m-0 text-[18px] font-bold">Фокус на ближайшие сделки</h3>
          <p className="mt-1 text-sm text-[#8aa6c7]">
            Конкретные действия, которые стоит держать в приоритете в следующей серии входов
          </p>
        </div>

        <div className="grid gap-3">
          {insights.nextFocus.map((text, index) => (
            <div key={index} className="item py-3 text-[15px] leading-[1.7] text-[#dcecff]">
              • {text}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}