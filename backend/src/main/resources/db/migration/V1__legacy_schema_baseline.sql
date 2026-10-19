-- Frozen PostgreSQL structure before receipt-date/delivery changes. No seed or business-data DML.
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.accomplishment_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    accomplishment_id uuid NOT NULL,
    type character varying(24) NOT NULL,
    status character varying(20) NOT NULL,
    message text,
    staff_response text,
    reviewed_by_teacher_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT accomplishment_feedback_status_check CHECK (((status)::text = ANY ((ARRAY['RECORDED'::character varying, 'PENDING'::character varying, 'ACCEPTED'::character varying, 'DECLINED'::character varying])::text[]))),
    CONSTRAINT accomplishment_feedback_type_check CHECK (((type)::text = ANY ((ARRAY['ACKNOWLEDGEMENT'::character varying, 'CORRECTION_REQUEST'::character varying])::text[])))
);

CREATE TABLE public.accomplishments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    course_offering_id uuid NOT NULL,
    created_by_teacher_id uuid NOT NULL,
    confirmed_by_teacher_id uuid,
    revoked_by_teacher_id uuid,
    category character varying(24) NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    student_note text,
    points numeric(8,2),
    achievement_date date NOT NULL,
    include_in_report boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    CONSTRAINT accomplishments_category_check CHECK (((category)::text = ANY ((ARRAY['PROJECT'::character varying, 'MILESTONE'::character varying, 'AWARD'::character varying, 'IMPROVEMENT'::character varying, 'LEADERSHIP'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT accomplishments_points_check CHECK (((points IS NULL) OR (points >= (0)::numeric))),
    CONSTRAINT accomplishments_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'CONFIRMED'::character varying, 'REVOKED'::character varying])::text[])))
);

CREATE TABLE public.account_links (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    purpose character varying(32) NOT NULL,
    state character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    credential_digest character varying(64),
    account_id uuid,
    account_role character varying(20),
    password_fingerprint character varying(64),
    version bigint NOT NULL,
    CONSTRAINT account_links_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['STUDENT_REGISTRATION'::character varying, 'STAFF_ACTIVATION'::character varying, 'PASSWORD_RESET'::character varying])::text[]))),
    CONSTRAINT account_links_state_check CHECK (((state)::text = ANY ((ARRAY['REQUESTED'::character varying, 'DISPATCHED'::character varying, 'USED'::character varying, 'DISCARDED'::character varying])::text[])))
);

CREATE TABLE public.attendance_billing_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attendance_record_id uuid NOT NULL,
    decision character varying(16) NOT NULL,
    reason character varying(500) NOT NULL,
    updated_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_billing_overrides_decision_check CHECK (((decision)::text = ANY ((ARRAY['CONSUME'::character varying, 'WAIVE'::character varying])::text[])))
);

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    session_id uuid NOT NULL,
    check_in_time timestamp with time zone,
    check_out_time timestamp with time zone,
    status character varying(20) NOT NULL,
    source character varying(20) DEFAULT 'MANUAL'::character varying NOT NULL,
    absence_reason character varying(32),
    absence_note character varying(500),
    CONSTRAINT attendance_records_absence_reason_check CHECK (((absence_reason IS NULL) OR ((absence_reason)::text = ANY ((ARRAY['ILLNESS'::character varying, 'ADVANCE_NOTICE'::character varying, 'NO_NOTICE'::character varying, 'SCHOOL_CANCELLED'::character varying, 'OTHER'::character varying])::text[])))),
    CONSTRAINT attendance_records_source_check CHECK (((source)::text = ANY ((ARRAY['MANUAL'::character varying, 'AI'::character varying])::text[]))),
    CONSTRAINT attendance_records_status_check CHECK (((status)::text = ANY ((ARRAY['PRESENT'::character varying, 'LATE'::character varying, 'ABSENT'::character varying, 'UNKNOWN'::character varying])::text[])))
);

CREATE TABLE public.behaviour_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_event_id character varying(120) NOT NULL,
    student_id uuid,
    session_id uuid NOT NULL,
    track_id character varying(120) NOT NULL,
    event_type character varying(120) NOT NULL,
    confidence numeric(4,3) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    duration_seconds integer DEFAULT 0 NOT NULL,
    evidence_url character varying(500),
    model_version character varying(80) NOT NULL,
    review_status character varying(30) NOT NULL,
    teacher_note text,
    CONSTRAINT behaviour_events_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT behaviour_events_duration_nonnegative CHECK ((duration_seconds >= 0)),
    CONSTRAINT behaviour_events_review_status_check CHECK (((review_status)::text = ANY ((ARRAY['PENDING_REVIEW'::character varying, 'CONFIRMED'::character varying, 'REJECTED'::character varying, 'CORRECTED'::character varying])::text[])))
);

CREATE TABLE public.billing_account_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    invoice_id uuid,
    session_package_id uuid,
    activity_type character varying(32) NOT NULL,
    amount numeric(12,2),
    from_value character varying(160),
    to_value character varying(160),
    reason character varying(500) NOT NULL,
    external_reference character varying(120),
    actor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_account_activities_activity_type_check CHECK (((activity_type)::text = ANY ((ARRAY['PACKAGE_PAUSED'::character varying, 'PACKAGE_RESUMED'::character varying, 'PACKAGE_EXTENDED'::character varying, 'PACKAGE_TRANSFERRED'::character varying, 'PACKAGE_CANCELLED'::character varying, 'CREDIT_ADJUSTMENT'::character varying, 'REFUND_ISSUED'::character varying, 'PAYMENT_REVERSED'::character varying])::text[])))
);

CREATE TABLE public.campuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL
);

