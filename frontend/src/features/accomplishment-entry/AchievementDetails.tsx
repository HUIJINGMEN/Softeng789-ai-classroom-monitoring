import { useId } from 'react';
import { ACCOMPLISHMENT_CATEGORIES } from '../../lib/accomplishments';
import SelectMenu from '../../components/SelectMenu';
import type { AchievementEntryState } from './useAchievementEntry';

interface Props {
  readonly entry: AchievementEntryState;
}

export default function AchievementDetails({ entry }: Props) {
  const fieldIds = useId();
  const {
    fixedRecipient,
    fixedRecipientName,
    title,
    setTitle,
    availableCourses,
    selectedCourseId,
    selectedCourseLabel,
    selectCourse,
    category,
    setCategory,
    achievementDate,
    setAchievementDate,
    description,
    setDescription,
    fixedEntry,
    updateEntry,
    includeInReport,
    setIncludeInReport
  } = entry;
  return (
    <div
      className={`accomplishment-modal__details${fixedRecipient ? ' accomplishment-modal__details--single' : ''}`}
    >
      {!fixedRecipient && (
        <div className="accomplishment-modal__details-intro">
          <h3>What was completed?</h3>
          <p>Start with a short, specific title. The remaining details provide context.</p>
        </div>
      )}
      <label className="field accomplishment-modal__title-field">
        <span>{fixedRecipient ? 'What was completed?' : 'Achievement'}</span>
        <input
          value={title}
          maxLength={160}
          placeholder="e.g. Completed the service integration project"
          data-initial-focus
          onChange={(event) => setTitle(event.target.value)}
        />
        <small>{title.length}/160</small>
      </label>

      <div className="accomplishment-modal__facts">
        {availableCourses.length > 1 ? (
          <label htmlFor={`${fieldIds}-field-0`} className="field">
            <span>Class</span>
            <SelectMenu
              id={`${fieldIds}-field-0`}
              value={selectedCourseId}
              options={availableCourses.map((course) => ({ value: course.id, label: course.label }))}
              onChange={selectCourse}
              ariaLabel="Class"
            />
          </label>
        ) : (
          <div className="accomplishment-modal__fixed-class">
            <span>Class</span>
            <strong>{selectedCourseLabel}</strong>
          </div>
        )}
        <label htmlFor={`${fieldIds}-field-1`} className="field">
          <span>Type</span>
          <SelectMenu
            id={`${fieldIds}-field-1`}
            value={category}
            options={ACCOMPLISHMENT_CATEGORIES}
            onChange={setCategory}
            ariaLabel="Achievement type"
          />
        </label>
        <label className="field">
          <span>Date completed</span>
          <input
            type="date"
            value={achievementDate}
            onChange={(event) => setAchievementDate(event.target.value)}
          />
        </label>
      </div>

      <details
        className={`accomplishment-modal__optional${fixedRecipient ? ' accomplishment-modal__optional--single' : ''}`}
      >
        <summary>
          <span>
            <strong>{fixedRecipient ? 'Optional details' : 'Supporting detail'}</strong>
            <small>
              {fixedRecipient
                ? 'Description, points or a personal note'
                : 'Optional evidence or context for the student'}
            </small>
          </span>
        </summary>
        <div className="accomplishment-modal__optional-body">
          <label className="field accomplishment-modal__description-field">
            <span>Description</span>
            <textarea
              value={description}
              maxLength={4000}
              rows={3}
              placeholder="Add evidence or explain why this achievement matters."
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {fixedRecipient && fixedEntry && (
            <div className="accomplishment-modal__single-student-fields">
              <label className="field">
                <span>
                  Points <small>Optional</small>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={fixedEntry.points}
                  placeholder="30"
                  onChange={(event) => updateEntry(fixedEntry.studentId, { points: event.target.value })}
                />
              </label>
              <label className="field accomplishment-modal__personal-note">
                <span>
                  Personal note <small>Optional</small>
                </span>
                <input
                  value={fixedEntry.note}
                  maxLength={2000}
                  placeholder={`Add a short note for ${fixedRecipientName}`}
                  onChange={(event) => updateEntry(fixedEntry.studentId, { note: event.target.value })}
                />
              </label>
            </div>
          )}
        </div>
      </details>
      <label
        aria-label="Include in reports"
        htmlFor={`${fieldIds}-field-2`}
        className="check-row accomplishment-modal__report-toggle"
      >
        <input
          id={`${fieldIds}-field-2`}
          type="checkbox"
          checked={includeInReport}
          onChange={(event) => setIncludeInReport(event.target.checked)}
        />
        <span>
          <strong>Include in reports</strong>
          <small>After it is shared, this achievement can appear in reports covering this date.</small>
        </span>
      </label>
    </div>
  );
}
