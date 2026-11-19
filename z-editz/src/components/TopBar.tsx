import React from 'react';
import type { WorkspaceMode } from '../types/editor';

interface TopBarProps {
  workspace: WorkspaceMode;
  onChangeWorkspace: (mode: WorkspaceMode) => void;
  onOpenExport: () => void;
}

const WORKSPACES: { id: WorkspaceMode; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'color', label: 'Color' },
  { id: 'audio', label: 'Audio' },
  { id: 'export', label: 'Export' },
];

export const TopBar: React.FC<TopBarProps> = ({
  workspace,
  onChangeWorkspace,
  onOpenExport,
}) => {
  return (
    <header className="h-12 shrink-0 flex items-center justify-between gap-3 sm:gap-8 px-3 sm:px-5 bg-white dark:bg-[#100f16] border-b border-[#e4e1ee] dark:border-[#242233] select-none">
      {/* Zone 1: Single text element wordmark */}
      <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0">
        Z-editz
      </span>

      {/* Zone 2: 4 clean single-line workspace navigation links */}
      <nav
        aria-label="Workspace navigation"
        className="flex items-center gap-3.5 sm:gap-6 h-full"
      >
        {WORKSPACES.map((item) => {
          const active = workspace === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeWorkspace(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative h-full flex items-center text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-violet-500 ${
                active
                  ? 'text-violet-700 dark:text-violet-300'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenExport}
          className="px-2.5 sm:px-4 py-1.5 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          <span className="hidden sm:inline">Export Video</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>
    </header>
  );
};
