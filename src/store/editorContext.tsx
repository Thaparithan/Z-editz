import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Clip, Track, AspectRatio, ThemeMode, ExportSettings, Keyframe } from '../types/editor';
import { audioEngine } from '../engine/audioEngine';

interface EditorContextType {
  // Theme & Layout
  themeMode: ThemeMode;
  toggleTheme: () => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  activePanel: string;
  setActivePanel: (panel: string) => void;

  // Timeline State
  tracks: Track[];
  clips: Clip[];
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  selectedClip: Clip | null;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  totalDuration: number;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;

  // Actions
  addClip: (clip: Omit<Clip, 'id'>) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  splitClipAtPlayhead: () => void;
  extractAudioFromClip: (clipId: string) => Promise<void>;
  duplicateClip: (clipId: string) => void;
  addKeyframeAtPlayhead: (clipId: string) => void;
  removeKeyframe: (clipId: string, keyframeId: string) => void;

  // Track Actions
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;

  // Export
  exportSettings: ExportSettings;
  setExportSettings: React.Dispatch<React.SetStateAction<ExportSettings>>;
  isExporting: boolean;
  setIsExporting: (exporting: boolean) => void;
  exportProgress: number;
  setExportProgress: (prog: number) => void;

  // Video Element Registry for real-time canvas preview
  videoElements: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  audioElements: React.MutableRefObject<Map<string, HTMLAudioElement>>;

  // Undo / Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

const DEFAULT_TRACKS: Track[] = [
  { id: 'track-text', name: 'Text & Titles', type: 'text', isMuted: false, isLocked: false, isHidden: false },
  { id: 'track-overlay', name: 'PIP / Overlay', type: 'video', isMuted: false, isLocked: false, isHidden: false },
  { id: 'track-main-video', name: 'Main Video', type: 'video', isMuted: false, isLocked: false, isHidden: false },
  { id: 'track-audio', name: 'Audio Track 1', type: 'audio', isMuted: false, isLocked: false, isHidden: false },
  { id: 'track-sfx', name: 'Sound FX & Voice', type: 'audio', isMuted: false, isLocked: false, isHidden: false },
];

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [activePanel, setActivePanel] = useState<string>('media');

  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(35); // pixels per second

  // History for Undo / Redo
  const [history, setHistory] = useState<Clip[][]>([]);
  const [redoStack, setRedoStack] = useState<Clip[][]>([]);

