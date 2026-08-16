import { useCallback, useEffect, useRef, useState } from 'react';

export function useCameraCapture() {
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setStream(null);
  }, []);

  const playStream = useCallback(async (nextStream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;

    if (video.srcObject !== nextStream) {
      video.srcObject = nextStream;
    }

    if (video.readyState < 1) {
      await new Promise<void>((resolve) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      });
    }

    await video.play();
  }, []);

  const startCamera = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError('');
    setIsStarting(true);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setStream(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 }
        }
      });

      if (requestId !== requestIdRef.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = nextStream;
      setStream(nextStream);
      try {
        await playStream(nextStream);
      } catch (error) {
        const isInterruptedPlay = error instanceof DOMException && error.name === 'AbortError';
        if (!isInterruptedPlay) throw error;
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Camera permission was blocked. Allow camera access and try again.'
      );
    } finally {
      setIsStarting(false);
    }
  }, [playStream]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setError('Camera preview is not ready yet. Wait a moment and try again.');
      return null;
    }

    const width = video.videoWidth || 960;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not capture an image from this camera.');
      return null;
    }

    context.drawImage(video, 0, 0, width, height);
    const image = canvas.toDataURL('image/jpeg', 0.88);
    setError('');
    return image;
  }, []);

  const capturePhoto = useCallback(() => {
    const image = captureFrame();
    if (!image) return;
    setPhoto(image);
    stopCamera();
  }, [captureFrame, stopCamera]);

  const retakePhoto = useCallback(() => {
    setPhoto('');
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  return {
    videoRef,
    canvasRef,
    stream,
    photo,
    error,
    isStarting,
    startCamera,
    stopCamera,
    capturePhoto,
    captureFrame,
    retakePhoto
  };
}