CREATE TABLE public.class_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_offering_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.class_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_offering_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    scope_key character varying(64) NOT NULL,
    document text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finalized_at timestamp with time zone,
    version bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.classroom_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_name character varying(120) NOT NULL,
    room character varying(120) NOT NULL,
    course_offering_id uuid,
    room_id uuid,
    teacher_id uuid,
    schedule_series_id uuid,
    session_date date NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    status character varying(30) DEFAULT 'SCHEDULED'::character varying NOT NULL,
    CONSTRAINT classroom_sessions_status_check2 CHECK (((status)::text = ANY ((ARRAY['SCHEDULED'::character varying, 'ACTIVE'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT classroom_sessions_time_check CHECK ((end_time > start_time))
);

CREATE TABLE public.course_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    course_offering_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    withdrawn_at timestamp with time zone,
    CONSTRAINT course_enrollments_status_check3 CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'WITHDRAWN'::character varying])::text[])))
);

CREATE TABLE public.course_offering_teachers (
    course_offering_id uuid NOT NULL,
    teacher_id uuid NOT NULL
);

CREATE TABLE public.course_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    offering_code character varying(160) NOT NULL,
    academic_term character varying(80) NOT NULL,
    purchase_mode character varying(32) DEFAULT 'COURSE_ENROLMENT'::character varying NOT NULL,
    default_price numeric(12,2),
    default_session_count integer,
    package_validity_days integer,
    absence_policy character varying(32),
    membership_interval character varying(24),
    sessions_per_period integer,
    pay_per_lesson_trigger character varying(24),
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT course_offerings_absence_policy_check CHECK (((absence_policy IS NULL) OR ((absence_policy)::text = ANY ((ARRAY['CONSUME_UNEXCUSED'::character varying, 'ATTENDANCE_ONLY'::character varying])::text[])))),
    CONSTRAINT course_offerings_default_price_check CHECK (((default_price IS NULL) OR (default_price > (0)::numeric))),
    CONSTRAINT course_offerings_default_session_count_check CHECK (((default_session_count IS NULL) OR ((default_session_count >= 1) AND (default_session_count <= 500)))),
    CONSTRAINT course_offerings_membership_interval_check CHECK (((membership_interval IS NULL) OR ((membership_interval)::text = ANY ((ARRAY['WEEKLY'::character varying, 'MONTHLY'::character varying, 'TERM'::character varying, 'ANNUAL'::character varying])::text[])))),
    CONSTRAINT course_offerings_package_validity_days_check CHECK (((package_validity_days IS NULL) OR ((package_validity_days >= 1) AND (package_validity_days <= 3650)))),
    CONSTRAINT course_offerings_pay_per_lesson_trigger_check CHECK (((pay_per_lesson_trigger IS NULL) OR ((pay_per_lesson_trigger)::text = ANY ((ARRAY['BOOKING'::character varying, 'ATTENDANCE'::character varying])::text[])))),
    CONSTRAINT course_offerings_purchase_mode_check CHECK (((purchase_mode)::text = ANY ((ARRAY['COURSE_ENROLMENT'::character varying, 'LESSON_PACKAGE'::character varying, 'MEMBERSHIP'::character varying, 'PAY_PER_LESSON'::character varying])::text[]))),
    CONSTRAINT course_offerings_sessions_per_period_check CHECK (((sessions_per_period IS NULL) OR ((sessions_per_period >= 1) AND (sessions_per_period <= 500)))),
    CONSTRAINT course_offerings_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ARCHIVED'::character varying])::text[])))
);

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(160) NOT NULL
);

CREATE TABLE public.face_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    image_path character varying(500) NOT NULL,
    status character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT face_enrollments_status_check CHECK (((status)::text = ANY ((ARRAY['NOT_ENROLLED'::character varying, 'PHOTO_CAPTURED'::character varying, 'VERIFIED'::character varying, 'FAILED'::character varying])::text[])))
);

CREATE TABLE public.feedback_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    course_offering_id uuid NOT NULL,
    created_by_teacher_id uuid NOT NULL,
    reviewed_by_teacher_id uuid,
    date_from date NOT NULL,
    date_to date NOT NULL,
    summary text NOT NULL,
    strengths text NOT NULL,
    next_steps text NOT NULL,
    source_feedback_count integer NOT NULL,
    source_fingerprint character varying(64) NOT NULL,
    provider character varying(40) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    published_at timestamp with time zone,
    emailed_at timestamp with time zone,
    CONSTRAINT feedback_summaries_check CHECK ((date_to >= date_from)),
    CONSTRAINT feedback_summaries_source_feedback_count_check CHECK ((source_feedback_count > 0)),
    CONSTRAINT feedback_summaries_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'REVIEWED'::character varying, 'SUPERSEDED'::character varying])::text[])))
);

CREATE TABLE public.health_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    session_id uuid NOT NULL,
    status character varying(20) DEFAULT 'AWAITING_REVIEW'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    external_event_id character varying(120) NOT NULL,
    event_type character varying(60) NOT NULL,
    confidence numeric(4,3),
    detected_at timestamp with time zone NOT NULL,
    track_id character varying(120) NOT NULL,
    duration_seconds integer DEFAULT 0 NOT NULL,
    model_version character varying(80) NOT NULL,
    source character varying(30) DEFAULT 'AI_SERVICE'::character varying NOT NULL,
    evidence_url character varying(500),
    reviewed_by_teacher_id uuid,
    reviewed_at timestamp with time zone,
    teacher_notes text,
    action_taken text,
    CONSTRAINT health_alerts_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))),
    CONSTRAINT health_alerts_duration_nonnegative CHECK ((duration_seconds >= 0)),
    CONSTRAINT health_alerts_status_check2 CHECK (((status)::text = ANY ((ARRAY['AWAITING_REVIEW'::character varying, 'CONFIRMED'::character varying, 'DISMISSED'::character varying])::text[])))
);

