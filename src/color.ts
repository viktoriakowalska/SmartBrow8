export type ColorRole = 'skin' | 'brow' | 'target';

export type ImagePoint = {
  x: number;
  y: number;
};

export type MarkerPoint = {
  x: number;
  y: number;
};

export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type HsvColor = {
  h: number;
  s: number;
  v: number;
};

type FitMetrics = {
  rect: DOMRect;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');

export const rgbToHex = (red: number, green: number, blue: number) =>
  `#${toHex(red)}${toHex(green)}${toHex(blue)}`;

export const hexToRgb = (value: string): RgbColor => {
  const normalized = value.trim().replace(/^#/, '');
  const expanded = normalized.length === 3 ? normalized.split('').map((part) => `${part}${part}`).join('') : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return { r: 109, g: 58, b: 32 };
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
};

export const rgbToHsv = ({ r, g, b }: RgbColor): HsvColor => {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  return {
    h: ((hue * 60) + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

export const hsvToRgb = ({ h, s, v }: HsvColor): RgbColor => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 1);
  const value = clamp(v, 0, 1);
  const chroma = value * saturation;
  const segment = hue / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = second;
  } else if (segment < 2) {
    red = second;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = second;
  } else if (segment < 4) {
    green = second;
    blue = chroma;
  } else if (segment < 5) {
    red = second;
    blue = chroma;
  } else {
    red = chroma;
    blue = second;
  }

  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  };
};

export const hsvToHex = (value: HsvColor) => {
  const rgb = hsvToRgb(value);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
};

export const hexToHsv = (value: string) => rgbToHsv(hexToRgb(value));

const getContainMetrics = (image: HTMLImageElement): FitMetrics => {
  const rect = image.getBoundingClientRect();
  const naturalWidth = image.naturalWidth || rect.width;
  const naturalHeight = image.naturalHeight || rect.height;
  const scale = Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
  const renderedWidth = naturalWidth * scale;
  const renderedHeight = naturalHeight * scale;

  return {
    rect,
    scale,
    renderedWidth,
    renderedHeight,
    offsetX: (rect.width - renderedWidth) / 2,
    offsetY: (rect.height - renderedHeight) / 2,
  };
};

export const clientToImagePoint = (
  image: HTMLImageElement,
  clientX: number,
  clientY: number,
): { imagePoint: ImagePoint; marker: MarkerPoint } => {
  const metrics = getContainMetrics(image);
  const localX = clientX - metrics.rect.left;
  const localY = clientY - metrics.rect.top;
  const imageX = (localX - metrics.offsetX) / metrics.scale;
  const imageY = (localY - metrics.offsetY) / metrics.scale;
  const clampedX = clamp(imageX, 0, image.naturalWidth - 1);
  const clampedY = clamp(imageY, 0, image.naturalHeight - 1);

  return {
    imagePoint: { x: clampedX, y: clampedY },
    marker: imagePointToMarker(image, { x: clampedX, y: clampedY }),
  };
};

export const imagePointToMarker = (image: HTMLImageElement, point: ImagePoint): MarkerPoint => {
  const metrics = getContainMetrics(image);
  const localX = metrics.offsetX + point.x * metrics.scale;
  const localY = metrics.offsetY + point.y * metrics.scale;

  return {
    x: (localX / metrics.rect.width) * 100,
    y: (localY / metrics.rect.height) * 100,
  };
};

export const sampleAverageColor = (image: HTMLImageElement, point: ImagePoint, size = 7): string => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context || !image.naturalWidth || !image.naturalHeight) {
    return '#6d3a20';
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const radius = Math.floor(size / 2);
  const startX = clamp(Math.round(point.x) - radius, 0, canvas.width - 1);
  const startY = clamp(Math.round(point.y) - radius, 0, canvas.height - 1);
  const width = Math.min(size, canvas.width - startX);
  const height = Math.min(size, canvas.height - startY);
  const pixels = context.getImageData(startX, startY, width, height).data;

  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
    count += 1;
  }

  return rgbToHex(red / count, green / count, blue / count);
};
