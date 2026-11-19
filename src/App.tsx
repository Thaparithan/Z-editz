import React, { useState } from 'react';
import { 
  FolderOpen, 
  Music, 
  Type, 
  Sparkles, 
  Palette, 
  Smile, 
} from 'lucide-react';
import { EditorProvider, useEditor } from './store/editorContext';
import { TopNavbar } from './components/header/TopNavbar';
import { ExportModal } from './components/header/ExportModal';
import { CanvasPreview } from './components/player/CanvasPreview';
import { PlayerControls } from './components/player/PlayerControls';
import { Timeline } from './components/timeline/Timeline';
import { MediaPanel } from './components/panels/MediaPanel';
import { AudioPanel } from './components/panels/AudioPanel';
import { TextPanel } from './components/panels/TextPanel';
import { EffectsPanel } from './components/panels/EffectsPanel';
import { FiltersPanel } from './components/panels/FiltersPanel';
import { StickersPanel } from './components/panels/StickersPanel';
import { InspectorPanel } from './components/panels/InspectorPanel';

const EditorLayout: React.FC = () => {
  const { activePanel, setActivePanel } = useEditor();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const tabs = [
    { id: 'media', label: 'Media', icon: <FolderOpen size={18} /> },
    { id: 'audio', label: 'Audio', icon: <Music size={18} /> },
    { id: 'text', label: 'Text', icon: <Type size={18} /> },
    { id: 'effects', label: 'Effects', icon: <Sparkles size={18} /> },
    { id: 'filters', label: 'Filters', icon: <Palette size={18} /> },
    { id: 'stickers', label: 'Stickers', icon: <Smile size={18} /> },
  ];

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'media':
        return <MediaPanel />;
      case 'audio':
        return <AudioPanel />;
      case 'text':
        return <TextPanel />;
      case 'effects':
        return <EffectsPanel />;
      case 'filters':
        return <FiltersPanel />;
      case 'stickers':
        return <StickersPanel />;
      default:
        return <MediaPanel />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* 1. TOP NAVBAR */}
      <TopNavbar onOpenExport={() => setIsExportModalOpen(true)} />

      {/* 2. MAIN WORKSPACE (CENTER) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Icon Strip */}
        <div className="w-16 md:w-18 bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col items-center py-3 gap-1 shrink-0 select-none z-20">
          {tabs.map((tab) => {
            const isActive = activePanel === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
                  isActive
                    ? 'bg-purple-600/15 text-purple-400 font-bold border border-purple-500/40 shadow-sm shadow-purple-500/20'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Left Panel Drawer (Media, Audio, Text, Filters, etc.) */}
        <div className="w-64 md:w-80 bg-[var(--bg-surface)] border-r border-[var(--border-color)] overflow-y-auto shrink-0 hidden sm:block z-10">
          {renderActivePanel()}
        </div>

        {/* Center Preview Player Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <CanvasPreview />
          <PlayerControls />
        </div>

        {/* Right Inspector Panel (Properties, Transform, Chroma Key) */}
        <div className="w-64 md:w-72 bg-[var(--bg-surface)] border-l border-[var(--border-color)] overflow-y-auto shrink-0 hidden lg:block z-10">
          <InspectorPanel />
        </div>
      </div>

      {/* 3. MULTI-TRACK TIMELINE (BOTTOM) */}
      <Timeline />

      {/* 4. EXPORT MODAL */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <EditorProvider>
      <EditorLayout />
    </EditorProvider>
  );
}
