import { useMemo, useState } from 'react';
import {
  ACCOMPLISHMENT_CATEGORIES,
  accomplishmentCategoryLabel,
  accomplishmentCorrectionLabel,
  formatAccomplishmentPoints
} from '../../lib/accomplishments';
import {
  acknowledgeAccomplishment,
  requestAccomplishmentCorrection
} from '../../lib/accomplishmentApi';
import { apiMessage } from '../../lib/apiClient';
import { usePagination } from '../../lib/table';
import type { Accomplishment } from '../../types';
import { IconAward } from '../icons';
import Pager from '../Pager';
import SelectMenu from '../SelectMenu';
import RespondToAchievementModal from '../RespondToAchievementModal';
import StudentCourseFilter from './StudentCourseFilter';
import { studentDateLabel } from './studentPortalMetrics';

interface Props {
  readonly accomplishments: readonly Accomplishment[];
  readonly studentId: string;
  readonly courses: readonly string[];
  readonly courseFilter: string;
  readonly loading: boolean;
  readonly onCourseChange: (course: string) => void;
  readonly onRefresh: () => void;
}

function accomplishmentCourse(item: Accomplishment): string {
  return item.classLabel.split(' · ')[0]?.trim() || item.classLabel;
}

function responseState(item: Accomplishment): { label: string; className: string } {
  if (item.latestCorrection?.status === 'PENDING') {
    return { label: 'Waiting for teacher', className: 'is-pending' };
  }
  if (item.acknowledgedAt || item.latestCorrection) {
    return { label: 'Responded', className: 'is-complete' };
  }
  return { label: 'Response needed', className: 'is-required' };
}

function responseActionLabel(item: Accomplishment): string {
  if (item.acknowledgedAt || item.latestCorrection) return 'Review response';
  return 'Respond';
}

