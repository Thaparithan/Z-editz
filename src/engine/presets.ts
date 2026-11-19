import { FilterPreset, EffectPreset, TransitionPreset, FontPreset } from '../types/editor';

export const FONT_PRESETS: FontPreset[] = [
  { id: 'font-cyber', name: 'Cyberpunk Neon', fontFamily: 'Impact, sans-serif', previewText: 'CYBERPUNK', isNeon: true, styleCategory: 'Cyber' },
  { id: 'font-urban', name: 'Urban Heavy', fontFamily: '"Arial Black", Gadget, sans-serif', previewText: 'URBAN VIBE', styleCategory: 'Urban' },
  { id: 'font-velvet', name: 'Velvet Luxe', fontFamily: 'Georgia, serif', previewText: 'Velvet Edition', styleCategory: 'Luxe' },
  { id: 'font-modern', name: 'Clean Modern', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', previewText: 'MODERN EDIT', styleCategory: 'Modern' },
  { id: 'font-calligraphy', name: 'Handwritten Script', fontFamily: '"Brush Script MT", cursive', previewText: 'Aesthetic Story', styleCategory: 'Calligraphy' },
  { id: 'font-retro', name: 'Arcade 80s', fontFamily: '"Courier New", Courier, monospace', previewText: 'RETRO GAMING', isNeon: true, styleCategory: 'Cyber' },
  { id: 'font-cinematic', name: 'Cinematic Bold', fontFamily: 'Trebuchet MS, sans-serif', previewText: 'CINEMATIC 4K', styleCategory: 'Urban' },
  { id: 'font-futura', name: 'Futuristic Glow', fontFamily: 'Copperplate, Papyrus, fantasy', previewText: 'Z-EDITZ PRO', isNeon: true, styleCategory: 'Cyber' },
];

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'filter-normal',
    name: 'Original',
    category: 'Color',
    thumbnail: 'linear-gradient(135deg, #444, #888)',
    adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, vignette: 0, exposure: 0 }
  },
  {
    id: 'filter-cyber-neon',
    name: 'Cyber Neon',
    category: 'Cyber',
    thumbnail: 'linear-gradient(135deg, #a855f7, #06b6d4)',
    adjustments: { brightness: 5, contrast: 30, saturation: 45, temperature: -20, vignette: 25 },
    tintColor: '#a855f7',
    tintStrength: 0.2
  },
  {
    id: 'filter-moody-velvet',
    name: 'Moody Velvet',
    category: 'Mood',
    thumbnail: 'linear-gradient(135deg, #2e0854, #7c3aed)',
    adjustments: { brightness: -5, contrast: 25, saturation: 15, temperature: -10, vignette: 40 },
    tintColor: '#7c3aed',
    tintStrength: 0.25
  },
  {
    id: 'filter-teal-orange',
    name: 'Teal & Orange',
    category: 'Cinematic',
    thumbnail: 'linear-gradient(135deg, #0e7490, #ea580c)',
    adjustments: { brightness: 5, contrast: 35, saturation: 25, temperature: 20, vignette: 30 },
  },
  {
    id: 'filter-vintage-vhs',
    name: 'VHS 90s',
    category: 'Retro',
    thumbnail: 'linear-gradient(135deg, #854d0e, #d97706)',
    adjustments: { brightness: 10, contrast: -10, saturation: -20, temperature: 25, vignette: 20 },
  },
  {
    id: 'filter-noir-bw',
    name: 'Noir B&W',
    category: 'Cinematic',
    thumbnail: 'linear-gradient(135deg, #000, #fff)',
    adjustments: { brightness: 0, contrast: 40, saturation: -100, vignette: 45 },
  },
  {
    id: 'filter-golden-hour',
    name: 'Golden Hour',
    category: 'Color',
    thumbnail: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    adjustments: { brightness: 10, contrast: 15, saturation: 35, temperature: 40, exposure: 10 },
  },
  {
    id: 'filter-emerald',
    name: 'Matrix Emerald',
    category: 'Cyber',
    thumbnail: 'linear-gradient(135deg, #064e3b, #10b981)',
    adjustments: { brightness: 0, contrast: 20, saturation: 20, temperature: -30, vignette: 30 },
    tintColor: '#10b981',
    tintStrength: 0.3
  }
];

export const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'effect-none', name: 'No Effect', category: 'Cinema', icon: 'Off' },
  { id: 'effect-glitch-rgb', name: 'RGB Split Glitch', category: 'Glitch', icon: 'Zap' },
  { id: 'effect-neon-glow', name: 'Neon Aura Glow', category: 'Glow', icon: 'Sun' },
  { id: 'effect-camera-shake', name: 'Heavy Bass Shake', category: 'Distortion', icon: 'Activity' },
  { id: 'effect-vhs-scanlines', name: 'Retro VHS Lines', category: 'Retro', icon: 'Tv' },
  { id: 'effect-zoom-blur', name: 'Speed Zoom Blur', category: 'Cinema', icon: 'Maximize' },
  { id: 'effect-lens-flare', name: 'Optical Flare', category: 'Glow', icon: 'Sparkles' },
];

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: 'trans-fade', name: 'Cross Dissolve', duration: 0.5, icon: 'Fade' },
  { id: 'trans-zoom', name: 'Zoom In Punch', duration: 0.4, icon: 'ZoomIn' },
  { id: 'trans-whip-pan', name: 'Whip Pan Right', duration: 0.3, icon: 'ArrowRight' },
  { id: 'trans-glitch', name: 'Digital Glitch', duration: 0.35, icon: 'Zap' },
  { id: 'trans-light-leak', name: 'Light Leak Flare', duration: 0.6, icon: 'Sun' },
];

export const STICKER_PRESETS = [
  { id: 'st-pro', name: 'Z-PRO VIP', emoji: '👑', color: '#eab308' },
  { id: 'st-fire', name: 'Fire Edit', emoji: '🔥', color: '#ef4444' },
  { id: 'st-rec', name: 'REC 4K', emoji: '🔴', color: '#dc2626' },
  { id: 'st-sound', name: 'Bass Wave', emoji: '⚡', color: '#a855f7' },
  { id: 'st-heart', name: 'Neon Heart', emoji: '💜', color: '#d946ef' },
  { id: 'st-verified', name: 'Verified', emoji: '✨', color: '#06b6d4' },
  { id: 'st-cyber', name: 'Cyberpunk', emoji: '🤖', color: '#10b981' },
];
