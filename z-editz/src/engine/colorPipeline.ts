import type {
  ChromaKeySettings,
  ColorGrade,
  ColorWheelValue,
  CurvePoint,
  FilterPreset,
  RGBCurves,
  TransitionType,
} from '../types/editor';

export function createDefaultCurve(): CurvePoint[] {
  return [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.75 },
    { x: 1, y: 1 },
  ];
}

export function createDefaultCurves(): RGBCurves {
  return {
    master: createDefaultCurve(),
    red: createDefaultCurve(),
    green: createDefaultCurve(),
    blue: createDefaultCurve(),
  };
}

export function createDefaultWheel(): ColorWheelValue {
  return { r: 0, g: 0, b: 0, luma: 0 };
}

export function createDefaultColorGrade(): ColorGrade {
  return {
    exposure: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    gamma: 1,
    highlights: 0,
    shadows: 0,
    vignette: 0,
    blur: 0,
    sharpen: 0,
    curves: createDefaultCurves(),
    wheels: {
      lift: createDefaultWheel(),
      gamma: createDefaultWheel(),
      gain: createDefaultWheel(),
    },
  };
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'none',
    name: 'Original',
    category: 'Cinematic',
    description: 'Neutral untouched source color pipeline',
    grade: {},
  },
  {
    id: 'teal-orange',
    name: 'Teal & Orange Cine',
    category: 'Cinematic',
    description: 'Cool slate shadows with warm golden highlights',
    grade: { contrast: 18, saturation: 14, temperature: 16, shadows: -10, highlights: 12 },
    tintOverlay: { r: 16, g: 98, b: 124, alpha: 0.08 },
  },
  {
    id: 'film-noir',
    name: 'Film Noir',
    category: 'Monochrome',
    description: 'High-contrast monochrome with deep blacks and silver grain',
    grade: { saturation: -100, contrast: 38, exposure: -0.1, vignette: 35 },
    grain: 0.14,
  },
  {
    id: 'vintage-kodak',
    name: 'Kodak 2383 Warm',
    category: 'Vintage',
    description: 'Rich print-film curve with warm amber midtones',
    grade: { contrast: 14, temperature: 22, saturation: 8, gamma: 1.06, vignette: 20 },
    grain: 0.08,
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    category: 'Stylized',
    description: 'Lifted shadows and soft muted pastel palette',
    grade: { contrast: -18, saturation: -20, exposure: 0.18, shadows: 24, tint: 14 },
  },
  {
    id: 'vhs-retro',
    name: 'VHS Camcorder',
    category: 'Vintage',
    description: 'Analog chroma shift with scanlines and tape grain',
    grade: { contrast: 10, saturation: -15, temperature: -8, tint: 18, vignette: 28 },
    grain: 0.18,
    scanlines: true,
  },
  {
    id: 'nordic-cool',
    name: 'Nordic Slate',
    category: 'Cinematic',
    description: 'Crisp desaturated blues and clean neutral highlights',
    grade: { temperature: -28, saturation: -18, contrast: 16, highlights: 8 },
  },
  {
    id: 'bleach-bypass',
    name: 'Bleach Bypass',
    category: 'Cinematic',
    description: 'Silver-retention cinema contrast with muted color',
    grade: { saturation: -55, contrast: 42, shadows: -16, highlights: 18 },
    grain: 0.1,
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    category: 'Cinematic',
    description: 'Warm sunlit amber glow with gentle contrast',
    grade: { temperature: 36, tint: 8, exposure: 0.12, saturation: 18, vignette: 12 },
  },
  {
    id: 'sepia-archive',
    name: 'Sepia Archive',
    category: 'Vintage',
    description: 'Classic warm sepia monochrome stock',
    grade: { saturation: -82, temperature: 45, contrast: 10, vignette: 30 },
    tintOverlay: { r: 120, g: 74, b: 28, alpha: 0.18 },
    grain: 0.12,
  },
  {
    id: 'velvet-dusk',
    name: 'Velvet Dusk',
    category: 'Stylized',
    description: 'Deep violet shadows with luminous magenta-warm skin tones',
    grade: { temperature: -12, tint: 34, contrast: 22, saturation: 16, vignette: 25 },
    tintOverlay: { r: 94, g: 38, b: 145, alpha: 0.12 },
  },
  {
    id: 'hdr-vivid',
    name: 'HDR Crisp',
    category: 'HDR',
    description: 'Expanded dynamic punch with vivid micro-contrast',
    grade: { contrast: 26, saturation: 28, shadows: 18, highlights: -12, sharpen: 40 },
  },
  {
    id: 'matte-cinema',
    name: 'Matte Cinema',
    category: 'Cinematic',
    description: 'Soft faded blacks and balanced editorial contrast',
    grade: { contrast: -8, shadows: 22, saturation: -12, temperature: 6 },
  },
  {
    id: 'silver-gelatin',
    name: 'Silver Gelatin',
    category: 'Monochrome',
    description: 'Balanced darkroom tonal monochrome',
    grade: { saturation: -100, contrast: 16, gamma: 1.05, highlights: 10 },
  },
];

