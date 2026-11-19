import React, { useState } from 'react';
import { Type, Sparkles, Plus, Palette } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { FONT_PRESETS } from '../../engine/presets';
import { FontPreset, Clip } from '../../types/editor';

export const TextPanel: React.FC = () => {
  const { addClip, selectedClip, updateClip, currentTime } = useEditor();

  const [customText, setCustomText] = useState('YOUR TEXT HERE');
  const [selectedFont, setSelectedFont] = useState<FontPreset>(FONT_PRESETS[0]);
  const [textColor, setTextColor] = useState('#ffffff');
  const [glowColor, setGlowColor] = useState('#a855f7');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [outlineWidth, setOutlineWidth] = useState(3);
  const [animation, setAnimation] = useState<'none' | 'typewriter' | 'wave' | 'glitch' | 'pop' | 'fade'>('typewriter');

  const isTextSelected = selectedClip?.type === 'text';

  const handleAddText = () => {
    const newTextClip: Omit<Clip, 'id'> = {
      trackId: 'track-text',
      name: customText.slice(0, 15) || 'Text Layer',
      type: 'text',
      sourceUrl: '',
      startTime: currentTime,
      duration: 5,
      sourceStartTime: 0,
      sourceDuration: 5,
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
      text: customText,
      fontFamily: selectedFont.fontFamily,
      fontSize: 54,
      textColor: textColor,
      textGlowColor: glowColor,
      textOutlineColor: outlineColor,
      textOutlineWidth: outlineWidth,
      textAnimation: animation,
    };

    addClip(newTextClip);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Text Input */}
      <div>
        <label className="text-xs font-semibold text-[var(--text-primary)] mb-1 block">
          Text Content
        </label>
        <input
          type="text"
          value={isTextSelected ? selectedClip.text || '' : customText}
          onChange={(e) => {
            const val = e.target.value;
            if (isTextSelected) {
              updateClip(selectedClip.id, { text: val, name: val.slice(0, 15) || 'Text' });
            } else {
              setCustomText(val);
            }
          }}
          placeholder="Enter text..."
          className="w-full h-9 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500 font-bold"
        />
      </div>

      {/* Font Presets */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] mb-2">
          <Sparkles size={14} className="text-purple-400" />
          <span>CapCut Pro Font Styles</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {FONT_PRESETS.map((font) => (
            <button
              key={font.id}
              onClick={() => {
                setSelectedFont(font);
                if (isTextSelected) {
                  updateClip(selectedClip.id, {
                    fontFamily: font.fontFamily,
                  });
                }
              }}
              style={{ fontFamily: font.fontFamily }}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                selectedFont.id === font.id
                  ? 'border-purple-500 bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/40'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-purple-500/30'
              }`}
            >
              <span className="text-sm font-bold truncate">{font.previewText}</span>
              <span className="text-[10px] font-sans opacity-60 mt-0.5">{font.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Styling Colors */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
            Text Color
          </label>
          <input
            type="color"
            value={isTextSelected ? selectedClip.textColor || '#ffffff' : textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              if (isTextSelected) updateClip(selectedClip.id, { textColor: e.target.value });
            }}
            className="w-full h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] cursor-pointer p-0.5"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
            Neon Glow
          </label>
          <input
            type="color"
            value={isTextSelected ? selectedClip.textGlowColor || '#a855f7' : glowColor}
            onChange={(e) => {
              setGlowColor(e.target.value);
              if (isTextSelected) updateClip(selectedClip.id, { textGlowColor: e.target.value });
            }}
            className="w-full h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] cursor-pointer p-0.5"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
            Outline Color
          </label>
          <input
            type="color"
            value={isTextSelected ? selectedClip.textOutlineColor || '#000000' : outlineColor}
            onChange={(e) => {
              setOutlineColor(e.target.value);
              if (isTextSelected) updateClip(selectedClip.id, { textOutlineColor: e.target.value });
            }}
            className="w-full h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] cursor-pointer p-0.5"
          />
        </div>
      </div>

      {/* Text Animation */}
      <div>
        <label className="text-xs font-semibold text-[var(--text-primary)] mb-1 block">
          Text Animation
        </label>
        <select
          value={isTextSelected ? selectedClip.textAnimation || 'none' : animation}
          onChange={(e) => {
            const val = e.target.value as any;
            setAnimation(val);
            if (isTextSelected) updateClip(selectedClip.id, { textAnimation: val });
          }}
          className="w-full h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500 font-semibold"
        >
          <option value="none">None</option>
          <option value="typewriter">Typewriter (Popular)</option>
          <option value="pop">Pop-In Zoom</option>
          <option value="fade">Smooth Fade</option>
          <option value="glitch">Glitch Cyber</option>
        </select>
      </div>

      {/* Add Text Button */}
      <button
        onClick={handleAddText}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 transition active:scale-95"
      >
        <Plus size={15} />
        <span>Add Text to Timeline</span>
      </button>
    </div>
  );
};
