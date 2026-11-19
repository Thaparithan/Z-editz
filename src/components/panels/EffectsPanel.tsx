import React from 'react';
import { Sparkles, Zap, Activity, Sun, Tv, Maximize } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { EFFECT_PRESETS } from '../../engine/presets';

export const EffectsPanel: React.FC = () => {
  const { selectedClip, updateClip } = useEditor();

  const isEligible = selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'image');

  const getEffectIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap size={18} className="text-cyan-400" />;
      case 'Sun':
        return <Sun size={18} className="text-amber-400" />;
      case 'Activity':
        return <Activity size={18} className="text-pink-400" />;
      case 'Tv':
        return <Tv size={18} className="text-emerald-400" />;
      case 'Maximize':
        return <Maximize size={18} className="text-purple-400" />;
      default:
        return <Sparkles size={18} className="text-purple-400" />;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-xs font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
          <Sparkles size={14} className="text-purple-400" />
          <span>CapCut Pro Video Effects</span>
        </h3>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {isEligible
            ? `Click to apply effect to "${selectedClip.name}"`
            : 'Select a video clip on the timeline first to apply effects'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {EFFECT_PRESETS.map((eff) => {
          const isActive = selectedClip?.effectId === eff.id;
          return (
            <button
              key={eff.id}
              disabled={!isEligible}
              onClick={() => {
                if (selectedClip) {
                  updateClip(selectedClip.id, {
                    effectId: eff.id,
                  });
                }
              }}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition text-center ${
                isActive
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/40 shadow-md shadow-purple-500/20'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-purple-500/40'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center">
                {getEffectIcon(eff.icon)}
              </div>
              <div className="truncate w-full">
                <span className="text-xs font-bold block truncate text-[var(--text-primary)]">
                  {eff.name}
                </span>
                <span className="text-[10px] text-purple-400 font-mono">
                  {eff.category}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
