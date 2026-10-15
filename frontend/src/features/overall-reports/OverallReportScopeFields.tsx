import { useState } from "react";
import MultiSelectPickerModal from "../../components/MultiSelectPickerModal";
import { OverallReportHelp } from './OverallReportHelp';
import type { OverallCourseOption, OverallReportScope } from "./types";

export function OverallReportScopeFields({
  scope,
  onChange,
  disabled,
  valid,
  changed,
  courses,
  loading,
  onApply,
}: {
  readonly scope: OverallReportScope;
  readonly onChange: (scope: OverallReportScope) => void;
  readonly disabled: boolean;
  readonly valid: boolean;
  readonly changed: boolean;
  readonly courses: OverallCourseOption[];
  readonly loading: boolean;
  readonly onApply: () => void;
}) {
  const [picker, setPicker] = useState(false);
  let applyLabel = changed ? "Apply scope" : "Refresh records";
  if (disabled) applyLabel = "Working…";
  const courseLabel = scope.courseOfferingIds.length
    ? `${scope.courseOfferingIds.length} courses selected`
    : "All courses";
  return (
    <section className="overall-report-scope" aria-label="Overall report scope">
      <div className="overall-report-scope-head">
        <h3 className="overall-report-scope-title">Report setup</h3>
        <fieldset className="overall-report-audience" disabled={disabled}>
          <legend>Report audience</legend>
          {[
            {
              value: "INTERNAL",
              title: "Internal operations",
            },
            {
              value: "PARTNER",
              title: "Partners & reviewers",
            },
          ].map((option) => (
            <label
              key={option.value}
              aria-label={option.title}
              className={scope.audience === option.value ? "is-selected" : ""}
            >
              <input
                type="radio"
                name="overall-audience"
                value={option.value}
                checked={scope.audience === option.value}
                onChange={() =>
                  onChange({
                    ...scope,
                    audience: option.value as OverallReportScope["audience"],
                  })
                }
              />
              <span>
                <strong>{option.title}</strong>
              </span>
            </label>
          ))}
        </fieldset>
        <OverallReportHelp />
      </div>
      <p className="overall-report-audience-description">
        {scope.audience === "INTERNAL"
          ? "Teaching, record quality and follow-up · Staff only"
          : "Aggregate results and reviewed next steps · Designated recipients"}
      </p>
      <div className="overall-report-filters">
        {(["dateFrom", "dateTo"] as const).map((key) => (
          <label className="field" key={key}>
            <span>{key === "dateFrom" ? "From" : "To"}</span>
            <input
              type="date"
              value={scope[key]}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...scope, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <div className="field">
          <span id="overall-report-courses-label">Courses</span>
          <button
            type="button"
            className="btn overall-report-course-picker"
            disabled={disabled || loading}
            aria-labelledby="overall-report-courses-label overall-report-courses-value"
            aria-haspopup="dialog"
            onClick={() => setPicker(true)}
          >
            <span id="overall-report-courses-value">
              {loading ? "Loading courses…" : courseLabel}
            </span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className={changed ? "btn btn--primary" : "btn"}
          disabled={disabled || !valid}
          onClick={onApply}
        >
          {applyLabel}
        </button>
      </div>
      {!valid && (
        <p className="form-error" role="alert">
          Choose valid dates spanning up to one year and at most 100 courses.
        </p>
      )}
      {picker && (
        <MultiSelectPickerModal
          title="Choose report courses"
          subtitle="Select up to 100 courses. Clear the selection to report on all courses."
          searchLabel="Search courses"
          searchPlaceholder="Course code or term"
          options={courses.map((course) => ({
            id: course.id,
            label: course.label,
          }))}
          selectedIds={scope.courseOfferingIds}
          onApply={(ids) => {
            onChange({ ...scope, courseOfferingIds: ids });
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </section>
  );
}
