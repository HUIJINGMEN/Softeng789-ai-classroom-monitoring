import { useState } from 'react';
import { useCameraCapture } from '../../hooks/useCameraCapture';

export default function RecognitionCamera({ onCapture, onClose }: {
  onCapture: (image: string) => void; onClose: () => void;
}) {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [consent, setConsent] = useState(false);
  const { videoRef, canvasRef, stream, error, isStarting, startCamera, stopCamera, captureFrame } = useCameraCapture({
    facingMode, maxWidth: 1920, maxHeight: 1440,
  });
  function capture() {
    if (!consent || !stream || isStarting) return;
    const image = captureFrame();
    if (!image) return;
    stopCamera();
    onCapture(image);
  }
  return <section className="vision-capture" aria-label="Classroom camera">
    <h3>Take a classroom photo</h3>
    <p>Capture uploads one photo immediately for recognition. Check the results before saving attendance.</p>
    <label>Camera direction
      <select value={facingMode} onChange={e => { setConsent(false); setFacingMode(e.target.value as 'user' | 'environment'); }}>
        <option value="user">Front / laptop camera</option>
        <option value="environment">Rear camera (if available)</option>
      </select>
    </label>
    <video ref={videoRef} className="vision-camera" muted playsInline aria-label="Live camera preview" />
    <canvas ref={canvasRef} hidden />
    {isStarting && <p role="status">Starting camera…</p>}
    {error && <p role="alert">{error} Allow camera access on HTTPS or localhost, or close the camera and choose a photo file.</p>}
    <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Everyone in this camera frame consented to capture and biometric processing.</label>
    <div className="vision-actions">
      <button type="button" className="btn btn--primary" disabled={!consent || !stream || isStarting} onClick={capture}>Capture and recognize</button>
      {(!stream || error) && <button type="button" className="btn" disabled={isStarting} onClick={() => void startCamera()}>Retry camera</button>}
      <button type="button" className="btn" onClick={() => { stopCamera(); onClose(); }}>Close camera</button>
    </div>
  </section>;
}
