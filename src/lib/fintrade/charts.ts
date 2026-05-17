import { Trade, fmt } from "@/lib/fintrade/store";

type EquityPointMeta = {
  x: number;
  y: number;
  trade?: Trade;
};

type EquityCanvasWithHandlers = HTMLCanvasElement & {
  __equityHoverHandler?: (event: MouseEvent) => void;
  __equityLeaveHandler?: () => void;
  __equityClickHandler?: (event: MouseEvent) => void;
};

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number) {
  ctx.strokeStyle = "rgba(125,170,220,.10)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad + (h - pad * 2) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }
}

function sortTradesExactlyLikeEquityCurve(trades: Trade[]) {
  return [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function buildEquityPoints(
  values: number[],
  trades: Trade[],
  w: number,
  h: number,
  pad: number
): EquityPointMeta[] {
  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map((value, index) => {
    const x = pad + (index * (w - pad * 2)) / Math.max(values.length - 1, 1);
    const y = h - pad - ((value - min) / range) * (h - pad * 2);

    return {
      x,
      y,
      trade: trades[index],
    };
  });
}

function getNearestPointByDistance(
  mouseX: number,
  mouseY: number,
  points: EquityPointMeta[],
  radius = 18
) {
  let nearest: EquityPointMeta | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const dx = mouseX - point.x;
    const dy = mouseY - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= radius && distance < minDistance) {
      nearest = point;
      minDistance = distance;
    }
  }

  return nearest;
}

function getNearestPointByX(mouseX: number, points: EquityPointMeta[], radius = 24) {
  let nearest: EquityPointMeta | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const distance = Math.abs(mouseX - point.x);

    if (distance <= radius && distance < minDistance) {
      nearest = point;
      minDistance = distance;
    }
  }

  return nearest;
}

function drawEquityBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: number,
  values: number[],
  orderedTrades: Trade[],
  hoveredIndex: number | null = null,
  showTradePoints = true
) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h, pad);

  if (!values.length) {
    ctx.fillStyle = "#86a7c8";
    ctx.font = "14px Manrope, Arial";
    ctx.fillText("Нет данных", pad, 36);
    return [] as EquityPointMeta[];
  }

  const points = buildEquityPoints(values, orderedTrades, w, h, pad);

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(103,232,249,.28)");
  gradient.addColorStop(1, "rgba(29,155,240,.03)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + curr.y) / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.lineTo(w - pad, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + curr.y) / 2);
  }
  ctx.strokeStyle = "#1dd1ff";
  ctx.lineWidth = 2.2;
  ctx.shadowColor = "rgba(29,209,255,.35)";
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (showTradePoints) {
    points.forEach((point, index) => {
      const trade = orderedTrades[index];
      const positive = (trade?.pnl || 0) >= 0;
      const isHovered = hoveredIndex === index;

      ctx.beginPath();
      ctx.arc(point.x, point.y, isHovered ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = positive ? "#4de2c5" : "#ff6b81";
      ctx.shadowColor = positive ? "rgba(77,226,197,.45)" : "rgba(255,107,129,.45)";
      ctx.shadowBlur = isHovered ? 18 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = positive ? "rgba(77,226,197,.45)" : "rgba(255,107,129,.45)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  return points;
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  point: EquityPointMeta
) {
  const trade = point.trade;
  if (!trade) return;

  const pnl = Number(trade.pnl) || 0;
  const pnlText = `${pnl >= 0 ? "+" : ""}${fmt(pnl)}`;

  const lines = [trade.date || "—", trade.symbol || "—", `P/L: ${pnlText}`];

  ctx.save();
  ctx.font = "13px Manrope, Arial";

  const lineHeight = 18;
  const horizontalPadding = 12;
  const verticalPadding = 10;

  const textWidths = lines.map((line) => ctx.measureText(line).width);
  const tooltipWidth = Math.max(...textWidths) + horizontalPadding * 2;
  const tooltipHeight = lines.length * lineHeight + verticalPadding * 2;

  let tooltipX = point.x + 14;
  let tooltipY = point.y - tooltipHeight - 14;

  if (tooltipX + tooltipWidth > w - 8) {
    tooltipX = point.x - tooltipWidth - 14;
  }

  if (tooltipX < 8) {
    tooltipX = 8;
  }

  if (tooltipY < 8) {
    tooltipY = point.y + 14;
  }

  if (tooltipY + tooltipHeight > h - 8) {
    tooltipY = h - tooltipHeight - 8;
  }

  ctx.shadowColor = "rgba(0,0,0,.28)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(8,15,28,.96)";
  ctx.strokeStyle = "rgba(56,189,248,.18)";
  ctx.lineWidth = 1;

  const radius = 12;

  ctx.beginPath();
  ctx.moveTo(tooltipX + radius, tooltipY);
  ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
  ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY, tooltipX + tooltipWidth, tooltipY + radius);
  ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
  ctx.quadraticCurveTo(
    tooltipX + tooltipWidth,
    tooltipY + tooltipHeight,
    tooltipX + tooltipWidth - radius,
    tooltipY + tooltipHeight
  );
  ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
  ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipHeight, tooltipX, tooltipY + tooltipHeight - radius);
  ctx.lineTo(tooltipX, tooltipY + radius);
  ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + radius, tooltipY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  lines.forEach((line, index) => {
    if (index === 2) {
      ctx.fillStyle = pnl >= 0 ? "#4de2c5" : "#ff6b81";
    } else {
      ctx.fillStyle = "#e8f3ff";
    }

    ctx.fillText(
      line,
      tooltipX + horizontalPadding,
      tooltipY + verticalPadding + 13 + index * lineHeight
    );
  });

  ctx.restore();
}

function emitOpenTrade(tradeId: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("fintrade:open-trade", {
      detail: { tradeId },
    })
  );
}

