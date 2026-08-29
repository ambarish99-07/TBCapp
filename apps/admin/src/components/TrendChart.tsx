import { useState } from "react";

export interface TrendPoint {
  label: string;
  value: number;
  /** Shown in the hover tooltip under the value — e.g. an order count alongside a revenue value. */
  secondaryLabel?: string;
}

const WIDTH = 720;
const HEIGHT = 220;
const PADDING_X = 16;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 26;

/** Generic inline-SVG chart — a line+area (`variant="line"`) or a bar chart (`variant="bar"`) over
 * an arbitrary set of {label, value} points. Used for both the Revenue and Order Summary cards on
 * the Dashboard, each switchable between Monthly/Weekly/Today granularity by just swapping which
 * `points` array is passed in. */
export function TrendChart({ points, variant = "line", formatValue }: { points: TrendPoint[]; variant?: "line" | "bar"; formatValue: (n: number) => string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const plotWidth = WIDTH - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const barWidth = points.length > 0 ? (plotWidth / points.length) * 0.55 : 0;

  const coords = points.map((p, i) => ({
    x: PADDING_X + i * stepX,
    y: PADDING_TOP + plotHeight - (p.value / maxValue) * plotHeight,
    ...p,
  }));

  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x},${PADDING_TOP + plotHeight} L${coords[0].x},${PADDING_TOP + plotHeight} Z`
      : "";
  const hovered = hoverIndex != null ? coords[hoverIndex] : null;
  const gradientId = variant === "line" ? "trendFillLine" : "trendFillBar";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {variant === "line" ? (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          coords.map((p, i) => (
            <rect
              key={i}
              x={p.x - barWidth / 2}
              y={p.y}
              width={barWidth}
              height={PADDING_TOP + plotHeight - p.y}
              rx={4}
              fill={i === hoverIndex ? "var(--color-primary-dark)" : "var(--color-primary)"}
              opacity={i === hoverIndex ? 1 : 0.8}
            />
          ))
        )}

        {coords.map((p, i) => (
          <g key={p.label + i}>
            <rect
              x={PADDING_X + i * stepX - stepX / 2}
              y={0}
              width={stepX || plotWidth}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((current) => (current === i ? null : current))}
            />
            {variant === "line" && <circle cx={p.x} cy={p.y} r={i === hoverIndex ? 5 : 3.5} fill="var(--color-primary)" pointerEvents="none" />}
            {p.label && (
              <text x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-muted)">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs shadow-lg"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
        >
          <p className="font-bold text-text">{formatValue(hovered.value)}</p>
          {hovered.secondaryLabel && <p className="text-muted">{hovered.secondaryLabel}</p>}
        </div>
      )}
    </div>
  );
}
