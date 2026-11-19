import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronFirst,
  ChevronLast,
  Grid,
  Maximize2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import type { ProjectState, TimelineClip } from '../types/editor';
import {
  type MediaResourceCache,
  renderTimelineFrame,
} from '../engine/compositor';
import { formatTimecode } from '../engine/timelineEngine';

interface PreviewMonitorProps {
  project: ProjectState;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  loopEnabled: boolean;
  playbackRate: number;
  selectedClip: TimelineClip | null;
  mediaCache: MediaResourceCache;
  bypassGrade?: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleLoop: () => void;
  onSetInPoint: () => void;
  onSetOutPoint: () => void;
  onToggleProxyMode: () => void;
  onExportFramePng: (canvas: HTMLCanvasElement) => void;
  onUpdateClipPosition?: (clipId: string, x: number, y: number) => void;
  onCanvasFrameRendered?: (canvas: HTMLCanvasElement) => void;
}

export const PreviewMonitor: React.FC<PreviewMonitorProps> = ({
  project,
  currentTime,
  duration,
  isPlaying,
  loopEnabled,
  playbackRate,
  selectedClip,
  mediaCache,
  bypassGrade = false,
  onTogglePlay,
  onSeek,
  onToggleLoop,
  onSetInPoint,
  onSetOutPoint,
  onToggleProxyMode,
  onExportFramePng,
  onUpdateClipPosition,
  onCanvasFrameRendered,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSafeGuides, setShowSafeGuides] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    clipId: string;
  } | null>(null);

  const canvasW = project.settings.proxyMode ? 640 : 960;
  const canvasH = Math.round((canvasW * project.settings.height) / project.settings.width);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    renderTimelineFrame(
      ctx,
      project,
      currentTime,
      mediaCache,
      () => setRenderVersion((v) => v + 1),
      {
        bypassGrade,
        showSafeGuides,
        selectedClipId: selectedClip?.id ?? null,
        isPlaying,
      }
    );
    onCanvasFrameRendered?.(canvas);
  }, [
    project,
    currentTime,
    mediaCache,
    isPlaying,
    bypassGrade,
    showSafeGuides,
    selectedClip?.id,
    renderVersion,
    canvasW,
    canvasH,
    onCanvasFrameRendered,
  ]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selectedClip || selectedClip.type === 'audio' || !onUpdateClipPosition) return;
    if (
      currentTime < selectedClip.startTime ||
      currentTime > selectedClip.startTime + selectedClip.duration
    ) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: selectedClip.transform.x,
      origY: selectedClip.transform.y,
      clipId: selectedClip.id,
    };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || !onUpdateClipPosition || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1280 / Math.max(1, rect.width);
    const scaleY = 720 / Math.max(1, rect.height);
    const dx = (e.clientX - dragRef.current.startClientX) * scaleX;
    const dy = (e.clientY - dragRef.current.startClientY) * scaleY;
    onUpdateClipPosition(
      dragRef.current.clipId,
      Math.round(dragRef.current.origX + dx),
      Math.round(dragRef.current.origY + dy)
    );
  };

  const handleCanvasPointerUp = () => {
    dragRef.current = null;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const stepFrame = (deltaFrames: number) => {
    const step = deltaFrames / project.settings.fps;
    onSeek(Math.max(0, Math.min(duration, currentTime + step)));
  };

  return (
    <section
      ref={containerRef}
      aria-label="Program Preview Monitor"
      className="flex flex-col h-full bg-[#f4f3f8] dark:bg-[#0e0d14] min-w-0 overflow-hidden"
    >
      {/* Monitor Top Info Bar */}
      <div className="h-9 px-3.5 flex items-center justify-between gap-4 border-b border-[#e4e1ee] dark:border-[#242233] bg-white/80 dark:bg-[#13121a] shrink-0">
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 min-w-0">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
            Program Monitor
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[11px] truncate">
            {project.settings.width}×{project.settings.height} · {project.settings.fps} fps
          </span>
          {playbackRate !== 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-violet-600 dark:text-violet-400 font-semibold">
                {playbackRate}x Shuttle
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleProxyMode}
            title="Toggle Proxy Playback (faster preview on 4K timelines)"
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              project.settings.proxyMode
                ? 'bg-violet-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5'
            }`}
          >
            {project.settings.proxyMode ? 'Proxy: 1/2' : 'Full Res'}
          </button>
          <button
            type="button"
            onClick={() => setShowSafeGuides((v) => !v)}
            aria-label="Toggle title safe guides"
            title="Title & Action Safe Guides"
            className={`p-1.5 rounded transition-colors ${
              showSafeGuides
                ? 'bg-violet-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => canvasRef.current && onExportFramePng(canvasRef.current)}
            aria-label="Export current frame as PNG"
            title="Snapshot Frame (PNG)"
            className="p-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen preview"
            title="Fullscreen Preview"
            className="p-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 overflow-hidden relative">
        <div className="relative w-full h-full flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            data-testid="preview-canvas"
            data-time={currentTime.toFixed(2)}
            data-playing={isPlaying ? 'true' : 'false'}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className="max-w-full max-h-full aspect-video rounded-md bg-black shadow-lg border border-black/15 dark:border-white/10 cursor-move"
          />
        </div>
      </div>

      {/* Transport Controls */}
      <div className="h-11 px-2.5 sm:px-3.5 flex items-center justify-between gap-2 sm:gap-3 border-t border-[#e4e1ee] dark:border-[#242233] bg-white/90 dark:bg-[#13121a] shrink-0">
        {/* Timecode Readout */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs shrink-0">
          <span
            data-testid="timecode-current"
            className="font-semibold text-violet-700 dark:text-violet-300 tabular-nums"
          >
            {formatTimecode(currentTime, project.settings.fps)}
          </span>
          <span className="text-zinc-400 hidden sm:inline">/</span>
          <span className="text-zinc-500 dark:text-zinc-400 tabular-nums hidden sm:inline">
            {formatTimecode(duration, project.settings.fps)}
          </span>
        </div>

        {/* Play / Step / Shuttle Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => onSeek(0)}
            aria-label="Jump to start"
            title="Start (Home)"
            className="p-1.5 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronFirst className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => stepFrame(-1)}
            aria-label="Step back one frame"
            title="Previous Frame (←)"
            className="p-1.5 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause playback' : 'Play timeline'}
            title="Play / Pause (Space)"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500 text-white transition-colors mx-0.5 sm:mx-1"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => stepFrame(1)}
            aria-label="Step forward one frame"
            title="Next Frame (→)"
            className="p-1.5 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(duration)}
            aria-label="Jump to end"
            title="End (End)"
            className="p-1.5 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronLast className="w-4 h-4" />
          </button>
        </div>

        {/* In / Out & Loop */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSetInPoint}
            title="Mark In Point (I)"
            className={`hidden sm:inline-flex px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
              project.settings.inPoint !== null
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5'
            }`}
          >
            In
          </button>
          <button
            type="button"
            onClick={onSetOutPoint}
            title="Mark Out Point (O)"
            className={`hidden sm:inline-flex px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
              project.settings.outPoint !== null
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5'
            }`}
          >
            Out
          </button>
          <button
            type="button"
            onClick={onToggleLoop}
            aria-label="Toggle loop playback"
            title="Loop Playback"
            className={`p-1.5 rounded transition-colors ${
              loopEnabled
                ? 'bg-violet-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
