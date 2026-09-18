// Spring's default multipart file limit is 1 MB. Leave room for multipart headers and text fields.
const TARGET_BYTES = 850_000;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This photo could not be opened. Please take another one.'));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('This photo could not be prepared.'))),
      'image/jpeg',
      quality
    );
  });
}

/** Keeps phone photos below the server upload limit without visibly harming review evidence. */
export async function prepareFeedbackPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const image = await loadImage(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  let scale = Math.min(1, 1600 / longest);
  const canvas = document.createElement('canvas');
  let result: Blob | null = null;

  do {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare the photo.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.84;
    result = await canvasBlob(canvas, quality);
    while (result.size > TARGET_BYTES && quality > 0.5) {
      quality -= 0.1;
      result = await canvasBlob(canvas, quality);
    }
    scale *= 0.82;
  } while (result.size > TARGET_BYTES && longest * scale > 720);

  return result;
}