CREATE TABLE public.health_incident_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    course_offering_id uuid NOT NULL,
    session_id uuid,
    teacher_id uuid NOT NULL,
    source character varying(30) NOT NULL,
    incident_type character varying(60) NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    description text NOT NULL,
    action_taken text,
    teacher_notes text,
    health_alert_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT health_incident_reports_source_check CHECK (((source)::text = ANY ((ARRAY['AI_DETECTED'::character varying, 'TEACHER_REPORTED'::character varying])::text[])))
);

CREATE TABLE public.invoice_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    description character varying(180) NOT NULL,
    type character varying(16) NOT NULL,
    amount numeric(12,2) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT invoice_line_items_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT invoice_line_items_type_check CHECK (((type)::text = ANY ((ARRAY['CHARGE'::character varying, 'CREDIT'::character varying])::text[])))
);

CREATE TABLE public.lesson_credit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_credit_id uuid NOT NULL,
    event_type character varying(32) NOT NULL,
    from_status character varying(32),
    to_status character varying(32) NOT NULL,
    source_session_id uuid,
    target_session_id uuid,
    note character varying(500),
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_credit_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['CREATED'::character varying, 'PAYMENT_ACTIVATED'::character varying, 'LESSON_BOOKED'::character varying, 'ATTENDANCE_RECORDED'::character varying, 'ABSENCE_COUNTED'::character varying, 'MAKEUP_APPROVED'::character varying, 'MAKEUP_SCHEDULED'::character varying, 'MAKEUP_RESCHEDULED'::character varying, 'MAKEUP_CANCELLED'::character varying, 'MAKEUP_COMPLETED'::character varying, 'SESSION_CANCELLED'::character varying, 'MANUAL_ADJUSTMENT'::character varying])::text[])))
);

CREATE TABLE public.lesson_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_package_id uuid NOT NULL,
    sequence_number integer NOT NULL,
    original_session_id uuid,
    current_session_id uuid,
    source_attendance_record_id uuid,
    status character varying(32) NOT NULL,
    absence_reason character varying(32),
    decision_note character varying(500),
    decided_by_admin_id uuid,
    expires_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT lesson_credits_absence_reason_check CHECK (((absence_reason)::text = ANY ((ARRAY['ILLNESS'::character varying, 'ADVANCE_NOTICE'::character varying, 'NO_NOTICE'::character varying, 'SCHOOL_CANCELLED'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT lesson_credits_sequence_number_check CHECK ((sequence_number > 0)),
    CONSTRAINT lesson_credits_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING_PAYMENT'::character varying, 'AVAILABLE'::character varying, 'BOOKED'::character varying, 'USED'::character varying, 'COUNTED_ABSENCE'::character varying, 'MAKEUP_DUE'::character varying, 'MAKEUP_SCHEDULED'::character varying, 'EXPIRED'::character varying, 'VOID'::character varying])::text[])))
);

CREATE TABLE public.lesson_makeup_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_credit_id uuid NOT NULL,
    student_id uuid NOT NULL,
    preferred_session_id uuid NOT NULL,
    status character varying(20) DEFAULT 'SUBMITTED'::character varying NOT NULL,
    student_note character varying(500),
    review_note character varying(500),
    reviewed_by_admin_id uuid,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT lesson_makeup_requests_status_check CHECK (((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'APPROVED'::character varying, 'DECLINED'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE public.login_attempt_windows (
    identity_digest character varying(64) NOT NULL,
    window_id uuid NOT NULL,
    attempt_count integer NOT NULL,
    first_attempt_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    version bigint NOT NULL,
    CONSTRAINT login_attempt_windows_attempt_count_check CHECK ((attempt_count >= 0))
);

CREATE TABLE public.login_sessions (
    credential_digest character varying(64) NOT NULL,
    account_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT login_session_expiry CHECK ((expires_at > created_at)),
    CONSTRAINT login_sessions_role_check CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'TEACHER'::character varying, 'STUDENT'::character varying])::text[])))
);

CREATE TABLE public.manual_payment_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    method character varying(24) NOT NULL,
    amount numeric(12,2) NOT NULL,
    student_note text,
    original_file_name character varying(255),
    content_type character varying(100),
    file_size bigint NOT NULL,
    status character varying(16) DEFAULT 'PENDING'::character varying NOT NULL,
    reviewed_by_admin_id uuid,
    review_note text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT chk_manual_payment_receipt_presence CHECK (((((method)::text = 'CASH'::text) AND (original_file_name IS NULL) AND (content_type IS NULL) AND (file_size = 0)) OR ((original_file_name IS NOT NULL) AND (content_type IS NOT NULL) AND (file_size > 0)))),
    CONSTRAINT manual_payment_submissions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT manual_payment_submissions_method_check CHECK (((method)::text = ANY ((ARRAY['BANK_TRANSFER'::character varying, 'CASH'::character varying])::text[]))),
    CONSTRAINT manual_payment_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);

CREATE TABLE public.overall_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by_id uuid NOT NULL,
    scope_key character varying(64) NOT NULL,
    document text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finalized_at timestamp with time zone,
    privacy_reviewed_by character varying(255),
    privacy_reviewed_at timestamp with time zone,
    version bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.payment_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_name character varying(120) NOT NULL,
    bank_name character varying(120) NOT NULL,
    account_number character varying(80) NOT NULL,
    payment_reference character varying(120),
    instructions text,
    active boolean DEFAULT true NOT NULL,
    updated_by_admin_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(16) NOT NULL,
    provider character varying(40) NOT NULL,
    provider_reference character varying(120) NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    CONSTRAINT payment_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['SUCCEEDED'::character varying, 'FAILED'::character varying, 'REFUNDED'::character varying])::text[])))
);

CREATE TABLE public.progress_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    course_offering_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campus_id uuid NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(160) NOT NULL,
    capacity integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.student_fee_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    title character varying(160) NOT NULL,
    request_details text NOT NULL,
    evidence_file_name character varying(255),
    evidence_content_type character varying(100),
    evidence_file_size bigint,
    status character varying(20) NOT NULL,
    reviewed_by_admin_id uuid,
    invoice_id uuid,
    review_note text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT student_fee_requests_status_check CHECK (((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'INVOICED'::character varying, 'DECLINED'::character varying])::text[])))
);

