import React from 'react';
import { Volume2, VolumeX, Lock, Unlock, Film, Music, Type } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { Track } from '../../types/editor';
import { TimelineClip } from './TimelineClip';

interface TimelineTrackProps {
  track: Track;
  totalWidth: number;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({ track, totalWidth }) => {
  const { clips, toggleTrackMute, toggleTrackLock } = useEditor();

  const trackClips = clips.filter((c) => c.trackId === track.id);

  const getTrackIcon = () => {
    switch (track.type) {
      case 'video':
        return <Film size={13} className="text-purple-400" />;
      case 'audio':
        return <Music size={13} className="text-emerald-400" />;
      case 'text':
      default:
        return <Type size={13} className="text-amber-400" />;
    }
  };

  return (
    <div className="flex h-12 border-b border-[var(--border-color)] select-none">
      {/* Track Header (Left pinned) */}
      <div className="w-40 sm:w-48 shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-color)] px-2.5 flex items-center justify-between text-xs z-10 shadow-sm">
        <div className="flex items-center gap-2 truncate">
          {getTrackIcon()}
          <span className="font-semibold text-[var(--text-primary)] truncate text-[11px]">
            {track.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Mute Toggle */}
          <button
            onClick={() => toggleTrackMute(track.id)}
            title={track.isMuted ? 'Unmute Track' : 'Mute Track'}
            className={`p-1 rounded hover:bg-[var(--bg-card)] transition ${
              track.isMuted ? 'text-red-400 bg-red-500/10' : 'text-[var(--text-secondary)]'
            }`}
          >
            {track.isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          {/* Lock Toggle */}
          <button
            onClick={() => toggleTrackLock(track.id)}
            title={track.isLocked ? 'Unlock Track' : 'Lock Track'}
            className={`p-1 rounded hover:bg-[var(--bg-card)] transition ${
              track.isLocked ? 'text-amber-400 bg-amber-500/10' : 'text-[var(--text-secondary)]'
            }`}
          >
            {track.isLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
        </div>
      </div>

      {/* Track Lane (Scrollable area where clips sit) */}
      <div
        style={{ width: `${totalWidth}px` }}
        className="relative h-full bg-[var(--timeline-track)] timeline-grid"
      >
        {trackClips.map((clip) => (
          <TimelineClip key={clip.id} clip={clip} />
        ))}
      </div>
    </div>
  );
};
