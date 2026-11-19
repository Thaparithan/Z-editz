import React, { useRef, useState } from 'react';
import {
  Film,
  Layers,
  Loader2,
  Music,
  Plus,
  Search,
  Sparkles,
  Subtitles,
  Trash2,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import type {
  CaptionItem,
  MediaAsset,
  OverlayEffectType,
  TimelineClip,
  TitleStyle,
  TransitionType,
} from '../types/editor';
import { FILTER_PRESETS } from '../engine/colorPipeline';
import { generateSubtitlesWithGemini } from '../engine/geminiService';
import {
  OVERLAY_LIBRARY,
  TITLE_TEMPLATES,
  TRANSITION_LIBRARY,
} from '../engine/presets';
import { formatTimecode } from '../engine/timelineEngine';

type BinTab = 'media' | 'effects' | 'transitions' | 'titles' | 'captions';

interface MediaEffectsBinProps {
  assets: MediaAsset[];
  captions: CaptionItem[];
  showCaptions: boolean;
  selectedClip: TimelineClip | null;
  playheadTime: number;
  fps: number;
  onImportFiles: (files: FileList) => void;
  onAddAssetToTimeline: (asset: MediaAsset) => void;
  onApplyFilterToSelected: (presetId: string) => void;
  onApplyTransitionToSelected: (type: TransitionType, edge: 'in' | 'out', duration: number) => void;
  onAddTitleTemplate: (name: string, style: TitleStyle, motionPreset: TimelineClip['motionPreset']) => void;
  onAddOverlay: (name: string, overlayType: OverlayEffectType) => void;
  onToggleShowCaptions: () => void;
  onAddCaption: (text: string, start: number, end: number) => void;
  onUpdateCaption: (id: string, patch: Partial<CaptionItem>) => void;
  onDeleteCaption: (id: string) => void;
  onBatchAddCaptions?: (captions: CaptionItem[]) => void;
  onDownloadSrt: () => void;
}

export const MediaEffectsBin: React.FC<MediaEffectsBinProps> = ({
  assets,
  captions,
  showCaptions,
  selectedClip,
  playheadTime,
  fps,
  onImportFiles,
  onAddAssetToTimeline,
  onApplyFilterToSelected,
  onApplyTransitionToSelected,
  onAddTitleTemplate,
  onAddOverlay,
  onToggleShowCaptions,
  onAddCaption,
  onUpdateCaption,
  onDeleteCaption,
  onBatchAddCaptions,
  onDownloadSrt,
}) => {
  const [activeTab, setActiveTab] = useState<BinTab>('media');
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState<string>('All');
  const [transitionEdge, setTransitionEdge] = useState<'in' | 'out'>('in');
  const [newCaptionText, setNewCaptionText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [aiTranscribing, setAiTranscribing] = useState(false);
  const [aiTranscribeError, setAiTranscribeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleTranscribeAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiTranscribing(true);
    setAiTranscribeError(null);
    try {
      const items = await generateSubtitlesWithGemini(file);
      if (onBatchAddCaptions) {
        onBatchAddCaptions(items);
      } else {
        items.forEach((c) => onAddCaption(c.text, c.startTime, c.endTime));
      }
    } catch (err) {
      setAiTranscribeError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setAiTranscribing(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const normalizedQuery = query.trim().toLowerCase();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImportFiles(e.dataTransfer.files);
    }
  };

  const tabs: { id: BinTab; label: string; icon: React.ReactNode }[] = [
    { id: 'media', label: 'Media', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'effects', label: 'Filters', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'transitions', label: 'Trans', icon: <Wand2 className="w-3.5 h-3.5" /> },
    { id: 'titles', label: 'Titles', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'captions', label: 'SRT', icon: <Subtitles className="w-3.5 h-3.5" /> },
  ];

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(normalizedQuery)
  );

  const filteredPresets = FILTER_PRESETS.filter((p) => {
    const matchesCat = filterCat === 'All' || p.category === filterCat;
    const matchesQuery =
      p.name.toLowerCase().includes(normalizedQuery) ||
      p.description.toLowerCase().includes(normalizedQuery);
    return matchesCat && matchesQuery;
  });

  const filteredTransitions = TRANSITION_LIBRARY.filter((t) =>
    t.name.toLowerCase().includes(normalizedQuery)
  );

  return (
    <aside
      aria-label="Media and Effects Library"
      className="flex flex-col h-full bg-[#f8f7fb] dark:bg-[#13121a] border-r border-[#e4e1ee] dark:border-[#242233] min-w-0 overflow-hidden"
    >
      {/* Bin Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Library sections"
        className="grid grid-cols-5 border-b border-[#e4e1ee] dark:border-[#242233] bg-white/70 dark:bg-[#100f16] px-1 pt-1.5 gap-0.5 shrink-0"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1 py-2 px-1 text-[11px] font-medium rounded-t-md transition-colors whitespace-nowrap min-w-0 ${
                active
                  ? 'bg-[#f8f7fb] dark:bg-[#13121a] text-violet-700 dark:text-violet-300 border-t border-x border-[#e4e1ee] dark:border-[#242233]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Import Bar */}
      <div className="p-2.5 border-b border-[#e4e1ee] dark:border-[#242233] flex items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search
            aria-hidden="true"
            className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            aria-label={`Search ${activeTab}`}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-violet-500"
          />
        </div>
        {activeTab === 'media' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,image/*,audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onImportFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
          </>
        )}
      </div>

      {/* Scrollable Content */}
      <div
        className={`flex-1 overflow-y-auto p-2.5 space-y-2.5 ${
          isDragOver ? 'ring-2 ring-inset ring-violet-500 bg-violet-500/5' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* MEDIA TAB */}
        {activeTab === 'media' && (
          <>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-0.5">
              <span>Project Bin · {filteredAssets.length} items</span>
              <span>Drop files anywhere</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-[#191723] border border-[#e4e1ee] dark:border-[#282538] hover:border-violet-400 dark:hover:border-violet-500/70 transition-colors"
                >
                  <div className="w-16 h-10 rounded overflow-hidden bg-zinc-900 shrink-0 relative flex items-center justify-center">
                    {asset.thumbnail ? (
                      <img
                        src={asset.thumbnail}
                        alt={asset.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : asset.type === 'audio' ? (
                      <div className="w-full h-full bg-teal-950/70 flex items-center justify-center">
                        <Music className="w-4 h-4 text-teal-400" />
                      </div>
                    ) : (
                      <Film className="w-4 h-4 text-violet-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {asset.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                      {asset.type === 'audio'
                        ? `Audio · ${asset.duration.toFixed(1)}s`
                        : `${asset.width ?? 1920}×${asset.height ?? 1080} · ${asset.duration.toFixed(1)}s`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddAssetToTimeline(asset)}
                    aria-label={`Add ${asset.name} to timeline`}
                    title="Append to timeline"
                    className="p-1.5 rounded-md bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 hover:bg-violet-600 hover:text-white transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {filteredAssets.length === 0 && (
                <div className="text-center py-8 px-3 text-xs text-zinc-500 dark:text-zinc-400">
                  No media matches "{query}". Import video, image, or audio files from disk.
                </div>
              )}
            </div>
          </>
        )}

        {/* FILTERS & OVERLAYS TAB */}
        {activeTab === 'effects' && (
          <>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {['All', 'Cinematic', 'Vintage', 'Monochrome', 'Stylized', 'HDR'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCat(cat)}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    filterCat === cat
                      ? 'bg-violet-700 text-white dark:bg-violet-600'
                      : 'bg-white dark:bg-[#1c1a27] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-[#e4e1ee] dark:border-[#282538]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {!selectedClip && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-md px-2.5 py-2">
                Select a video or image clip on the timeline to apply a filter preset.
              </p>
            )}

            <div className="space-y-1.5">
              {filteredPresets.map((preset) => {
                const isApplied = selectedClip?.filterPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={!selectedClip}
                    onClick={() => onApplyFilterToSelected(preset.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      isApplied
                        ? 'bg-violet-50 dark:bg-violet-500/15 border-violet-500 text-zinc-950 dark:text-white'
                        : 'bg-white dark:bg-[#191723] border-[#e4e1ee] dark:border-[#282538] hover:border-violet-400 dark:hover:border-violet-500/60 disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {preset.name}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#e4e1ee] dark:border-[#242233]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                <Layers className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Graphic Overlays</span>
              </div>
              <div className="space-y-1.5">
                {OVERLAY_LIBRARY.map((ov) => (
                  <div
                    key={ov.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-[#191723] border border-[#e4e1ee] dark:border-[#282538]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {ov.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {ov.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddOverlay(ov.name, ov.overlayType)}
                      aria-label={`Add ${ov.name} overlay`}
                      className="p-1.5 rounded-md bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 hover:bg-violet-600 hover:text-white transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TRANSITIONS TAB */}
        {activeTab === 'transitions' && (
          <>
            <div className="flex items-center justify-between gap-2 p-1 rounded-lg bg-white dark:bg-[#191723] border border-[#e4e1ee] dark:border-[#282538]">
              <button
                type="button"
                onClick={() => setTransitionEdge('in')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  transitionEdge === 'in'
                    ? 'bg-violet-700 text-white dark:bg-violet-600'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Transition In
              </button>
              <button
                type="button"
                onClick={() => setTransitionEdge('out')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  transitionEdge === 'out'
                    ? 'bg-violet-700 text-white dark:bg-violet-600'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Transition Out
              </button>
            </div>

            {!selectedClip && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-md px-2.5 py-2">
                Select a visual clip on the timeline to attach a transition.
              </p>
            )}

            <div className="space-y-1.5">
              {filteredTransitions.map((tr) => {
                const current =
                  transitionEdge === 'in'
                    ? selectedClip?.transitionIn.type
                    : selectedClip?.transitionOut.type;
                const active = current === tr.type;
                return (
                  <button
                    key={tr.type}
                    type="button"
                    disabled={!selectedClip || selectedClip.type === 'audio'}
                    onClick={() =>
                      onApplyTransitionToSelected(tr.type, transitionEdge, tr.defaultDuration || 0.7)
                    }
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-violet-50 dark:bg-violet-500/15 border-violet-500'
                        : 'bg-white dark:bg-[#191723] border-[#e4e1ee] dark:border-[#282538] hover:border-violet-400 disabled:opacity-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {tr.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {tr.category} · {tr.defaultDuration > 0 ? `${tr.defaultDuration}s` : 'Instant'}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                      {active ? 'Applied' : 'Apply'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* TITLES TAB */}
        {activeTab === 'titles' && (
          <div className="space-y-2">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 px-0.5">
              Open Fonts (SIL OFL) · Add at playhead ({formatTimecode(playheadTime, fps)})
            </div>
            {TITLE_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="p-2.5 rounded-lg bg-white dark:bg-[#191723] border border-[#e4e1ee] dark:border-[#282538] space-y-2"
              >
                <div className="h-14 rounded bg-[#0c0b10] flex flex-col items-center justify-center px-3 text-center overflow-hidden border border-zinc-800">
                  <span
                    className="text-xs font-bold tracking-wider truncate max-w-full"
                    style={{ color: tpl.style.color, fontFamily: tpl.style.fontFamily }}
                  >
                    {tpl.style.text}
                  </span>
                  {tpl.style.subtitle && (
                    <span className="text-[10px] text-zinc-400 truncate max-w-full">
                      {tpl.style.subtitle}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {tpl.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {tpl.category} · {tpl.motionPreset}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAddTitleTemplate(`Title · ${tpl.name}`, { ...tpl.style }, tpl.motionPreset)
                    }
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500 text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CAPTIONS / SRT TAB */}
        {activeTab === 'captions' && (
          <div className="space-y-3">
            {/* Gemini AI Transcription Card */}
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 border border-violet-500/20 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemini Auto-Subtitles</span>
                </div>
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={handleTranscribeAudioFile}
                  accept="audio/*,video/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={aiTranscribing}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-50 rounded-md flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {aiTranscribing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  <span>{aiTranscribing ? 'Transcribing...' : 'Auto-Generate'}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Select an audio or video file to auto-generate timestamped subtitles using Gemini.
              </p>
              {aiTranscribeError && <p className="text-[11px] text-rose-500">{aiTranscribeError}</p>}
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCaptions}
                  onChange={onToggleShowCaptions}
                  className="accent-violet-600 rounded"
                />
                <span>Show Captions on Preview</span>
              </label>
              <button
                type="button"
                onClick={onDownloadSrt}
                className="text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline whitespace-nowrap shrink-0"
              >
                Export .SRT
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCaptionText.trim()) return;
                onAddCaption(newCaptionText.trim(), playheadTime, playheadTime + 3.5);
                setNewCaptionText('');
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={newCaptionText}
                onChange={(e) => setNewCaptionText(e.target.value)}
                placeholder="Caption at current playhead..."
                aria-label="New caption text"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-violet-700 hover:bg-violet-800 text-white shrink-0"
              >
                Add
              </button>
            </form>

            <div className="space-y-2">
              {captions.map((cap) => (
                <div
                  key={cap.id}
                  className="p-2 rounded-lg bg-white dark:bg-[#191723] border border-[#e4e1ee] dark:border-[#282538] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    <span>
                      {formatTimecode(cap.startTime, fps)} → {formatTimecode(cap.endTime, fps)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteCaption(cap.id)}
                      aria-label={`Delete caption ${cap.text.slice(0, 20)}`}
                      className="text-zinc-400 hover:text-rose-500 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={cap.text}
                    onChange={(e) => onUpdateCaption(cap.id, { text: e.target.value })}
                    aria-label="Caption subtitle line"
                    className="w-full text-xs rounded bg-[#f8f7fb] dark:bg-[#121118] border border-[#e4e1ee] dark:border-[#282538] px-2 py-1 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:border-violet-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
