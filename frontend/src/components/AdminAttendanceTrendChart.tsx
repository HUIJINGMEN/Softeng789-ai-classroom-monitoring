import { useEffect, useMemo, useState } from 'react';
import SelectMenu from './SelectMenu';
import { IconTrendLine } from './icons';
import { buildChart, buildRoomOptions, chartSessionLabel, type ChartPoint } from '../lib/chart';
import type { Session } from '../types';

const TOOLTIP_WIDTH = 168;
const TOOLTIP_HEIGHT = 96;
const DAY_AGGREGATION_THRESHOLD = 10;
const SPARSE_POINT_THRESHOLD = 3;

const TIME_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' }
];

interface TrendPointMeta {
  title: string;
  dateLabel: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  /** Only set in per-session mode — a day-aggregated point has no single session to jump to. */
  sessionId: string | null;
}

/** Same thresholds as the "Lowest Attendance" table's rate coloring, as an SVG fill colour
 * instead of a CSS class — keeps the chart's bars/dots on the same red/amber/green severity
 * language as the rest of the dashboard instead of a single flat accent tone. */
function rateFillColor(rate: number): string {
  if (rate < 50) return 'var(--danger)';
  if (rate < 65) return 'var(--warn)';
  return 'var(--ok)';
}

interface Props {
  readonly sessions: readonly Session[];
  readonly courseOptions: readonly string[];
  readonly countsForSession: (sessionId: string) => { present: number; late: number; absent: number; total: number; rate: number };
  readonly onGoToSession: (sessionId: string) => void;
  /** Lets the parent decide whether to stretch this card and its sibling to equal height — it
   *  only makes sense to do that once at least one of them actually has something to show. */
  readonly onHasDataChange?: (hasData: boolean) => void;
}