export default function StudentAccomplishmentsView({
  accomplishments,
  studentId,
  courses,
  courseFilter,
  loading,
  onCourseChange,
  onRefresh
}: Props) {
  const [category, setCategory] = useState('ALL');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [responseItem, setResponseItem] = useState<Accomplishment | null>(null);
  const [correctionError, setCorrectionError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const rows = useMemo(
    () => accomplishments.filter((item) =>
      (courseFilter === 'all' || accomplishmentCourse(item) === courseFilter)
      && (category === 'ALL' || item.category === category)
    ),
    [accomplishments, category, courseFilter]
  );
  const paged = usePagination(rows, page, setPage, 6);

  const acknowledge = async (item: Accomplishment) => {
    setBusyId(item.id);
    setNotice(null);
    setCorrectionError('');
    try {
      await acknowledgeAccomplishment(studentId, item.id);
      setNotice(`You confirmed the details for “${item.title}”.`);
      setResponseItem(null);
      onRefresh();
    } catch (caught) {
      setCorrectionError(apiMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const submitCorrection = async (message: string) => {
    if (!responseItem) return;
    setBusyId(responseItem.id);
    setCorrectionError('');
    try {
      await requestAccomplishmentCorrection(studentId, responseItem.id, message);
      setNotice('Your change request was sent to your teacher.');
      setResponseItem(null);
      onRefresh();
    } catch (caught) {
      setCorrectionError(apiMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="student-view student-view--accomplishments">
      <div className="student-page-head student-page-head--accomplishments">
        <div>
          <h1>Achievements</h1>
          <p>Work your teachers have recognised as completed. Check each record and respond if anything is incorrect.</p>
        </div>
        <div className="student-accomplishment-total" aria-label={`${accomplishments.length} shared achievements`}>
          <IconAward />
          <strong>{loading ? '—' : accomplishments.length}</strong>
          <span>shared</span>
        </div>
      </div>

      <div className="student-achievement-guide" aria-label="How achievements work">
        <strong>How it works</strong>
        <span><b>1</b> Your teacher records completed work</span>
        <span><b>2</b> You check the details</span>
        <span><b>3</b> The achievement can appear in your reports</span>
      </div>

      <div className="student-collection-head student-accomplishment-filters">
        <StudentCourseFilter courses={courses} value={courseFilter} onChange={(value) => { onCourseChange(value); setPage(0); }} />
        <label className="student-course-filter">
          <span>Type</span>
          <SelectMenu
            value={category}
            options={[{ value: 'ALL', label: 'All types' }, ...ACCOMPLISHMENT_CATEGORIES]}
            onChange={(value) => { setCategory(value); setPage(0); }}
            ariaLabel="Achievement type"
          />
        </label>
      </div>

      <div className="student-list-summary" aria-live="polite">
        <span>{courseFilter === 'all' ? 'All classes' : courseFilter}</span>
        <strong>{rows.length} achievement{rows.length === 1 ? '' : 's'}</strong>
      </div>

      {notice && (
        <output className="student-action-notice student-action-notice--success">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>Dismiss</button>
        </output>
      )}

      <section className="student-accomplishment-list" aria-live="polite">
        {paged.rows.map((item) => {
          const studentResponse = responseState(item);
          return (
            <article className={`student-accomplishment-card student-accomplishment-card--${studentResponse.className}`} key={item.id}>
              <div className="student-accomplishment-card__icon"><IconAward /></div>
              <div className="student-accomplishment-card__body">
                <div className="student-accomplishment-card__topline">
                  <span>{accomplishmentCategoryLabel(item.category)}</span>
                  <span className={`student-accomplishment-card__state ${studentResponse.className}`}>{studentResponse.label}</span>
                </div>
                <h2>{item.title}</h2>
                {item.description && <p>{item.description}</p>}
                {item.studentNote && <blockquote>{item.studentNote}</blockquote>}
                <div className="student-accomplishment-card__footer">
                  <span>{accomplishmentCourse(item)}</span>
                  <span><time dateTime={item.achievementDate}>{studentDateLabel(`${item.achievementDate}T00:00:00`)}</time> · {item.confirmedByTeacherName ?? item.createdByTeacherName}</span>
                </div>
                {item.latestCorrection && (
                  <div className={`student-accomplishment-response student-accomplishment-response--${item.latestCorrection.status.toLowerCase()}`}>
                    <strong>{accomplishmentCorrectionLabel(item.latestCorrection.status)}</strong>
                    <span>{item.latestCorrection.status === 'PENDING'
                      ? `You asked: “${item.latestCorrection.message}”`
                      : item.latestCorrection.staffResponse || 'Your teacher has completed the review.'}</span>
                  </div>
                )}
                {!item.latestCorrection && item.acknowledgedAt && (
                  <div className="student-accomplishment-response student-accomplishment-response--accepted">
                    <strong>Details confirmed</strong>
                    <span>You told your teacher this achievement is correct.</span>
                  </div>
                )}
                {item.latestCorrection?.status !== 'PENDING' && (
                  <div className="student-accomplishment-card__actions">
                    <button
                      type="button"
                      className="student-secondary-action student-secondary-action--response"
                      disabled={busyId === item.id}
                      onClick={() => { setCorrectionError(''); setResponseItem(item); }}
                    >
                      {responseActionLabel(item)}
                    </button>
                  </div>
                )}
              </div>
              {formatAccomplishmentPoints(item.points) && (
                <div className="student-accomplishment-card__points">
                  <strong>{item.points}</strong><span>points</span>
                </div>
              )}
            </article>
          );
        })}
        {!loading && rows.length === 0 && (
          <div className="student-empty-state student-empty-state--panel">
            <IconAward />
            <strong>{accomplishments.length === 0 ? 'Your achievements will appear here' : 'No achievements match these filters'}</strong>
            <span>{accomplishments.length === 0 ? 'When a teacher recognises a completed project, milestone or award, you will see it here.' : 'Try selecting another class or type.'}</span>
          </div>
        )}
        {loading && <div className="student-loading-block" aria-label="Loading achievements" />}
      </section>

      {!loading && rows.length > 0 && (
        <div className="student-list-pager">
          <Pager label={paged.label} page={paged.page} pageCount={paged.pageCount} canPrev={paged.canPrev} canNext={paged.canNext} onPrev={paged.prev} onNext={paged.next} onGoToPage={paged.goToPage} />
        </div>
      )}

      {responseItem && (
        <RespondToAchievementModal
          accomplishment={responseItem}
          saving={busyId === responseItem.id}
          error={correctionError}
          onClose={() => { setResponseItem(null); setCorrectionError(''); }}
          onConfirm={() => void acknowledge(responseItem)}
          onSubmit={(message) => void submitCorrection(message)}
        />
      )}
    </div>
  );
}
