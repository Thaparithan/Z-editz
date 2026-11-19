import React, { useState } from 'react';
import { Film, Music, Type, Sparkles, Smile, VolumeX, Diamond } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { Clip } from '../../types/editor';

interface TimelineClipProps {
  clip: Clip;
}

export const TimelineClip: React.FC<TimelineClipProps> = ({ clip }) => {
  const {
    selectedClipId,
    setSelectedClipId,
    zoomLevel,
    updateClip,
  } = useEditor();

  const isSelected = selectedClipId === clip.id;

  const left = clip.startTime * zoomLevel;
  const width = Math.max(30, clip.duration * zoomLevel);

  // Dragging & Trimming States
  const [isTrimmingLeft, setIsTrimmingLeft] = useState(false);
  const [isTrimmingRight, setIsTrimmingRight] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Type styling
  const getTypeConfig = () => {
    switch (clip.type) {
      case 'video':
        return {
          icon: <Film size={12} className="text-purple-300" />,
          bg: 'bg-gradient-to-r from-purple-900/80 to-indigo-900/80 border-purple-500/50',
          activeBg: 'border-purple-400 ring-2 ring-purple-500/50',
        };
      case 'audio':
        return {
          icon: <Music size={12} className="text-emerald-300" />,
          bg: 'bg-gradient-to-r from-emerald-950/90 to-teal-900/90 border-emerald-500/50',
          activeBg: 'border-emerald-400 ring-2 ring-emerald-500/50',
        };
      case 'text':
        return {
          icon: <Type size={12} className="text-amber-300" />,
          bg: 'bg-gradient-to-r from-amber-950/80 to-orange-950/80 border-amber-500/50',
          activeBg: 'border-amber-400 ring-2 ring-amber-500/50',
        };
      case 'effect':
        return {
          icon: <Sparkles size={12} className="text-pink-300" />,
          bg: 'bg-gradient-to-r from-pink-950/80 to-rose-950/80 border-pink-500/50',
          activeBg: 'border-pink-400 ring-2 ring-pink-500/50',
        };
      case 'sticker':
      default:
        return {
          icon: <Smile size={12} className="text-cyan-300" />,
          bg: 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border-cyan-500/50',
          activeBg: 'border-cyan-400 ring-2 ring-cyan-500/50',
        };
    }
  };

  const config = getTypeConfig();

  // Handle Drag to move
  const handleMouseDownMove = (e: React.MouseEvent) => {
    if (isTrimmingLeft || isTrimmingRight) return;
    e.stopPropagation();
    setSelectedClipId(clip.id);
    setIsMoving(true);

    const startX = e.clientX;
    const initialStartTime = clip.startTime;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startX) / zoomLevel;
      const newStartTime = Math.max(0, initialStartTime + deltaSec);
      updateClip(clip.id, { startTime: Math.round(newStartTime * 100) / 100 });
    };

    const handleMouseUp = () => {
      setIsMoving(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Left Trim
  const handleMouseDownTrimLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTrimmingLeft(true);
    const startX = e.clientX;
    const initialStartTime = clip.startTime;
    const initialDuration = clip.duration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startX) / zoomLevel;
      if (initialDuration - deltaSec > 0.3) {
        updateClip(clip.id, {
          startTime: Math.max(0, initialStartTime + deltaSec),
          duration: initialDuration - deltaSec,
          sourceStartTime: clip.sourceStartTime + deltaSec,
        });
      }
    };

    const handleMouseUp = () => {
      setIsTrimmingLeft(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Right Trim
  const handleMouseDownTrimRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTrimmingRight(true);
    const startX = e.clientX;
    const initialDuration = clip.duration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaSec = (moveEvent.clientX - startX) / zoomLevel;
      if (initialDuration + deltaSec > 0.3) {
        updateClip(clip.id, {
          duration: initialDuration + deltaSec,
        });
      }
    };

    const handleMouseUp = () => {
      setIsTrimmingRight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setSelectedClipId(clip.id);
      }}
      onMouseDown={handleMouseDownMove}
      style={{
        left: `${left}px`,
        width: `${width}px`,
      }}
      className={`absolute top-1 bottom-1 rounded-lg border flex items-center justify-between overflow-hidden cursor-pointer select-none transition-shadow ${
        config.bg
      } ${isSelected ? config.activeBg : ''} ${isMoving ? 'opacity-70 scale-[0.98]' : ''}`}
    >
      {/* Left Trim Handle */}
      <div
        onMouseDown={handleMouseDownTrimLeft}
        className="w-2.5 h-full hover:bg-white/40 cursor-w-resize shrink-0 flex items-center justify-center transition"
      >
        <div className="w-0.5 h-3 bg-white/40 rounded-full" />
      </div>

      {/* Main Clip Body */}
      <div className="flex-1 px-1.5 flex flex-col justify-center h-full overflow-hidden relative">
        <div className="flex items-center gap-1.5">
          {config.icon}
          <span className="text-[11px] font-bold text-white truncate drop-shadow-sm">
            {clip.name}
          </span>
          {clip.isMuted && <VolumeX size={11} className="text-red-400 shrink-0" />}
          {clip.speed !== 1 && (
            <span className="text-[9px] font-mono px-1 rounded bg-black/40 text-purple-300">
              {clip.speed}x
            </span>
          )}
        </div>

        {/* Audio Waveform Visualization for Audio Clips */}
        {clip.type === 'audio' && clip.audioWaveform && (
          <div className="w-full h-4 mt-0.5 flex items-end gap-[1px] opacity-75 overflow-hidden">
            {clip.audioWaveform.map((peak, idx) => (
              <div
                key={idx}
                style={{ height: `${Math.max(15, peak * 100)}%` }}
                className="w-1 bg-emerald-400 rounded-t-sm"
              />
            ))}
          </div>
        )}

        {/* Keyframe Markers along clip */}
        {clip.keyframes && clip.keyframes.length > 0 && (
          <div className="absolute bottom-0.5 left-0 right-0 h-2 flex items-center">
            {clip.keyframes.map((kf) => {
              const kfLeft = (kf.timeOffset / clip.duration) * 100;
              return (
                <div
                  key={kf.id}
                  style={{ left: `${kfLeft}%` }}
                  className="absolute transform -translate-x-1/2"
                >
                  <Diamond size={8} className="text-cyan-400 fill-cyan-400" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Trim Handle */}
      <div
        onMouseDown={handleMouseDownTrimRight}
        className="w-2.5 h-full hover:bg-white/40 cursor-e-resize shrink-0 flex items-center justify-center transition"
      >
        <div className="w-0.5 h-3 bg-white/40 rounded-full" />
      </div>
    </div>
  );
};
