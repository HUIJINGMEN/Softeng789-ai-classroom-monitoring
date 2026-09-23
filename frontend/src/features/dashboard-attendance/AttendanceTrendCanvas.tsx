import { useEffect, useRef, useState } from 'react';
import { buildChart, type ChartPoint } from '../../lib/chart';
import type { TrendPointMeta } from './attendanceTrendModel';

const TOOLTIP_WIDTH = 168;
const TOOLTIP_HEIGHT = 96;
const SPARSE_POINT_THRESHOLD = 3;
const CHART_VIEWBOX_HEIGHT = 176;
const DEFAULT_CHART_VIEWBOX_WIDTH = 520;

function rateFillColor(rate: number): string {
  if (rate < 50) return 'var(--danger)';
  if (rate < 65) return 'var(--warn)';
  return 'var(--ok)';
}

interface Props {
  readonly points: readonly ChartPoint[];
  readonly pointMeta: readonly TrendPointMeta[];
  readonly aggregateByDay: boolean;
  readonly onGoToSession: (sessionId: string) => void;
}

export default function AttendanceTrendCanvas({
  points,
  pointMeta,
  aggregateByDay,
  onGoToSession
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_VIEWBOX_WIDTH);
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = chartRef.current;
    if (!svg) return undefined;

    const updateChartWidth = () => {
      const bounds = svg.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const nextWidth = Math.max(
        340,
        Math.round((bounds.width / bounds.height) * CHART_VIEWBOX_HEIGHT)
      );
      setChartWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) < 2 ? currentWidth : nextWidth
      );
    };

    updateChartWidth();
    const observer = new ResizeObserver(updateChartWidth);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [points.length]);

  const chart = buildChart([...points], chartWidth);
  const showTrendLine = points.length > SPARSE_POINT_THRESHOLD;
  const visibleTickCapacity = Math.max(4, Math.floor((chart.axisRight - chart.axisLeft) / 76));
  const tickLabelStride = Math.max(1, Math.ceil(points.length / visibleTickCapacity));
  const sparseBars = !showTrendLine
    ? (() => {
        const count = Math.max(points.length, 1);
        const totalWidth = chart.axisRight - chart.axisLeft;
        const width = Math.min(64, totalWidth / count - 24);
        const gap = (totalWidth - width * count) / (count + 1);
        return chart.bars.map((bar, index) => ({
          ...bar,
          x: chart.axisLeft + gap * (index + 1) + width * index,
          width
        }));
      })()
    : [];
  const pointCenterX = (index: number) =>
    showTrendLine ? chart.dots[index].cx : sparseBars[index].x + sparseBars[index].width / 2;

  const tooltipDot =
    hover !== null && hover < points.length
      ? {
          cx: pointCenterX(hover),
          cy: showTrendLine ? chart.dots[hover].cy : chart.bars[hover].y
        }
      : null;
  const tooltipMeta = hover !== null && hover < points.length ? pointMeta[hover] : null;
  const tooltipRate = hover !== null && hover < points.length ? points[hover].rate : null;
  const tooltipBox = tooltipDot
    ? {
        x: Math.min(
          Math.max(tooltipDot.cx - TOOLTIP_WIDTH / 2, chart.axisLeft),
          chart.axisRight - TOOLTIP_WIDTH
        ),
        y: Math.max(tooltipDot.cy - TOOLTIP_HEIGHT - 10, 4)
      }
    : null;
  const areaPath = `${chart.dots[0].cx},${chart.axisY} ${chart.line} ${
    chart.dots[chart.dots.length - 1].cx
  },${chart.axisY}`;
  const chartElementLabel = showTrendLine ? 'point' : 'bar';
  const hintAction = aggregateByDay ? 'Hover' : 'Click';
  const hintPurpose = aggregateByDay ? 'for its detail' : 'to view session details';

  const goToSession = (index: number) => {
    const sessionId = pointMeta[index]?.sessionId;
    if (sessionId) onGoToSession(sessionId);
  };

  return (
    <>
      <svg
        ref={chartRef}
        className="chart__canvas"
        viewBox={`0 0 ${chartWidth} ${CHART_VIEWBOX_HEIGHT}`}
        role="img"
        aria-label="Attendance rate by session"
      >
        <defs>
          <linearGradient id="adminTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-hi)" stopOpacity="0.55" />
            <stop offset="65%" stopColor="var(--accent-hi)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--accent-hi)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {chart.grid.map((line) => (
          <g key={line.label}>
            <line
              x1={chart.axisLeft}
              x2={chart.axisRight}
              y1={line.y}
              y2={line.y}
              stroke="var(--line-2)"
            />
            <text
              x={30}
              y={line.y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--muted-2)"
              className="chart__axis-label"
            >
              {line.label}
            </text>
          </g>
        ))}

        {showTrendLine ? (
          <>
            <polygon points={areaPath} fill="url(#adminTrendArea)" />
            <polyline
              points={chart.line}
              fill="none"
              stroke="var(--accent-hi)"
              strokeWidth={2}
              strokeLinejoin="round"
              className="chart-line--draw"
            />
            {chart.dots.map((dot, index) => (
              <circle
                key={pointMeta[index]?.dateLabel ?? index}
                cx={dot.cx}
                cy={dot.cy}
                r={4}
                fill={rateFillColor(points[index].rate)}
                stroke="var(--panel)"
                strokeWidth={2}
              />
            ))}
          </>
        ) : (
          <g className="chart-bars">
            {sparseBars.map((bar, index) => (
              <rect
                key={pointMeta[index]?.dateLabel ?? index}
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx={6}
                fill={rateFillColor(points[index].rate)}
                className={`stagger-${Math.min(index, 7)}`}
              />
            ))}
          </g>
        )}

        {points.map((point, index) => (
          <text
            key={`${point.label}-${index}`}
            x={pointCenterX(index)}
            y={Math.max(11, (showTrendLine ? chart.dots[index].cy : chart.bars[index].y) - 9)}
            textAnchor="middle"
            fill="var(--text-2)"
            className="chart__value-label"
          >
            {point.rate}%
          </text>
        ))}

        <line
          x1={chart.axisLeft}
          x2={chart.axisRight}
          y1={chart.axisY}
          y2={chart.axisY}
          stroke="var(--line-strong)"
        />
        {chart.ticks.map((tick, index) => {
          const tickX = pointCenterX(index);
          return index % tickLabelStride === 0 ? (
            <g key={`${tick.label}-${tick.sub}-${index}`}>
              <line x1={tickX} x2={tickX} y1={chart.axisY} y2={140} stroke="var(--line-strong)" />
              <text x={tickX} y={151} textAnchor="middle" fill="var(--text-3)" className="chart__tick-label">
                {tick.label}
              </text>
              <text x={tickX} y={162} textAnchor="middle" fill="var(--muted-2)" className="chart__tick-sub">
                {tick.sub}
              </text>
            </g>
          ) : (
            <line
              key={`${tick.label}-${tick.sub}-${index}`}
              x1={tickX}
              x2={tickX}
              y1={chart.axisY}
              y2={chart.axisY - 4}
              stroke="var(--line-strong)"
            />
          );
        })}

        <text x={12} y={12} fill="var(--muted-2)" className="chart__axis-title">
          RATE
        </text>
        <text
          x={chart.axisRight}
          y={12}
          textAnchor="end"
          fill="var(--muted-2)"
          className="chart__axis-title"
        >
          DATE →
        </text>

        {chart.hotspots.map((zone) => {
          const isClickable = Boolean(pointMeta[zone.index]?.sessionId);
          return (
            <rect
              key={zone.index}
              x={pointCenterX(zone.index) - 24}
              y={10}
              width={48}
              height={126}
              fill="transparent"
              className={`chart__hotspot${isClickable ? ' chart__hotspot--clickable' : ''}`}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              aria-label={
                isClickable
                  ? `Open attendance for ${pointMeta[zone.index].title}, ${pointMeta[zone.index].dateLabel}`
                  : undefined
              }
              onMouseEnter={() => setHover(zone.index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(zone.index)}
              onBlur={() => setHover(null)}
              onClick={() => goToSession(zone.index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  goToSession(zone.index);
                }
              }}
            />
          );
        })}

        {tooltipDot && tooltipMeta && tooltipBox && (
          <g pointerEvents="none">
            <circle cx={tooltipDot.cx} cy={tooltipDot.cy} r={5} fill="var(--accent-hi)" />
            <rect
              x={tooltipBox.x}
              y={tooltipBox.y}
              width={TOOLTIP_WIDTH}
              height={TOOLTIP_HEIGHT}
              rx={8}
              fill="var(--panel-3)"
              stroke="var(--line-strong)"
            />
            <text x={tooltipBox.x + 11} y={tooltipBox.y + 17} fill="var(--text)" className="chart__tooltip-main">
              {tooltipMeta.title}
            </text>
            <text x={tooltipBox.x + 11} y={tooltipBox.y + 32} fill="var(--muted)" className="chart__tooltip-sub">
              {tooltipMeta.dateLabel}
            </text>
            <text x={tooltipBox.x + 11} y={tooltipBox.y + 50} fill="var(--accent-hi)" className="chart__tooltip-main">
              {tooltipRate}% attendance
            </text>
            <text x={tooltipBox.x + 11} y={tooltipBox.y + 67} fill="var(--muted)" className="chart__tooltip-sub">
              {tooltipMeta.present} present · {tooltipMeta.late} late · {tooltipMeta.absent} absent
            </text>
            <text x={tooltipBox.x + 11} y={tooltipBox.y + 83} fill="var(--muted-2)" className="chart__tooltip-sub">
              {tooltipMeta.total} expected · {tooltipMeta.unknown} not recorded
            </text>
          </g>
        )}
      </svg>

      <div className="chart__hint">
        {`${hintAction} a ${chartElementLabel} ${hintPurpose}`}
      </div>
    </>
  );
}
