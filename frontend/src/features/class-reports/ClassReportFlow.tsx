import { useState } from "react";
import { ClassReportPreparation } from "./ClassReportPreparation";
import { ClassReportPreview } from "./ClassReportPreview";
import type { ClassReport, ClassReportScope } from "./types";

export function ClassReportFlow({
  scope,
  classLabel,
  onClose,
}: {
  scope: ClassReportScope;
  classLabel: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ClassReport | null>(null);
  const [draftScope, setDraftScope] = useState(scope);
  if (preview)
    return (
      <ClassReportPreview
        report={preview}
        onClose={onClose}
        onBack={() => {
          setDraftScope({
            courseOfferingId: preview.courseOfferingId,
            dateFrom: preview.document.dateFrom,
            dateTo: preview.document.dateTo,
          });
          setPreview(null);
        }}
      />
    );
  return (
    <ClassReportPreparation
      scope={draftScope}
      classLabel={classLabel}
      onClose={onClose}
      onContinue={setPreview}
    />
  );
}
