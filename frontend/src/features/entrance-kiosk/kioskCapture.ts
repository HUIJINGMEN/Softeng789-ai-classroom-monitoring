const MAX_EDGE = 960;

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not prepare the photo.'))), 'image/jpeg', quality);
  });
}

/**
 * Copies one frame of the live preview into a JPEG for the single kiosk upload.
 * The frame is not mirrored and nothing is kept after the upload resolves.
 */
export async function captureVideoFrame(video: HTMLVideoElement, maxBytes: number): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height || video.readyState < 2) throw new Error('The camera is not ready yet.');
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the photo.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    const limit = maxBytes > 0 ? maxBytes : 2 * 1024 * 1024;
    let quality = 0.86;
    let blob = await toJpeg(canvas, quality);
    while (blob.size > limit && quality > 0.5) {
      quality -= 0.12;
      blob = await toJpeg(canvas, quality);
    }
    if (blob.size > limit) throw new Error('The photo is too large to send.');
    return blob;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
