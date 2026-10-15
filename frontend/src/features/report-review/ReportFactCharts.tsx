import { formatReportDateRange } from "../../lib/sessionTime";
import type { ReportAttendance, ReportChartSnapshot } from "./types";

const statuses = [
  { key: "present", label: "Present", color: "#426946" },
  { key: "late", label: "Late", color: "#96721b" },
  { key: "absent", label: "Absent", color: "#a55250" },
  { key: "unrecorded", label: "Not recorded", color: "#77736b" },
] as const;

type ChartAudience = "student" | "class" | "overall";
const chartSubject = {
  student: "This student's",
  class: "Class",
  overall: "Overall",
};
const observationScope = {
  student: "for this student",
  class: "across this class",
  overall: "across the reporting scope",
};

/** SVGs remain crisp in PDF; all chart values are also exposed as text. */
function AttendanceDistribution({
  attendance,
}: {
  attendance: ReportAttendance;
}) {
  let offset = 0;
  const segments = statuses.map((status) => {
    const width = attendance.completed
      ? (attendance[status.key] / attendance.completed) * 360
      : 0;
    const segment = {
      ...status,
      width,
      x: offset,
      value: attendance[status.key],
    };
    offset += width;
    return segment;
  });
  return (
    <figure className="report-facts__chart">
      <figcaption>Attendance distribution</figcaption>
      {attendance.completed === 0 ? (
        <p className="report-facts__empty">
          No completed sessions in this scope.
        </p>
      ) : (
        <svg
          viewBox="0 0 360 34"
          role="img"
          aria-label="Attendance distribution by status"
        >
          {segments.map((segment) => (
            <rect
              key={segment.key}
              x={segment.x}
              y="5"
              width={segment.width}
              height="24"
              fill={segment.color}
            >
              <title>{`${segment.label}: ${segment.value}`}</title>
            </rect>
          ))}
        </svg>
      )}
      <dl className="report-facts__legend">
        {segments.map((segment) => (
          <div key={segment.key}>
            <dt>
              <i
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              {segment.label}
            </dt>
            <dd>{segment.value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

function WeeklyAttendance({
  attendanceTrend,
  audience,
}: {
  attendanceTrend: ReportChartSnapshot["attendanceTrend"];
  audience: ChartAudience;
}) {
  const labelEvery = Math.max(1, Math.ceil(attendanceTrend.length / 4));
  const rateLabel = (rate: number | null) =>
    rate === null ? "No recorded marks" : `${rate}%`;
  return (
    <figure className="report-facts__chart">
      <figcaption>Weekly attendance</figcaption>
      {attendanceTrend.length === 0 ? (
        <p className="report-facts__empty">No completed sessions to chart.</p>
      ) : (
        <svg
          viewBox="0 0 360 150"
          role="img"
          aria-label={`${chartSubject[audience]} weekly attendance rate; a dash means no recorded marks`}
        >
          {[0, 50, 100].map((rate) => (
            <g key={rate}>
              <line
                x1="32"
                x2="354"
                y1={118 - rate}
                y2={118 - rate}
                stroke="currentColor"
                opacity=".18"
              />
              <text x="26" y={122 - rate} textAnchor="end">
                {rate}%
              </text>
            </g>
          ))}
          {attendanceTrend.map((point, index) => {
            const step = 320 / attendanceTrend.length;
            const x = 34 + step * index;
            return (
              <g key={point.weekOf}>
                <title>{`Week of ${point.weekOf}: ${rateLabel(point.attendance.rate)}`}</title>
                {point.attendance.rate === null ? (
                  <text x={x + step / 2} y="112" textAnchor="middle">
                    —
                  </text>
                ) : (
                  <rect
                    x={x + step * 0.18}
                    y={118 - point.attendance.rate}
                    width={step * 0.64}
                    height={point.attendance.rate}
                    fill="#426e7a"
                  />
                )}
                {(index % labelEvery === 0 ||
                  index === attendanceTrend.length - 1) && (
                  <text x={x + step / 2} y="139" textAnchor="middle">
                    {formatReportDateRange(point.weekOf, point.weekOf).replace(
                      / \d{4}$/,
                      "",
                    )}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <p className="report-facts__note">
        {audience !== "student"
          ? `${chartSubject[audience]} attendance by week, weighted by recorded student marks.`
          : "This student's attendance by week."}{" "}
        Unrecorded marks are not absences.
      </p>
    </figure>
  );
}

function ConfirmedObservations({
  confirmedEvents,
  audience,
}: {
  confirmedEvents: ReportChartSnapshot["confirmedEvents"];
  audience: ChartAudience;
}) {
  const maxEvents = Math.max(1, ...confirmedEvents.map((event) => event.count));
  return (
    <section className="report-facts__observations">
      <h3>Confirmed observations</h3>
      <p className="report-facts__note">
        {confirmedEvents.reduce((total, event) => total + event.count, 0)}{" "}
        confirmed or corrected observations {observationScope[audience]}.
        Pending and rejected detections are excluded.
      </p>
      {confirmedEvents.length === 0 ? (
        <p className="report-facts__empty">
          No confirmed observations recorded in this scope.
        </p>
      ) : (
        <div className="report-facts__event-list">
          {confirmedEvents.map((event) => (
            <div className="report-facts__event" key={event.type}>
              <span>{event.type}</span>
              <strong>{event.count}</strong>
              <svg viewBox="0 0 240 8" aria-hidden="true">
                <rect
                  width={(event.count / maxEvents) * 240}
                  height="8"
                  fill="#426e7a"
                />
              </svg>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ReportFactCharts({
  snapshot,
  audience = "student",
}: {
  snapshot: ReportChartSnapshot;
  audience?: ChartAudience;
}) {
  return (
    <>
      <div className="report-facts__charts">
        <AttendanceDistribution attendance={snapshot.attendance} />
        <WeeklyAttendance
          attendanceTrend={snapshot.attendanceTrend}
          audience={audience}
        />
      </div>
      <ConfirmedObservations
        confirmedEvents={snapshot.confirmedEvents}
        audience={audience}
      />
    </>
  );
}
