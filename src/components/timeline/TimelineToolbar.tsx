import React from 'react';
import { 
  Scissors, 
  Trash2, 
  Copy, 
  Mic2, 
  Diamond, 
  ZoomIn, 
  ZoomOut, 
  Volume2,
  Gauge
} from 'lucide-react';
import { useEditor } from '../../store/editorContext';

export const TimelineToolbar: React.FC = () => {
  const {
    selectedClip,
    selectedClipId,
    splitClipAtPlayhead,
    removeClip,
    duplicateClip,
    extractAudioFromClip,
    addKeyframeAtPlayhead,
    zoomLevel,
    setZoomLevel,
    updateClip,
  } = useEditor();

  const handleZoomChange = (delta: number) => {
    setZoomLevel(Math.min(120, Math.max(15, zoomLevel + delta)));
  };

  const isVideoSelected = selectedClip?.type === 'video';

  return (
    <div className="h-11 px-3 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex items-center justify-between select-none">
      {/* Primary Editing Actions */}
      <div className="flex items-center gap-1.5">
        {/* Split / Razor Tool */}
        <button
          onClick={splitClipAtPlayhead}
          disabled={!selectedClip}
          title="Split Clip at Playhead (S)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:border-purple-500/40 hover:bg-purple-500/10 disabled:opacity-40 disabled:hover:bg-[var(--bg-card)] disabled:hover:border-[var(--border-color)] transition"
        >
          <Scissors size={14} className="text-purple-400" />
          <span className="hidden sm:inline">Split</span>
        </button>

        {/* Delete Tool */}
        <button
          onClick={() => selectedClipId && removeClip(selectedClipId)}
          disabled={!selectedClip}
          title="Delete Clip (Delete/Backspace)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 transition"
        >
          <Trash2 size={14} className="text-red-400" />
          <span className="hidden sm:inline">Delete</span>
        </button>

        {/* Duplicate Tool */}
        <button
          onClick={() => selectedClipId && duplicateClip(selectedClipId)}
          disabled={!selectedClip}
          title="Duplicate Clip"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:border-purple-500/40 hover:bg-purple-500/10 disabled:opacity-40 transition"
        >
          <Copy size={14} />
          <span className="hidden sm:inline">Duplicate</span>
        </button>

        {/* EXTRACT AUDIO (Special Feature Highlighted) */}
        <button
          onClick={() => selectedClipId && extractAudioFromClip(selectedClipId)}
          disabled={!isVideoSelected}
          title="Extract Audio directly from this Video Clip into an editable sound track"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
            isVideoSelected
              ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-cyan-500/25 hover:from-cyan-500 hover:to-purple-500 active:scale-95'
              : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] opacity-40 cursor-not-allowed'
          }`}
        >
          <Mic2 size={14} className="animate-pulse" />
          <span>Extract Audio</span>
        </button>

        {/* Add Keyframe */}
        <button
          onClick={() => selectedClipId && addKeyframeAtPlayhead(selectedClipId)}
          disabled={!selectedClip}
          title="Add Keyframe at Playhead"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold hover:border-purple-500/40 hover:bg-purple-500/10 disabled:opacity-40 transition"
        >
          <Diamond size={13} className="text-cyan-400" />
          <span className="hidden sm:inline">+ Keyframe</span>
        </button>

        {/* Quick Speed Switch */}
        {selectedClip && (
          <div className="hidden md:flex items-center gap-1 bg-[var(--bg-card)] px-2 py-1 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
            <Gauge size={13} className="text-purple-400" />
            <span>Speed:</span>
            <select
              value={selectedClip.speed}
              onChange={(e) => updateClip(selectedClip.id, { speed: parseFloat(e.target.value) })}
              className="bg-transparent text-[var(--text-primary)] font-bold focus:outline-none cursor-pointer"
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1.0x (Norm)</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
              <option value="4">4.0x</option>
            </select>
          </div>
        )}

        {/* Quick Volume Switch */}
        {selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'audio') && (
          <div className="hidden lg:flex items-center gap-1 bg-[var(--bg-card)] px-2 py-1 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
            <Volume2 size={13} className="text-cyan-400" />
            <span>Vol:</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={selectedClip.volume}
              onChange={(e) => updateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
              className="w-16 h-1 accent-purple-500 cursor-pointer"
            />
            <span className="font-mono text-[10px] w-6">{Math.round(selectedClip.volume * 100)}%</span>
          </div>
        )}
      </div>

      {/* Timeline Zoom Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleZoomChange(-10)}
          title="Zoom Out Timeline"
          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
        >
          <ZoomOut size={15} />
        </button>

        <input
          type="range"
          min="15"
          max="120"
          value={zoomLevel}
          onChange={(e) => setZoomLevel(parseInt(e.target.value))}
          className="w-20 md:w-28 h-1 accent-purple-500 cursor-pointer"
        />

        <button
          onClick={() => handleZoomChange(10)}
          title="Zoom In Timeline"
          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
        >
          <ZoomIn size={15} />
        </button>
      </div>
    </div>
  );
};