CREATE TABLE public.student_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    created_by_admin_id uuid NOT NULL,
    invoice_number character varying(32) NOT NULL,
    title character varying(160) NOT NULL,
    note text,
    due_date date NOT NULL,
    currency character varying(3) DEFAULT 'NZD'::character varying NOT NULL,
    status character varying(24) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    message_reviewed_at timestamp with time zone,
    message_draft_saved_at timestamp with time zone,
    last_emailed_at timestamp with time zone,
    last_delivery_key character varying(100),
    last_delivery_status character varying(16),
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT student_invoices_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING'::character varying, 'PARTIALLY_PAID'::character varying, 'PAID'::character varying, 'OVERDUE'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE public.student_learning_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    course_offering_id uuid NOT NULL,
    classroom_session_id uuid,
    purchase_mode character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'PENDING_PAYMENT'::character varying NOT NULL,
    valid_from date,
    valid_to date,
    session_allowance integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid,
    line_item_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT student_learning_entitlements_check CHECK (((valid_from IS NULL) OR (valid_to IS NULL) OR (valid_to >= valid_from))),
    CONSTRAINT student_learning_entitlements_purchase_mode_check CHECK (((purchase_mode)::text = ANY ((ARRAY['COURSE_ENROLMENT'::character varying, 'LESSON_PACKAGE'::character varying, 'MEMBERSHIP'::character varying, 'PAY_PER_LESSON'::character varying])::text[]))),
    CONSTRAINT student_learning_entitlements_session_allowance_check CHECK (((session_allowance IS NULL) OR (session_allowance > 0))),
    CONSTRAINT student_learning_entitlements_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING_PAYMENT'::character varying, 'ACTIVE'::character varying, 'COMPLETED'::character varying, 'EXPIRED'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE public.student_report_email_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    report_version bigint NOT NULL,
    status character varying(20) DEFAULT 'PROCESSING'::character varying NOT NULL,
    message character varying(1000) DEFAULT 'Email delivery is not yet confirmed.'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

CREATE TABLE public.student_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    scope_key character varying(64) NOT NULL,
    document text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    version bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.student_session_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    course_offering_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    entitlement_id uuid,
    purchased_sessions integer NOT NULL,
    service_from date NOT NULL,
    service_to date NOT NULL,
    absence_policy character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'PENDING_PAYMENT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paused_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    lifecycle_note character varying(500),
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT student_session_packages_absence_policy_check CHECK (((absence_policy)::text = ANY ((ARRAY['CONSUME_UNEXCUSED'::character varying, 'ATTENDANCE_ONLY'::character varying])::text[]))),
    CONSTRAINT student_session_packages_check CHECK ((service_to >= service_from)),
    CONSTRAINT student_session_packages_purchased_sessions_check CHECK ((purchased_sessions > 0)),
    CONSTRAINT student_session_packages_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING_PAYMENT'::character varying, 'ACTIVE'::character varying, 'PAUSED'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE public.student_support_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    requester_role character varying(24) NOT NULL,
    contact_name character varying(160) NOT NULL,
    relationship_to_student character varying(80),
    contact_email character varying(255) NOT NULL,
    contact_phone character varying(40),
    request_type character varying(32) NOT NULL,
    status character varying(20) DEFAULT 'SUBMITTED'::character varying NOT NULL,
    course_offering_id uuid,
    session_id uuid,
    leave_reason character varying(32),
    leave_lesson_treatment character varying(32),
    subject character varying(160) NOT NULL,
    message text NOT NULL,
    review_note text,
    reviewed_by_admin_id uuid,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    CONSTRAINT student_support_requests_leave_context CHECK ((((request_type)::text <> 'LEAVE'::text) OR ((session_id IS NOT NULL) AND (leave_reason IS NOT NULL)))),
    CONSTRAINT student_support_requests_leave_lesson_treatment_check CHECK (((leave_lesson_treatment IS NULL) OR ((leave_lesson_treatment)::text = ANY ((ARRAY['KEEP_CHARGED'::character varying, 'ALLOW_MAKEUP'::character varying])::text[])))),
    CONSTRAINT student_support_requests_leave_reason_check CHECK (((leave_reason)::text = ANY ((ARRAY['ILLNESS'::character varying, 'FAMILY'::character varying, 'SCHOOL_COMMITMENT'::character varying, 'EMERGENCY'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT student_support_requests_parent_contact CHECK ((((requester_role)::text <> 'PARENT_GUARDIAN'::text) OR ((relationship_to_student IS NOT NULL) AND (length(TRIM(BOTH FROM relationship_to_student)) > 0)))),
    CONSTRAINT student_support_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['LEAVE'::character varying, 'SCHEDULE_CHANGE'::character varying, 'PAYMENT_QUESTION'::character varying, 'MAKEUP'::character varying, 'GENERAL'::character varying])::text[]))),
    CONSTRAINT student_support_requests_requester_role_check CHECK (((requester_role)::text = ANY ((ARRAY['STUDENT'::character varying, 'PARENT_GUARDIAN'::character varying])::text[]))),
    CONSTRAINT student_support_requests_status_check CHECK (((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'APPROVED'::character varying, 'DECLINED'::character varying, 'RESOLVED'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_number character varying(32) NOT NULL,
    university_email character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    course character varying(120) NOT NULL,
    seat character varying(40) NOT NULL,
    programme character varying(160) DEFAULT ''::character varying NOT NULL,
    consent_given boolean DEFAULT false NOT NULL,
    face_enrollment_status character varying(30) DEFAULT 'NOT_ENROLLED'::character varying NOT NULL,
    level character varying(20) DEFAULT 'LEVEL_1'::character varying NOT NULL,
    password_hash character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    approval_status character varying(20) DEFAULT 'APPROVED'::character varying NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT students_approval_status_check2 CHECK (((approval_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT students_face_enrollment_status_check CHECK (((face_enrollment_status)::text = ANY ((ARRAY['NOT_ENROLLED'::character varying, 'PHOTO_CAPTURED'::character varying, 'VERIFIED'::character varying, 'FAILED'::character varying])::text[]))),
    CONSTRAINT students_level_check CHECK (((level)::text = ANY ((ARRAY['LEVEL_1'::character varying, 'LEVEL_2'::character varying, 'LEVEL_3'::character varying, 'LEVEL_4'::character varying])::text[]))),
    CONSTRAINT students_status_check2 CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'WITHDRAWN'::character varying])::text[])))
);

CREATE TABLE public.teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_number character varying(80) NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(160) NOT NULL,
    password_hash character varying(255),
    version bigint DEFAULT 0 NOT NULL,
    role character varying(20) DEFAULT 'TEACHER'::character varying NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT teachers_role_check CHECK (((role)::text = ANY ((ARRAY['TEACHER'::character varying, 'ADMIN'::character varying])::text[]))),
    CONSTRAINT teachers_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'DEACTIVATED'::character varying])::text[])))
);

