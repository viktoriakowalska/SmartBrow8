const supportedOutputTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type NormalizedImageAsset = {
  blob: Blob;
  height: number;
  width: number;
};

const loadImageElement = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for normalization.'));
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas export returned an empty blob.'));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });

const getOutputType = (file: File) => (supportedOutputTypes.has(file.type) ? file.type : 'image/png');

const getOutputQuality = (type: string) => (type === 'image/jpeg' || type === 'image/webp' ? 0.95 : undefined);

const drawNormalizedSource = (source: CanvasImageSource, width: number, height: number) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(source, 0, 0, width, height);

  return canvas;
};

const loadOrientedBitmap = async (file: File) => {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  try {
    return await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
  } catch (error) {
    console.warn('createImageBitmap with EXIF orientation failed, falling back to default decode.', error);

    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
};

export const normalizeUploadedImage = async (file: File): Promise<NormalizedImageAsset> => {
  const outputType = getOutputType(file);
  const outputQuality = getOutputQuality(outputType);
  const bitmap = await loadOrientedBitmap(file);

  if (bitmap) {
    try {
      const canvas = drawNormalizedSource(bitmap, bitmap.width, bitmap.height);
      const blob = await canvasToBlob(canvas, outputType, outputQuality);

      return {
        blob,
        height: canvas.height,
        width: canvas.width,
      };
    } finally {
      bitmap.close();
    }
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(sourceUrl);
    const canvas = drawNormalizedSource(image, image.naturalWidth, image.naturalHeight);
    const blob = await canvasToBlob(canvas, outputType, outputQuality);

    return {
      blob,
      height: canvas.height,
      width: canvas.width,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};
