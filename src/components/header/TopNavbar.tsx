import React from 'react';
import { 
  Sparkles, 
  Sun, 
  Moon, 
  Undo2, 
  Redo2, 
  Download, 
  Tv, 
  Smartphone, 
  Square,
  Flame
} from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { AspectRatio } from '../../types/editor';

interface TopNavbarProps {
  onOpenExport: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenExport }) => {
  const {
    themeMode,
    toggleTheme,
    aspectRatio,
    setAspectRatio,
    canUndo,
    canRedo,
    undo,
    redo,
    exportSettings,
  } = useEditor();

  const aspectOptions: { ratio: AspectRatio; label: string; icon: React.ReactNode }[] = [
    { ratio: '16:9', label: '16:9 (PC/YT)', icon: <Tv size={14} /> },
    { ratio: '9:16', label: '9:16 (Phone/Reels)', icon: <Smartphone size={14} /> },
    { ratio: '1:1', label: '1:1 (Insta)', icon: <Square size={14} /> },
  ];

  return (
    <header className="h-14 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 flex items-center justify-between select-none z-30 transition-colors">
      {/* Brand & Pro Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Flame className="text-white fill-white" size={18} />
          </div>
          <span className="font-black text-xl tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Z-editz
          </span>
        </div>

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40 text-[11px] font-bold text-purple-400">
          <Sparkles size={11} className="text-purple-400" />
          <span>PRO UNLOCKED</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--text-secondary)] border-l border-[var(--border-color)] pl-3 ml-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>100% Offline • No Ads • No Login</span>
        </div>
      </div>

      {/* Center Controls: Aspect Ratio & Undo/Redo */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-[var(--bg-card)] rounded-lg p-0.5 border border-[var(--border-color)]">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-purple-500/10 disabled:opacity-30 disabled:hover:bg-transparent text-[var(--text-primary)] transition"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 rounded hover:bg-purple-500/10 disabled:opacity-30 disabled:hover:bg-transparent text-[var(--text-primary)] transition"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex items-center bg-[var(--bg-card)] rounded-lg p-0.5 border border-[var(--border-color)]">
          {aspectOptions.map((opt) => (
            <button
              key={opt.ratio}
              onClick={() => setAspectRatio(opt.ratio)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                aspectRatio === opt.ratio
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/40'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right Controls: Theme Toggle & 4K Export Button */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={themeMode === 'dark' ? 'Switch to Velvet Light Mode' : 'Switch to Cyber Neon Dark Mode'}
          className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-purple-500/50 hover:bg-purple-500/10 transition"
        >
          {themeMode === 'dark' ? (
            <Sun size={17} className="text-amber-400" />
          ) : (
            <Moon size={17} className="text-purple-600" />
          )}
        </button>

        {/* 4K 60FPS Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition transform active:scale-95"
        >
          <Download size={15} />
          <span>Export {exportSettings.resolution.toUpperCase()}</span>
          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-mono">
            {exportSettings.fps}FPS
          </span>
        </button>
      </div>
    </header>
  );
};
