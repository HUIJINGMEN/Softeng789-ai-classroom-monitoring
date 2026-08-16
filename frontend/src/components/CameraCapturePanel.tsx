import { useCallback, useEffect } from 'react';
import { useCameraCapture } from '../hooks/useCameraCapture';

interface Props {
  title: string;
  instruction: string;
  eyebrow?: string;
  captureLabel: string;
  busy?: boolean;
  status?: 'idle' | 'checking' | 'success' | 'error';
  statusText?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  autoCapture?: {
    enabled: boolean;
    delayMs: number;
    triggerKey: string;
    label: string;
  };
  progressDots?: Array<{
    key: string;
    state: 'pending' | 'current' | 'done';
  }>;
  completionText?: string;
  mirrorPreview?: boolean;
  showCaptureButton?: boolean;
  showResetButton?: boolean;
  hudMode?: 'standard' | 'minimal';
  stableActions?: boolean;
  onCapture: (photo: string) => void;
}

export default function CameraCapturePanel({
  title,
  instruction,
  eyebrow,
  captureLabel,
  busy = false,
  status = 'idle',
  statusText,
  secondaryAction,
  autoCapture,
  progressDots,
  completionText,
  mirrorPreview = true,
  showCaptureButton = true,
  showResetButton = true,
  hudMode = 'standard',
  stableActions = false,
  onCapture
}: Props) {
  const camera = useCameraCapture();
  const disabled = busy || camera.isStarting || !camera.stream;
  const autoCaptureEnabled = autoCapture?.enabled ?? false;
  const autoCaptureDelayMs = autoCapture?.delayMs ?? 0;
  const autoCaptureTriggerKey = autoCapture?.triggerKey ?? '';

  const capture = useCallback(() => {
    const photo = camera.captureFrame();
    if (photo) onCapture(photo);
  }, [camera.captureFrame, onCapture]);

  useEffect(() => {
    if (!autoCaptureEnabled || disabled || status !== 'idle') return undefined;

    const timer = window.setTimeout(capture, autoCaptureDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoCaptureDelayMs, autoCaptureEnabled, autoCaptureTriggerKey, capture, disabled, status]);

  const guidanceText =
    camera.error || (status === 'idle' ? instruction : statusText || instruction);
  const feedbackTone = camera.error ? 'error' : status;
  const guidanceStatus = camera.error
    ? 'Camera issue'
    : busy || status === 'checking'
      ? 'Hold still'
      : status === 'error'
        ? 'Try again'
        : status === 'success'
          ? 'Face detected'
          : autoCapture?.label || 'Face detected';
  const retryVisible = showCaptureButton || stableActions;

  return (
    <section className="camera-panel" aria-label={title}>
      <div
        className={`camera-frame camera-frame--guided camera-frame--${feedbackTone}${
          mirrorPreview ? ' camera-frame--mirrored' : ''
        }`}
      >
        <video ref={camera.videoRef} playsInline muted />

        <div className="camera-frame__topbar">
          <span className="camera-frame__label">{eyebrow || 'Camera'}</span>
          {progressDots && (
            <div className="camera-progress-dots" aria-label="Enrollment progress">
              {progressDots.map((dot) => (
                <span
                  key={dot.key}
                  className={`camera-progress-dot camera-progress-dot--${dot.state}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className={`face-guide face-guide--${feedbackTone}`} aria-hidden="true">
          <div className="face-guide__oval" />
          <div className="face-guide__line face-guide__line--eyes" />
          <div className="face-guide__line face-guide__line--chin" />
        </div>

        {status === 'success' && (
          <div className="camera-frame__success-mark" aria-hidden="true">
            ✓
          </div>
        )}

        <div
          className={`camera-frame__hud camera-frame__hud--${feedbackTone} camera-frame__hud--${hudMode}`}
          aria-live="polite"
        >
          <div className="camera-frame__hud-copy">
            <div className="camera-frame__hud-title">{title}</div>
            <div className="camera-frame__hud-text">
              {completionText || guidanceText}
            </div>
          </div>
          {hudMode === 'standard' && (
            <div className="camera-frame__microstatus">
              <span className="camera-frame__microdot" aria-hidden="true" />
              {completionText ? 'Complete' : guidanceStatus}
            </div>
          )}
        </div>

        {!camera.stream && (
          <div className="camera-frame__empty">
            {camera.isStarting ? 'Starting camera...' : 'Camera preview unavailable'}
          </div>
        )}
      </div>

      <canvas ref={camera.canvasRef} className="camera-canvas" aria-hidden="true" />

      {(showResetButton || retryVisible) && (
        <div className="camera-actions camera-actions--panel">
          {showResetButton && (
            <button
              type="button"
              className="btn"
              disabled={busy || camera.isStarting}
              onClick={camera.retakePhoto}
            >
              Reset camera
            </button>
          )}
          {retryVisible && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={disabled || (!showCaptureButton && stableActions)}
              onClick={capture}
            >
              {busy ? 'Checking...' : captureLabel}
            </button>
          )}
        </div>
      )}

      {secondaryAction && (
        <button
          type="button"
          className="btn btn--quiet camera-panel__secondary"
          disabled={busy || secondaryAction.disabled}
          onClick={secondaryAction.onClick}
        >
          {secondaryAction.label}
        </button>
      )}
    </section>
  );
}
