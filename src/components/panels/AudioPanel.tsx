import React from 'react';
import { Mic2, Volume2, Sparkles, Sliders, Play, Plus, Zap } from 'lucide-react';
import { useEditor } from '../../store/editorContext';

const VOICE_EFFECTS = [
  { id: 'none', label: 'Original Voice', icon: '🎤' },
  { id: 'deep', label: 'Deep / Bass', icon: '🦁' },
  { id: 'chipmunk', label: 'Chipmunk (High)', icon: '🐿️' },
  { id: 'robot', label: 'Cyber Robot', icon: '🤖' },
  { id: 'megaphone', label: 'Megaphone', icon: '📢' },
  { id: 'telephone', label: 'Old Phone', icon: '📞' },
];

const SOUND_EFFECTS = [
  { name: 'Cinematic Whoosh', duration: 1.5, type: 'Transition' },
  { name: 'Heavy Bass Drop 808', duration: 3.0, type: 'Impact' },
  { name: 'Laser Glitch SFX', duration: 1.0, type: 'Cyber' },
  { name: 'Camera Shutter Click', duration: 0.8, type: 'Foley' },
];

export const AudioPanel: React.FC = () => {
  const {
    selectedClip,
    updateClip,
    extractAudioFromClip,
    currentTime,
    addClip,
  } = useEditor();

  const isVideo = selectedClip?.type === 'video';
  const isAudio = selectedClip?.type === 'audio';

  // Generate synthetic tone for SFX
  const handleAddSFX = (sfx: (typeof SOUND_EFFECTS)[0]) => {
    // Generate synthetic sine beep audio buffer or clip
    addClip({
      trackId: 'track-sfx',
      name: sfx.name,
      type: 'audio',
      sourceUrl: '',
      startTime: currentTime,
      duration: sfx.duration,
      sourceStartTime: 0,
      sourceDuration: sfx.duration,
      volume: 1,
      speed: 1,
      fadeIn: 0.1,
      fadeOut: 0.2,
      isMuted: false,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      keyframes: [],
      blendMode: 'source-over',
      colorAdjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, vignette: 0, exposure: 0, hue: 0, blur: 0 },
      chromaKey: { enabled: false, color: '#00ff00', similarity: 30, smoothness: 10, spillReduction: 50 },
      audioWaveform: [0.2, 0.5, 0.9, 0.8, 0.4, 0.2, 0.1],
    });
  };

  return (
    <div className="p-4 space-y-5">
      {/* 1. EXTRACT AUDIO FEATURE HIGHLIGHT */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-cyan-950/60 to-purple-950/60 border border-cyan-500/30">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Mic2 size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              Extract Video Audio
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                1-CLICK
              </span>
            </h3>
            <p className="text-[11px] text-gray-300">
              Detaches audio from video into a separate editable track
            </p>
          </div>
        </div>

        <button
          onClick={() => selectedClip && extractAudioFromClip(selectedClip.id)}
          disabled={!isVideo}
          className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
            isVideo
              ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-95'
              : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] opacity-50 cursor-not-allowed'
          }`}
        >
          <Zap size={14} />
          <span>{isVideo ? 'Extract Audio from Selected Video' : 'Select a Video Clip on Timeline First'}</span>
        </button>
      </div>

      {/* 2. VOICE CHANGER / VOICE EFFECTS */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] mb-2.5">
          <Sparkles size={14} className="text-purple-400" />
          <span>CapCut Voice Changer & Effects</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {VOICE_EFFECTS.map((fx) => (
            <button
              key={fx.id}
              disabled={!isAudio && !isVideo}
              onClick={() => {
                if (selectedClip) {
                  updateClip(selectedClip.id, {
                    voiceEffect: { type: fx.id as any, pitchShift: 0 },
                  });
                }
              }}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                selectedClip?.voiceEffect?.type === fx.id
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-bold'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-purple-500/40'
              } disabled:opacity-40`}
            >
              <span className="text-base">{fx.icon}</span>
              <span className="text-xs truncate">{fx.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. SOUND EFFECTS (SFX) LIBRARY */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] mb-2.5">
          <Volume2 size={14} className="text-emerald-400" />
          <span>Built-in Sound FX</span>
        </div>

        <div className="space-y-1.5">
          {SOUND_EFFECTS.map((sfx, idx) => (
            <div
              key={idx}
              className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {sfx.type}
                </span>
                <span className="font-semibold text-[var(--text-primary)] truncate">
                  {sfx.name}
                </span>
              </div>

              <button
                onClick={() => handleAddSFX(sfx)}
                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-[10px] font-bold transition shadow-sm"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
