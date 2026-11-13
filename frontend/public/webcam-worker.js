/* Classic worker: MediaPipe's WASM loader uses importScripts. All assets are same-origin. */
let model;
let qualityCanvas, qualityContext;
function lighting(bitmap, box) {
  try {
    if (!box || box.width <= 0 || box.height <= 0) return null;
    if (!qualityCanvas) {
      qualityCanvas = new OffscreenCanvas(32, 32);
      qualityContext = qualityCanvas.getContext('2d', { willReadFrequently: true });
    }
    qualityContext.drawImage(bitmap, box.x * bitmap.width, box.y * bitmap.height,
      box.width * bitmap.width, box.height * bitmap.height, 0, 0, 32, 32);
    const pixels = qualityContext.getImageData(0, 0, 32, 32).data;
    let sum = 0, squares = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const value = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
      sum += value; squares += value * value;
    }
    const mean = sum / 1024;
    return { mean, contrast: Math.sqrt(Math.max(0, squares / 1024 - mean * mean)) };
  } catch { return null; } // An unsupported quality check must not break existing camera/video sharing.
}
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts('./webcam-model/vision_bundle.js');
      importScripts('./webcam-local-signals.js');
      const files = await Vision.FilesetResolver.forVisionTasks(new URL('./webcam-model/wasm', self.location.href).href);
      model = await Vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./webcam-model/face_landmarker.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 2,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false, outputFacialTransformationMatrixes: true
      });
      self.postMessage({ type: 'ready' });
    } catch {
      self.postMessage({ type: 'error', message: 'Could not load the webcam model. Ask the developer to run npm run setup:webcam, then retry in a supported browser.' });
    }
    return;
  }
  if (data.type !== 'frame') return;
  try {
    const started = performance.now();
    const result = model.detectForVideo(data.bitmap, data.timestamp);
    const boxes = result.faceLandmarks.map(points => {
      const xs = points.map(p => p.x), ys = points.map(p => p.y);
      const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys));
      return { x, y, width: Math.max(0, Math.min(1, Math.max(...xs)) - x), height: Math.max(0, Math.min(1, Math.max(...ys)) - y) };
    });
    self.postMessage({ type: 'result', timestamp: data.timestamp, count: boxes.length, boxes,
      matrix: boxes.length === 1 ? result.facialTransformationMatrixes[0]?.data ?? null : null,
      localEyes: boxes.length === 1 ? measureLocalFace(result.faceLandmarks[0], data.bitmap.width, data.bitmap.height, lighting(data.bitmap, boxes[0])) : null,
      inferenceMs: performance.now() - started });
  } catch {
    self.postMessage({ type: 'error', message: 'Face detection stopped unexpectedly. Stop and restart the camera test.' });
  } finally { data.bitmap.close(); }
};
