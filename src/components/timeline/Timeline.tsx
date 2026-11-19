import React, { useRef } from 'react';
import { useEditor } from '../../store/editorContext';
import { TimelineToolbar } from './TimelineToolbar';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';

export const Timeline: React.FC = () => {
  const {
    tracks,
    currentTime,
    setCurrentTime,
    totalDuration,
    zoomLevel,
    setSelectedClipId,
  } = useEditor();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const totalWidth = Math.max(1200, totalDuration * zoomLevel + 500);
  const playheadLeft = currentTime * zoomLevel;

  // Handle Playhead Scrubbing
  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    // Account for track header width (w-40 = 160px on mobile, w-48 = 192px on desktop)
    const headerWidth = window.innerWidth >= 640 ? 192 : 160;
    const clickX = e.clientX - rect.left + scrollLeft - headerWidth;
    if (clickX >= 0) {
      setCurrentTime(Math.max(0, clickX / zoomLevel));
    }
  };

  return (
    <div className="flex flex-col h-64 md:h-72 bg-[var(--bg-surface)] border-t border-[var(--border-color)] select-none">
      {/* Top Toolbar */}
      <TimelineToolbar />

      {/* Main Timeline Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onClick={(e) => {
          handleTimelineScrub(e);
          setSelectedClipId(null);
        }}
        className="flex-1 overflow-x-auto overflow-y-auto relative"
      >
        <div style={{ width: `${totalWidth}px` }} className="relative min-w-full">
          {/* Header Row: Ruler with empty left spacer */}
          <div className="flex">
            <div className="w-40 sm:w-48 shrink-0 bg-[var(--bg-card)] border-r border-b border-[var(--border-color)] flex items-center px-3 z-20">
              <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Tracks
              </span>
            </div>
            <TimelineRuler />
          </div>

          {/* Tracks List */}
          <div className="relative">
            {tracks.map((track) => (
              <TimelineTrack key={track.id} track={track} totalWidth={totalWidth} />
            ))}

            {/* Playhead Scrubber */}
            <div
              style={{
                left: `${(window.innerWidth >= 640 ? 192 : 160) + playheadLeft}px`,
              }}
              className="absolute top-0 bottom-0 z-30 pointer-events-none transform -translate-x-1/2 flex flex-col items-center"
            >
              {/* Playhead Top Pointer */}
              <div className="w-3.5 h-3.5 bg-red-500 rounded-sm transform rotate-45 -mt-1 shadow-md shadow-red-500/50 pointer-events-auto cursor-ew-resize" />
              {/* Red Line */}
              <div className="w-[1.5px] flex-1 bg-red-500 shadow-sm shadow-red-500/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
