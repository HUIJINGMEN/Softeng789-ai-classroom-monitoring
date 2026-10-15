import { useState, type ComponentProps } from 'react';
import { StudentReportPreparation } from './StudentReportPreparation';
import { StudentReportDelivery } from './StudentReportDelivery';
import type { StudentReport } from './types';

type Props = Omit<
  ComponentProps<typeof StudentReportPreparation>,
  'onContinue' | 'resumeReport'
> & {
  showToast: (message: string) => void;
  initialReport?: StudentReport;
};

/** Both entry points preserve the selected scope when returning to editing. */
export function StudentReportFlow({ showToast, initialReport, ...props }: Props) {
  const [report, setReport] = useState<StudentReport | null>(initialReport ?? null);
  const [preview, setPreview] = useState(false);
  if (preview && report)
    return (
      <StudentReportDelivery
        report={report}
        onClose={props.onClose}
        onBack={() => setPreview(false)}
        showToast={showToast}
      />
    );
  return (
    <StudentReportPreparation
      {...props}
      resumeReport={report}
      onContinue={(next) => {
        setReport(next);
        setPreview(true);
      }}
    />
  );
}
