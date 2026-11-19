import React from 'react';
import { 
  Sliders, 
  RotateCw, 
  Eye, 
  Sparkles, 
  Volume2, 
  Gauge, 
  Layers, 
  SlidersHorizontal 
} from 'lucide-react';
import { useEditor } from '../../store/editorContext';

export const InspectorPanel: React.FC = () => {
  const { selectedClip, updateClip } = useEditor();

  if (!selectedClip) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-[var(--text-secondary)]">
        <SlidersHorizontal size={28} className="opacity-30 mb-2" />
        <p className="text-xs font-semibold">No Clip Selected</p>
        <p className="text-[11px] opacity-70 mt-1 max-w-[180px]">
          Click any clip on the timeline to inspect its transform, chroma key, and color grading.
        </p>
      </div>
    );
  }

  const isVideoOrImage = selectedClip.type === 'video' || selectedClip.type === 'image';
  const isAudioOrVideo = selectedClip.type === 'video' || selectedClip.type === 'audio';

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 select-none text-xs">
      {/* Clip Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
        <div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">
            {selectedClip.type}
          </span>
          <h3 className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate max-w-[180px]">
            {selectedClip.name}
          </h3>
        </div>
      </div>

      {/* 1. TRANSFORM SECTION */}
      {selectedClip.type !== 'audio' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
            <RotateCw size={14} className="text-purple-400" />
            <span>Transform & Position</span>
          </div>

          {/* Scale Slider */}
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Scale</span>
              <span className="font-mono text-purple-400 font-bold">{selectedClip.scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.05"
              value={selectedClip.scale}
              onChange={(e) => updateClip(selectedClip.id, { scale: parseFloat(e.target.value) })}
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Rotation Slider */}
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Rotation</span>
              <span className="font-mono text-purple-400 font-bold">{selectedClip.rotation}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={selectedClip.rotation}
              onChange={(e) => updateClip(selectedClip.id, { rotation: parseInt(e.target.value) })}
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Opacity Slider */}
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Opacity</span>
              <span className="font-mono text-purple-400 font-bold">{Math.round(selectedClip.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={selectedClip.opacity}
              onChange={(e) => updateClip(selectedClip.id, { opacity: parseFloat(e.target.value) })}
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Blend Mode */}
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
              Blend Mode
            </label>
            <select
              value={selectedClip.blendMode}
              onChange={(e) => updateClip(selectedClip.id, { blendMode: e.target.value as any })}
              className="w-full h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
            >
              <option value="source-over">Normal</option>
              <option value="screen">Screen (Lighten)</option>
              <option value="multiply">Multiply (Darken)</option>
              <option value="overlay">Overlay</option>
              <option value="color-dodge">Color Dodge (Glow)</option>
            </select>
          </div>
        </div>
      )}

      {/* 2. CHROMA KEY (GREEN SCREEN) */}
      {isVideoOrImage && (
        <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-400" />
              Chroma Key
            </span>
            <input
              type="checkbox"
              checked={selectedClip.chromaKey.enabled}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  chromaKey: { ...selectedClip.chromaKey, enabled: e.target.checked },
                })
              }
              className="accent-purple-500 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {selectedClip.chromaKey.enabled && (
            <div className="space-y-2 bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-secondary)]">Key Color</span>
                <input
                  type="color"
                  value={selectedClip.chromaKey.color}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      chromaKey: { ...selectedClip.chromaKey, color: e.target.value },
                    })
                  }
                  className="w-7 h-7 rounded border border-[var(--border-color)] cursor-pointer p-0"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                  <span>Similarity</span>
                  <span className="font-mono text-purple-400">{selectedClip.chromaKey.similarity}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  value={selectedClip.chromaKey.similarity}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      chromaKey: { ...selectedClip.chromaKey, similarity: parseInt(e.target.value) },
                    })
                  }
                  className="w-full h-1 accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. COLOR GRADING ADJUSTMENTS */}
      {isVideoOrImage && (
        <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
          <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sliders size={14} className="text-cyan-400" />
            <span>Color Grading</span>
          </div>

          {/* Brightness */}
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Brightness</span>
              <span className="font-mono">{selectedClip.colorAdjustments.brightness}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={selectedClip.colorAdjustments.brightness}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  colorAdjustments: {
                    ...selectedClip.colorAdjustments,
                    brightness: parseInt(e.target.value),
                  },
                })
              }
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Contrast</span>
              <span className="font-mono">{selectedClip.colorAdjustments.contrast}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={selectedClip.colorAdjustments.contrast}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  colorAdjustments: {
                    ...selectedClip.colorAdjustments,
                    contrast: parseInt(e.target.value),
                  },
                })
              }
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Saturation */}
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Saturation</span>
              <span className="font-mono">{selectedClip.colorAdjustments.saturation}</span>
            </div>
            <input
              type="range"
              min="-80"
              max="80"
              value={selectedClip.colorAdjustments.saturation}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  colorAdjustments: {
                    ...selectedClip.colorAdjustments,
                    saturation: parseInt(e.target.value),
                  },
                })
              }
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Vignette */}
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Vignette Edge</span>
              <span className="font-mono">{selectedClip.colorAdjustments.vignette}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedClip.colorAdjustments.vignette}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  colorAdjustments: {
                    ...selectedClip.colorAdjustments,
                    vignette: parseInt(e.target.value),
                  },
                })
              }
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* 4. AUDIO ENVELOPE (FADE & VOLUME) */}
      {isAudioOrVideo && (
        <div className="space-y-3 border-t border-[var(--border-color)] pt-3">
          <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Volume2 size={14} className="text-emerald-400" />
            <span>Audio & Envelope</span>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Volume</span>
              <span className="font-mono text-emerald-400 font-bold">{Math.round(selectedClip.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={selectedClip.volume}
              onChange={(e) => updateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
              className="w-full h-1 accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] block mb-1">Fade In (s)</span>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={selectedClip.fadeIn}
                onChange={(e) => updateClip(selectedClip.id, { fadeIn: parseFloat(e.target.value) || 0 })}
                className="w-full h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-primary)] font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] block mb-1">Fade Out (s)</span>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={selectedClip.fadeOut}
                onChange={(e) => updateClip(selectedClip.id, { fadeOut: parseFloat(e.target.value) || 0 })}
                className="w-full h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-primary)] font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
