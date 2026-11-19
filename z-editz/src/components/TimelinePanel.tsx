import React, { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  HelpCircle,
  Lock,
  Magnet,
  Moon,
  MousePointer2,
  Plus,
  Redo2,
  Scissors,
  Snowflake,
  SplitSquareHorizontal,
  Sun,
  Trash2,
  Undo2,
  Unlink,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  EditorTool,
  MediaAsset,
  ProjectState,
  TimelineClip,
  TimelineTrack,
  TrackType,
} from '../types/editor';
import { formatTimecode, snapTime } from '../engine/timelineEngine';

interface TimelinePanelProps {
  project: ProjectState;
  currentTime: number;
  duration: number;
  selectedClipId: string | null;
  activeTool: EditorTool;
  rippleMode: boolean;
  snapEnabled: boolean;
  zoomPxPerSec: number;
  canUndo: boolean;
  canRedo: boolean;
  theme: 'dark' | 'light';
  onSelectTool: (tool: EditorTool) => void;
  onToggleRipple: () => void;
  onToggleSnap: () => void;
  onZoomChange: (px: number) => void;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onSplitAtPlayhead: () => void;
  onSplitClipAtTime: (clipId: string, time: number) => void;
  onMoveClip: (clipId: string, newStart: number, newTrackId?: string) => void;
  onTrimClip: (clipId: string, edge: 'left' | 'right', deltaSec: number) => void;
  onDeleteSelectedClip: (forceRipple?: boolean) => void;
  onDetachAudio: () => void;
  onFreezeFrame: () => void;
  onAddMarker: () => void;
  onRemoveMarker: (markerId: string) => void;
  onAddTrack: (type: TrackType) => void;
  onRemoveTrack: (trackId: string) => void;
  onToggleTrackProp: (
    trackId: string,
    prop: 'muted' | 'hidden' | 'locked' | 'solo' | 'targeted'
  ) => void;
  onReorderTrack: (trackId: string, dir: 'up' | 'down') => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onLoadProjectFile: (file: File) => void;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
}

