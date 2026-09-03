import { useMemo, useState } from 'react';
import SelectMenu from './SelectMenu';
import { IconTrendLine } from './icons';
import { buildChart, buildRoomOptions, formatChartRange, type ChartPoint } from '../lib/chart';
import type { Session } from '../types';

interface Props {
  readonly sessions: readonly Session[];
  readonly chartSessions: readonly Session[];
  readonly points: readonly ChartPoint[];
  readonly chartCourse: string;
  readonly chartRoom: string;
  readonly courseOptions: readonly string[];
  readonly onChartCourseChange: (course: string) => void;
  readonly onChartRoomChange: (room: string) => void;
}

/** The stat cards above this chart share its `points` data for their sparklines (see
 *  Dashboard.tsx), so the course/room filters and the resulting point list live one level up —
 *  this component owns only its own hover/tooltip state and the chart-geometry rendering. */
export default function TeacherAttendanceTrendChart({
  sessions,
  chartSessions,
  points,
  chartCourse,
  chartRoom,
  courseOptions,
  onChartCourseChange,
  onChartRoomChange
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const roomOptions = useMemo(() => buildRoomOptions(sessions), [sessions]);
  const chart = buildChart([...points]);
  const tooltip = hover === null || hover >= points.length ? null : chart.tooltipFor(hover);

  return (
    <section className="card chart dashboard-enter stagger-5">
      <div className="card__body">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconTrendLine />
          </span>
          <div>
            <div className="card__title">Attendance summary</div>
            <div className="card__sub card__sub--chart">Attendance trend by course or classroom</div>
          </div>
        </div>

        <div className="chart__filters" aria-label="Attendance trend filters">
          <div className="field chart__filter">
            <span>Course</span>
            <SelectMenu
              value={chartCourse}
              options={courseOptions.map((course) => ({ value: course, label: course }))}
              ariaLabel="Filter attendance trend by course"
              onChange={(course) => {
                onChartCourseChange(course);
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
                onChartRoomChange(room);
                setHover(null);
              }}
            />
          </div>
        </div>

        <div className="chart__legend">
          <span className="chart__legend-item">
            <span className="chart__swatch" />
            Rate per session
          </span>
          <span className="chart__legend-item">
            <span className="chart__dash" />
            Trend
          </span>
          <span className="mono chart__range">{formatChartRange(chartSessions)}</span>
        </div>

        {points.length === 0 ? (
          <div className="empty empty--chart">No sessions match the selected course and room.</div>
        ) : (
          <svg className="chart__canvas" viewBox="0 0 340 176" role="img" aria-label="Attendance rate by session">
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

            <g className="chart-bars">
              {chart.bars.map((bar, i) => (
                <rect
                  key={i}
                  x={bar.x}
                  y={bar.y}
                  width={30}
                  height={bar.height}
                  rx={4}
                  opacity={0.9}
                  fill={bar.isLatest ? 'var(--accent)' : 'var(--accent-soft)'}
                  stroke={bar.isLatest ? 'none' : 'var(--info-line)'}
                  className={`stagger-${Math.min(i, 7)}`}
                />
              ))}
            </g>

            <polyline
              key={`${chartCourse}-${chartRoom}`}
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
                r={3.2}
                fill="var(--panel)"
                stroke="var(--accent-hi)"
                strokeWidth={2}
              />
            ))}

            <line
              x1={chart.axisLeft}
              x2={chart.axisRight}
              y1={chart.axisY}
              y2={chart.axisY}
              stroke="var(--line-strong)"
            />
            {chart.ticks.map((tick, i) => (
              <g key={`${tick.label}-${tick.sub}-${i}`}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={chart.axisY}
                  y2={140}
                  stroke="var(--line-strong)"
                />
                <text
                  x={tick.x}
                  y={151}
                  textAnchor="middle"
                  fill="var(--text-3)"
                  className="chart__tick-label"
                >
                  {tick.label}
                </text>
                <text
                  x={tick.x}
                  y={162}
                  textAnchor="middle"
                  fill="var(--muted-2)"
                  className="chart__tick-sub"
                >
                  {tick.sub}
                </text>
              </g>
            ))}

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
                x={zone.x}
                y={10}
                width={48}
                height={126}
                fill="transparent"
                className="chart__hotspot"
                onMouseEnter={() => setHover(zone.index)}
                onMouseLeave={() => setHover(null)}
              />
            ))}

            {tooltip && (
              <g pointerEvents="none">
                <circle cx={tooltip.dotX} cy={tooltip.dotY} r={5} fill="var(--accent-hi)" />
                <rect
                  x={tooltip.x}
                  y={tooltip.y}
                  width={132}
                  height={42}
                  rx={7}
                  fill="var(--panel-3)"
                  stroke="var(--line-strong)"
                />
                <text x={tooltip.x + 10} y={tooltip.y + 17} fill="var(--text)" className="chart__tooltip-main">
                  {tooltip.line1}
                </text>
                <text x={tooltip.x + 10} y={tooltip.y + 31} fill="var(--muted)" className="chart__tooltip-sub">
                  {tooltip.line2}
                </text>
              </g>
            )}
          </svg>
        )}

        {points.length > 0 && <div className="chart__hint">Hover a session for its detail</div>}
      </div>
    </section>
  );
}
