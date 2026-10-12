import { useEffect, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import {
  listClasses,
  type ClassApiResponse,
  type ClassBillingPlan,
  type CoursePurchaseMode
} from '../../../lib/classAdminApi';
import { listClassroomSessions } from '../../../lib/classroomApi';
import { formatSessionDateLabel, formatSessionTimeRange } from '../../../lib/sessionTime';
import SearchableSelect from '../../../components/SearchableSelect';
import type { LearningEntitlementDraft } from '../paymentRequestDraft';

interface Props {
  readonly value: LearningEntitlementDraft;
  readonly onChange: (value: LearningEntitlementDraft) => void;
  readonly fixedCourseOfferingId?: string;
  readonly fixedCourseLabel?: string;
  readonly fixedBillingPlan?: { sessionsPerPeriod: number | null; membershipInterval: string | null };
  readonly sessionOptions: readonly { id: string; label: string; date: string }[];
  readonly allowDisable?: boolean;
  readonly excludedCourseOfferingIds?: readonly string[];
  readonly onClassSelected?: (klass: ClassApiResponse, entitlement: LearningEntitlementDraft) => void;
  readonly onSessionLabelChange?: (label: string | undefined) => void;
}

const PURCHASE_MODE_COPY: Record<CoursePurchaseMode, { title: string; description: string }> = {
  COURSE_ENROLMENT: {
    title: 'Full course enrolment',
    description: 'Covers the complete scheduled course. Attendance does not reduce a lesson balance.'
  },
  LESSON_PACKAGE: {
    title: 'Lesson package',
    description: 'Adds a finite number of lessons that can be used during the package period.'
  },
  MEMBERSHIP: {
    title: 'Membership period',
    description: 'Provides access for a defined period, with the class membership rules applied.'
  },
  PAY_PER_LESSON: {
    title: 'Single lesson charge',
    description: 'Charges for one specific scheduled lesson without creating a prepaid balance.'
  }
};

export default function CourseAccessEditor({
  value,
  onChange,
  fixedCourseOfferingId,
  fixedCourseLabel,
  fixedBillingPlan,
  sessionOptions,
  allowDisable = true,
  excludedCourseOfferingIds = [],
  onClassSelected,
  onSessionLabelChange
}: Props) {
  const [classes, setClasses] = useState<ClassApiResponse[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadedSessionOptions, setLoadedSessionOptions] = useState<Array<{ id: string; label: string; date: string }>>([]);

  useEffect(() => {
    if (fixedCourseOfferingId) return undefined;
    let active = true;
    listClasses()
      .then((result) => active && setClasses(result.filter((item) => item.status === 'ACTIVE')))
      .catch((cause) => active && setLoadError(apiMessage(cause)));
    return () => { active = false; };
  }, [fixedCourseOfferingId]);

  useEffect(() => {
    if (fixedCourseOfferingId || value.purchaseMode !== 'PAY_PER_LESSON' || !value.courseOfferingId) {
      setLoadedSessionOptions([]);
      return undefined;
    }
    let active = true;
    listClassroomSessions()
      .then((sessions) => {
        if (!active) return;
        setLoadedSessionOptions(sessions
          .filter((session) => session.courseOfferingId === value.courseOfferingId && session.status !== 'CANCELLED')
          .map((session) => ({
            id: session.id,
            date: session.date,
            label: `${formatSessionDateLabel(session.date)} · ${formatSessionTimeRange(session.startTime, session.endTime, session.date)}`
          })));
      })
      .catch((cause) => active && setLoadError(apiMessage(cause)));
    return () => { active = false; };
  }, [fixedCourseOfferingId, value.courseOfferingId, value.purchaseMode]);

  const update = (patch: Partial<LearningEntitlementDraft>) => onChange({ ...value, ...patch });
  const chooseClass = (courseOfferingId: string) => {
    const selectedClass = classes.find((item) => item.id === courseOfferingId);
    const plan = selectedClass?.billingPlan;
    const entitlement = {
      ...value,
      courseOfferingId,
      purchaseMode: plan?.purchaseMode ?? 'COURSE_ENROLMENT',
      includedSessions: plan?.defaultSessionCount?.toString() ?? '',
      absencePolicy: plan?.absencePolicy ?? 'CONSUME_UNEXCUSED',
      classroomSessionId: ''
    };
    onChange(entitlement);
    if (selectedClass) onClassSelected?.(selectedClass, entitlement);
  };
  const billingPlan = fixedBillingPlan ?? classes.find((item) => item.id === value.courseOfferingId)?.billingPlan;
  const modeCopy = PURCHASE_MODE_COPY[value.purchaseMode];
  const availableSessionOptions = fixedCourseOfferingId ? sessionOptions : loadedSessionOptions;

  return (
    <section className={`session-package-editor${value.enabled ? ' is-enabled' : ''}`}>
      {fixedCourseOfferingId || !allowDisable ? (
        <div className="session-package-editor__toggle is-fixed">
          <span><strong>{value.courseOfferingId ? modeCopy.title : 'Choose a class'}</strong><small>{value.courseOfferingId ? modeCopy.description : 'Search for the course this invoice item will provide access to.'}</small></span>
        </div>
      ) : (
        <label className="session-package-editor__toggle">
          <input type="checkbox" checked={value.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
          <span>
            <strong>Link this payment to course access</strong>
            <small>Create the learning entitlement defined by the selected class billing setup.</small>
          </span>
        </label>
      )}
      {value.enabled && (
        <div className="session-package-editor__fields">
          <label className="field">
            <span>Class <small>Required</small></span>
            {fixedCourseOfferingId ? (
              <div className="session-package-editor__fixed-class">
                <strong>{fixedCourseLabel ?? 'Current class'}</strong>
                <small>Locked to this lesson account</small>
              </div>
            ) : (
              <SearchableSelect
                value={value.courseOfferingId}
                label="Class"
                searchPlaceholder="Search course code or teaching period"
                options={classes.map((item) => ({
                  value: item.id,
                  label: item.courseCode,
                  meta: item.academicTerm,
                  keywords: item.offeringCode,
                  disabled: excludedCourseOfferingIds.includes(item.id) && item.id !== value.courseOfferingId
                }))}
                onChange={chooseClass}
                emptyMessage="No active classes match this search."
              />
            )}
          </label>
          <div className="session-package-editor__mode" aria-label="Purchase type">
            <span>Purchase type</span><strong>{modeCopy.title}</strong><small>Set in this class’s Billing setup</small>
          </div>
          <PurchaseModeFields
            value={value}
            billingPlan={billingPlan}
            sessionOptions={availableSessionOptions}
            onChange={update}
            onSessionLabelChange={onSessionLabelChange}
          />
          {loadError && <p className="field-error">{loadError}</p>}
        </div>
      )}
    </section>
  );
}

function PurchaseModeFields({
  value,
  billingPlan,
  sessionOptions,
  onChange,
  onSessionLabelChange
}: {
  readonly value: LearningEntitlementDraft;
  readonly billingPlan?: { sessionsPerPeriod: number | null; membershipInterval: string | null };
  readonly sessionOptions: readonly { id: string; label: string; date: string }[];
  readonly onChange: (patch: Partial<LearningEntitlementDraft>) => void;
  readonly onSessionLabelChange?: (label: string | undefined) => void;
}) {
  if (value.purchaseMode === 'COURSE_ENROLMENT') {
    return <div className="session-package-editor__summary"><strong>Complete scheduled course</strong><span>Course dates and lesson count follow the timetable automatically.</span></div>;
  }
  if (value.purchaseMode === 'PAY_PER_LESSON') {
    return (
      <label className="field session-package-editor__session">
        <span>Scheduled lesson <small>Required</small></span>
        <select required value={value.classroomSessionId} onChange={(event) => {
          const sessionId = event.target.value;
          onChange({ classroomSessionId: sessionId });
          onSessionLabelChange?.(sessionOptions.find((session) => session.id === sessionId)?.label);
        }}>
          <option value="">Select a lesson</option>
          {sessionOptions.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}
        </select>
        {sessionOptions.length === 0 && <small>No available lessons are scheduled for this class.</small>}
      </label>
    );
  }
  return (
    <>
      {value.purchaseMode === 'LESSON_PACKAGE' && (
        <label className="field">
          <span>Lessons included <small>Required</small></span>
          <input required type="number" min="1" max="500" value={value.includedSessions} onChange={(event) => onChange({ includedSessions: event.target.value })} placeholder="10" />
        </label>
      )}
      <fieldset className="session-package-editor__period">
        <legend>{value.purchaseMode === 'MEMBERSHIP' ? 'Membership access' : 'Package validity'} <small>Required</small></legend>
        <div>
          <label className="field"><span>{value.purchaseMode === 'MEMBERSHIP' ? 'Starts' : 'Valid from'}</span><input required type="date" value={value.validFrom} onChange={(event) => onChange({ validFrom: event.target.value })} /></label>
          <label className="field"><span>{value.purchaseMode === 'MEMBERSHIP' ? 'Ends' : 'Expires on'}</span><input required type="date" min={value.validFrom || undefined} value={value.validTo} onChange={(event) => onChange({ validTo: event.target.value })} /></label>
        </div>
      </fieldset>
      {value.purchaseMode === 'LESSON_PACKAGE' ? (
        <div className="session-package-editor__summary">
          <strong>{value.absencePolicy === 'CONSUME_UNEXCUSED' ? 'Absences deduct a lesson' : 'Absences keep the lesson'}</strong>
          <span>{value.absencePolicy === 'CONSUME_UNEXCUSED' ? 'An admin can waive the deduction for approved leave.' : 'Only attendance reduces the student’s remaining balance.'}</span>
        </div>
      ) : (
        <div className="session-package-editor__summary">
          <strong>{billingPlan?.sessionsPerPeriod ? `${billingPlan.sessionsPerPeriod} lessons per period` : 'Unlimited lessons'}</strong>
          <span>{billingPlan?.membershipInterval?.toLowerCase() ?? 'Configured'} membership rules apply.</span>
        </div>
      )}
    </>
  );
}