export function drawEquityChart(
  canvas: HTMLCanvasElement,
  values: number[],
  trades: Trade[],
  onPointClick?: (trade: Trade) => void,
  showTradePoints = true
) {
  const target = canvas as EquityCanvasWithHandlers;

  if (target.__equityHoverHandler) {
    canvas.removeEventListener("mousemove", target.__equityHoverHandler);
  }
  if (target.__equityLeaveHandler) {
    canvas.removeEventListener("mouseleave", target.__equityLeaveHandler);
  }
  if (target.__equityClickHandler) {
    canvas.removeEventListener("click", target.__equityClickHandler);
  }

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const w = rect.width;
  const h = rect.height;
  const pad = 28;

  const orderedTrades = sortTradesExactlyLikeEquityCurve(trades);
  const points = drawEquityBase(ctx, w, h, pad, values, orderedTrades, null, showTradePoints);

  if (!values.length || !points.length || !showTradePoints) {
    canvas.style.cursor = "default";
    return;
  }

  const redraw = (hoveredIndex: number | null) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const nextPoints = drawEquityBase(ctx, w, h, pad, values, orderedTrades, hoveredIndex, showTradePoints);

    if (hoveredIndex !== null && nextPoints[hoveredIndex]) {
      drawTooltip(ctx, w, h, nextPoints[hoveredIndex]);
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const mouseX = event.clientX - bounds.left;
    const mouseY = event.clientY - bounds.top;

    const nearest =
      getNearestPointByDistance(mouseX, mouseY, points, 18) ||
      getNearestPointByX(mouseX, points, 22);

    if (!nearest) {
      canvas.style.cursor = "default";
      redraw(null);
      return;
    }

    const hoveredIndex = points.findIndex(
      (point) => point.x === nearest.x && point.y === nearest.y
    );

    canvas.style.cursor = nearest.trade ? "pointer" : "default";
    redraw(hoveredIndex);
  };

  const handleMouseLeave = () => {
    canvas.style.cursor = "default";
    redraw(null);
  };

  const handleClick = (event: MouseEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const mouseX = event.clientX - bounds.left;
    const mouseY = event.clientY - bounds.top;

    const nearest =
      getNearestPointByDistance(mouseX, mouseY, points, 22) ||
      getNearestPointByX(mouseX, points, 28);

    if (!nearest?.trade?.id) return;

    if (onPointClick) {
      onPointClick(nearest.trade);
      return;
    }

    emitOpenTrade(nearest.trade.id);
  };

  target.__equityHoverHandler = handleMouseMove;
  target.__equityLeaveHandler = handleMouseLeave;
  target.__equityClickHandler = handleClick;

  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseleave", handleMouseLeave);
  canvas.addEventListener("click", handleClick);
}

export function drawWeekdayBars(canvas: HTMLCanvasElement, trades: Trade[]) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const w = rect.width;
  const h = rect.height;
  const pad = 28;

  ctx.clearRect(0, 0, w, h);

  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const values = [0, 0, 0, 0, 0, 0, 0];

  trades.forEach((t) => {
    const d = new Date(t.date);
    const idx = (d.getDay() + 6) % 7;
    values[idx] += Number(t.pnl) || 0;
  });

  drawGrid(ctx, w, h, pad);

  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const zeroY = h / 2;

  ctx.strokeStyle = "rgba(125,170,220,.16)";
  ctx.beginPath();
  ctx.moveTo(pad, zeroY);
  ctx.lineTo(w - pad, zeroY);
  ctx.stroke();

  const step = (w - pad * 2) / days.length;

  values.forEach((v, i) => {
    const x = pad + i * step + step * 0.15;
    const bw = step * 0.7;
    const barH = (Math.abs(v) / maxAbs) * (h / 2 - pad);
    const y = v >= 0 ? zeroY - barH : zeroY;

    ctx.fillStyle = v >= 0 ? "#2fd7ff" : "#ff6b81";
    ctx.shadowColor = v >= 0 ? "rgba(47,215,255,.25)" : "rgba(255,107,129,.2)";
    ctx.shadowBlur = 10;
    ctx.fillRect(x, y, bw, barH);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#98b5d4";
    ctx.font = "12px Manrope, Arial";
    ctx.fillText(days[i], x + 8, h - 8);
  });
}

export function drawDonut(canvas: HTMLCanvasElement, trades: Trade[]) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const total = wins + losses;
  const wr = total ? wins / total : 0;

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.24;

  ctx.lineCap = "round";
  ctx.lineWidth = 16;

  ctx.strokeStyle = "rgba(125,170,220,.10)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (total === 0) return;

  if (wr > 0) {
    ctx.strokeStyle = "#2fd7ff";
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wr);
    ctx.stroke();
  }

  if (wr < 1) {
    ctx.strokeStyle = "#ff475f";
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2 + Math.PI * 2 * wr, -Math.PI / 2 + Math.PI * 2);
    ctx.stroke();
  }
}