import { useRef, useState } from 'react';
import { useCameraCapture } from '../../hooks/useCameraCapture';

export default function RecognitionCamera({ onCapture, onClose, selfCheckIn = false }: {
  onCapture: (image: string) => void; onClose: () => void; selfCheckIn?: boolean;
}) {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(selfCheckIn ? 'user' : 'environment');
  const [consent, setConsent] = useState(false);
  const [captured, setCaptured] = useState('');
  const submitted = useRef(false);
  const { videoRef, canvasRef, stream, error, isStarting, startCamera, stopCamera, captureFrame } = useCameraCapture({
    facingMode, maxWidth: 1920, maxHeight: 1440,
  });
  function capture() {
    if (!consent || !stream || isStarting) return;
    const image = captureFrame();
    if (!image) return;
    stopCamera();
    if (selfCheckIn) submit(image);
    else setCaptured(image);
  }
  function submit(image: string) {
    if (!consent || submitted.current) return;
    submitted.current = true;
    onCapture(image);
  }
  return <section className="vision-capture" aria-label="Classroom camera">
    <h3>{selfCheckIn ? 'Take your attendance photo' : 'Take a classroom photo'}</h3>
    <p>{selfCheckIn ? 'Show only your own face. One photo will be compared with your enrollment and sent for teacher approval if it matches. Attendance is not saved yet.' : captured ? 'Check that faces are clear. This photo has not been uploaded. Retake it or send it for recognition.' : 'Use the rear camera for a group. Keep faces large and well lit; photograph smaller groups if needed. You can review the photo before uploading.'}</p>
    {!captured && <label>Camera direction
      <select value={facingMode} onChange={e => { setConsent(false); setFacingMode(e.target.value as 'user' | 'environment'); }}>
        <option value="user">Front / laptop camera</option>
        <option value="environment">Rear camera (if available)</option>
      </select>
    </label>}
    {!captured && <p className="vision-review-muted">The browser may use another camera if the requested direction is unavailable. Check the preview.</p>}
    <video ref={videoRef} hidden={!!captured} className="vision-camera" muted playsInline aria-label="Live camera preview" />
    {captured && <img className="vision-camera" src={captured} alt="Classroom capture awaiting upload" />}
    <canvas ref={canvasRef} hidden />
    {isStarting && <p role="status">Starting camera…</p>}
    {error && <p role="alert">{error} Allow camera access on HTTPS or localhost. {selfCheckIn ? 'You can also ask your teacher for manual attendance.' : 'Or close the camera and choose a photo file.'}</p>}
    <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> {selfCheckIn ? 'I consent to submit my own face for this attendance request.' : 'Everyone in this camera frame consented to capture and biometric processing.'}</label>
    <div className="vision-actions">
      {!captured && <button type="button" className="btn btn--primary" disabled={!consent || !stream || isStarting} onClick={capture}>{selfCheckIn ? 'Capture and request attendance' : 'Take photo'}</button>}
      {captured && <>
        <button type="button" className="btn btn--primary" disabled={!consent} onClick={() => submit(captured)}>Use photo and recognize</button>
        <button type="button" className="btn" onClick={() => { setCaptured(''); setConsent(false); void startCamera(); }}>Retake photo</button>
      </>}
      {!captured && (!stream || error) && <button type="button" className="btn" disabled={isStarting} onClick={() => void startCamera()}>Retry camera</button>}
      <button type="button" className="btn" onClick={() => { stopCamera(); onClose(); }}>Close camera</button>
    </div>
  </section>;
}