  // Export
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    resolution: '1080p',
    width: 1920,
    height: 1080,
    fps: 60,
    quality: 'ultra_pro',
    format: 'mp4',
  });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  const videoElements = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Calculate project total duration
  const totalDuration = Math.max(
    10,
    ...clips.map((c) => c.startTime + c.duration)
  );

  // Selected clip object
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;

  // Toggle Theme & apply dark class to HTML root
  const toggleTheme = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // Save history state
  const pushHistory = (newClips: Clip[]) => {
    setHistory((prev) => [...prev.slice(-25), clips]);
    setRedoStack([]);
    setClips(newClips);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [...prev, clips]);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setClips(previous);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, clips]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setClips(next);
  };

  // Add Clip
  const addClip = (clipData: Omit<Clip, 'id'>) => {
    const id = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newClip: Clip = {
      ...clipData,
      id,
    };
    pushHistory([...clips, newClip]);
    setSelectedClipId(id);
  };

  // Update Clip
  const updateClip = (id: string, updates: Partial<Clip>) => {
    const updated = clips.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setClips(updated);
  };

  // Remove Clip
  const removeClip = (id: string) => {
    pushHistory(clips.filter((c) => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  // Split Clip at current playhead position (CapCut Razor Tool)
  const splitClipAtPlayhead = () => {
    if (!selectedClip) return;
    if (currentTime <= selectedClip.startTime || currentTime >= selectedClip.startTime + selectedClip.duration) {
      return;
    }

    const firstDuration = currentTime - selectedClip.startTime;
    const secondDuration = selectedClip.duration - firstDuration;

    const firstClip: Clip = {
      ...selectedClip,
      duration: firstDuration,
    };

    const secondClip: Clip = {
      ...selectedClip,
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: `${selectedClip.name} (Part 2)`,
      startTime: currentTime,
      duration: secondDuration,
      sourceStartTime: selectedClip.sourceStartTime + firstDuration * selectedClip.speed,
    };

    const updatedClips = clips.map((c) => (c.id === selectedClip.id ? firstClip : c));
    pushHistory([...updatedClips, secondClip]);
    setSelectedClipId(secondClip.id);
  };

  // Extract Audio from selected Video Clip (User's special requirement)
  const extractAudioFromClip = async (clipId: string) => {
    const targetClip = clips.find((c) => c.id === clipId);
    if (!targetClip || targetClip.type !== 'video') return;

    try {
      const { audioUrl, duration, waveform } = await audioEngine.extractAudioFromVideo(targetClip.sourceUrl);

      // Create new audio clip placed exactly in sync with the video
      const extractedAudioClip: Clip = {
        id: `audio-ext-${Date.now()}`,
        trackId: 'track-audio',
        name: `Extracted: ${targetClip.name}`,
        type: 'audio',
        sourceUrl: audioUrl,
        startTime: targetClip.startTime,
        duration: Math.min(targetClip.duration, duration),
        sourceStartTime: targetClip.sourceStartTime,
        sourceDuration: duration,
        volume: targetClip.volume,
        speed: targetClip.speed,
        fadeIn: 0,
        fadeOut: 0,
        isMuted: false,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        keyframes: [],
        blendMode: 'source-over',
        colorAdjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, vignette: 0, exposure: 0, hue: 0, blur: 0 },
        chromaKey: { enabled: false, color: '#00ff00', similarity: 30, smoothness: 10, spillReduction: 50 },
        audioWaveform: waveform,
        originalVideoClipId: targetClip.id,
      };

      // Mute the original video clip's audio so there's no echo
      const updatedClips = clips.map((c) => (c.id === targetClip.id ? { ...c, isMuted: true } : c));
      pushHistory([...updatedClips, extractedAudioClip]);
      setSelectedClipId(extractedAudioClip.id);
    } catch (err) {
      console.error('Audio extraction error:', err);
    }
  };

  // Duplicate Clip
  const duplicateClip = (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    const duplicated: Clip = {
      ...clip,
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: `${clip.name} (Copy)`,
      startTime: clip.startTime + clip.duration + 0.2,
    };
    pushHistory([...clips, duplicated]);
    setSelectedClipId(duplicated.id);
  };

  // Add Keyframe at Playhead
  const addKeyframeAtPlayhead = (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    const offset = Math.max(0, currentTime - clip.startTime);
    const newKeyframe: Keyframe = {
      id: `kf-${Date.now()}`,
      timeOffset: offset,
      x: clip.x,
      y: clip.y,
      scale: clip.scale,
      rotation: clip.rotation,
      opacity: clip.opacity,
    };
    const updatedKeyframes = [...clip.keyframes.filter((k) => Math.abs(k.timeOffset - offset) > 0.1), newKeyframe];
    updateClip(clipId, { keyframes: updatedKeyframes });
  };

  // Remove Keyframe
  const removeKeyframe = (clipId: string, keyframeId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    updateClip(clipId, {
      keyframes: clip.keyframes.filter((k) => k.id !== keyframeId),
    });
  };

  // Toggle Track states
  const toggleTrackMute = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isMuted: !t.isMuted } : t)));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isLocked: !t.isLocked } : t)));
  };

  // Playhead ticking
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (isPlaying) {
        const delta = (now - lastTime) / 1000;
        setCurrentTime((prev) => {
          if (prev + delta >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + delta;
        });
      }
      lastTime = now;
      if (isPlaying) {
        animId = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, totalDuration]);

  const togglePlay = () => setIsPlaying((prev) => !prev);

  // Keyboard Shortcuts (Space: Play/Pause, Split: 'S', Delete: Backspace/Del, Undo: Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyS' && !e.ctrlKey) {
        splitClipAtPlayhead();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) removeClip(selectedClipId);
      } else if (e.ctrlKey && e.code === 'KeyZ') {
        if (e.shiftKey) redo();
        else undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <EditorContext.Provider
      value={{
        themeMode,
        toggleTheme,
        aspectRatio,
        setAspectRatio,
        activePanel,
        setActivePanel,
        tracks,
        clips,
        selectedClipId,
        setSelectedClipId,
        selectedClip,
        currentTime,
        setCurrentTime,
        isPlaying,
        setIsPlaying,
        togglePlay,
        totalDuration,
        zoomLevel,
        setZoomLevel,
        addClip,
        updateClip,
        removeClip,
        splitClipAtPlayhead,
        extractAudioFromClip,
        duplicateClip,
        addKeyframeAtPlayhead,
        removeKeyframe,
        toggleTrackMute,
        toggleTrackLock,
        exportSettings,
        setExportSettings,
        isExporting,
        setIsExporting,
        exportProgress,
        setExportProgress,
        videoElements,
        audioElements,
        canUndo: history.length > 0,
        canRedo: redoStack.length > 0,
        undo,
        redo,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};
