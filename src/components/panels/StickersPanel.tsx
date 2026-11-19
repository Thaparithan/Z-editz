import React from 'react';
import { Smile, Plus, Sparkles } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { STICKER_PRESETS } from '../../engine/presets';
import { Clip } from '../../types/editor';

export const StickersPanel: React.FC = () => {
  const { addClip, currentTime } = useEditor();

  const handleAddSticker = (sticker: (typeof STICKER_PRESETS)[0]) => {
    const newStickerClip: Omit<Clip, 'id'> = {
      trackId: 'track-overlay',
      name: sticker.name,
      type: 'sticker',
      sourceUrl: '',
      startTime: currentTime,
      duration: 4,
      sourceStartTime: 0,
      sourceDuration: 4,
      volume: 1,
      speed: 1,
      fadeIn: 0,
      fadeOut: 0,
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
      text: sticker.emoji,
    };

    addClip(newStickerClip);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
          <Smile size={14} className="text-pink-400" />
          <span>Overlays & Neon Stickers</span>
        </h3>
        <p className="text-[11px] text-[var(--text-secondary)]">
          Click any badge to place an animated overlay on your video
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {STICKER_PRESETS.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => handleAddSticker(sticker)}
            className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-pink-500/40 hover:bg-pink-500/10 transition flex flex-col items-center justify-center gap-1.5 group"
          >
            <span className="text-3xl group-hover:scale-125 transition-transform">
              {sticker.emoji}
            </span>
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {sticker.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
