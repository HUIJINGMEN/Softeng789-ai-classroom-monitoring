import { useEffect, useRef, useState } from "react";
import { apiMessage } from "../../lib/apiClient";
import {
  hasReportEdits,
  reportDraftTargets,
  reviewedSectionCount,
  reportApprovalBlocker,
  reportEvidenceReviewed,
  type ReportEdits,
  type ReportAcknowledgements,
} from "./reportModel";
import { approveReportSections, ReportApprovalError } from "./reportApproval";
import { saveReportDrafts, ReportDraftSaveError } from "./reportDraftSave";
import {
  generateReportDrafts,
  type ReportGenerationProgress,
} from "./reportGeneration";
import type { ReportReviewApi, ReportTopic, ReviewableReport } from "./types";

function confirmGeneration(
  report: ReviewableReport,
  edits: ReportEdits,
  topic?: ReportTopic,
) {
  if (topic) {
    const section = report.document.sections.find(
      (item) => item.topic === topic,
    );
    if (!section?.text && !edits[topic]) return true;
    return window.confirm(
      "Replace this section with a newly generated draft? Saved and unsaved wording will be replaced.",
    );
  }
  if (
    !reportDraftTargets(report, edits).some((item) => item.stale && item.text)
  )
    return true;
  return window.confirm(
    "Update outdated drafts? Their saved wording will be replaced and must be reviewed again. Sections with unsaved edits are skipped; update them individually when ready.",
  );
}

export function useReportReview<
  R extends ReviewableReport,
  S extends { dateFrom: string; dateTo: string },
>(initialScope: S, api: ReportReviewApi<R, S>) {
  const [scope, setScope] = useState(initialScope);
  const [report, setReport] = useState<R | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [edits, setEdits] = useState<Partial<Record<ReportTopic, string>>>({});
  const [acknowledgements, setAcknowledgements] =
    useState<ReportAcknowledgements>({});
  const [busy, setBusy] = useState<
    ReportTopic | "load" | "prepare" | "all" | "approve-all" | "save-all" | null
  >("prepare");
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState<ReportGenerationProgress | null>(
    null,
  );
  const [sectionErrors, setSectionErrors] = useState<
    Partial<Record<ReportTopic, string>>
  >({});
  const mounted = useRef(true);
  const operation = useRef(false);
  const dirty = hasReportEdits(report, edits);
  const reviewed = reviewedSectionCount(report, edits);
  const approvalBlocker = reportApprovalBlocker(
    report,
    edits,
    acknowledgements,
  );
  const ready = Boolean(
    report &&
    sourceReady && !api.scopeChanged(scope, report) &&
    report.document.sections.length > 0 &&
    reviewed === report.document.sections.length,
  );
  const scopeValid = api.scopeValid(scope);
  const scopeChanged = Boolean(report && (!sourceReady || api.scopeChanged(scope, report)));

  // Preserve the original report editor flow: opening prepares current evidence and resumes saved wording.
  const acceptReport = (value: R | null, refreshed: boolean) => {
    if (!mounted.current) return;
    setReport(value);
    setSourceReady(refreshed);
    setEdits({});
    setAcknowledgements({});
    setSectionErrors({});
  };
  const acceptSection = (value: R, topic: ReportTopic) => {
    if (!mounted.current) return;
    setReport(value);
    setEdits((current) => {
      const remaining = { ...current };
      delete remaining[topic];
      return remaining;
    });
    setSectionErrors((current) => ({ ...current, [topic]: "" }));
  };

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    Promise.resolve()
      .then(() => (cancelled ? null : api.prepare(initialScope)))
      .then((value) => {
        if (!cancelled && value) {
          setReport(value);
          setSourceReady(true);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(apiMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  const reload = async () => {
    if (operation.current || !scopeValid) return;
    if (dirty && !window.confirm("Discard unsaved edits and view the saved draft?")) return;
    operation.current = true;
    setBusy("load");
    setError("");
    try {
      acceptReport(await api.load(scope), false);
    } catch (cause) {
      if (mounted.current) setError(apiMessage(cause));
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const prepare = async () => {
    if (operation.current || !scopeValid) return;
    if (
      dirty &&
      !window.confirm(
        "Discard unsaved text and load the saved draft for this scope?",
      )
    )
      return;
    operation.current = true;
    setBusy("prepare");
    setError("");
    try {
      acceptReport(await api.prepare(scope), true);
    } catch (cause) {
      if (mounted.current) setError(apiMessage(cause));
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const generate = async (topic?: ReportTopic) => {
    if (!report || operation.current || scopeChanged) return;
    if (!confirmGeneration(report, edits, topic)) return;
    const batch = reportDraftTargets(report, edits);
    const targets = topic
      ? report.document.sections.filter((section) => section.topic === topic)
      : batch;
    if (!targets.length) return;
    operation.current = true;
    setBusy(topic ?? "all");
    setError("");
    try {
      await generateReportDrafts(
        report,
        targets,
        api.generate,
        setGeneration,
        acceptSection,
        (target, message) => {
          setSectionErrors((current) => ({
            ...current,
            [target]: message,
          }));
        },
        () => mounted.current,
      );
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const save = async (topic: ReportTopic, approve: boolean) => {
    if (!report || operation.current || scopeChanged) return;
    const section = report.document.sections.find(
      (item) => item.topic === topic,
    );
    const text = edits[topic] ?? section?.text ?? "";
    if (!text.trim()) return;
    operation.current = true;
    setBusy(topic);
    try {
      const next = await api.save(
        report,
        topic,
        text,
        approve,
        Boolean(section && reportEvidenceReviewed(section, acknowledgements)),
      );
      acceptSection(next, topic);
    } catch (cause) {
      if (mounted.current)
        setSectionErrors((current) => ({
          ...current,
          [topic]: apiMessage(cause),
        }));
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const approveAll = async () => {
    if (
      !report ||
      operation.current ||
      scopeChanged ||
      approvalBlocker ||
      ready
    )
      return;
    operation.current = true;
    setBusy("approve-all");
    setError("");
    try {
      await approveReportSections(
        report,
        edits,
        api.save,
        acceptSection,
        acknowledgements,
      );
    } catch (cause) {
      if (mounted.current && cause instanceof ReportApprovalError) {
        const reason = apiMessage(cause.original);
        setError(
          `${cause.completed} of ${cause.total} pending sections saved and approved. Remaining edits are preserved. ${reason}`,
        );
        setSectionErrors((current) => ({ ...current, [cause.topic]: reason }));
      } else if (mounted.current) setError(apiMessage(cause));
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  const saveAll = async () => {
    if (!report || operation.current || scopeChanged || !dirty) return;
    operation.current = true;
    setBusy("save-all");
    setError("");
    try {
      await saveReportDrafts(report, edits, api.save, acceptSection);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof ReportDraftSaveError
            ? `${cause.completed}/${cause.total} changed drafts saved. Unsaved edits are preserved. ${apiMessage(cause.original)}`
            : apiMessage(cause),
        );
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  };
  return {
    scope,
    setScope,
    report,
    edits,
    setEdits,
    acknowledgements,
    setAcknowledgements,
    busy,
    error,
    sectionErrors,
    generation,
    dismissGeneration: () => {
      if (!busy) setGeneration(null);
    },
    approvalBlocker,
    approveAll,
    saveAll,
    dirty,
    reviewed,
    ready,
    scopeValid,
    scopeChanged,
    prepare,
    reload,
    generate,
    save,
  };
}