const TRACK_HEADER_W = 196;

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  project,
  currentTime,
  duration,
  selectedClipId,
  activeTool,
  rippleMode,
  snapEnabled,
  zoomPxPerSec,
  canUndo,
  canRedo,
  theme,
  onSelectTool,
  onToggleRipple,
  onToggleSnap,
  onZoomChange,
  onSeek,
  onSelectClip,
  onSplitAtPlayhead,
  onSplitClipAtTime,
  onMoveClip,
  onTrimClip,
  onDeleteSelectedClip,
  onDetachAudio,
  onFreezeFrame,
  onAddMarker,
  onRemoveMarker,
  onAddTrack,
  onRemoveTrack,
  onToggleTrackProp,
  onReorderTrack,
  onUndo,
  onRedo,
  onSaveProject,
  onLoadProjectFile,
  onToggleTheme,
  onOpenShortcuts,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [dragPreview, setDragPreview] = useState<{
    clipId: string;
    startTime: number;
    duration: number;
    trackId: string;
  } | null>(null);

  const dragOpRef = useRef<{
    kind: 'move' | 'trim-left' | 'trim-right';
    clip: TimelineClip;
    startClientX: number;
    startClientY: number;
    latestStart: number;
    latestDelta: number;
    latestTrackId: string;
  } | null>(null);

  const assetsById = new Map<string, MediaAsset>(project.assets.map((a) => [a.id, a]));
  const totalTimelineSec = Math.max(duration + 6, 28);
  const timelineWidthPx = Math.max(900, Math.round(totalTimelineSec * zoomPxPerSec));

  const getTimeFromClientX = (clientX: number): number => {
    const container = scrollRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const xInsideTrackArea = clientX - rect.left + container.scrollLeft - TRACK_HEADER_W;
    return Math.max(0, Number((xInsideTrackArea / zoomPxPerSec).toFixed(3)));
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(getTimeFromClientX(e.clientX));
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    onSeek(getTimeFromClientX(e.clientX));
  };

  const handleClipPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    clip: TimelineClip,
    track: TimelineTrack,
    kind: 'move' | 'trim-left' | 'trim-right'
  ) => {
    e.stopPropagation();
    if (track.locked) return;

    if (activeTool === 'razor' && kind === 'move') {
      const cutTime = getTimeFromClientX(e.clientX);
      onSplitClipAtTime(clip.id, cutTime);
      return;
    }

    onSelectClip(clip.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOpRef.current = {
      kind,
      clip,
      startClientX: e.clientX,
      startClientY: e.clientY,
      latestStart: clip.startTime,
      latestDelta: 0,
      latestTrackId: clip.trackId,
    };
  };

  const handleClipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const op = dragOpRef.current;
    if (!op) return;
    const dxSec = (e.clientX - op.startClientX) / zoomPxPerSec;

    if (op.kind === 'move') {
      let nextStart = Math.max(0, op.clip.startTime + dxSec);
      if (snapEnabled) {
        const res = snapTime(
          nextStart,
          project.clips,
          project.markers,
          currentTime,
          op.clip.id,
          12 / zoomPxPerSec
        );
        nextStart = res.time;
      }

      // Check vertical track switching among compatible tracks
      const dyTracks = Math.round((e.clientY - op.startClientY) / 56);
      let nextTrackId = op.clip.trackId;
      if (dyTracks !== 0) {
        const currentIdx = project.tracks.findIndex((t) => t.id === op.clip.trackId);
        const candidate = project.tracks[currentIdx + dyTracks];
        if (candidate && !candidate.locked) {
          const isAudio = op.clip.type === 'audio';
          if (isAudio && candidate.type === 'audio') {
            nextTrackId = candidate.id;
          } else if (!isAudio && candidate.type !== 'audio') {
            nextTrackId = candidate.id;
          }
        }
      }

      op.latestStart = nextStart;
      op.latestTrackId = nextTrackId;
      setDragPreview({
        clipId: op.clip.id,
        startTime: nextStart,
        duration: op.clip.duration,
        trackId: nextTrackId,
      });
    } else if (op.kind === 'trim-right') {
      const nextDur = Math.max(0.2, op.clip.duration + dxSec);
      op.latestDelta = nextDur - op.clip.duration;
      setDragPreview({
        clipId: op.clip.id,
        startTime: op.clip.startTime,
        duration: nextDur,
        trackId: op.clip.trackId,
      });
    } else if (op.kind === 'trim-left') {
      const clampedDelta = Math.max(-op.clip.startTime, Math.min(op.clip.duration - 0.2, dxSec));
      op.latestDelta = clampedDelta;
      setDragPreview({
        clipId: op.clip.id,
        startTime: rippleMode ? op.clip.startTime : Math.max(0, op.clip.startTime + clampedDelta),
        duration: Math.max(0.2, op.clip.duration - clampedDelta),
        trackId: op.clip.trackId,
      });
    }
  };

  const handleClipPointerUp = () => {
    const op = dragOpRef.current;
    if (!op) return;
    dragOpRef.current = null;
    setDragPreview(null);

    if (op.kind === 'move') {
      if (
        Math.abs(op.latestStart - op.clip.startTime) > 0.01 ||
        op.latestTrackId !== op.clip.trackId
      ) {
        onMoveClip(op.clip.id, op.latestStart, op.latestTrackId);
      }
    } else if (op.kind === 'trim-right' && Math.abs(op.latestDelta) > 0.01) {
      onTrimClip(op.clip.id, 'right', op.latestDelta);
    } else if (op.kind === 'trim-left' && Math.abs(op.latestDelta) > 0.01) {
      onTrimClip(op.clip.id, 'left', op.latestDelta);
    }
  };

  const selectedClip = project.clips.find((c) => c.id === selectedClipId) ?? null;

  // Build ruler tick interval cleanly based on zoom
  const tickStepSec = zoomPxPerSec >= 80 ? 1 : zoomPxPerSec >= 40 ? 2 : 5;
  const ticks: number[] = [];
  for (let s = 0; s <= totalTimelineSec; s += tickStepSec) {
    ticks.push(s);
  }

  return (
    <section
      aria-label="Multi-track Timeline"
      className="flex flex-col h-full bg-white dark:bg-[#111017] border-t border-[#e4e1ee] dark:border-[#242233] select-none overflow-hidden"
    >
      {/* Timeline Studio Toolbar */}
      <div className="min-h-10 px-3 py-1.5 flex items-center justify-between gap-2 border-b border-[#e4e1ee] dark:border-[#242233] bg-[#f8f7fb] dark:bg-[#14131c] overflow-x-auto shrink-0">
        {/* Left: Core Edit Tools */}
        <div className="flex items-center gap-1 shrink-0">
          <ToolBtn
            active={activeTool === 'select'}
            onClick={() => onSelectTool('select')}
            label="Select Tool (V)"
            title="Select / Move / Trim (V)"
            icon={<MousePointer2 className="w-3.5 h-3.5" />}
            text="Select"
          />
          <ToolBtn
            active={activeTool === 'razor'}
            onClick={() => onSelectTool('razor')}
            label="Razor Cut Tool (C)"
            title="Razor / Blade Cut Tool (C)"
            icon={<Scissors className="w-3.5 h-3.5" />}
            text="Razor"
          />

          <div className="w-px h-5 bg-[#ddd9e8] dark:bg-[#2a273b] mx-1" />

          <ToolBtn
            active={rippleMode}
            onClick={onToggleRipple}
            label="Toggle Ripple Edit Mode (R)"
            title="Ripple Edit Mode (R) — Auto-shift clips on trim/delete"
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            text="Ripple"
          />
          <ToolBtn
            active={snapEnabled}
            onClick={onToggleSnap}
            label="Toggle Snapping (N)"
            title="Timeline Snapping (N)"
            icon={<Magnet className="w-3.5 h-3.5" />}
            text="Snap"
          />

          <div className="w-px h-5 bg-[#ddd9e8] dark:bg-[#2a273b] mx-1" />

          <ToolBtn
            onClick={onSplitAtPlayhead}
            label="Split at Playhead (S)"
            title="Split clip at playhead (S)"
            icon={<SplitSquareHorizontal className="w-3.5 h-3.5" />}
            text="Split"
          />
          <ToolBtn
            onClick={onAddMarker}
            label="Add Timeline Marker (M)"
            title="Add Marker at Playhead (M)"
            icon={<Bookmark className="w-3.5 h-3.5" />}
            text="Marker"
          />
          <ToolBtn
            disabled={!selectedClip || selectedClip.type === 'audio'}
            onClick={onDetachAudio}
            label="Detach Audio"
            title="Detach Audio onto Audio Track"
            icon={<Unlink className="w-3.5 h-3.5" />}
            text="Detach"
          />
          <ToolBtn
            disabled={!selectedClip || selectedClip.type === 'audio'}
            onClick={onFreezeFrame}
            label="Insert Freeze Frame"
            title="Hold Freeze Frame (2s) at Playhead"
            icon={<Snowflake className="w-3.5 h-3.5" />}
            text="Freeze"
          />
          <ToolBtn
            disabled={!selectedClip}
            onClick={() => onDeleteSelectedClip(false)}
            label="Delete Selected Clip"
            title="Delete Clip (Del) · Shift+Del for Ripple Extract"
            icon={<Trash2 className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Right: History, Tracks, Project I/O, Theme, Zoom */}
        <div className="flex items-center gap-1 shrink-0">
          <ToolBtn
            disabled={!canUndo}
            onClick={onUndo}
            label="Undo"
            title="Undo (Ctrl+Z)"
            icon={<Undo2 className="w-3.5 h-3.5" />}
          />
          <ToolBtn
            disabled={!canRedo}
            onClick={onRedo}
            label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            icon={<Redo2 className="w-3.5 h-3.5" />}
          />

          <div className="w-px h-5 bg-[#ddd9e8] dark:bg-[#2a273b] mx-1" />

          <button
            type="button"
            onClick={() => onAddTrack('video')}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>Video</span>
          </button>
          <button
            type="button"
            onClick={() => onAddTrack('audio')}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>Audio</span>
          </button>

          <div className="w-px h-5 bg-[#ddd9e8] dark:bg-[#2a273b] mx-1" />

          <ToolBtn
            onClick={onSaveProject}
            label="Save Z-editz Project JSON"
            title="Save Project (.zeditz.json)"
            icon={<Download className="w-3.5 h-3.5" />}
          />
          <input
            ref={projectFileInputRef}
            type="file"
            accept=".json,.zeditz.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onLoadProjectFile(file);
                e.target.value = '';
              }
            }}
          />
          <ToolBtn
            onClick={() => projectFileInputRef.current?.click()}
            label="Open Project File"
            title="Open Project (.zeditz.json)"
            icon={<FolderOpen className="w-3.5 h-3.5" />}
          />
          <ToolBtn
            onClick={onToggleTheme}
            label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            icon={theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          />
          <ToolBtn
            onClick={onOpenShortcuts}
            label="Keyboard Shortcuts and Licenses"
            title="Shortcuts & Licenses (?)"
            icon={<HelpCircle className="w-3.5 h-3.5" />}
          />

          <div className="w-px h-5 bg-[#ddd9e8] dark:bg-[#2a273b] mx-1" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 pl-1">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(24, zoomPxPerSec - 14))}
              aria-label="Zoom out timeline"
              className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              aria-label="Timeline zoom"
              className="w-20 studio-slider"
              min={24}
              max={150}
              step={2}
              value={zoomPxPerSec}
              onChange={(e) => onZoomChange(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(150, zoomPxPerSec + 14))}
              aria-label="Zoom in timeline"
              className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Track & Ruler Canvas */}
      <div
        ref={scrollRef}
        data-testid="timeline-scroll"
        data-clip-count={project.clips.length}
        className="flex-1 overflow-auto relative"
      >
        <div
          className="relative min-h-full"
          style={{ width: TRACK_HEADER_W + timelineWidthPx }}
        >
          {/* Sticky Timecode Ruler Row */}
          <div className="sticky top-0 z-20 flex h-8 border-b border-[#e4e1ee] dark:border-[#242233] bg-[#f4f3f8] dark:bg-[#15141e]">
            <div
              className="sticky left-0 z-30 flex items-center justify-between px-3 border-r border-[#e4e1ee] dark:border-[#242233] bg-[#f4f3f8] dark:bg-[#15141e] text-[11px] font-mono text-zinc-600 dark:text-zinc-400 shrink-0"
              style={{ width: TRACK_HEADER_W }}
            >
              <span className="truncate font-semibold text-zinc-800 dark:text-zinc-200">
                {project.settings.name}
              </span>
            </div>

            {/* Clickable Time Ruler */}
            <div
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              className="relative flex-1 cursor-ew-resize overflow-hidden"
            >
              {/* In / Out highlight bar */}
              {project.settings.inPoint !== null && project.settings.outPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 bg-violet-500/20 border-x border-violet-500"
                  style={{
                    left: project.settings.inPoint * zoomPxPerSec,
                    width: Math.max(
                      4,
                      (project.settings.outPoint - project.settings.inPoint) * zoomPxPerSec
                    ),
                  }}
                />
              )}

              {ticks.map((sec) => (
                <div
                  key={sec}
                  className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                  style={{ left: sec * zoomPxPerSec }}
                >
                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 pl-1 pb-1.5">
                    {formatTimecode(sec, project.settings.fps).slice(3, 8)}
                  </span>
                  <div className="w-px h-2 bg-zinc-400/60 dark:bg-zinc-600" />
                </div>
              ))}

              {/* Timeline Markers */}
              {project.markers.map((mk) => (
                <button
                  key={mk.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(mk.time);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onRemoveMarker(mk.id);
                  }}
                  title={`${mk.label} (${formatTimecode(mk.time, project.settings.fps)}) · Double-click to remove`}
                  aria-label={`Jump to marker ${mk.label}`}
                  className="absolute top-0.5 -translate-x-1/2 z-10 w-3 h-3 rotate-45 rounded-[2px] border border-white dark:border-zinc-900 shadow-sm hover:scale-125 transition-transform"
                  style={{ left: mk.time * zoomPxPerSec, backgroundColor: mk.color }}
                />
              ))}
            </div>
          </div>

          {/* Tracks Stack */}
          <div className="relative">
            {project.tracks.map((track, trackIdx) => {
              const trackClips = project.clips.filter((c) => {
                const preview = dragPreview?.clipId === c.id ? dragPreview : null;
                return (preview ? preview.trackId : c.trackId) === track.id;
              });

              return (
                <div
                  key={track.id}
                  className={`flex h-14 border-b border-[#e8e5f0] dark:border-[#201e2e] ${
                    track.hidden || track.muted ? 'opacity-60' : ''
                  }`}
                >
                  {/* Sticky Track Header */}
                  <div
                    className="sticky left-0 z-10 flex items-center justify-between gap-1 px-2.5 border-r border-[#e4e1ee] dark:border-[#242233] bg-[#f8f7fb] dark:bg-[#14131c] shrink-0"
                    style={{ width: TRACK_HEADER_W }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleTrackProp(track.id, 'targeted')}
                          title="Toggle Track Targeting"
                          aria-label={`Target track ${track.name}`}
                          className={`px-1 py-0.5 text-[10px] font-mono font-bold rounded ${
                            track.targeted
                              ? 'bg-violet-600 text-white'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {track.name.split(' ')[0]}
                        </button>
                        <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate">
                          {track.name.split('·')[1]?.trim() ?? track.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {track.type !== 'audio' ? (
                        <button
                          type="button"
                          onClick={() => onToggleTrackProp(track.id, 'hidden')}
                          aria-label={`Toggle visibility for ${track.name}`}
                          className={`p-1 rounded ${
                            track.hidden
                              ? 'text-rose-500'
                              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleTrackProp(track.id, 'muted')}
                          aria-label={`Toggle mute for ${track.name}`}
                          className={`p-1 rounded ${
                            track.muted
                              ? 'text-rose-500'
                              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleTrackProp(track.id, 'locked')}
                        aria-label={`Toggle lock for ${track.name}`}
                        className={`p-1 rounded ${
                          track.locked
                            ? 'text-amber-500'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        disabled={trackIdx === 0}
                        onClick={() => onReorderTrack(track.id, 'up')}
                        aria-label={`Move ${track.name} up`}
                        className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white disabled:opacity-30"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={trackIdx === project.tracks.length - 1}
                        onClick={() => onReorderTrack(track.id, 'down')}
                        aria-label={`Move ${track.name} down`}
                        className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {project.tracks.length > 2 && (
                        <button
                          type="button"
                          onClick={() => onRemoveTrack(track.id)}
                          aria-label={`Remove ${track.name}`}
                          className="p-0.5 text-zinc-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Track Lane */}
                  <div
                    onClick={() => onSelectClip(null)}
                    className={`relative flex-1 ${
                      track.type === 'audio'
                        ? 'bg-[#f4faf9] dark:bg-[#0e1518]'
                        : 'bg-[#fcfbfd] dark:bg-[#111017]'
                    }`}
                  >
                    {trackClips.map((clip) => {
                      const preview = dragPreview?.clipId === clip.id ? dragPreview : null;
                      const dispStart = preview ? preview.startTime : clip.startTime;
                      const dispDur = preview ? preview.duration : clip.duration;
                      const leftPx = dispStart * zoomPxPerSec;
                      const widthPx = Math.max(18, dispDur * zoomPxPerSec);
                      const isSelected = clip.id === selectedClipId;
                      const asset = assetsById.get(clip.assetId);
                      const totalKeyframes = Object.values(clip.keyframes).reduce(
                        (sum, arr) => sum + (arr?.length ?? 0),
                        0
                      );

                      return (
                        <div
                          key={clip.id}
                          data-testid={`clip-${clip.id}`}
                          onPointerDown={(e) => handleClipPointerDown(e, clip, track, 'move')}
                          onPointerMove={handleClipPointerMove}
                          onPointerUp={handleClipPointerUp}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            left: leftPx,
                            width: widthPx,
                            backgroundColor:
                              clip.type === 'audio'
                                ? 'rgba(13, 148, 136, 0.22)'
                                : clip.type === 'title'
                                ? 'rgba(217, 119, 6, 0.24)'
                                : clip.type === 'overlay'
                                ? 'rgba(219, 39, 119, 0.22)'
                                : 'rgba(124, 58, 237, 0.22)',
                          }}
                          className={`absolute top-1.5 bottom-1.5 rounded-md overflow-hidden border transition-shadow ${
                            activeTool === 'razor' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
                          } ${
                            isSelected
                              ? 'border-violet-500 ring-2 ring-violet-500/40 z-10'
                              : 'border-zinc-400/40 dark:border-white/15 hover:border-violet-400'
                          }`}
                        >
                          {/* Video/Image Thumbnail Strip Background */}
                          {asset?.thumbnail && (
                            <div
                              aria-hidden="true"
                              className="absolute inset-0 opacity-35 bg-repeat-x bg-center pointer-events-none"
                              style={{
                                backgroundImage: `url(${asset.thumbnail})`,
                                backgroundSize: 'auto 100%',
                              }}
                            />
                          )}

                          {/* Audio Waveform Visualization */}
                          {clip.type === 'audio' && asset?.waveform && (
                            <svg
                              aria-hidden="true"
                              preserveAspectRatio="none"
                              viewBox={`0 0 ${asset.waveform.length} 40`}
                              className="absolute inset-0 w-full h-full opacity-65 pointer-events-none"
                            >
                              {asset.waveform.map((pk, idx) => {
                                const barH = Math.max(2, pk * 34);
                                return (
                                  <rect
                                    key={idx}
                                    x={idx}
                                    y={(40 - barH) / 2}
                                    width={0.68}
                                    height={barH}
                                    fill="#14b8a6"
                                  />
                                );
                              })}
                            </svg>
                          )}

                          {/* Transition In/Out Visual Wedges */}
                          {clip.transitionIn.type !== 'none' && clip.transitionIn.duration > 0 && (
                            <div
                              title={`Transition In: ${clip.transitionIn.type}`}
                              className="absolute left-0 top-0 bottom-0 bg-violet-400/35 border-r border-violet-300/60 pointer-events-none"
                              style={{
                                width: Math.min(widthPx * 0.4, clip.transitionIn.duration * zoomPxPerSec),
                              }}
                            />
                          )}
                          {clip.transitionOut.type !== 'none' && clip.transitionOut.duration > 0 && (
                            <div
                              title={`Transition Out: ${clip.transitionOut.type}`}
                              className="absolute right-0 top-0 bottom-0 bg-violet-400/35 border-l border-violet-300/60 pointer-events-none"
                              style={{
                                width: Math.min(widthPx * 0.4, clip.transitionOut.duration * zoomPxPerSec),
                              }}
                            />
                          )}

                          {/* Clip Label & Metadata */}
                          <div className="relative z-10 px-2 py-0.5 flex items-center justify-between gap-1 pointer-events-none">
                            <span className="text-[11px] font-medium text-zinc-950 dark:text-white truncate drop-shadow-sm">
                              {clip.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-200 shrink-0">
                              {clip.speed !== 1 ? `${clip.speed}x ` : ''}
                              {clip.freezeFrame ? 'HOLD ' : ''}
                              {totalKeyframes > 0 ? `◆${totalKeyframes}` : ''}
                            </span>
                          </div>

                          {/* Left Trim Handle */}
                          <div
                            onPointerDown={(e) => handleClipPointerDown(e, clip, track, 'trim-left')}
                            onPointerMove={handleClipPointerMove}
                            onPointerUp={handleClipPointerUp}
                            title="Drag to trim clip start"
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-500/70 z-20"
                          />

                          {/* Right Trim Handle */}
                          <div
                            onPointerDown={(e) => handleClipPointerDown(e, clip, track, 'trim-right')}
                            onPointerMove={handleClipPointerMove}
                            onPointerUp={handleClipPointerUp}
                            title="Drag to trim clip end"
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-500/70 z-20"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Full-Height Playhead Line */}
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none z-30"
              style={{ left: TRACK_HEADER_W + currentTime * zoomPxPerSec }}
            >
              <div className="w-3 h-3 -ml-[5.5px] -mt-2 bg-rose-500 rounded-b-sm rotate-45" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

interface ToolBtnProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  title: string;
  icon: React.ReactNode;
  text?: string;
}

const ToolBtn: React.FC<ToolBtnProps> = ({
  active = false,
  disabled = false,
  onClick,
  label,
  title,
  icon,
  text,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-label={label}
    aria-pressed={active || undefined}
    title={title}
    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-35 ${
      active
        ? 'bg-violet-700 text-white dark:bg-violet-600'
        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10'
    }`}
  >
    {icon}
    {text && <span>{text}</span>}
  </button>
);
