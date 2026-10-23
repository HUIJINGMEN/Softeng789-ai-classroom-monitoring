import { useEffect, useRef, useState } from 'react';
import type { PhotoFace, PhotoReview } from './types';

function FaceCrop({ source, face, number }: { source: string; face: PhotoFace; number: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    const image = new Image();
    const context = canvas.current?.getContext('2d');
    context?.clearRect(0, 0, 180, 180);
    image.onload = () => {
      if (!active || !context) return;
      const { x, y, width, height } = face.box;
      const left = Math.max(0, x - width * .2) * image.naturalWidth;
      const top = Math.max(0, y - height * .2) * image.naturalHeight;
      const right = Math.min(1, x + width * 1.2) * image.naturalWidth;
      const bottom = Math.min(1, y + height * 1.2) * image.naturalHeight;
      const w = right - left, h = bottom - top;
      if (w <= 0 || h <= 0) return;
      const scale = Math.min(180 / w, 180 / h);
      context.drawImage(image, left, top, w, h, (180 - w * scale) / 2, (180 - h * scale) / 2, w * scale, h * scale);
    };
    image.src = source;
    return () => { active = false; image.onload = null; };
  }, [source, face]);
  return <canvas ref={canvas} width={180} height={180} className="vision-face-crop" role="img" aria-label={`Enlarged face ${number}`} />;
}

export default function PhotoFaceReview({ review, preview, choices, late, busy, onChoose, onLate }: {
  review: PhotoReview; preview: string; choices: Record<string, string>; late: Record<string, boolean>; busy: boolean;
  onChoose: (faceId: string, studentId: string) => void; onLate: (faceId: string, value: boolean) => void;
}) {
  const faces = review.result.recognition.faces;
  const [activeId, setActiveId] = useState(faces[0]?.faceId ?? '');
  const detail = useRef<HTMLElement>(null);
  const index = Math.max(0, faces.findIndex(face => face.faceId === activeId));
  const face = faces[index];
  const completed = faces.filter(row => !!choices[row.faceId]).length;
  const excluded = faces.filter(row => choices[row.faceId] === 'EXCLUDE').length;
  const used = new Set(Object.entries(choices).filter(([id, student]) => id !== face?.faceId && student !== 'EXCLUDE').map(([, student]) => student));
  function activate(id: string, focus = false) {
    setActiveId(id);
    if (focus) detail.current?.focus();
  }
  return <div className="vision-group-review">
    <p role="status"><strong>{completed} of {faces.length} faces reviewed</strong> · {completed - excluded} selected · {excluded} excluded · {faces.length - completed} remaining</p>
    <p>Tap a face number to see its crop and matching students. Similarity is a comparison score, not a probability. Check each identity before selecting it.</p>
    {preview && <div className="vision-photo vision-photo-interactive">
      <img src={preview} alt="Classroom photo; select a numbered face to review" />
      {faces.map((row, i) => <button type="button" key={row.faceId} className="vision-box vision-box-button" disabled={busy}
        aria-label={`Review face ${i + 1}`} aria-pressed={row.faceId === face?.faceId}
        onClick={() => activate(row.faceId, true)} style={{ left: `${row.box.x * 100}%`, top: `${row.box.y * 100}%`, width: `${row.box.width * 100}%`, height: `${row.box.height * 100}%` }}><b>{i + 1}</b></button>)}
    </div>}
    {!faces.length && <p>No faces detected. Try a closer, well-lit photo or use manual attendance.</p>}
    {!!faces.length && <>
      <div className="vision-face-nav" role="group" aria-label="Detected faces">
        {faces.map((row, i) => <button type="button" key={row.faceId} disabled={busy} aria-pressed={row.faceId === face.faceId}
          aria-label={`Face ${i + 1}: ${choices[row.faceId] === 'EXCLUDE' ? 'excluded' : choices[row.faceId] ? 'selected' : 'needs review'}`}
          onClick={() => activate(row.faceId)}> {i + 1}{choices[row.faceId] ? ' ✓' : ''}</button>)}
      </div>
      <article ref={detail} tabIndex={-1} className="vision-face-detail" aria-label={`Reviewing face ${index + 1}`}>
        <div className="vision-face-header">
          {preview && <FaceCrop source={preview} face={face} number={index + 1} />}
          <div><h3>Face {index + 1} of {faces.length}</h3><p>{face.decision.replace(/_/g, ' ').toLowerCase()}</p>
            {!!face.qualityReasons.length && <p>{face.qualityReasons.join(', ').replace(/_/g, ' ')}</p>}
          </div>
        </div>
        {face.candidates.length ? <div className="vision-candidates">
          <p>Suggested matches — select after checking this face.</p>
          {face.candidates.map(candidate => {
            const student = review.result.roster.find(row => row.studentId === candidate.studentId);
            if (!student) return null;
            const selected = choices[face.faceId] === student.studentId;
            return <button key={student.studentId} type="button" className="btn vision-candidate" disabled={busy || used.has(student.studentId)}
              aria-label={`Select ${student.name} for face ${index + 1}`} aria-pressed={selected} onClick={() => onChoose(face.faceId, student.studentId)}>
              <strong>{selected ? 'Selected: ' : ''}{student.name}</strong><span>{student.studentNumber} · Similarity {candidate.similarity.toFixed(3)}{used.has(student.studentId) ? ' · Selected for another face' : ''}</span>
            </button>;
          })}
        </div> : <p>No identity suggestion. Choose only if you can verify this person; otherwise exclude this face and use manual attendance.</p>}
        <label>Confirm identity for face {index + 1}
          <select value={choices[face.faceId] ?? ''} disabled={busy} onChange={e => onChoose(face.faceId, e.target.value)}>
            <option value="">Choose after checking the photo</option><option value="EXCLUDE">Exclude / cannot identify</option>
            {review.result.roster.map(student => <option key={student.studentId} value={student.studentId} disabled={used.has(student.studentId)}>{student.name} ({student.studentNumber}){used.has(student.studentId) ? ' — already selected' : ''}</option>)}
          </select>
        </label>
        <p className="vision-selection" role="status">{choices[face.faceId] === 'EXCLUDE' ? 'Excluded — no attendance will be recorded for this face.'
          : choices[face.faceId] ? `Selected: ${review.result.roster.find(row => row.studentId === choices[face.faceId])?.name} — not saved yet.` : 'No student selected yet.'}</p>
        <label><input type="checkbox" checked={late[face.faceId] ?? false} disabled={busy || !choices[face.faceId] || choices[face.faceId] === 'EXCLUDE'}
          onChange={e => onLate(face.faceId, e.target.checked)} /> Mark this student late</label>
        <div className="vision-actions">
          <button type="button" className="btn" disabled={busy || index === 0} onClick={() => activate(faces[index - 1].faceId)}>Previous face</button>
          <button type="button" className="btn" disabled={busy || index === faces.length - 1} onClick={() => activate(faces[index + 1].faceId)}>Next face</button>
          <button type="button" className="btn" disabled={busy || completed === faces.length} onClick={() => activate(faces.find(row => !choices[row.faceId])!.faceId)}>Next unreviewed</button>
        </div>
      </article>
    </>}
  </div>;
}
