import { Pipette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { hexToHsv, hexToRgb, hsvToHex, type HsvColor } from './color';

type TargetColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  onPickFromPhoto: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function TargetColorPicker({ value, onChange, onPickFromPhoto }: TargetColorPickerProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const paletteRef = useRef<HTMLButtonElement | null>(null);
  const hsvRef = useRef(hsv);

  useEffect(() => {
    const nextHsv = hexToHsv(value);
    hsvRef.current = nextHsv;
    setHsv(nextHsv);
  }, [value]);

  const commitColor = (nextHsv: HsvColor) => {
    hsvRef.current = nextHsv;
    setHsv(nextHsv);
    onChange(hsvToHex(nextHsv));
  };

  const updateFromPalettePoint = (clientX: number, clientY: number) => {
    const palette = paletteRef.current;

    if (!palette) {
      return;
    }

    const rect = palette.getBoundingClientRect();
    const saturation = clamp((clientX - rect.left) / rect.width, 0, 1);
    const valueLevel = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);

    commitColor({
      ...hsvRef.current,
      s: saturation,
      v: valueLevel,
    });
  };

  const handlePalettePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPalettePoint(event.clientX, event.clientY);
  };

  const handlePalettePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    updateFromPalettePoint(event.clientX, event.clientY);
  };

  const handlePalettePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleHueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    commitColor({
      ...hsvRef.current,
      h: clamp(Number.parseFloat(event.target.value), 0, 360),
    });
  };

  const handleRgbChange =
    (channel: 'r' | 'g' | 'b') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.value === '') {
        return;
      }

      const rgb = hexToRgb(value);
      const nextValue = clamp(Number.parseInt(event.target.value, 10), 0, 255);
      const nextRgb = {
        ...rgb,
        [channel]: Number.isNaN(nextValue) ? rgb[channel] : nextValue,
      };

      onChange(
        `#${nextRgb.r.toString(16).padStart(2, '0')}${nextRgb.g.toString(16).padStart(2, '0')}${nextRgb.b
          .toString(16)
          .padStart(2, '0')}`,
      );
    };

  const rgb = hexToRgb(value);
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div className="target-picker">
      <button
        ref={paletteRef}
        className="target-picker-surface"
        type="button"
        style={{ backgroundColor: hueColor }}
        onPointerDown={handlePalettePointerDown}
        onPointerMove={handlePalettePointerMove}
        onPointerUp={handlePalettePointerEnd}
        onPointerCancel={handlePalettePointerEnd}
        aria-label="Выбрать насыщенность и яркость желаемого цвета"
      >
        <span className="target-picker-surface-white" />
        <span className="target-picker-surface-black" />
        <span
          className="target-picker-cursor"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
          }}
        />
      </button>

      <div className="target-picker-toolbar">
        <button className="target-picker-sample" type="button" onClick={onPickFromPhoto} aria-label="Выбрать цвет с фото">
          <Pipette size={18} />
        </button>

        <span className="target-picker-preview" style={{ backgroundColor: value }} aria-hidden="true" />

        <input
          className="target-picker-hue"
          type="range"
          min="0"
          max="360"
          step="1"
          value={Math.round(hsv.h)}
          onChange={handleHueChange}
          aria-label="Выбрать оттенок"
        />
      </div>

      <div className="target-picker-rgb">
        <label className="target-picker-channel">
          <input type="number" min="0" max="255" value={rgb.r} onChange={handleRgbChange('r')} aria-label="Красный канал" />
          <span>R</span>
        </label>
        <label className="target-picker-channel">
          <input type="number" min="0" max="255" value={rgb.g} onChange={handleRgbChange('g')} aria-label="Зеленый канал" />
          <span>G</span>
        </label>
        <label className="target-picker-channel">
          <input type="number" min="0" max="255" value={rgb.b} onChange={handleRgbChange('b')} aria-label="Синий канал" />
          <span>B</span>
        </label>
      </div>
    </div>
  );
}