ALTER TABLE ONLY public.accomplishment_feedback
    ADD CONSTRAINT accomplishment_feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accomplishments
    ADD CONSTRAINT accomplishments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.account_links
    ADD CONSTRAINT account_links_credential_digest_key UNIQUE (credential_digest);

ALTER TABLE ONLY public.account_links
    ADD CONSTRAINT account_links_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance_billing_overrides
    ADD CONSTRAINT attendance_billing_overrides_attendance_record_id_key UNIQUE (attendance_record_id);

ALTER TABLE ONLY public.attendance_billing_overrides
    ADD CONSTRAINT attendance_billing_overrides_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_unique_student_session UNIQUE (student_id, session_id);

ALTER TABLE ONLY public.behaviour_events
    ADD CONSTRAINT behaviour_events_external_event_id_unique UNIQUE (external_event_id);

ALTER TABLE ONLY public.behaviour_events
    ADD CONSTRAINT behaviour_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_account_activities
    ADD CONSTRAINT billing_account_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_name_key UNIQUE (name);

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.class_feedback
    ADD CONSTRAINT class_feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.class_reports
    ADD CONSTRAINT class_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.classroom_sessions
    ADD CONSTRAINT classroom_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_unique_student_offering UNIQUE (student_id, course_offering_id);

ALTER TABLE ONLY public.course_offering_teachers
    ADD CONSTRAINT course_offering_teachers_pkey PRIMARY KEY (course_offering_id, teacher_id);

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_offering_code_key UNIQUE (offering_code);

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.face_enrollments
    ADD CONSTRAINT face_enrollments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.face_enrollments
    ADD CONSTRAINT face_enrollments_student_id_key UNIQUE (student_id);

ALTER TABLE ONLY public.feedback_summaries
    ADD CONSTRAINT feedback_summaries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.health_alerts
    ADD CONSTRAINT health_alerts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.health_incident_reports
    ADD CONSTRAINT health_incident_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lesson_credit_events
    ADD CONSTRAINT lesson_credit_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lesson_credits
    ADD CONSTRAINT lesson_credits_package_sequence_unique UNIQUE (session_package_id, sequence_number);

ALTER TABLE ONLY public.lesson_credits
    ADD CONSTRAINT lesson_credits_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lesson_makeup_requests
    ADD CONSTRAINT lesson_makeup_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.login_attempt_windows
    ADD CONSTRAINT login_attempt_windows_pkey PRIMARY KEY (identity_digest);

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_pkey PRIMARY KEY (credential_digest);

ALTER TABLE ONLY public.manual_payment_submissions
    ADD CONSTRAINT manual_payment_submissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.overall_reports
    ADD CONSTRAINT overall_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_bank_accounts
    ADD CONSTRAINT payment_bank_accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_provider_reference_key UNIQUE (provider_reference);

ALTER TABLE ONLY public.progress_reports
    ADD CONSTRAINT progress_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_unique_campus_code UNIQUE (campus_id, code);

ALTER TABLE ONLY public.student_fee_requests
    ADD CONSTRAINT student_fee_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_invoices
    ADD CONSTRAINT student_invoices_invoice_number_key UNIQUE (invoice_number);

ALTER TABLE ONLY public.student_invoices
    ADD CONSTRAINT student_invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_learning_entitlements
    ADD CONSTRAINT student_learning_entitlements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_report_email_deliveries
    ADD CONSTRAINT student_report_email_deliveries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_reports
    ADD CONSTRAINT student_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_session_packages
    ADD CONSTRAINT student_session_packages_entitlement_id_key UNIQUE (entitlement_id);

ALTER TABLE ONLY public.student_session_packages
    ADD CONSTRAINT student_session_packages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.student_support_requests
    ADD CONSTRAINT student_support_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_number_key UNIQUE (student_number);

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_university_email_key UNIQUE (university_email);

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_email_key UNIQUE (email);

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_staff_number_key UNIQUE (staff_number);

ALTER TABLE ONLY public.student_report_email_deliveries
    ADD CONSTRAINT uq_student_report_email_revision UNIQUE (report_id, report_version);

CREATE INDEX idx_accomplishment_feedback_accomplishment ON public.accomplishment_feedback USING btree (accomplishment_id);

CREATE UNIQUE INDEX idx_accomplishment_feedback_ack_unique ON public.accomplishment_feedback USING btree (accomplishment_id) WHERE ((type)::text = 'ACKNOWLEDGEMENT'::text);

CREATE UNIQUE INDEX idx_accomplishment_feedback_pending_unique ON public.accomplishment_feedback USING btree (accomplishment_id) WHERE (((type)::text = 'CORRECTION_REQUEST'::text) AND ((status)::text = 'PENDING'::text));

