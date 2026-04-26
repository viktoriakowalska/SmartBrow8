import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ImagePoint } from './color';

type Landmark = {
  x: number;
  y: number;
};

export type FaceColorPoints = {
  brow: ImagePoint;
  skin: ImagePoint;
};

const visionTasksVersion = '0.10.34';
const wasmBaseUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${visionTasksVersion}/wasm`;
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getFaceLandmarker = async () => {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = FilesetResolver.forVisionTasks(wasmBaseUrl).then((vision) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
        },
        numFaces: 1,
        runningMode: 'IMAGE',
      }),
    );
  }

  return faceLandmarkerPromise;
};

const averagePoint = (landmarks: Landmark[], indices: number[], width: number, height: number): ImagePoint => {
  const points = indices.map((index) => landmarks[index]).filter(Boolean);
  const average = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: (average.x / points.length) * width,
    y: (average.y / points.length) * height,
  };
};

export const detectFaceColorPoints = async (image: HTMLImageElement): Promise<FaceColorPoints | null> => {
  const detector = await getFaceLandmarker();
  const result = detector.detect(image);
  const landmarks = result.faceLandmarks[0] as Landmark[] | undefined;

  if (!landmarks) {
    return null;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const brow = averagePoint(landmarks, [336, 296, 334, 293, 300], width, height);
  const skinOffset = Math.max(12, height * 0.055);
  const skin = {
    x: clamp(brow.x, 0, width - 1),
    y: clamp(brow.y - skinOffset, 0, height - 1),
  };

  return {
    brow: {
      x: clamp(brow.x, 0, width - 1),
      y: clamp(brow.y, 0, height - 1),
    },
    skin,
  };
};
