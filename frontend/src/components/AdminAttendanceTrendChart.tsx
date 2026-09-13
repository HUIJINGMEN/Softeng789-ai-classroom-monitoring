import { useEffect, useMemo, useRef, useState } from 'react';
import SelectMenu from './SelectMenu';
import { IconTrendLine } from './icons';
import { buildChart, chartSessionLabel, type ChartPoint } from '../lib/chart';
import {
  ALL_STUDENT_LEVELS,
  ALL_ROOMS,
  ATTENDANCE_RANGE_OPTIONS,
  attendanceCountsForLevel,
  attendanceRangeStart,
  percentageOf,
  sessionCampusName,
  type AttendanceCounts,
  type AttendanceLevelFilter,
  type AttendanceRangeDays
} from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/classroomApi';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { STUDENT_LEVEL_OPTIONS } from '../lib/studentLevels';
import type { AttendanceStatus, Session, Student } from '../types';

const TOOLTIP_WIDTH = 168;
const TOOLTIP_HEIGHT = 96;
const DAY_AGGREGATION_THRESHOLD = 10;
const SPARSE_POINT_THRESHOLD = 3;
const CHART_VIEWBOX_HEIGHT = 176;
const DEFAULT_CHART_VIEWBOX_WIDTH = 520;

interface TrendPointMeta {
  title: string;
  dateLabel: string;
  present: number;
  late: number;
  absent: number;
  unknown: number;
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
  readonly students: readonly Student[];
  readonly countsForSession: (sessionId: string) => AttendanceCounts;
  readonly attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus;
  readonly campus: string;
  readonly room: string;
  readonly level: AttendanceLevelFilter;
  readonly rangeDays: AttendanceRangeDays;
  readonly onCampusChange: (campus: string) => void;
  readonly onRoomChange: (room: string) => void;
  readonly onLevelChange: (level: AttendanceLevelFilter) => void;
  readonly onRangeDaysChange: (range: AttendanceRangeDays) => void;
  readonly onResetFilters: () => void;
  readonly onGoToSession: (sessionId: string) => void;
}