CREATE INDEX idx_accomplishments_course_id ON public.accomplishments USING btree (course_offering_id);

CREATE INDEX idx_accomplishments_date ON public.accomplishments USING btree (achievement_date);

CREATE INDEX idx_accomplishments_status ON public.accomplishments USING btree (status);

CREATE INDEX idx_accomplishments_student_id ON public.accomplishments USING btree (student_id);

CREATE INDEX idx_account_links_expiry ON public.account_links USING btree (expires_at);

CREATE INDEX idx_account_links_pending ON public.account_links USING btree (state, created_at, id);

CREATE INDEX idx_attendance_billing_overrides_admin ON public.attendance_billing_overrides USING btree (updated_by_admin_id, updated_at DESC);

CREATE INDEX idx_attendance_records_session_id ON public.attendance_records USING btree (session_id);

CREATE INDEX idx_attendance_records_student_id ON public.attendance_records USING btree (student_id);

CREATE INDEX idx_behaviour_events_review_status ON public.behaviour_events USING btree (review_status);

CREATE INDEX idx_behaviour_events_session_id ON public.behaviour_events USING btree (session_id);

CREATE INDEX idx_behaviour_events_student_id ON public.behaviour_events USING btree (student_id);

CREATE INDEX idx_behaviour_events_track_id ON public.behaviour_events USING btree (track_id);

CREATE INDEX idx_billing_account_activities_invoice ON public.billing_account_activities USING btree (invoice_id, created_at DESC);

CREATE INDEX idx_billing_account_activities_student ON public.billing_account_activities USING btree (student_id, created_at DESC);

CREATE INDEX idx_class_feedback_course_offering_id ON public.class_feedback USING btree (course_offering_id);

CREATE INDEX idx_class_feedback_teacher_id ON public.class_feedback USING btree (teacher_id);

CREATE INDEX idx_class_reports_finalized ON public.class_reports USING btree (course_offering_id, finalized_at);

CREATE INDEX idx_class_reports_scope ON public.class_reports USING btree (course_offering_id, created_by_id, scope_key);

CREATE INDEX idx_classroom_sessions_course_offering_id ON public.classroom_sessions USING btree (course_offering_id);

CREATE INDEX idx_classroom_sessions_room_id ON public.classroom_sessions USING btree (room_id);

CREATE INDEX idx_classroom_sessions_schedule_series ON public.classroom_sessions USING btree (schedule_series_id, session_date) WHERE (schedule_series_id IS NOT NULL);

CREATE INDEX idx_classroom_sessions_teacher_id ON public.classroom_sessions USING btree (teacher_id);

CREATE INDEX idx_course_enrollments_course_offering_id ON public.course_enrollments USING btree (course_offering_id);

CREATE INDEX idx_course_enrollments_student_id ON public.course_enrollments USING btree (student_id);

CREATE INDEX idx_course_offering_teachers_teacher_id ON public.course_offering_teachers USING btree (teacher_id);

CREATE INDEX idx_course_offerings_course_id ON public.course_offerings USING btree (course_id);

CREATE INDEX idx_courses_code ON public.courses USING btree (code);

CREATE INDEX idx_face_enrollments_student_id ON public.face_enrollments USING btree (student_id);

CREATE INDEX idx_feedback_summaries_course_id ON public.feedback_summaries USING btree (course_offering_id);

CREATE INDEX idx_feedback_summaries_status ON public.feedback_summaries USING btree (status);

CREATE INDEX idx_feedback_summaries_student_id ON public.feedback_summaries USING btree (student_id);

CREATE UNIQUE INDEX idx_health_alerts_external_event_id ON public.health_alerts USING btree (external_event_id);

CREATE INDEX idx_health_alerts_session_id ON public.health_alerts USING btree (session_id);

CREATE INDEX idx_health_alerts_status ON public.health_alerts USING btree (status);

CREATE INDEX idx_health_alerts_student_id ON public.health_alerts USING btree (student_id);

CREATE INDEX idx_health_alerts_track_id ON public.health_alerts USING btree (track_id);

CREATE INDEX idx_health_incident_reports_course_offering_id ON public.health_incident_reports USING btree (course_offering_id);

CREATE INDEX idx_health_incident_reports_health_alert_id ON public.health_incident_reports USING btree (health_alert_id);

CREATE INDEX idx_health_incident_reports_student_id ON public.health_incident_reports USING btree (student_id);

CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items USING btree (invoice_id, "position");

CREATE INDEX idx_learning_entitlements_invoice ON public.student_learning_entitlements USING btree (invoice_id, "position");

CREATE UNIQUE INDEX idx_learning_entitlements_line_item ON public.student_learning_entitlements USING btree (line_item_id) WHERE (line_item_id IS NOT NULL);

CREATE INDEX idx_learning_entitlements_session ON public.student_learning_entitlements USING btree (student_id, classroom_session_id) WHERE (classroom_session_id IS NOT NULL);

CREATE INDEX idx_learning_entitlements_student_offering ON public.student_learning_entitlements USING btree (student_id, course_offering_id, purchase_mode, status);

CREATE INDEX idx_lesson_credit_events_credit ON public.lesson_credit_events USING btree (lesson_credit_id, created_at);

CREATE INDEX idx_lesson_credits_current_session ON public.lesson_credits USING btree (current_session_id, status);

CREATE INDEX idx_lesson_credits_package_status ON public.lesson_credits USING btree (session_package_id, status);

CREATE UNIQUE INDEX idx_lesson_makeup_requests_open_credit ON public.lesson_makeup_requests USING btree (lesson_credit_id) WHERE ((status)::text = 'SUBMITTED'::text);

CREATE INDEX idx_lesson_makeup_requests_status ON public.lesson_makeup_requests USING btree (status, submitted_at);

CREATE INDEX idx_lesson_makeup_requests_student ON public.lesson_makeup_requests USING btree (student_id, submitted_at DESC);