export function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return Math.round(v);
}

/**
 * Builds a 256-entry 0..255 Lookup Table (LUT) from sorted normalized control points (0..1).
 * Uses smooth Catmull-Rom / clamped piecewise linear interpolation for predictable curve editing.
 */
export function buildCurveLUT(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    if (x <= sorted[0].x) {
      lut[i] = clampByte(sorted[0].y * 255);
      continue;
    }
    const last = sorted[sorted.length - 1];
    if (x >= last.x) {
      lut[i] = clampByte(last.y * 255);
      continue;
    }
    for (let j = 0; j < sorted.length - 1; j++) {
      const p0 = sorted[j];
      const p1 = sorted[j + 1];
      if (x >= p0.x && x <= p1.x) {
        const span = Math.max(1e-6, p1.x - p0.x);
        const t = (x - p0.x) / span;
        const y = p0.y + (p1.y - p0.y) * t;
        lut[i] = clampByte(y * 255);
        break;
      }
    }
  }
  return lut;
}

/**
 * Merges a clip's manual ColorGrade with a selected FilterPreset scaled by intensity (0..1).
 */
export function getEffectiveColorGrade(
  base: ColorGrade,
  presetId: string,
  intensity: number
): { grade: ColorGrade; preset: FilterPreset | undefined } {
  const preset = FILTER_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.id === 'none' || intensity <= 0) {
    return { grade: base, preset };
  }
  const t = Math.max(0, Math.min(1, intensity));
  const pg = preset.grade;
  const merged: ColorGrade = {
    ...base,
    exposure: base.exposure + (pg.exposure ?? 0) * t,
    contrast: base.contrast + (pg.contrast ?? 0) * t,
    saturation: base.saturation + (pg.saturation ?? 0) * t,
    temperature: base.temperature + (pg.temperature ?? 0) * t,
    tint: base.tint + (pg.tint ?? 0) * t,
    gamma: base.gamma + ((pg.gamma ?? 1) - 1) * t,
    highlights: base.highlights + (pg.highlights ?? 0) * t,
    shadows: base.shadows + (pg.shadows ?? 0) * t,
    vignette: Math.min(100, base.vignette + (pg.vignette ?? 0) * t),
    blur: base.blur + (pg.blur ?? 0) * t,
    sharpen: Math.min(100, base.sharpen + (pg.sharpen ?? 0) * t),
  };
  return { grade: merged, preset };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned.padEnd(6, '0');
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Applies full pixel-level color correction, RGB curves, Lift/Gamma/Gain wheels,
 * optional filter tint overlay, and Chroma Key to an RGBA Uint8ClampedArray in place.
 * Pure & deterministic so it can be unit-tested directly on synthetic image buffers.
 */
