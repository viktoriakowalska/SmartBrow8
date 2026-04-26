import { ArrowLeft, ArrowRight, Camera, Check, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type ColorRole, type MarkerPoint, sampleAverageColor } from './color';
import { detectFaceColorPoints } from './faceAnalysis';
import TargetColorPicker from './TargetColorPicker';

type Screen = 'picker' | 'result';

type ColorState = {
  skin: string;
  brow: string;
  target: string;
};

type MarkerState = {
  skin: MarkerPoint | null;
  brow: MarkerPoint | null;
};

type FormulaItem = {
  name: string;
  amount: string;
  color: string;
};

type ImageSize = {
  width: number;
  height: number;
};

type PhotoViewport = {
  width: number;
  height: number;
};

type PhotoTransform = {
  scale: number;
  x: number;
  y: number;
};

type PhotoStage = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ViewPoint = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PinchState = {
  startDistance: number;
  startScale: number;
  contentX: number;
  contentY: number;
};

const demoPhotoUrl = `${import.meta.env.BASE_URL}demo-photo.png`;

const initialColors: ColorState = {
  skin: '#d98a5c',
  brow: '#67381d',
  target: '#67381d',
};

const initialMarkers: MarkerState = {
  skin: { x: 35, y: 42 },
  brow: { x: 57, y: 35 },
};

const initialImageSize: ImageSize = {
  width: 0,
  height: 0,
};

const initialPhotoViewport: PhotoViewport = {
  width: 0,
  height: 0,
};

const initialPhotoTransform: PhotoTransform = {
  scale: 1,
  x: 0,
  y: 0,
};

const minPhotoScale = 1;
const maxPhotoScale = 4;
const wheelZoomSpeed = 0.0015;
const dragThreshold = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const areTransformsEqual = (first: PhotoTransform, second: PhotoTransform) =>
  first.scale === second.scale && first.x === second.x && first.y === second.y;

const getPhotoStage = (viewport: PhotoViewport, imageSize: ImageSize): PhotoStage | null => {
  if (!viewport.width || !viewport.height || !imageSize.width || !imageSize.height) {
    return null;
  }

  const scale = Math.min(viewport.width / imageSize.width, viewport.height / imageSize.height);
  const width = imageSize.width * scale;
  const height = imageSize.height * scale;

  return {
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
    width,
    height,
  };
};

const constrainPhotoTransform = (
  transform: PhotoTransform,
  viewport: PhotoViewport,
  stage: PhotoStage | null,
): PhotoTransform => {
  const scale = clamp(transform.scale, minPhotoScale, maxPhotoScale);

  if (!stage || scale <= 1) {
    return initialPhotoTransform;
  }

  const scaledWidth = stage.width * scale;
  const scaledHeight = stage.height * scale;
  const centerX = (viewport.width - scaledWidth) / 2 - stage.left;
  const centerY = (viewport.height - scaledHeight) / 2 - stage.top;

  let x = transform.x;
  let y = transform.y;

  if (scaledWidth <= viewport.width) {
    x = centerX;
  } else {
    const minX = viewport.width - stage.left - scaledWidth;
    const maxX = -stage.left;
    x = clamp(x, minX, maxX);
  }

  if (scaledHeight <= viewport.height) {
    y = centerY;
  } else {
    const minY = viewport.height - stage.top - scaledHeight;
    const maxY = -stage.top;
    y = clamp(y, minY, maxY);
  }

  return { scale, x, y };
};

const getContentPoint = (stage: PhotoStage, transform: PhotoTransform, anchor: ViewPoint): ViewPoint => ({
  x: (anchor.x - stage.left - transform.x) / transform.scale,
  y: (anchor.y - stage.top - transform.y) / transform.scale,
});

const placeContentPoint = (
  stage: PhotoStage,
  viewport: PhotoViewport,
  contentPoint: ViewPoint,
  anchor: ViewPoint,
  scale: number,
): PhotoTransform =>
  constrainPhotoTransform(
    {
      scale,
      x: anchor.x - stage.left - contentPoint.x * scale,
      y: anchor.y - stage.top - contentPoint.y * scale,
    },
    viewport,
    stage,
  );

const getDistanceBetweenPoints = (first: ViewPoint, second: ViewPoint) =>
  Math.hypot(first.x - second.x, first.y - second.y);

const getMidpointBetweenPoints = (first: ViewPoint, second: ViewPoint): ViewPoint => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

const imagePointToMarker = (image: HTMLImageElement, point: ViewPoint): MarkerPoint => ({
  x: (clamp(point.x, 0, image.naturalWidth - 1) / image.naturalWidth) * 100,
  y: (clamp(point.y, 0, image.naturalHeight - 1) / image.naturalHeight) * 100,
});

