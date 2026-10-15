import { useEffect, useMemo, useState } from "react";
import { apiMessage } from "../../lib/apiClient";
import { usePagination } from "../../lib/table";
import { listStudentReportProgress } from "./api";
import { reportTaskStatus, studentReportTasks } from "./workspaceModel";
import type { Student } from "../../types";
import type { ReportTaskStatus, StudentReportProgress } from "./workspaceTypes";

export function useStudentReportWorkspace(
  students: Student[],
  courses: { id: string; label: string }[],
  dateFrom: string,
  dateTo: string,
) {
  const [course, setCourse] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReportTaskStatus | "">("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [progress, setProgress] = useState<StudentReportProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const valid = Boolean(dateFrom && dateTo && dateFrom <= dateTo);
  const tasks = useMemo(
    () => studentReportTasks(students, courses, dateFrom, dateTo, course),
    [students, courses, dateFrom, dateTo, course],
  );
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setProgress([]);
    if (!valid) {
      setLoading(false);
      return;
    }
    listStudentReportProgress(tasks.map((task) => task.scope))
      .then((rows) => {
        if (!cancelled) setProgress(rows);
      })
      .catch((cause) => {
        if (!cancelled) setError(apiMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tasks, valid, revision]);
  const rows = tasks.map((task) => ({
    ...task,
    progress: progress.find((row) => row.studentId === task.studentId),
  }));
  const searched = rows.filter((row) =>
    `${row.name} ${row.number}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const filtered = searched.filter(
    (row) => !status || reportTaskStatus(row.progress) === status,
  );
  const pagination = usePagination(filtered, page, setPage, 8);
  return {
    rows,
    searched,
    pagination,
    loading,
    error,
    valid,
    course,
    query,
    status,
    setCourse: (value: string) => {
      setCourse(value);
      setPage(0);
    },
    setQuery: (value: string) => {
      setQuery(value);
      setPage(0);
    },
    setStatus: (value: ReportTaskStatus | "") => {
      setStatus(value);
      setPage(0);
    },
    refresh: () => setRevision((value) => value + 1),
  };
}
