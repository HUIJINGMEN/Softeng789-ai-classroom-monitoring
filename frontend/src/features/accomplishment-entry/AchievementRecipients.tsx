import { ACCOMPLISHMENT_CATEGORIES } from '../../lib/accomplishments';
import { avatarTone } from '../../lib/format';
import { IconAward } from '../../components/icons';
import Pager from '../../components/Pager';
import PersonAvatar from '../../components/PersonAvatar';
import SearchField from '../../components/SearchField';
import SelectionControl from '../../components/SelectionControl';
import type { AchievementEntryState } from './useAchievementEntry';

interface Props {
  readonly entry: AchievementEntryState;
}

export default function AchievementRecipients({ entry }: Props) {
  const {
    fixedRecipient,
    fixedRecipientName,
    title,
    selectedCourseLabel,
    category,
    achievementDate,
    entries,
    search,
    setSearch,
    setRosterPage,
    roster,
    selectedIds,
    toggleStudent,
    filteredStudents,
    selectedStudents,
    updateEntry
  } = entry;
  return (
    <div
      className={`accomplishment-modal__recipients${fixedRecipient ? ' accomplishment-modal__recipients--single' : ''}`}
    >
      <div className="accomplishment-modal__recipient-context">
        <span aria-hidden="true">
          <IconAward />
        </span>
        <div>
          <strong>{title}</strong>
          <small>
            {selectedCourseLabel} ·{' '}
            {ACCOMPLISHMENT_CATEGORIES.find((option) => option.value === category)?.label} · {achievementDate}
          </small>
        </div>
      </div>
      {!fixedRecipient && (
        <section className="accomplishment-modal__roster">
          <div className="accomplishment-modal__section-head">
            <div>
              <strong>Class roster</strong>
              <span>Select one or more students</span>
            </div>
            <span
              className={`accomplishment-modal__selected-count${entries.length > 0 ? ' has-selection' : ''}`}
            >
              {entries.length} selected
            </span>
          </div>
          <SearchField
            label="Search class roster"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setRosterPage(0);
            }}
            placeholder="Name or student number"
          />
          <div className="accomplishment-modal__roster-list">
            {roster.rows.map((student, index) => {
              const studentId = student.recordId;
              if (!studentId) return null;
              const checked = selectedIds.has(studentId);
              return (
                <label
                  key={studentId}
                  className={`accomplishment-modal__student-option${checked ? ' is-selected' : ''}`}
                >
                  <PersonAvatar
                    photoUrl={student.registrationPhoto}
                    name={student.name}
                    tone={avatarTone(student.id, index)}
                    alt=""
                  />
                  <span>
                    <strong>{student.name}</strong>
                    <small>{student.studentNumber ?? student.id}</small>
                  </span>
                  <SelectionControl
                    checked={checked}
                    label={`${checked ? 'Remove' : 'Select'} ${student.name}`}
                    onChange={() => toggleStudent(studentId)}
                  />
                </label>
              );
            })}
          </div>
          {filteredStudents.length === 0 && (
            <div className="empty empty--compact">No students match this search.</div>
          )}
          {roster.pageCount > 1 && (
            <Pager
              label={roster.label}
              page={roster.page}
              pageCount={roster.pageCount}
              canPrev={roster.canPrev}
              canNext={roster.canNext}
              onPrev={roster.prev}
              onNext={roster.next}
              onGoToPage={roster.goToPage}
            />
          )}
        </section>
      )}

      <section className="accomplishment-modal__scores">
        <div className="accomplishment-modal__section-head">
          <div>
            <strong>{fixedRecipient ? fixedRecipientName : 'Student details'}</strong>
            <span>Points and a personal note are optional</span>
          </div>
        </div>
        {selectedStudents.length === 0 ? (
          <div className="accomplishment-modal__selection-empty">
            <strong>No students selected</strong>
            <span>Choose students from the class roster, then add points or a personal note if needed.</span>
          </div>
        ) : (
          <div className="accomplishment-modal__score-list">
            {selectedStudents.map(({ student, entry }) => (
              <div className="accomplishment-modal__score-row" key={entry.studentId}>
                <div>
                  <strong>{student.name}</strong>
                  <small>{student.studentNumber ?? student.id}</small>
                </div>
                <label>
                  <span>Points</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={entry.points}
                    placeholder="30"
                    onChange={(event) => updateEntry(entry.studentId, { points: event.target.value })}
                  />
                </label>
                <label>
                  <span>Personal note</span>
                  <input
                    value={entry.note}
                    maxLength={2000}
                    placeholder="Optional context"
                    onChange={(event) => updateEntry(entry.studentId, { note: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
