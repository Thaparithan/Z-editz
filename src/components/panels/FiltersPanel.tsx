import React from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { FILTER_PRESETS } from '../../engine/presets';

export const FiltersPanel: React.FC = () => {
  const { selectedClip, updateClip } = useEditor();

  const isEligible = selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'image');

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
          <Palette size={14} className="text-cyan-400" />
          <span>Cinematic Color Grading & Filters</span>
        </h3>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {isEligible
            ? `Click to grade "${selectedClip.name}"`
            : 'Select a video or image clip on the timeline first'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {FILTER_PRESETS.map((filter) => {
          const isActive = selectedClip?.filterId === filter.id;
          return (
            <button
              key={filter.id}
              disabled={!isEligible}
              onClick={() => {
                if (selectedClip) {
                  updateClip(selectedClip.id, {
                    filterId: filter.id,
                  });
                }
              }}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-2 transition text-center ${
                isActive
                  ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300 ring-2 ring-cyan-500/40 shadow-md shadow-cyan-500/20'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-cyan-500/30'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {/* Color Gradient Preview Circle */}
              <div
                style={{ background: filter.thumbnail }}
                className="w-12 h-12 rounded-xl shadow-inner border border-white/20 shrink-0"
              />
              <div className="truncate w-full">
                <span className="text-xs font-bold block truncate text-[var(--text-primary)]">
                  {filter.name}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {filter.category}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