export function applyColorPipelineToPixels(
  data: Uint8ClampedArray,
  grade: ColorGrade,
  chromaKey?: ChromaKeySettings,
  tintOverlay?: { r: number; g: number; b: number; alpha: number },
  overlayIntensity = 1
): void {
  const masterLut = buildCurveLUT(grade.curves.master);
  const redLut = buildCurveLUT(grade.curves.red);
  const greenLut = buildCurveLUT(grade.curves.green);
  const blueLut = buildCurveLUT(grade.curves.blue);

  const expMul = Math.pow(2, grade.exposure);
  const contrastFactor =
    (259 * (grade.contrast * 2.55 + 255)) / (255 * (259 - grade.contrast * 2.55));
  const satMul = Math.max(0, 1 + grade.saturation / 100);
  const invGamma = 1 / Math.max(0.2, grade.gamma);

  const tempR = grade.temperature * 0.65;
  const tempB = -grade.temperature * 0.65;
  const tintG = -grade.tint * 0.45;
  const tintRB = grade.tint * 0.25;

  const { lift, gamma: wheelGamma, gain } = grade.wheels;
  const hasWheels =
    lift.r !== 0 ||
    lift.g !== 0 ||
    lift.b !== 0 ||
    lift.luma !== 0 ||
    wheelGamma.r !== 0 ||
    wheelGamma.g !== 0 ||
    wheelGamma.b !== 0 ||
    wheelGamma.luma !== 0 ||
    gain.r !== 0 ||
    gain.g !== 0 ||
    gain.b !== 0 ||
    gain.luma !== 0;

  const keyRgb = chromaKey?.enabled ? hexToRgb(chromaKey.keyColor) : null;
  const keySim = (chromaKey?.similarity ?? 0.35) * 441.67; // max RGB euclidean distance
  const keySmooth = Math.max(1, (chromaKey?.smoothness ?? 0.15) * 200);

  const hasTint = tintOverlay && tintOverlay.alpha * overlayIntensity > 0.001;
  const tintAlpha = hasTint ? tintOverlay.alpha * overlayIntensity : 0;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let a = data[i + 3];

    if (a === 0) continue;

    // 1. Chroma key (evaluate on raw source pixel)
    if (keyRgb) {
      const dr = r - keyRgb.r;
      const dg = g - keyRgb.g;
      const db = b - keyRgb.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < keySim) {
        a = 0;
      } else if (dist < keySim + keySmooth) {
        const factor = (dist - keySim) / keySmooth;
        a = Math.round(a * factor);
      }
      data[i + 3] = a;
      if (a === 0) continue;
    }

    // 2. Exposure & Temperature / Tint
    r = r * expMul + tempR + tintRB;
    g = g * expMul + tintG;
    b = b * expMul + tempB + tintRB;

    // 3. Shadows & Highlights selective luma lift
    const luma01 = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (grade.shadows !== 0) {
      const shadowWeight = Math.pow(1 - Math.max(0, Math.min(1, luma01)), 2);
      const delta = grade.shadows * 0.9 * shadowWeight;
      r += delta;
      g += delta;
      b += delta;
    }
    if (grade.highlights !== 0) {
      const highWeight = Math.pow(Math.max(0, Math.min(1, luma01)), 2);
      const delta = grade.highlights * 0.9 * highWeight;
      r += delta;
      g += delta;
      b += delta;
    }

    // 4. Lift / Gamma / Gain Color Wheels
    if (hasWheels) {
      let nr = Math.max(0, Math.min(1, r / 255));
      let ng = Math.max(0, Math.min(1, g / 255));
      let nb = Math.max(0, Math.min(1, b / 255));

      // Lift affects shadows
      nr += (lift.r * 0.35 + lift.luma * 0.25) * (1 - nr);
      ng += (lift.g * 0.35 + lift.luma * 0.25) * (1 - ng);
      nb += (lift.b * 0.35 + lift.luma * 0.25) * (1 - nb);

      // Gain multiplies highlights
      nr *= 1 + gain.r * 0.45 + gain.luma * 0.35;
      ng *= 1 + gain.g * 0.45 + gain.luma * 0.35;
      nb *= 1 + gain.b * 0.45 + gain.luma * 0.35;

      // Gamma midtone shift
      const gR = Math.max(0.25, 1 - (wheelGamma.r * 0.4 + wheelGamma.luma * 0.3));
      const gG = Math.max(0.25, 1 - (wheelGamma.g * 0.4 + wheelGamma.luma * 0.3));
      const gB = Math.max(0.25, 1 - (wheelGamma.b * 0.4 + wheelGamma.luma * 0.3));
      nr = Math.pow(Math.max(0, Math.min(1, nr)), gR);
      ng = Math.pow(Math.max(0, Math.min(1, ng)), gG);
      nb = Math.pow(Math.max(0, Math.min(1, nb)), gB);

      r = nr * 255;
      g = ng * 255;
      b = nb * 255;
    }

    // 5. Contrast
    if (grade.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // 6. Gamma
    if (grade.gamma !== 1) {
      r = 255 * Math.pow(Math.max(0, Math.min(1, r / 255)), invGamma);
      g = 255 * Math.pow(Math.max(0, Math.min(1, g / 255)), invGamma);
      b = 255 * Math.pow(Math.max(0, Math.min(1, b / 255)), invGamma);
    }

    // 7. Saturation
    if (grade.saturation !== 0) {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gray + (r - gray) * satMul;
      g = gray + (g - gray) * satMul;
      b = gray + (b - gray) * satMul;
    }

    // 8. RGB Curves + Master Curve LUTs
    const cr = redLut[clampByte(r)];
    const cg = greenLut[clampByte(g)];
    const cb = blueLut[clampByte(b)];

    r = masterLut[cr];
    g = masterLut[cg];
    b = masterLut[cb];

    // 9. Optional Preset Tint Overlay
    if (hasTint && tintOverlay) {
      r = r * (1 - tintAlpha) + tintOverlay.r * tintAlpha;
      g = g * (1 - tintAlpha) + tintOverlay.g * tintAlpha;
      b = b * (1 - tintAlpha) + tintOverlay.b * tintAlpha;
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

/**
 * Computes transition blend state for an incoming or outgoing transition.
 * progress: 0 -> 1 across transition duration.
 */
export function computeTransitionState(
  type: TransitionType,
  progress: number,
  direction: 'in' | 'out'
): {
  opacity: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  clipWipe?: { edge: 'left' | 'right' | 'top'; ratio: number };
  irisRadius?: number;
  dipColor?: { color: string; alpha: number };
  glitchOffset?: number;
} {
  const p = Math.max(0, Math.min(1, direction === 'in' ? progress : 1 - progress));
  switch (type) {
    case 'cross-dissolve':
      return { opacity: p, offsetX: 0, offsetY: 0, scale: 1 };
    case 'dip-black':
      return {
        opacity: p > 0.5 ? 1 : p * 2,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        dipColor: { color: '#000000', alpha: 1 - p },
      };
    case 'dip-white':
      return {
        opacity: p > 0.5 ? 1 : p * 2,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        dipColor: { color: '#ffffff', alpha: 1 - p },
      };
    case 'wipe-left':
      return { opacity: 1, offsetX: 0, offsetY: 0, scale: 1, clipWipe: { edge: 'left', ratio: p } };
    case 'wipe-right':
      return { opacity: 1, offsetX: 0, offsetY: 0, scale: 1, clipWipe: { edge: 'right', ratio: p } };
    case 'wipe-up':
      return { opacity: 1, offsetX: 0, offsetY: 0, scale: 1, clipWipe: { edge: 'top', ratio: p } };
    case 'slide-left':
      return { opacity: 1, offsetX: (1 - p) * 100, offsetY: 0, scale: 1 };
    case 'zoom-in':
      return { opacity: p, offsetX: 0, offsetY: 0, scale: 0.72 + p * 0.28 };
    case 'glitch-split':
      return { opacity: Math.min(1, p * 1.4), offsetX: 0, offsetY: 0, scale: 1, glitchOffset: (1 - p) * 28 };
    case 'iris-circle':
      return { opacity: 1, offsetX: 0, offsetY: 0, scale: 1, irisRadius: p };
    case 'none':
    default:
      return { opacity: 1, offsetX: 0, offsetY: 0, scale: 1 };
  }
}

export interface ScopeData {
  histogramR: Uint32Array;
  histogramG: Uint32Array;
  histogramB: Uint32Array;
  histogramLuma: Uint32Array;
  maxBin: number;
}

export function computeHistogram(pixels: Uint8ClampedArray): ScopeData {
  const histogramR = new Uint32Array(256);
  const histogramG = new Uint32Array(256);
  const histogramB = new Uint32Array(256);
  const histogramLuma = new Uint32Array(256);
  let maxBin = 1;

  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const luma = clampByte(0.2126 * r + 0.7152 * g + 0.0722 * b);
    histogramR[r]++;
    histogramG[g]++;
    histogramB[b]++;
    histogramLuma[luma]++;
    if (histogramR[r] > maxBin) maxBin = histogramR[r];
    if (histogramG[g] > maxBin) maxBin = histogramG[g];
    if (histogramB[b] > maxBin) maxBin = histogramB[b];
  }

  return { histogramR, histogramG, histogramB, histogramLuma, maxBin };
}
