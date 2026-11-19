import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight, 
  Repeat
} from 'lucide-react';
import { useEditor } from '../../store/editorContext';

export const PlayerControls: React.FC = () => {
  const {
    currentTime,
    setCurrentTime,
    totalDuration,
    isPlaying,
    togglePlay,
  } = useEditor();

  const [isLooping, setIsLooping] = React.useState<boolean>(false);

  // Format time as HH:MM:SS:FF (at 30fps)
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const handleStepBack = () => {
    setCurrentTime(Math.max(0, currentTime - 1 / 30));
  };

  const handleStepForward = () => {
    setCurrentTime(Math.min(totalDuration, currentTime + 1 / 30));
  };

  const handleToStart = () => {
    setCurrentTime(0);
  };

  const handleToEnd = () => {
    setCurrentTime(totalDuration);
  };

  return (
    <div className="h-10 px-4 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex items-center justify-between select-none text-xs">
      {/* Timecode display */}
      <div className="flex items-center gap-2 font-mono font-bold">
        <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 text-xs">
          {formatTimecode(currentTime)}
        </span>
        <span className="text-[var(--text-secondary)] font-normal">/</span>
        <span className="text-[var(--text-secondary)] font-normal">
          {formatTimecode(totalDuration)}
        </span>
      </div>

      {/* Main Playback Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleToStart}
          title="Jump to Start"
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
        >
          <SkipBack size={15} />
        </button>

        <button
          onClick={handleStepBack}
          title="Step 1 Frame Back"
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={togglePlay}
          title="Play / Pause (Space)"
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 text-white flex items-center justify-center shadow-md shadow-purple-600/40 hover:scale-105 active:scale-95 transition"
        >
          {isPlaying ? <Pause size={15} fill="white" /> : <Play size={15} fill="white" className="ml-0.5" />}
        </button>

        <button
          onClick={handleStepForward}
          title="Step 1 Frame Forward"
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={handleToEnd}
          title="Jump to End"
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
        >
          <SkipForward size={15} />
        </button>
      </div>

      {/* Secondary Controls: Loop toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsLooping(!isLooping)}
          title="Toggle Loop"
          className={`p-1.5 rounded-lg transition ${
            isLooping
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
          }`}
        >
          <Repeat size={14} />
        </button>
      </div>
    </div>
  );
};
