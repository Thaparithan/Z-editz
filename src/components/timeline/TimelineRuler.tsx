import React, { useRef } from 'react';
import { useEditor } from '../../store/editorContext';

export const TimelineRuler: React.FC = () => {
  const { totalDuration, zoomLevel, setCurrentTime } = useEditor();
  const rulerRef = useRef<HTMLDivElement | null>(null);

  const totalWidth = Math.max(1200, totalDuration * zoomLevel + 400);

  // Interval calculation based on zoom level
  let majorInterval = 5; // seconds
  let minorInterval = 1; // seconds

  if (zoomLevel > 60) {
    majorInterval = 1;
    minorInterval = 0.5;
  } else if (zoomLevel < 25) {
    majorInterval = 10;
    minorInterval = 5;
  }

  const ticksCount = Math.ceil(totalDuration / minorInterval) + 10;

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, clickX / zoomLevel);
    setCurrentTime(newTime);
  };

  return (
    <div
      ref={rulerRef}
      onClick={handleRulerClick}
      style={{ width: `${totalWidth}px` }}
      className="h-6 relative bg-[var(--bg-card)] border-b border-[var(--border-color)] cursor-pointer select-none overflow-hidden"
    >
      {Array.from({ length: ticksCount }).map((_, i) => {
        const time = i * minorInterval;
        const isMajor = time % majorInterval === 0;
        const left = time * zoomLevel;

        return (
          <div
            key={i}
            style={{ left: `${left}px` }}
            className={`absolute top-0 flex flex-col items-start ${
              isMajor ? 'h-full border-l border-purple-500/40' : 'h-2 border-l border-[var(--border-color)]'
            }`}
          >
            {isMajor && (
              <span className="text-[10px] font-mono pl-1 text-[var(--text-secondary)] font-semibold">
                {time}s
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
