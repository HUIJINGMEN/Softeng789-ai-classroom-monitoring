import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { PublicClassSummaryApiResponse } from '../../lib/classAdminApi';
import Modal from '../Modal';
import SearchField from '../SearchField';

interface Props {
  readonly classes: readonly PublicClassSummaryApiResponse[];
  readonly loading: boolean;
  readonly error: string;
  readonly selectedClassIds: readonly string[];
  readonly onSelectionChange: (ids: string[]) => void;
}

const MAX_VISIBLE_RESULTS = 5;

function courseOptionDetail(klass: PublicClassSummaryApiResponse): string {
  const courseCode = klass.courseCode.trim();
  const offeringCode = klass.offeringCode.trim();
  const normalizedCourseCode = courseCode.toLocaleLowerCase();
  const normalizedOfferingCode = offeringCode.toLocaleLowerCase();
  const offeringQualifier = normalizedOfferingCode.startsWith(normalizedCourseCode)
    ? offeringCode.slice(courseCode.length).trim()
    : offeringCode;
  const normalizedTerm = klass.academicTerm.trim().toLocaleLowerCase();
  const qualifierTokens = offeringQualifier.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const qualifierRepeatsTerm = qualifierTokens.length === 0
    || qualifierTokens.every((token) => normalizedTerm.includes(token));

  return qualifierRepeatsTerm
    ? klass.academicTerm
    : `${klass.academicTerm} · ${offeringQualifier}`;
}

function getCourseButtonLabel(loading: boolean, selectedCount: number): string {
  if (loading) return 'Loading courses…';
  if (selectedCount > 0) return 'Edit courses';
  return 'Add courses';
}

function getSaveLabel(selectedCount: number): string {
  if (selectedCount === 1) return 'Save 1 course';
  if (selectedCount > 1) return `Save ${selectedCount} courses`;
  return 'Save selection';
}

function getResultLabel(
  query: string,
  matchingCount: number,
  visibleCount: number,
  totalCount: number
): string {
  if (!query) return `Showing ${visibleCount} of ${totalCount}`;
  return `${matchingCount} ${matchingCount === 1 ? 'match' : 'matches'}`;
}

export default function RegistrationCourseSelector({
  classes,
  loading,
  error,
  selectedClassIds,
  onSelectionChange
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftClassIds, setDraftClassIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const selectedClasses = classes.filter((klass) => selectedClassIds.includes(klass.id));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingClasses = classes
    .filter((klass) =>
      !normalizedQuery || [klass.courseCode, klass.academicTerm, klass.offeringCode]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    )
    .sort((first, second) => {
      if (normalizedQuery) return 0;
      return Number(draftClassIds.includes(second.id)) - Number(draftClassIds.includes(first.id));
    });
  const visibleClasses = matchingClasses.slice(0, MAX_VISIBLE_RESULTS);
  const hiddenResultCount = matchingClasses.length - visibleClasses.length;
  const modalTitle = selectedClassIds.length > 0 ? 'Edit courses' : 'Add courses';
  const buttonLabel = getCourseButtonLabel(loading, selectedClasses.length);
  const saveLabel = getSaveLabel(draftClassIds.length);
  const resultLabel = getResultLabel(
    normalizedQuery,
    matchingClasses.length,
    visibleClasses.length,
    classes.length
  );

  const openPicker = () => {
    setDraftClassIds([...selectedClassIds]);
    setQuery('');
    setOpen(true);
  };

  const toggleDraftClass = (id: string) => {
    setDraftClassIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  };

  const applySelection = () => {
    onSelectionChange(draftClassIds);
    setOpen(false);
  };

  return (
    <div className="field field--wide course-field">
      <span className="auth-field-heading">Courses</span>

      {error && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>Could not load classes: {error}</span>
        </div>
      )}

      <div className="course-selector">
        <div className="course-selector__value" aria-live="polite">
          {selectedClasses.length > 0 ? (
            <span className="course-selector__selection">
              <strong>
                {selectedClasses.length} course{selectedClasses.length === 1 ? '' : 's'}
              </strong>
              <small>{selectedClasses.map((klass) => klass.courseCode).join(', ')}</small>
            </span>
          ) : (
            <span className="course-selector__placeholder">No courses added</span>
          )}

          <button
            type="button"
            className="course-selector__add"
            aria-haspopup="dialog"
            disabled={loading || classes.length === 0}
            onClick={openPicker}
          >
            {buttonLabel}
          </button>
        </div>
      </div>

      {!loading && !error && classes.length === 0 && (
        <small className="course-field__help">
          No courses are open for registration. Contact your Admin.
        </small>
      )}

      {open && createPortal(
        <Modal
          onClose={() => setOpen(false)}
          size="narrow"
          className="auth-course-modal"
          titleId="add-registration-courses-title"
          title={modalTitle}
          compactTitle
          closeButton
          subtitle="Choose one or more classes for your enrolment request."
          footer={
            <>
              <button
                type="button"
                className="btn auth-course-modal__clear"
                disabled={draftClassIds.length === 0}
                onClick={() => setDraftClassIds([])}
              >
                Clear selection
              </button>
              <span className="auth-course-modal__footer-spacer" aria-hidden="true" />
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={applySelection}>
                {saveLabel}
              </button>
            </>
          }
        >
          <div className="course-picker-modal">
            <SearchField
              className="course-picker-modal__search"
              label="Search courses"
              value={query}
              onChange={setQuery}
              placeholder="Course code, term or offering"
              autoFocus
            />

            <div className="course-picker-modal__summary" aria-live="polite">
              <span className="course-picker-modal__selected-count">
                {draftClassIds.length} selected
              </span>
              <span className="course-picker-modal__result-count">{resultLabel}</span>
            </div>

            {visibleClasses.length > 0 ? (
              <div className="course-picker-modal__list" aria-label="Course search results">
                {visibleClasses.map((klass) => (
                  <label key={klass.id} className="course-option">
                    <input
                      type="checkbox"
                      checked={draftClassIds.includes(klass.id)}
                      onChange={() => toggleDraftClass(klass.id)}
                    />
                    <span>
                      <strong>{klass.courseCode}</strong>
                      <small>{courseOptionDetail(klass)}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="course-picker-modal__empty">
                No courses match “{query.trim()}”. Try a course code or offering.
              </div>
            )}

            {hiddenResultCount > 0 && (
              <p className="course-picker-modal__hint">
                {hiddenResultCount} more result{hiddenResultCount === 1 ? '' : 's'}.
                {' '}Add another keyword to narrow the list.
              </p>
            )}
          </div>
        </Modal>,
        document.body
      )}
    </div>
  );
}
