export type WorkspaceMode = 'edit' | 'color' | 'audio' | 'export';

export type EditorTool = 'select' | 'razor';

export type TrackType = 'video' | 'title' | 'audio';

export type MediaType = 'video' | 'image' | 'audio' | 'title' | 'overlay';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'lighter'
  | 'difference';

export type MaskShape = 'none' | 'ellipse' | 'rectangle' | 'vignette';

export type InterpolationMode = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export type KeyframeChannel = 'x' | 'y' | 'scale' | 'rotation' | 'opacity' | 'volume';

export interface Keyframe {
  id: string;
  /** Time relative to clip start (seconds) */
  time: number;
  value: number;
  interpolation: InterpolationMode;
}

export type KeyframeMap = Partial<Record<KeyframeChannel, Keyframe[]>>;

export interface ClipTransform {
  x: number; // -500 to 500 px offset from center
  y: number; // -500 to 500 px offset from center
  scale: number; // 0.1 to 4.0
  rotation: number; // -360 to 360 degrees
  opacity: number; // 0 to 1
  flipH: boolean;
  flipV: boolean;
}

export interface ClipCrop {
  top: number; // 0 to 45 (%)
  right: number;
  bottom: number;
  left: number;
}

export interface ClipMask {
  shape: MaskShape;
  feather: number; // 0 to 100
  scale: number; // 0.2 to 1.5
  invert: boolean;
}

export interface ChromaKeySettings {
  enabled: boolean;
  keyColor: string; // hex e.g. '#00b140'
  similarity: number; // 0 to 1
  smoothness: number; // 0 to 1
}

export interface CurvePoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface RGBCurves {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface ColorWheelValue {
  r: number; // -1 to 1
  g: number; // -1 to 1
  b: number; // -1 to 1
  luma: number; // -1 to 1
}

export interface ColorWheels {
  lift: ColorWheelValue;
  gamma: ColorWheelValue;
  gain: ColorWheelValue;
}

export interface ColorGrade {
  exposure: number; // -2 to 2
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  temperature: number; // -100 to 100
  tint: number; // -100 to 100
  gamma: number; // 0.5 to 2.0
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  vignette: number; // 0 to 100
  blur: number; // 0 to 20 px
  sharpen: number; // 0 to 100
  curves: RGBCurves;
  wheels: ColorWheels;
}

export type TransitionType =
  | 'none'
  | 'cross-dissolve'
  | 'dip-black'
  | 'dip-white'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'slide-left'
  | 'zoom-in'
  | 'glitch-split'
  | 'iris-circle';

export interface ClipTransition {
  type: TransitionType;
  duration: number; // seconds, e.g. 0.5 to 2.5
}

export type MotionPresetType =
  | 'none'
  | 'fade-in'
  | 'slide-up'
  | 'slide-left'
  | 'zoom-in'
  | 'typewriter'
  | 'bounce'
  | 'ken-burns-in'
  | 'ken-burns-pan';

export interface TitleStyle {
  text: string;
  subtitle?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  shadowBlur: number;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  templateId?: string;
}

export type OverlayEffectType =
  | 'film-grain'
  | 'light-leak'
  | 'bokeh'
  | 'letterbox'
  | 'scanlines'
  | 'dust';

export interface AudioClipSettings {
  volume: number; // 0 to 2 (1 = 0dB)
  pan: number; // -1 to 1
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  muted: boolean;
  eqLow: number; // -12 to +12 dB
  eqMid: number; // -12 to +12 dB
  eqHigh: number; // -12 to +12 dB
  compressor: boolean;
  denoise: boolean;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  src?: string; // URL or objectURL
  thumbnail?: string;
  duration: number; // natural duration in seconds
  width?: number;
  height?: number;
  fps?: number;
  waveform?: number[]; // normalized 0..1 peaks
  license: string;
  isBuiltin?: boolean;
  overlayType?: OverlayEffectType;
  audioPreset?: 'ambient-cinema' | 'pulse-synth' | 'nature-wind' | 'voiceover';
}

export interface TimelineClip {
  id: string;
  assetId: string;
  trackId: string;
  name: string;
  type: MediaType;
  /** Start time on the timeline in seconds */
  startTime: number;
  /** Visible duration on the timeline in seconds */
  duration: number;
  /** In-point offset into source media in seconds */
  mediaOffset: number;
  /** Original source duration in seconds */
  sourceDuration: number;
  speed: number; // 0.25 to 8
  reversed: boolean;
  freezeFrame?: boolean;
  linkedClipId?: string;
  colorTag: string;
  transform: ClipTransform;
  crop: ClipCrop;
  mask: ClipMask;
  blendMode: BlendMode;
  chromaKey: ChromaKeySettings;
  filterPresetId: string;
  filterIntensity: number; // 0 to 1
  colorGrade: ColorGrade;
  transitionIn: ClipTransition;
  transitionOut: ClipTransition;
  motionPreset: MotionPresetType;
  keyframes: KeyframeMap;
  titleStyle?: TitleStyle;
  overlayType?: OverlayEffectType;
  audio: AudioClipSettings;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  solo: boolean;
  targeted: boolean;
  volume: number; // 0 to 2
  pan: number; // -1 to 1
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compressor: boolean;
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface CaptionItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface ProjectSettings {
  name: string;
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  proxyMode: boolean;
  inPoint: number | null;
  outPoint: number | null;
}

export interface ProjectState {
  version: string;
  settings: ProjectSettings;
  assets: MediaAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers: TimelineMarker[];
  captions: CaptionItem[];
  showCaptions: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  category: 'Cinematic' | 'Vintage' | 'Monochrome' | 'Stylized' | 'HDR';
  description: string;
  grade: Partial<ColorGrade>;
  tintOverlay?: { r: number; g: number; b: number; alpha: number };
  grain?: number;
  scanlines?: boolean;
}

export interface ExportPreset {
  id: string;
  name: string;
  platform: string;
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  format: 'webm-vp9' | 'webm-vp8' | 'mp4-h264';
}

export interface ExportJob {
  id: string;
  name: string;
  presetName: string;
  width: number;
  height: number;
  fps: number;
  format: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  progress: number; // 0 to 100
  downloadUrl?: string;
  fileSizeBytes?: number;
  createdAt: string;
  error?: string;
}
