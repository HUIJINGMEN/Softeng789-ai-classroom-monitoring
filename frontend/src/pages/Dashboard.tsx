import { buildChart, sparkline, type ChartPoint } from '../lib/chart';
import SelectMenu from '../components/SelectMenu';
import { eventSessionLabel, eventSubjectLabel, sessionDisplayName } from '../lib/eventDisplay';
import { statusClass } from '../lib/format';
import type { Console } from '../hooks/useConsole';
import { useCountUp } from '../hooks/useCountUp';
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '../types';

export default function Dashboard({ console: c }: { console: Console }) {
  const [hover, setHover] = useState<number | null>(null);
  const [chartCourse, setChartCourse] = useState('All courses');
  const [chartRoom, setChartRoom] = useState('All rooms');

  const recentSessions = c.sessions.slice(0, 4);
  const roomOptions = useMemo(() => buildRoomOptions(c.sessions), [c.sessions]);

  useEffect(() => {
    if (!c.courseOptions.includes(chartCourse)) {
      setChartCourse('All courses');
    }
  }, [c.courseOptions, chartCourse]);

  useEffect(() => {
    if (!roomOptions.some((option) => option.value === chartRoom)) {
      setChartRoom('All rooms');
    }
  }, [chartRoom, roomOptions]);

  const chartSessions = useMemo(
    () =>
      latestSessionByDate(
        c.sessions.filter(
          (session) =>
            (chartCourse === 'All courses' || session.course === chartCourse) &&
            (chartRoom === 'All rooms' || session.room === chartRoom)
        ),
        8
      ).reverse(),
    [c.sessions, chartCourse, chartRoom]
  );
  const points: ChartPoint[] = chartSessions.map((session) => {
    const counts = c.countsForSession(session.id);
    return {
      label: session.dateLabel.replace(', 2026', ''),
      sub: chartSessionLabel(session),
      rate: counts.rate,
      present: counts.present,
      pending: c.events.filter((e) => e.sessionId === session.id && e.status === 'Pending Review')
        .length
    };
  });
  const chart = buildChart(points);
  const tooltip = hover === null || hover >= points.length ? null : chart.tooltipFor(hover);
  const latestSession = c.sessions.find((session) => session.status === 'Live') ?? c.sessions[0];
  const enrolledCourseCount = Math.max(0, c.courseOptions.length - 1);
  const studentSpark = sparkline(Array(5).fill(c.students.length));

  const currentSessionPendingEvents = c.events.filter(
    (event) => event.sessionId === c.sessionId && event.status === 'Pending Review'
  );
  const pending = currentSessionPendingEvents.length;

  const totalStudentsCount = useCountUp(c.filteredStudents.length);
  const presentTodayCount = useCountUp(c.counts.present + c.counts.late);
  const attendanceRateCount = useCountUp(c.counts.rate);
  const pendingEventsCount = useCountUp(pending);

  const stats = [
    {
      label: 'Total students',
      value: String(totalStudentsCount),
      delta: `Across ${enrolledCourseCount} enrolled courses`,
      deltaTone: 'muted',
      spark: studentSpark,
      sparkColor: 'var(--muted-2)'
    },
    {
      label: 'Present today',
      value: String(presentTodayCount),
      delta: `${c.counts.late} marked late`,
      deltaTone: 'warn',
      spark: sparkline(points.map((p) => p.present)),
      sparkColor: 'var(--muted-2)'
    },
    {
      label: 'Attendance rate',
      value: `${attendanceRateCount}%`,
      delta: `${c.activeSession.course} · ${c.activeSession.room}`,
      deltaTone: 'muted',
      spark: sparkline(points.map((p) => p.rate)),
      sparkColor: 'var(--muted-2)'
    },
    {
      label: 'Pending AI events',
      value: String(pendingEventsCount),
      delta: pending > 0 ? 'Awaiting teacher review →' : 'All caught up',
      deltaTone: pending > 0 ? 'warn' : 'ok',
      spark: sparkline(points.map((p) => p.pending)),
      sparkColor: pending > 0 ? 'var(--warn)' : 'var(--muted-2)',
      alert: pending > 0,
      onClick: () => {
        c.setReviewFilter('Pending Review');
        c.setPage('events');
      }
    }
  ];

  return (
    <div className="page__inner">
      <div className="stat-grid">
        {stats.map((stat, index) => {
          const body = (
            <>
              <div className="stat__label">{stat.label}</div>
              <div className="stat__value">{stat.value}</div>
              <svg className="stat__spark" viewBox="0 0 100 26" preserveAspectRatio="none">
                <polyline
                  points={stat.spark}
                  fill="none"
                  stroke={stat.sparkColor}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className={`stat__delta stat__delta--${stat.deltaTone}`}>
                {stat.delta}
              </div>
            </>
          );
          const className = `stat dashboard-enter stagger-${index}${stat.alert ? ' stat--alert' : ''}`;

          return stat.onClick ? (
            <button key={stat.label} type="button" className={className} onClick={stat.onClick}>
              {body}
            </button>
          ) : (
            <div key={stat.label} className={className}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid-main">
        <section className="card dashboard-enter stagger-4">
          <div className="card__head">
            <div className="card__title">Recent classroom sessions</div>
            <div className="card__actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (latestSession) {
                    c.selectSession(latestSession.id);
                  }
                  c.setPage('live');
                }}
              >
                Open latest session
              </button>
            </div>
          </div>

          {recentSessions.length === 0 ? (
            <div className="empty empty--inline">
              No classroom sessions have been created yet.
            </div>
          ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Course</th>
                <th>Date</th>
                <th>Present</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((session) => {
                const counts = c.countsForSession(session.id);
                return (
                  <tr
                    key={session.id}
                    className="table__row-action"
                    onClick={() => {
                      c.selectSession(session.id);
                      c.setPage('attendance');
                    }}
                  >
                    <td>
                      <div className="cell-strong">{session.title}</div>
                      <div className="cell-sub">
                        {sessionDisplayName(session)}
                      </div>
                    </td>
                    <td>{session.course}</td>
                    <td>{session.dateLabel}</td>
                    <td className="mono">
                      {counts.present + counts.late} / {counts.total}
                    </td>
                    <td>
                      <span className={statusClass(session.status)}>{session.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </section>

        <section className="card chart dashboard-enter stagger-5">
          <div className="card__body">
            <div className="card__title">Attendance summary</div>
            <div className="card__sub card__sub--chart">
              Attendance trend by course or classroom
            </div>

            <div className="chart__filters" aria-label="Attendance trend filters">
              <div className="field chart__filter">
                <span>Course</span>
                <SelectMenu
                  value={chartCourse}
                  options={c.courseOptions.map((course) => ({ value: course, label: course }))}
                  ariaLabel="Filter attendance trend by course"
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
              <span className="mono chart__range">
                {formatChartRange(chartSessions)}
              </span>
            </div>

            {points.length === 0 ? (
              <div className="empty empty--chart">
                No sessions match the selected course and room.
              </div>
            ) : (
            <svg viewBox="0 0 340 176" role="img" aria-label="Attendance rate by session">
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

            {points.length > 0 && <div className="chart__hint">
              Hover a session for its detail
            </div>}
          </div>
        </section>
      </div>

      <section className="card dashboard-enter stagger-6">
        <div className="card__head">
          <div>
            <div className="card__title">Recent candidate events</div>
            <div className="card__sub">
              AI-generated events are candidate observations and require teacher review.
            </div>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              c.setReviewFilter('Pending Review');
              c.setPage('events');
            }}
          >
            Review session events
          </button>
        </div>

        {currentSessionPendingEvents.slice(0, 4).map((event) => (
          <div key={event.id} className="event-row">
            <div className="evidence-slot evidence-slot--row">
              Evidence
            </div>
            <div className="event-row__main">
              <div className="cell-strong">{event.type}</div>
              <div className="cell-sub">
                {eventSubjectLabel(event, c.students)} · {eventSessionLabel(event, c.sessions)} ·{' '}
                {event.start} · {event.duration}
              </div>
            </div>
            <div className="mono event-row__confidence">
              conf {event.confidence.toFixed(2)}
            </div>
            <span className={`${statusClass(event.status)} event-row__status`}>
              {event.status}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                c.setModalId(event.id);
                c.setCorrecting(false);
              }}
            >
              View evidence
            </button>
          </div>
        ))}

        {currentSessionPendingEvents.length === 0 && (
          <div className="empty empty--inline">
            No pending candidate events for the selected session.
          </div>
        )}
      </section>
    </div>
  );
}

function chartSessionLabel(session: { room: string; course: string }): string {
  return session.room || session.course;
}

function latestSessionByDate(sessions: readonly Session[], limit: number): Session[] {
  const byDate = new Map<string, Session>();

  for (const session of sessions) {
    if (!byDate.has(session.date)) {
      byDate.set(session.date, session);
    }
  }

  return Array.from(byDate.values()).slice(0, limit);
}

function formatChartRange(sessions: readonly Session[]): string {
  if (sessions.length === 0) return 'No sessions';
  if (sessions.length === 1) return sessions[0].dateLabel;
  return `${sessions[0].dateLabel} – ${sessions[sessions.length - 1].dateLabel}`;
}

function buildRoomOptions(sessions: readonly Session[]) {
  return [
    { value: 'All rooms', label: 'All rooms' },
    ...Array.from(new Set(sessions.map((session) => session.room)))
      .sort()
      .map((room) => ({ value: room, label: room }))
  ];
}
