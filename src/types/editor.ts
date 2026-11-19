export type MediaType = 'video' | 'audio' | 'image' | 'text' | 'effect' | 'sticker';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

export interface Keyframe {
  id: string;
  timeOffset: number; // time in seconds relative to clip start
  x: number;
  y: number;
  scale: number;
  rotation: number; // in degrees
  opacity: number;
}

export interface SpeedPoint {
  timePercent: number; // 0 to 1
  speed: number; // 0.1 to 10
}

export interface ColorAdjustments {
  brightness: number; // -100 to 100 (0 default)
  contrast: number;   // -100 to 100 (0 default)
  saturation: number; // -100 to 100 (0 default)
  temperature: number;// -100 to 100 (0 default)
  vignette: number;   // 0 to 100
  exposure: number;   // -100 to 100
  hue: number;        // -180 to 180
  blur: number;       // 0 to 50
}

export interface ChromaKeySettings {
  enabled: boolean;
  color: string; // hex like #00ff00
  similarity: number; // 1 to 100
  smoothness: number; // 1 to 100
  spillReduction: number; // 0 to 100
}

export interface VoiceEffect {
  type: 'none' | 'deep' | 'chipmunk' | 'robot' | 'echo' | 'reverb' | 'megaphone' | 'telephone';
  pitchShift: number; // in semitones
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  type: MediaType;
  sourceUrl: string;
  thumbnailUrl?: string;
  startTime: number; // in seconds on timeline
  duration: number; // in seconds on timeline
  sourceStartTime: number; // trim start in source
  sourceDuration: number; // total length of raw file
  volume: number; // 0 to 2 (1 = 100%)
  speed: number; // 0.1 to 10
  speedCurve?: SpeedPoint[]; // custom curve
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  isMuted: boolean;
  
  // Transform & Keyframes
  x: number; // -500 to 500
  y: number; // -500 to 500
  scale: number; // 0.1 to 5
  rotation: number; // degrees
  opacity: number; // 0 to 1
  keyframes: Keyframe[];

  // Effects & Video Styling
  blendMode: 'source-over' | 'screen' | 'multiply' | 'overlay' | 'lighten' | 'color-dodge';
  colorAdjustments: ColorAdjustments;
  filterId?: string;
  effectId?: string;
  chromaKey: ChromaKeySettings;
  transitionIn?: { type: string; duration: number };
  transitionOut?: { type: string; duration: number };

  // Text specific properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  textGlowColor?: string;
  textOutlineColor?: string;
  textOutlineWidth?: number;
  textBgColor?: string;
  textAnimation?: 'none' | 'typewriter' | 'wave' | 'glitch' | 'pop' | 'fade';

  // Audio specific properties
  voiceEffect?: VoiceEffect;
  audioWaveform?: number[]; // precomputed peak data (0 to 1)
  originalVideoClipId?: string; // set when extracted from a video clip
}

export interface Track {
  id: string;
  name: string;
  type: MediaType;
  isMuted: boolean;
  isLocked: boolean;
  isHidden: boolean;
}

export type ThemeMode = 'dark' | 'light';

export interface ExportSettings {
  resolution: '720p' | '1080p' | '2k' | '4k';
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  quality: 'standard' | 'high' | 'ultra_pro';
  format: 'mp4' | 'webm' | 'mp3' | 'wav';
}

export interface FilterPreset {
  id: string;
  name: string;
  category: 'Cinematic' | 'Cyber' | 'Retro' | 'Mood' | 'Color';
  thumbnail: string;
  adjustments: Partial<ColorAdjustments>;
  tintColor?: string;
  tintStrength?: number;
}

export interface EffectPreset {
  id: string;
  name: string;
  category: 'Glitch' | 'Glow' | 'Distortion' | 'Retro' | 'Cinema';
  icon: string;
}

export interface TransitionPreset {
  id: string;
  name: string;
  duration: number;
  icon: string;
}

export interface FontPreset {
  id: string;
  name: string;
  fontFamily: string;
  previewText: string;
  isNeon?: boolean;
  styleCategory: 'Modern' | 'Cyber' | 'Urban' | 'Luxe' | 'Calligraphy';
}