// Mock/demo formula until real mixing formulas are provided by the client.
const formulaItems: FormulaItem[] = [
  { name: 'Graphite Black', amount: '1.0', color: '#182638' },
  { name: 'Brown', amount: '0.4', color: '#985c2d' },
  { name: 'Blue Corrector', amount: '0.15', color: '#178ec3' },
  { name: 'Oxidant 1.8%', amount: '1.2', color: '#4f50ba' },
];

const roleLabels: Record<ColorRole, string> = {
  skin: 'Колір шкіри',
  brow: 'Колір брів',
  target: 'Бажаний колір',
};

function BrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 42" aria-hidden="true" focusable="false">
      <path
        d="M7 25C19 9 39 4 62 10c7 2 12 6 13 10-14-7-29-9-44-3-9 3-15 8-19 14-4 0-6-2-5-6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d="M49 31c2 4 0 7-5 8M58 30c3 2 4 5 1 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function Stepper({ screen }: { screen: Screen }) {
  return (
    <div className="stepper" aria-label="Кроки">
      <span className={screen === 'picker' ? 'step is-active' : 'step'}>1</span>
      <span className={screen === 'result' ? 'step is-active' : 'step'}>2</span>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('picker');
  const [photoUrl, setPhotoUrl] = useState(demoPhotoUrl);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorState>(initialColors);
  const [activeRole, setActiveRole] = useState<ColorRole>('skin');
  const [markers, setMarkers] = useState<MarkerState>(initialMarkers);
  const [targetTouched, setTargetTouched] = useState(false);
  const [status, setStatus] = useState('Готово до вибору кольору.');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize>(initialImageSize);
  const [photoViewport, setPhotoViewport] = useState<PhotoViewport>(initialPhotoViewport);
  const [photoTransform, setPhotoTransform] = useState<PhotoTransform>(initialPhotoTransform);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const photoFrameRef = useRef<HTMLButtonElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const photoTransformRef = useRef(initialPhotoTransform);
  const photoStageRef = useRef<PhotoStage | null>(null);
  const photoViewportRef = useRef(initialPhotoViewport);
  const activePointersRef = useRef<Map<number, ViewPoint>>(new Map());
  const dragStateRef = useRef<DragState | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);
  const suppressPhotoClickRef = useRef(false);
  const photoStage = getPhotoStage(photoViewport, imageSize);

  photoStageRef.current = photoStage;
  photoViewportRef.current = photoViewport;

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  useEffect(() => {
    const frame = photoFrameRef.current;

    if (!frame) {
      return;
    }

    const updateViewport = () => {
      setPhotoViewport({
        width: frame.clientWidth,
        height: frame.clientHeight,
      });
    };

    updateViewport();

    const observer = new ResizeObserver(updateViewport);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!photoStage) {
      return;
    }

    setPhotoTransform((current) => {
      const constrained = constrainPhotoTransform(current, photoViewport, photoStage);
      photoTransformRef.current = constrained;
      return areTransformsEqual(current, constrained) ? current : constrained;
    });
  }, [imageSize.height, imageSize.width, photoViewport.height, photoViewport.width]);

  const applyPhotoTransform = (nextTransform: PhotoTransform | ((current: PhotoTransform) => PhotoTransform)) => {
    setPhotoTransform((current) => {
      const candidate = typeof nextTransform === 'function' ? nextTransform(current) : nextTransform;
      const constrained = constrainPhotoTransform(candidate, photoViewportRef.current, photoStageRef.current);

      photoTransformRef.current = constrained;
      return areTransformsEqual(current, constrained) ? current : constrained;
    });
  };

  const resetPhotoInteraction = () => {
    activePointersRef.current.clear();
    dragStateRef.current = null;
    pinchStateRef.current = null;
    suppressPhotoClickRef.current = false;
    photoTransformRef.current = initialPhotoTransform;
    setIsDraggingPhoto(false);
    setPhotoTransform(initialPhotoTransform);
  };

  const analyzeCurrentPhoto = async () => {
    const image = imageRef.current;

    if (!image || !image.complete || !image.naturalWidth) {
      return;
    }

    setImageSize({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    setIsAnalyzing(true);
    setStatus('Аналізуємо фото...');

    try {
      const points = await detectFaceColorPoints(image);

      if (!points) {
        setStatus('Не вдалося автоматично знайти обличчя. Оберіть колір вручну на фото.');
        return;
      }

      const skinColor = sampleAverageColor(image, points.skin);
      const browColor = sampleAverageColor(image, points.brow);

      setColors({
        skin: skinColor,
        brow: browColor,
        target: browColor,
      });
      setTargetTouched(false);
      setMarkers({
        skin: imagePointToMarker(image, points.skin),
        brow: imagePointToMarker(image, points.brow),
      });
      setStatus('Кольори визначено автоматично.');
    } catch (error) {
      console.warn('MediaPipe analysis failed', error);
      setStatus('Не вдалося автоматично знайти обличчя. Оберіть колір вручну на фото.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const setPhotoFromFile = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setObjectUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      return nextUrl;
    });
    setPhotoUrl(nextUrl);
    setImageSize(initialImageSize);
    resetPhotoInteraction();
    setMarkers(initialMarkers);
    setStatus('Фото завантажено.');
    setScreen('picker');
  };

  const resetDemo = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }

    setPhotoUrl(demoPhotoUrl);
    setImageSize(initialImageSize);
    resetPhotoInteraction();
    setColors(initialColors);
    setMarkers(initialMarkers);
    setTargetTouched(false);
    setStatus('Готово до вибору кольору.');
    setScreen('picker');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoFromFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const getFramePoint = (clientX: number, clientY: number): ViewPoint | null => {
    const frame = photoFrameRef.current;

    if (!frame) {
      return null;
    }

    const rect = frame.getBoundingClientRect();

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePhotoWheel = (event: React.WheelEvent<HTMLButtonElement>) => {
    const stage = photoStageRef.current;
    const point = getFramePoint(event.clientX, event.clientY);

    if (!stage || !point) {
      return;
    }

    event.preventDefault();

    const currentTransform = photoTransformRef.current;
    const contentPoint = getContentPoint(stage, currentTransform, point);
    const nextScale = currentTransform.scale * Math.exp(-event.deltaY * wheelZoomSpeed);

    applyPhotoTransform(placeContentPoint(stage, photoViewportRef.current, contentPoint, point, nextScale));
  };

  const handlePhotoPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const point = getFramePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, point);

    if (activePointersRef.current.size >= 2) {
      const [firstPoint, secondPoint] = Array.from(activePointersRef.current.values());
      const stage = photoStageRef.current;

      if (!stage) {
        return;
      }

      const midpoint = getMidpointBetweenPoints(firstPoint, secondPoint);
      const currentTransform = photoTransformRef.current;
      const contentPoint = getContentPoint(stage, currentTransform, midpoint);

      pinchStateRef.current = {
        startDistance: Math.max(getDistanceBetweenPoints(firstPoint, secondPoint), 1),
        startScale: currentTransform.scale,
        contentX: contentPoint.x,
        contentY: contentPoint.y,
      };
      dragStateRef.current = null;
      suppressPhotoClickRef.current = true;
      setIsDraggingPhoto(false);
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      originX: photoTransformRef.current.x,
      originY: photoTransformRef.current.y,
    };
    suppressPhotoClickRef.current = false;
  };

  const handlePhotoPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) {
      return;
    }

    const point = getFramePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    activePointersRef.current.set(event.pointerId, point);

    const stage = photoStageRef.current;

    if (!stage) {
      return;
    }

    if (activePointersRef.current.size >= 2 && pinchStateRef.current) {
      const [firstPoint, secondPoint] = Array.from(activePointersRef.current.values());
      const midpoint = getMidpointBetweenPoints(firstPoint, secondPoint);
      const nextScale =
        pinchStateRef.current.startScale *
        (Math.max(getDistanceBetweenPoints(firstPoint, secondPoint), 1) / pinchStateRef.current.startDistance);

      suppressPhotoClickRef.current = true;
      applyPhotoTransform(
        placeContentPoint(
          stage,
          photoViewportRef.current,
          { x: pinchStateRef.current.contentX, y: pinchStateRef.current.contentY },
          midpoint,
          nextScale,
        ),
      );
      return;
    }

    const dragState = dragStateRef.current;
    const currentTransform = photoTransformRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || currentTransform.scale <= 1) {
      return;
    }

    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;

    if (!suppressPhotoClickRef.current && Math.hypot(deltaX, deltaY) >= dragThreshold) {
      suppressPhotoClickRef.current = true;
      setIsDraggingPhoto(true);
    }

    if (!suppressPhotoClickRef.current) {
      return;
    }

    applyPhotoTransform({
      scale: currentTransform.scale,
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    });
  };

  const handlePhotoPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activePointersRef.current.delete(event.pointerId);

    if (activePointersRef.current.size >= 2) {
      const [firstPoint, secondPoint] = Array.from(activePointersRef.current.values());
      const stage = photoStageRef.current;

      if (!stage) {
        return;
      }

      const midpoint = getMidpointBetweenPoints(firstPoint, secondPoint);
      const currentTransform = photoTransformRef.current;
      const contentPoint = getContentPoint(stage, currentTransform, midpoint);

      pinchStateRef.current = {
        startDistance: Math.max(getDistanceBetweenPoints(firstPoint, secondPoint), 1),
        startScale: currentTransform.scale,
        contentX: contentPoint.x,
        contentY: contentPoint.y,
      };
      dragStateRef.current = null;
      return;
    }

    pinchStateRef.current = null;

    if (activePointersRef.current.size === 1) {
      const [pointerId, remainingPoint] = Array.from(activePointersRef.current.entries())[0];

      dragStateRef.current = {
        pointerId,
        startX: remainingPoint.x,
        startY: remainingPoint.y,
        originX: photoTransformRef.current.x,
        originY: photoTransformRef.current.y,
      };
      return;
    }

    dragStateRef.current = null;
    setIsDraggingPhoto(false);
  };

  const handlePhotoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const image = imageRef.current;
    const stage = photoStageRef.current;
    const point = getFramePoint(event.clientX, event.clientY);

    if (suppressPhotoClickRef.current) {
      suppressPhotoClickRef.current = false;
      return;
    }

    if (!image || !stage || !point || !stage.width || !stage.height) {
      return;
    }

    const currentTransform = photoTransformRef.current;
    const left = stage.left + currentTransform.x;
    const top = stage.top + currentTransform.y;
    const width = stage.width * currentTransform.scale;
    const height = stage.height * currentTransform.scale;

    if (point.x < left || point.x > left + width || point.y < top || point.y > top + height) {
      return;
    }

    const imagePoint = {
      x: clamp(((point.x - left) / currentTransform.scale / stage.width) * image.naturalWidth, 0, image.naturalWidth - 1),
      y: clamp(
        ((point.y - top) / currentTransform.scale / stage.height) * image.naturalHeight,
        0,
        image.naturalHeight - 1,
      ),
    };
    const marker = imagePointToMarker(image, imagePoint);
    const pickedColor = sampleAverageColor(image, imagePoint);

    setColors((current) => {
      if (activeRole === 'skin') {
        return { ...current, skin: pickedColor };
      }

      if (activeRole === 'brow') {
        return {
          ...current,
          brow: pickedColor,
          target: targetTouched ? current.target : pickedColor,
        };
      }

      return { ...current, target: pickedColor };
    });

    if (activeRole === 'skin' || activeRole === 'brow') {
      setMarkers((current) => ({ ...current, [activeRole]: marker }));
    }

    if (activeRole === 'target') {
      setTargetTouched(true);
    }

    setStatus(`${roleLabels[activeRole]} оновлено вручну.`);
  };

  const handleTargetColorChange = (nextTargetColor: string) => {
    setActiveRole('target');
    setTargetTouched(true);
    setColors((current) => ({ ...current, target: nextTargetColor }));
    setStatus(`${roleLabels.target} РѕРЅРѕРІР»РµРЅРѕ РІСЂСѓС‡РЅСѓ.`);
  };

  const handleTargetPhotoSampling = () => {
    setActiveRole('target');
    setTargetTouched(true);
    setStatus('РўРѕСЂРєРЅС–С‚СЊСЃСЏ С„РѕС‚Рѕ Р°Р±Рѕ РІРёР±РµСЂС–С‚СЊ РєРѕР»С–СЂ РЅР° РїР°Р»С–С‚СЂС–.');
  };

  const selectRole = (role: ColorRole) => {
    setActiveRole(role);

    if (role === 'target') {
      setTargetTouched(true);
    }
  };

  const photoFrameClassName = isDraggingPhoto ? 'photo-frame is-dragging' : 'photo-frame';
  const photoStageStyle = photoStage
    ? {
        left: `${photoStage.left}px`,
        top: `${photoStage.top}px`,
        width: `${photoStage.width}px`,
        height: `${photoStage.height}px`,
        transform: `translate(${photoTransform.x}px, ${photoTransform.y}px) scale(${photoTransform.scale})`,
      }
    : {
        transform: `translate(${photoTransform.x}px, ${photoTransform.y}px) scale(${photoTransform.scale})`,
      };

  return (
    <div className="app-page">
      <div className="phone-shell">
        <header className="topbar">
          <h1>SmartBrow</h1>
          <button className="demo-button" type="button" onClick={resetDemo}>
            Demo
          </button>
        </header>

        <Stepper screen={screen} />

        {screen === 'picker' ? (
          <main className="screen-content">
            <section className="panel photo-panel">
              <p className="photo-hint">Торкніться фото, щоб вибрати колір шкіри або брів</p>
              <button
                ref={photoFrameRef}
                className={photoFrameClassName}
                type="button"
                onClick={handlePhotoClick}
                onWheel={handlePhotoWheel}
                onPointerDown={handlePhotoPointerDown}
                onPointerMove={handlePhotoPointerMove}
                onPointerUp={handlePhotoPointerEnd}
                onPointerCancel={handlePhotoPointerEnd}
                aria-label={`Вибрати ${roleLabels[activeRole].toLowerCase()} на фото`}
              >
                <div className="photo-stage" style={photoStageStyle}>
                <img ref={imageRef} src={photoUrl} alt="Портрет для вибору кольору" onLoad={analyzeCurrentPhoto} />
                {photoStage && markers.skin ? (
                  <span className="marker marker-skin" style={{ left: `${markers.skin.x}%`, top: `${markers.skin.y}%` }} />
                ) : null}
                {photoStage && markers.brow ? (
                  <span className="marker marker-brow" style={{ left: `${markers.brow.x}%`, top: `${markers.brow.y}%` }} />
                ) : null}
                </div>
              </button>
              <p className={isAnalyzing ? 'status is-loading' : 'status'}>{status}</p>
            </section>

            <section className="panel color-panel">
              <h2>Виберіть, що налаштувати</h2>
              <div className="color-grid">
                <button
                  className={activeRole === 'skin' ? 'color-card is-selected' : 'color-card'}
                  type="button"
                  onClick={() => selectRole('skin')}
                >
                  <span className="selection-check">{activeRole === 'skin' ? <Check size={18} /> : null}</span>
                  <span className="face-icon" aria-hidden="true">
                    <span />
                  </span>
                  <span className="color-card-row">
                    <span>Колір шкіри</span>
                    <span className="color-square" style={{ backgroundColor: colors.skin }} />
                  </span>
                </button>

                <button
                  className={activeRole === 'brow' ? 'color-card is-selected' : 'color-card'}
                  type="button"
                  onClick={() => selectRole('brow')}
                >
                  <span className="selection-check">{activeRole === 'brow' ? <Check size={18} /> : null}</span>
                  <BrowIcon className="brow-icon" />
                  <span className="color-card-row">
                    <span>Колір брів</span>
                    <span className="color-square" style={{ backgroundColor: colors.brow }} />
                  </span>
                </button>
              </div>

              <h2 className="target-title">Бажаний колір</h2>
              <button
                className={activeRole === 'target' ? 'target-swatch is-selected' : 'target-swatch'}
                style={{ backgroundColor: colors.target }}
                type="button"
                onClick={() => selectRole('target')}
              >
                <BrowIcon className="target-icon" />
              </button>
              {activeRole === 'target' ? (
                <TargetColorPicker
                  value={colors.target}
                  onChange={handleTargetColorChange}
                  onPickFromPhoto={handleTargetPhotoSampling}
                />
              ) : null}
            </section>

            <div className="actions">
              <button className="primary-action" type="button" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={24} />
                Зробити фото
              </button>
              <button className="secondary-action" type="button" onClick={() => uploadInputRef.current?.click()}>
                <Upload size={23} />
                Завантажити фото
              </button>
            </div>

            <input
              ref={cameraInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileChange}
            />
            <input ref={uploadInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleFileChange} />
          </main>
        ) : (
          <main className="screen-content result-content">
            <section className="panel result-panel">
              <span className="formula-badge">
                <Sparkles size={15} />
                Рекомендована формула
              </span>
              <h2>Стандартна формула</h2>
              <ul className="formula-list">
                {formulaItems.map((item) => (
                  <li key={item.name}>
                    <span className="formula-dot" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                    <strong>{item.amount}</strong>
                  </li>
                ))}
              </ul>
              <div className="ratio-card">
                <span>Пропорція змішування</span>
                <strong>1 : 1.2</strong>
              </div>
            </section>
          </main>
        )}

        <footer className={screen === 'picker' ? 'bottom-nav is-next' : 'bottom-nav is-back'}>
          {screen === 'picker' ? (
            <button className="nav-link" type="button" onClick={() => setScreen('result')}>
              Далі
              <ArrowRight size={31} />
            </button>
          ) : (
            <button className="nav-link" type="button" onClick={() => setScreen('picker')}>
              <ArrowLeft size={31} />
              Назад
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