export default function AdminAttendanceTrendChart({
  sessions,
  students,
  countsForSession,
  attendanceStatusFor,
  campus,
  room,
  level,
  rangeDays,
  onCampusChange,
  onRoomChange,
  onLevelChange,
  onRangeDaysChange,
  onResetFilters,
  onGoToSession
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_VIEWBOX_WIDTH);
  const chartRef = useRef<SVGSVGElement>(null);

  const campusOptions = useMemo(
    () => [
      { value: 'All campuses', label: 'All campuses' },
      ...Array.from(new Set(sessions.map(sessionCampusName)))
        .sort((a, b) => a.localeCompare(b))
        .map((campus) => ({ value: campus, label: campus }))
    ],
    [sessions]
  );

  const levelOptions = useMemo(
    () => [
      { value: ALL_STUDENT_LEVELS, label: 'All levels' },
      ...STUDENT_LEVEL_OPTIONS
    ],
    []
  );

  const roomOptions = useMemo(() => {
    const availableRooms = new Map<string, string>();
    for (const session of sessions) {
      if (campus !== 'All campuses' && sessionCampusName(session) !== campus) continue;
      const value = sessionRoomLabel(session);
      const label = campus === 'All campuses' ? value : session.room;
      availableRooms.set(value, label);
    }
    return [
      { value: ALL_ROOMS, label: ALL_ROOMS },
      ...Array.from(availableRooms, ([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label))
    ];
  }, [campus, sessions]);

  useEffect(() => {
    if (!campusOptions.some((option) => option.value === campus)) {
      onCampusChange('All campuses');
    }
  }, [campusOptions, campus, onCampusChange]);

  useEffect(() => {
    if (!roomOptions.some((option) => option.value === room)) {
      onRoomChange(ALL_ROOMS);
    }
  }, [onRoomChange, room, roomOptions]);

  const todayIso = formatIsoDateInAuckland(new Date());

  const rangeStartIso = useMemo(
    () => attendanceRangeStart(todayIso, rangeDays),
    [rangeDays, todayIso]
  );

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status !== 'Cancelled' &&
          session.status !== 'Scheduled' &&
          (campus === 'All campuses' || sessionCampusName(session) === campus) &&
          (room === ALL_ROOMS || sessionRoomLabel(session) === room) &&
          session.date >= rangeStartIso &&
          session.date <= todayIso
      ),
    [sessions, campus, room, rangeStartIso, todayIso]
  );

  const scopedSessions = useMemo(
    () =>
      filteredSessions
        .map((session) => ({
          session,
          counts: attendanceCountsForLevel(
            session,
            level,
            students,
            attendanceStatusFor,
            countsForSession
          )
        }))
        .filter(({ counts }) => counts.total > 0)
        .sort((a, b) =>
          a.session.date < b.session.date ? -1 : a.session.date > b.session.date ? 1 : 0
        ),
    [attendanceStatusFor, countsForSession, filteredSessions, level, students]
  );

  // A handful of real sessions plot one point each with full class/room detail. Once there are
  // enough to crowd the axis — or once any single day has more than one session, which would
  // otherwise repeat the same date label on adjacent points — roll them up per day instead.
  const uniqueSessionDateCount = new Set(scopedSessions.map(({ session }) => session.date)).size;
  const aggregateByDay =
    scopedSessions.length > DAY_AGGREGATION_THRESHOLD ||
    uniqueSessionDateCount < scopedSessions.length;

  const { points, pointMeta } = useMemo(() => {
    if (aggregateByDay) {
      const byDay = new Map<
        string,
        { date: string; dateLabel: string; present: number; late: number; absent: number; unknown: number; total: number; sessions: number }
      >();
      for (const { session, counts } of scopedSessions) {
        const entry = byDay.get(session.date) ?? {
          date: session.date,
          dateLabel: session.dateLabel,
          present: 0,
          late: 0,
          absent: 0,
          unknown: 0,
          total: 0,
          sessions: 0
        };
        entry.present += counts.present;
        entry.late += counts.late;
        entry.absent += counts.absent;
        entry.unknown += counts.unknown;
        entry.total += counts.total;
        entry.sessions += 1;
        byDay.set(session.date, entry);
      }
      const days = Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
      const builtPoints: ChartPoint[] = days.map((day) => ({
        label: day.dateLabel.replace(/(?:,\s*|\s+)\d{4}$/, ''),
        sub: `${day.sessions} session${day.sessions === 1 ? '' : 's'}`,
        rate: percentageOf(day.present + day.late, day.total, 0),
        present: day.present,
        pending: 0
      }));
      const builtMeta: TrendPointMeta[] = days.map((day) => ({
        title: `${day.sessions} session${day.sessions === 1 ? '' : 's'}`,
        dateLabel: day.dateLabel,
        present: day.present,
        late: day.late,
        absent: day.absent,
        unknown: day.unknown,
        total: day.total,
        sessionId: null
      }));
      return { points: builtPoints, pointMeta: builtMeta };
    }

    const builtPoints: ChartPoint[] = scopedSessions.map(({ session, counts }) => {
      return {
        label: session.dateLabel.replace(/(?:,\s*|\s+)\d{4}$/, ''),
        sub: chartSessionLabel(session),
        rate: counts.rate,
        present: counts.present,
        pending: 0
      };
    });
    const builtMeta: TrendPointMeta[] = scopedSessions.map(({ session, counts }) => {
      return {
        title: `${session.course} · ${sessionRoomLabel(session)}`,
        dateLabel: session.dateLabel,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        unknown: counts.unknown,
        total: counts.total,
        sessionId: session.id
      };
    });
    return { points: builtPoints, pointMeta: builtMeta };
  }, [scopedSessions, aggregateByDay]);

  useEffect(() => {
    const svg = chartRef.current;
    if (!svg) return;

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

  const chart = buildChart(points, chartWidth);
  const showTrendLine = points.length > SPARSE_POINT_THRESHOLD;
  const visibleTickCapacity = Math.max(4, Math.floor((chart.axisRight - chart.axisLeft) / 76));
  const tickLabelStride = Math.max(1, Math.ceil(points.length / visibleTickCapacity));

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
  const chartIsFiltered =
    campus !== 'All campuses' ||
    room !== ALL_ROOMS ||
    level !== ALL_STUDENT_LEVELS ||
    rangeDays !== '30';
  const trendEmptyMessage = chartIsFiltered
    ? 'No attendance matches the selected scope.'
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
    <section className="card chart dashboard-trend dashboard-enter stagger-4">
      <div className="card__body">
        <div className="card__title-row dashboard-trend__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconTrendLine />
            </span>
            <div>
              <div className="card__title">Attendance Trend</div>
              <div className="card__sub card__sub--chart">
              Attendance rate over time for the selected campus, room and student level
              </div>
            </div>
          </div>
          {chartIsFiltered && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={onResetFilters}>
              Reset filters
            </button>
          )}
        </div>

        <div className="chart__filters" aria-label="Attendance analysis filters">
          <div className="field chart__filter">
            <span>Campus</span>
            <SelectMenu
              value={campus}
              options={campusOptions}
              ariaLabel="Filter attendance trend by campus"
              onChange={(nextCampus) => {
                onCampusChange(nextCampus);
                onRoomChange(ALL_ROOMS);
                setHover(null);
              }}
            />
          </div>
          <div className="field chart__filter">
            <span>Room</span>
            <SelectMenu
              value={room}
              options={roomOptions}
              ariaLabel="Filter attendance trend by room"
              onChange={(nextRoom) => {
                onRoomChange(nextRoom);
                setHover(null);
              }}
            />
          </div>
          <div className="field chart__filter">
            <span>Level</span>
            <SelectMenu
              value={level}
              options={levelOptions}
              ariaLabel="Filter attendance trend by student level"
              onChange={(nextLevel) => {
                onLevelChange(nextLevel);
                setHover(null);
              }}
            />
          </div>
          <div className="field chart__filter">
            <span>Time</span>
            <SelectMenu
              value={rangeDays}
              options={ATTENDANCE_RANGE_OPTIONS}
              ariaLabel="Filter attendance trend by time range"
              onChange={(range) => {
                onRangeDaysChange(range);
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
                  key={`${campus}-${room}-${level}-${rangeDays}`}
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
              DATE →
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
                role={pointMeta[zone.index]?.sessionId ? 'button' : undefined}
                tabIndex={pointMeta[zone.index]?.sessionId ? 0 : undefined}
                aria-label={
                  pointMeta[zone.index]?.sessionId
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
                  {tooltipMeta.total} expected · {tooltipMeta.unknown} not recorded
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