CREATE INDEX idx_login_attempt_windows_expiry ON public.login_attempt_windows USING btree (expires_at);

CREATE INDEX idx_login_sessions_account ON public.login_sessions USING btree (account_id);

CREATE INDEX idx_login_sessions_expiry ON public.login_sessions USING btree (expires_at);

CREATE UNIQUE INDEX idx_manual_payment_pending_invoice ON public.manual_payment_submissions USING btree (invoice_id) WHERE ((status)::text = 'PENDING'::text);

CREATE INDEX idx_manual_payment_review_queue ON public.manual_payment_submissions USING btree (status, submitted_at);

CREATE INDEX idx_overall_reports_finalized ON public.overall_reports USING btree (finalized_at);

CREATE INDEX idx_overall_reports_scope ON public.overall_reports USING btree (created_by_id, scope_key);

CREATE UNIQUE INDEX idx_payment_bank_account_active ON public.payment_bank_accounts USING btree (active) WHERE (active = true);

CREATE INDEX idx_payment_transactions_invoice ON public.payment_transactions USING btree (invoice_id, occurred_at DESC);

CREATE INDEX idx_progress_reports_course_offering_id ON public.progress_reports USING btree (course_offering_id);

CREATE INDEX idx_progress_reports_student_id ON public.progress_reports USING btree (student_id);

CREATE INDEX idx_rooms_code ON public.rooms USING btree (code);

CREATE INDEX idx_session_packages_student_offering ON public.student_session_packages USING btree (student_id, course_offering_id, service_from, service_to);

CREATE INDEX idx_student_fee_requests_status ON public.student_fee_requests USING btree (status, submitted_at DESC);

CREATE INDEX idx_student_fee_requests_student ON public.student_fee_requests USING btree (student_id, submitted_at DESC);

CREATE INDEX idx_student_invoices_status_due ON public.student_invoices USING btree (status, due_date);

CREATE INDEX idx_student_invoices_student_due ON public.student_invoices USING btree (student_id, due_date DESC);

CREATE INDEX idx_student_reports_published ON public.student_reports USING btree (student_id, published_at);

CREATE INDEX idx_student_reports_scope ON public.student_reports USING btree (student_id, created_by_id, scope_key);

CREATE UNIQUE INDEX idx_student_support_requests_open_leave ON public.student_support_requests USING btree (student_id, session_id) WHERE (((request_type)::text = 'LEAVE'::text) AND ((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'APPROVED'::character varying])::text[])));

CREATE INDEX idx_student_support_requests_status ON public.student_support_requests USING btree (status, submitted_at);

CREATE INDEX idx_student_support_requests_student ON public.student_support_requests USING btree (student_id, submitted_at DESC);

CREATE INDEX idx_teachers_email ON public.teachers USING btree (email);