export default function AdminAttendanceTrendChart({
  sessions,
  courseOptions,
  countsForSession,
  onGoToSession,
  onHasDataChange
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [chartCourse, setChartCourse] = useState('All courses');
  const [chartRoom, setChartRoom] = useState('All rooms');
  const [chartRangeDays, setChartRangeDays] = useState('7');

  const roomOptions = useMemo(() => buildRoomOptions(sessions), [sessions]);

  useEffect(() => {
    if (!courseOptions.includes(chartCourse)) {
      setChartCourse('All courses');
    }
  }, [courseOptions, chartCourse]);

  useEffect(() => {
    if (!roomOptions.some((option) => option.value === chartRoom)) {
      setChartRoom('All rooms');
    }
  }, [chartRoom, roomOptions]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const rangeStartIso = useMemo(() => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - (Number(chartRangeDays) - 1));
    return start.toISOString().slice(0, 10);
  }, [chartRangeDays, todayIso]);

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status !== 'Cancelled' &&
          (chartCourse === 'All courses' || session.course === chartCourse) &&
          (chartRoom === 'All rooms' || session.room === chartRoom) &&
          session.date >= rangeStartIso &&
          session.date <= todayIso
      ),
    [sessions, chartCourse, chartRoom, rangeStartIso, todayIso]
  );

  const sortedRangeSessions = useMemo(
    () => [...filteredSessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [filteredSessions]
  );

  // A handful of real sessions plot one point each with full class/room detail. Once there are
  // enough to crowd the axis — or once any single day has more than one session, which would
  // otherwise repeat the same date label on adjacent points — roll them up per day instead.
  const uniqueSessionDateCount = new Set(sortedRangeSessions.map((session) => session.date)).size;
  const aggregateByDay =
    sortedRangeSessions.length > DAY_AGGREGATION_THRESHOLD ||
    uniqueSessionDateCount < sortedRangeSessions.length;

  const { points, pointMeta } = useMemo(() => {
    if (aggregateByDay) {
      const byDay = new Map<
        string,
        { date: string; dateLabel: string; present: number; late: number; absent: number; total: number; sessions: number }
      >();
      for (const session of sortedRangeSessions) {
        const counts = countsForSession(session.id);
        const entry = byDay.get(session.date) ?? {
          date: session.date,
          dateLabel: session.dateLabel,
          present: 0,
          late: 0,
          absent: 0,
          total: 0,
          sessions: 0
        };
        entry.present += counts.present;
        entry.late += counts.late;
        entry.absent += counts.absent;
        entry.total += counts.total;
        entry.sessions += 1;
        byDay.set(session.date, entry);
      }
      const days = Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
      const builtPoints: ChartPoint[] = days.map((day) => ({
        label: day.dateLabel.replace(', 2026', ''),
        sub: `${day.sessions} session${day.sessions === 1 ? '' : 's'}`,
        rate: day.total === 0 ? 0 : Math.round(((day.present + day.late) / day.total) * 100),
        present: day.present,
        pending: 0
      }));
      const builtMeta: TrendPointMeta[] = days.map((day) => ({
        title: `${day.sessions} session${day.sessions === 1 ? '' : 's'}`,
        dateLabel: day.dateLabel,
        present: day.present,
        late: day.late,
        absent: day.absent,
        total: day.total,
        sessionId: null
      }));
      return { points: builtPoints, pointMeta: builtMeta };
    }

    const builtPoints: ChartPoint[] = sortedRangeSessions.map((session) => {
      const counts = countsForSession(session.id);
      return {
        label: session.dateLabel.replace(', 2026', ''),
        sub: chartSessionLabel(session),
        rate: counts.rate,
        present: counts.present,
        pending: 0
      };
    });
    const builtMeta: TrendPointMeta[] = sortedRangeSessions.map((session) => {
      const counts = countsForSession(session.id);
      return {
        title: `${session.course} · ${session.room}`,
        dateLabel: session.dateLabel,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        total: counts.total,
        sessionId: session.id
      };
    });
    return { points: builtPoints, pointMeta: builtMeta };
  }, [sortedRangeSessions, aggregateByDay, countsForSession]);

  useEffect(() => {
    onHasDataChange?.(points.length > 0);
  }, [points.length, onHasDataChange]);

  const chart = buildChart(points);
  const showTrendLine = points.length > SPARSE_POINT_THRESHOLD;
  // The 340-unit-wide axis only has room for about 6 date labels before adjacent ones start
  // overlapping — thin them out rather than letting the text run together once there are more.
  const tickLabelStride = Math.max(1, Math.ceil(points.length / 6));

  // buildChart spaces bars assuming they'll fill the row (many points); with only 1-3 they'd sit
  // as a few small rects hugging the left edge with a huge empty gap to their right. Space them
  // out evenly across the full axis instead so a sparse chart still reads as a deliberate visual,
  // not a leftover fragment of a bigger one. The hotspot/tooltip positions below are derived from
  // these same bars so hover and click targets stay lined up with what's actually drawn.
  const sparseBars = !showTrendLine
    ? (() => {
        const count = Math.max(points.length, 1);
        const totalWidth = chart.axisRight - chart.axisLeft;
        const width = Math.min(64, totalWidth / count - 24);
        const gap = (totalWidth - width * count) / (count + 1);
        return chart.bars.map((bar, i) => ({
          ...bar,
          x: chart.axisLeft + gap * (i + 1) + width * i,
          width
        }));
      })()
    : [];
  const pointCenterX = (index: number) =>
    showTrendLine ? chart.dots[index].cx : sparseBars[index].x + sparseBars[index].width / 2;

  const tooltipDot =
    hover !== null && hover < points.length
      ? { cx: pointCenterX(hover), cy: showTrendLine ? chart.dots[hover].cy : chart.bars[hover].y }
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
  const chartIsFiltered = chartCourse !== 'All courses' || chartRoom !== 'All rooms';
  const trendEmptyMessage = chartIsFiltered
    ? 'No sessions match the selected class and room.'
    : 'No attendance data available for this period.';
  const trendEmptyHint = chartIsFiltered
    ? null
    : 'Attendance data will appear after a classroom session is completed.';
  const areaPath =
    points.length > 0
      ? `${chart.dots[0].cx},${chart.axisY} ${chart.line} ${chart.dots[chart.dots.length - 1].cx},${chart.axisY}`
      : '';

  const goToSession = (index: number) => {
    const sessionId = pointMeta[index]?.sessionId;
    if (!sessionId) return;
    onGoToSession(sessionId);
  };

  return (
    <section className="card chart dashboard-enter stagger-4">
      <div className="card__body">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconTrendLine />
          </span>
          <div>
            <div className="card__title">Attendance Trend</div>
            <div className="card__sub card__sub--chart">Attendance rate by session over time</div>
          </div>
        </div>

        <div className="chart__filters" aria-label="Attendance trend filters">
          <div className="field chart__filter">
            <span>Class</span>
            <SelectMenu
              value={chartCourse}
              options={courseOptions.map((course) => ({ value: course, label: course }))}
              ariaLabel="Filter attendance trend by class"
              onChange={(course) => {
                setChartCourse(course);
                setHover(null);
              }}
            />
          </div>
          <div className="field chart__filter">
            <span>Room</span>
            <SelectMenu
              value={chartRoom}
              options={roomOptions}
              ariaLabel="Filter attendance trend by room"
              onChange={(room) => {
                setChartRoom(room);
                setHover(null);
              }}
            />
          </div>
          <div className="field chart__filter">
            <span>Range</span>
            <SelectMenu
              value={chartRangeDays}
              options={TIME_RANGE_OPTIONS}
              ariaLabel="Filter attendance trend by time range"
              onChange={(range) => {
                setChartRangeDays(range);
                setHover(null);
              }}
            />
          </div>
        </div>

        <div className="chart__legend">
          <span className="chart__legend-item">
            <span className="chart__swatch" />
            Attendance rate (%)
          </span>
          {aggregateByDay && (
            <span className="chart__legend-item chart__legend-item--muted">Aggregated per day</span>
          )}
          <span className="mono chart__range">
            {points.length === 0 ? 'No sessions' : `${rangeStartIso} – ${todayIso}`}
          </span>
        </div>

        {points.length === 0 ? (
          <div className="empty empty--chart">
            <div className="empty__title">{trendEmptyMessage}</div>
            {trendEmptyHint && <div className="empty__hint">{trendEmptyHint}</div>}
          </div>
        ) : (
          <svg className="chart__canvas" viewBox="0 0 340 176" role="img" aria-label="Attendance rate by session">
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
                  key={`${chartCourse}-${chartRoom}-${chartRangeDays}`}
                  points={chart.line}
                  fill="none"
                  stroke="var(--accent-hi)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  className="chart-line--draw"
                />
                {chart.dots.map((dot, i) => (
                  <circle
                    key={i}
                    cx={dot.cx}
                    cy={dot.cy}
                    r={4}
                    fill={rateFillColor(points[i].rate)}
                    stroke="var(--panel)"
                    strokeWidth={2}
                  />
                ))}
              </>
            ) : (
              <g className="chart-bars">
                {sparseBars.map((bar, i) => (
                  <rect
                    key={i}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    rx={6}
                    fill={rateFillColor(points[i].rate)}
                    className={`stagger-${Math.min(i, 7)}`}
                  />
                ))}
              </g>
            )}

            {points.map((point, i) => (
              <text
                key={i}
                x={pointCenterX(i)}
                y={Math.max(11, (showTrendLine ? chart.dots[i].cy : chart.bars[i].y) - 9)}
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
            {chart.ticks.map((tick, i) => {
              const tickX = pointCenterX(i);
              return i % tickLabelStride === 0 ? (
                <g key={`${tick.label}-${tick.sub}-${i}`}>
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
                  key={`${tick.label}-${tick.sub}-${i}`}
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
              SESSION DATE →
            </text>

            {chart.hotspots.map((zone) => (
              <rect
                key={zone.index}
                x={pointCenterX(zone.index) - 24}
                y={10}
                width={48}
                height={126}
                fill="transparent"
                className={pointMeta[zone.index]?.sessionId ? 'chart__hotspot chart__hotspot--clickable' : 'chart__hotspot'}
                onMouseEnter={() => setHover(zone.index)}
                onMouseLeave={() => setHover(null)}
                onClick={() => goToSession(zone.index)}
              />
            ))}

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
                <text
                  x={tooltipBox.x + 11}
                  y={tooltipBox.y + 17}
                  fill="var(--text)"
                  className="chart__tooltip-main"
                >
                  {tooltipMeta.title}
                </text>
                <text
                  x={tooltipBox.x + 11}
                  y={tooltipBox.y + 32}
                  fill="var(--muted)"
                  className="chart__tooltip-sub"
                >
                  {tooltipMeta.dateLabel}
                </text>
                <text
                  x={tooltipBox.x + 11}
                  y={tooltipBox.y + 50}
                  fill="var(--accent-hi)"
                  className="chart__tooltip-main"
                >
                  {tooltipRate}% attendance
                </text>
                <text
                  x={tooltipBox.x + 11}
                  y={tooltipBox.y + 67}
                  fill="var(--muted)"
                  className="chart__tooltip-sub"
                >
                  {tooltipMeta.present} present · {tooltipMeta.late} late · {tooltipMeta.absent} absent
                </text>
                <text
                  x={tooltipBox.x + 11}
                  y={tooltipBox.y + 83}
                  fill="var(--muted-2)"
                  className="chart__tooltip-sub"
                >
                  {tooltipMeta.total} recorded
                </text>
              </g>
            )}
          </svg>
        )}

        {points.length > 0 && (
          <div className="chart__hint">
            {aggregateByDay
              ? `Hover a ${showTrendLine ? 'point' : 'bar'} for its detail`
              : `Click a ${showTrendLine ? 'point' : 'bar'} to view session details`}
          </div>
        )}
      </div>
    </section>
  );
}
