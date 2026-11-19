import React from 'react';
import { X } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / Pause timeline'],
  ['J / K / L', 'Shuttle Reverse / Stop / Fast-Forward'],
  ['V', 'Select / Trim Tool'],
  ['C', 'Razor / Blade Cut Tool'],
  ['R', 'Toggle Ripple Edit Mode'],
  ['N', 'Toggle Edge Snapping'],
  ['S', 'Split Clip at Playhead'],
  ['M', 'Add Timeline Marker'],
  ['I / O', 'Set In / Out Export Range'],
  ['← / →', 'Step Back / Forward 1 Frame'],
  ['Home / End', 'Jump to Timeline Start / End'],
  ['Delete / Backspace', 'Lift Delete Selected Clip'],
  ['Shift + Delete', 'Ripple Extract Selected Clip'],
  ['Ctrl/Cmd + Z', 'Undo Last Action'],
  ['Ctrl/Cmd + Shift + Z', 'Redo Action'],
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts and Licenses"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-white dark:bg-[#14131c] border border-[#e4e1ee] dark:border-[#2a273d] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-[#e4e1ee] dark:border-[#242233] flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
            Keyboard Shortcuts & Open Licenses
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
            className="p-1 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {SHORTCUTS.map(([keys, desc]) => (
              <div
                key={keys}
                className="flex items-center justify-between gap-2 py-1 border-b border-[#f0eef7] dark:border-[#201e2e]"
              >
                <span className="text-zinc-600 dark:text-zinc-300">{desc}</span>
                <kbd className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#f4f3f8] dark:bg-[#1e1c2b] border border-[#dcd8e8] dark:border-[#322e47] text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>

          <div className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5 leading-relaxed">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
              Offline-First & Licensing Attribution
            </div>
            <p>
              Z-editz processes video compositing, color grading, audio mixing, and project
              autosaves strictly locally in your browser without mandatory accounts or telemetry.
            </p>
            <p>
              Bundled fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono) are licensed under the SIL
              Open Font License (OFL). Included sample cinema plates and procedural audio stems are
              royalty-free.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