ALTER TABLE ONLY public.accomplishment_feedback
    ADD CONSTRAINT accomplishment_feedback_accomplishment_id_fkey FOREIGN KEY (accomplishment_id) REFERENCES public.accomplishments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.accomplishment_feedback
    ADD CONSTRAINT accomplishment_feedback_reviewed_by_teacher_id_fkey FOREIGN KEY (reviewed_by_teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.accomplishments
    ADD CONSTRAINT accomplishments_confirmed_by_teacher_id_fkey FOREIGN KEY (confirmed_by_teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.accomplishments
    ADD CONSTRAINT accomplishments_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id);

ALTER TABLE ONLY public.accomplishments
    ADD CONSTRAINT accomplishments_created_by_teacher_id_fkey FOREIGN KEY (created_by_teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.accomplishments
    ADD CONSTRAINT accomplishments_revoked_by_teacher_id_fkey FOREIGN KEY (revoked_by_teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.accomplishments
    ADD CONSTRAINT accomplishments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance_billing_overrides
    ADD CONSTRAINT attendance_billing_overrides_attendance_record_id_fkey FOREIGN KEY (attendance_record_id) REFERENCES public.attendance_records(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance_billing_overrides
    ADD CONSTRAINT attendance_billing_overrides_updated_by_admin_id_fkey FOREIGN KEY (updated_by_admin_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.classroom_sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.behaviour_events
    ADD CONSTRAINT behaviour_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.classroom_sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.behaviour_events
    ADD CONSTRAINT behaviour_events_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.billing_account_activities
    ADD CONSTRAINT billing_account_activities_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.billing_account_activities
    ADD CONSTRAINT billing_account_activities_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.student_invoices(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.billing_account_activities
    ADD CONSTRAINT billing_account_activities_session_package_id_fkey FOREIGN KEY (session_package_id) REFERENCES public.student_session_packages(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.billing_account_activities
    ADD CONSTRAINT billing_account_activities_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.class_feedback
    ADD CONSTRAINT class_feedback_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id);

ALTER TABLE ONLY public.class_feedback
    ADD CONSTRAINT class_feedback_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.class_reports
    ADD CONSTRAINT class_reports_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.class_reports
    ADD CONSTRAINT class_reports_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.classroom_sessions
    ADD CONSTRAINT classroom_sessions_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.classroom_sessions
    ADD CONSTRAINT classroom_sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.classroom_sessions
    ADD CONSTRAINT classroom_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.course_offering_teachers
    ADD CONSTRAINT course_offering_teachers_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.course_offering_teachers
    ADD CONSTRAINT course_offering_teachers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.face_enrollments
    ADD CONSTRAINT face_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.feedback_summaries
    ADD CONSTRAINT feedback_summaries_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id);

ALTER TABLE ONLY public.feedback_summaries
    ADD CONSTRAINT feedback_summaries_created_by_teacher_id_fkey FOREIGN KEY (created_by_teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.feedback_summaries
    ADD CONSTRAINT feedback_summaries_reviewed_by_teacher_id_fkey FOREIGN KEY (reviewed_by_teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.feedback_summaries
    ADD CONSTRAINT feedback_summaries_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.health_alerts
    ADD CONSTRAINT health_alerts_reviewed_by_teacher_id_fkey FOREIGN KEY (reviewed_by_teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.health_alerts
    ADD CONSTRAINT health_alerts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.classroom_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.health_alerts
    ADD CONSTRAINT health_alerts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.health_incident_reports
    ADD CONSTRAINT health_incident_reports_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id);

ALTER TABLE ONLY public.health_incident_reports
    ADD CONSTRAINT health_incident_reports_health_alert_id_fkey FOREIGN KEY (health_alert_id) REFERENCES public.health_alerts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.health_incident_reports
    ADD CONSTRAINT health_incident_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.classroom_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.health_incident_reports
    ADD CONSTRAINT health_incident_reports_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.health_incident_reports
    ADD CONSTRAINT health_incident_reports_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.student_invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lesson_credit_events
    ADD CONSTRAINT lesson_credit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lesson_credit_events
    ADD CONSTRAINT lesson_credit_events_lesson_credit_id_fkey FOREIGN KEY (lesson_credit_id) REFERENCES public.lesson_credits(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lesson_credit_events
    ADD CONSTRAINT lesson_credit_events_source_session_id_fkey FOREIGN KEY (source_session_id) REFERENCES public.classroom_sessions(id);

ALTER TABLE ONLY public.lesson_credit_events
    ADD CONSTRAINT lesson_credit_events_target_session_id_fkey FOREIGN KEY (target_session_id) REFERENCES public.classroom_sessions(id);

ALTER TABLE ONLY public.lesson_credits
    ADD CONSTRAINT lesson_credits_current_session_id_fkey FOREIGN KEY (current_session_id) REFERENCES public.classroom_sessions(id);

ALTER TABLE ONLY public.lesson_credits
    ADD CONSTRAINT lesson_credits_decided_by_admin_id_fkey FOREIGN KEY (decided_by_admin_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lesson_credits
    ADD CONSTRAINT lesson_credits_original_session_id_fkey FOREIGN KEY (original_session_id) REFERENCES public.classroom_sessions(id);

ALTER TABLE ONLY public.lesson_credits
    ADD CONSTRAINT lesson_credits_session_package_id_fkey FOREIGN KEY (session_package_id) REFERENCES public.student_session_packages(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lesson_credits
    ADD CONSTRAINT lesson_credits_source_attendance_record_id_fkey FOREIGN KEY (source_attendance_record_id) REFERENCES public.attendance_records(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lesson_makeup_requests
    ADD CONSTRAINT lesson_makeup_requests_lesson_credit_id_fkey FOREIGN KEY (lesson_credit_id) REFERENCES public.lesson_credits(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lesson_makeup_requests
    ADD CONSTRAINT lesson_makeup_requests_preferred_session_id_fkey FOREIGN KEY (preferred_session_id) REFERENCES public.classroom_sessions(id);

ALTER TABLE ONLY public.lesson_makeup_requests
    ADD CONSTRAINT lesson_makeup_requests_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lesson_makeup_requests
    ADD CONSTRAINT lesson_makeup_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.manual_payment_submissions
    ADD CONSTRAINT manual_payment_submissions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.student_invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.manual_payment_submissions
    ADD CONSTRAINT manual_payment_submissions_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.overall_reports
    ADD CONSTRAINT overall_reports_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.payment_bank_accounts
    ADD CONSTRAINT payment_bank_accounts_updated_by_admin_id_fkey FOREIGN KEY (updated_by_admin_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.student_invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.progress_reports
    ADD CONSTRAINT progress_reports_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id);

ALTER TABLE ONLY public.progress_reports
    ADD CONSTRAINT progress_reports_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.progress_reports
    ADD CONSTRAINT progress_reports_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.student_fee_requests
    ADD CONSTRAINT student_fee_requests_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.student_invoices(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_fee_requests
    ADD CONSTRAINT student_fee_requests_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_fee_requests
    ADD CONSTRAINT student_fee_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_invoices
    ADD CONSTRAINT student_invoices_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.student_invoices
    ADD CONSTRAINT student_invoices_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_learning_entitlements
    ADD CONSTRAINT student_learning_entitlements_classroom_session_id_fkey FOREIGN KEY (classroom_session_id) REFERENCES public.classroom_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_learning_entitlements
    ADD CONSTRAINT student_learning_entitlements_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id);

ALTER TABLE ONLY public.student_learning_entitlements
    ADD CONSTRAINT student_learning_entitlements_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.student_invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_learning_entitlements
    ADD CONSTRAINT student_learning_entitlements_line_item_id_fkey FOREIGN KEY (line_item_id) REFERENCES public.invoice_line_items(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_learning_entitlements
    ADD CONSTRAINT student_learning_entitlements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_report_email_deliveries
    ADD CONSTRAINT student_report_email_deliveries_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.student_reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_reports
    ADD CONSTRAINT student_reports_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.teachers(id);

ALTER TABLE ONLY public.student_reports
    ADD CONSTRAINT student_reports_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_session_packages
    ADD CONSTRAINT student_session_packages_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id);

ALTER TABLE ONLY public.student_session_packages
    ADD CONSTRAINT student_session_packages_entitlement_id_fkey FOREIGN KEY (entitlement_id) REFERENCES public.student_learning_entitlements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_session_packages
    ADD CONSTRAINT student_session_packages_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.student_invoices(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_session_packages
    ADD CONSTRAINT student_session_packages_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.student_support_requests
    ADD CONSTRAINT student_support_requests_course_offering_id_fkey FOREIGN KEY (course_offering_id) REFERENCES public.course_offerings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_support_requests
    ADD CONSTRAINT student_support_requests_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_support_requests
    ADD CONSTRAINT student_support_requests_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.classroom_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.student_support_requests
    ADD CONSTRAINT student_support_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
