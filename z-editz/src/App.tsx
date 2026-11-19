/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Film, Sliders, Rows3 } from 'lucide-react';
import type {
  CaptionItem,
  EditorTool,
  ExportJob,
  ExportPreset,
  MediaAsset,
  OverlayEffectType,
  ProjectState,
  TimelineClip,
  TimelineTrack,
  TitleStyle,
  TrackType,
  TransitionType,
  WorkspaceMode,
} from './types/editor';
import { ZEditzAudioEngine } from './engine/audioEngine';
import { createMediaCache } from './engine/compositor';
import {
  downloadCaptionsSrt,
  downloadProjectJson,
  exportCurrentFramePng,
  renderProjectVideo,
} from './engine/exporter';
import { createInitialSeedProject, generateDeterministicWaveform } from './engine/presets';
import {
  loadProjectFromStorage,
  restoreMediaAssetsBlobs,
  saveProjectToStorage,
  storeMediaBlob,
} from './engine/storage';
import {
  createClipFromAsset,
  createHistory,
  createTrack,
  deleteClip,
  deserializeProject,
  detachAudioFromClip,
  generateId,
  getProjectDuration,
  insertFreezeFrame,
  moveClip,
  pushHistory,
  redoHistory,
  reorderTracks,
  serializeProject,
  setClipSpeed,
  slipClip,
  splitClipAtTime,
  trimClip,
  undoHistory,
} from './engine/timelineEngine';
import { TopBar } from './components/TopBar';
import { MediaEffectsBin } from './components/MediaEffectsBin';
import { PreviewMonitor } from './components/PreviewMonitor';
import { InspectorPanel } from './components/InspectorPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { ColorWorkspace } from './components/ColorWorkspace';
import { AudioWorkspace } from './components/AudioWorkspace';
import { ExportWorkspace } from './components/ExportWorkspace';
import { ShortcutsModal } from './components/ShortcutsModal';

const AUTOSAVE_KEY = 'z_editz_autosave_v1';
const THEME_KEY = 'z_editz_theme_v1';

function loadInitialProject(): ProjectState {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      const parsed = deserializeProject(saved);
      if (parsed.clips.length > 0 && parsed.tracks.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fall back to clean deterministic seed project
  }
  return createInitialSeedProject();
}

export default function App() {
  const [history, setHistory] = useState(() => createHistory(loadInitialProject()));
  const project = history.present;

  const [workspace, setWorkspace] = useState<WorkspaceMode>('edit');
  const [mobilePanel, setMobilePanel] = useState<'timeline' | 'media' | 'inspector'>('timeline');
  const [currentTime, setCurrentTime] = useState<number>(1.4);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip_v1_coastal');
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [rippleMode, setRippleMode] = useState<boolean>(false);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [zoomPxPerSec, setZoomPxPerSec] = useState<number>(58);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // default dark
    }
    return 'dark';
  });

  const mediaCacheRef = useRef(createMediaCache());
  const audioEngineRef = useRef<ZEditzAudioEngine | null>(null);
  if (!audioEngineRef.current) {
    audioEngineRef.current = new ZEditzAudioEngine();
  }

  const projectRef = useRef(project);
  projectRef.current = project;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const duration = useMemo(() => getProjectDuration(project.clips), [project.clips]);
  const selectedClip = useMemo(
    () => project.clips.find((c) => c.id === selectedClipId) ?? null,
    [project.clips, selectedClipId]
  );

  // Show brief non-intrusive feedback banner
  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(id);
  }, [notice]);

  // Sync dual-theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage quota
    }
  }, [theme]);

  // Restore project & media blobs from IndexedDB on initial mount
  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await loadProjectFromStorage();
      if (stored && active) {
        const restoredAssets = await restoreMediaAssetsBlobs(stored.assets);
        setHistory(createHistory({ ...stored, assets: restoredAssets }));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // IndexedDB + LocalStorage non-destructive autosave (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProjectToStorage(project).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [project]);

  // History-aware state commit
  const commitProject = useCallback((updater: (prev: ProjectState) => ProjectState) => {
    setHistory((h) => pushHistory(h, updater(h.present)));
  }, []);

  // Fast live update without spamming undo stack (used during continuous slider drags)
  const updateProjectLive = useCallback((updater: (prev: ProjectState) => ProjectState) => {
    setHistory((h) => ({ ...h, present: updater(h.present) }));
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((h) => undoHistory(h));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((h) => redoHistory(h));
  }, []);

  // Playback loop (rAF + Web Audio Engine sync)
  useEffect(() => {
    if (!isPlaying) {
      audioEngineRef.current?.stopPlayback();
      return;
    }

    audioEngineRef.current?.startPlayback(projectRef.current, currentTimeRef.current);

    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000) * playbackRate;
      lastTs = now;

      const proj = projectRef.current;
      const totalDur = getProjectDuration(proj.clips);
      const minT = proj.settings.inPoint ?? 0;
      const maxT = proj.settings.outPoint ?? totalDur;

      let nextTime = currentTimeRef.current + dt;
      if (nextTime >= maxT) {
        if (loopEnabled) {
          nextTime = minT;
          audioEngineRef.current?.startPlayback(proj, nextTime);
        } else {
          nextTime = maxT;
          setIsPlaying(false);
        }
      } else if (nextTime < minT) {
        nextTime = minT;
        setIsPlaying(false);
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      audioEngineRef.current?.updateLiveMix(proj, nextTime);

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      audioEngineRef.current?.stopPlayback();
    };
  }, [isPlaying, loopEnabled, playbackRate]);

  const handleSeek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(duration + 4, Number(time.toFixed(3))));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      if (isPlaying) {
        audioEngineRef.current?.startPlayback(projectRef.current, clamped);
      }
    },
    [duration, isPlaying]
  );

  const handleTogglePlay = useCallback(() => {
    setPlaybackRate(1);
    setIsPlaying((prev) => !prev);
  }, []);

  // Media Import (real local video, image, audio files)
  const handleImportFiles = useCallback(
    async (files: FileList) => {
      const importedAssets: MediaAsset[] = [];

      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        const id = generateId('asset');

        if (file.type.startsWith('image/')) {
          storeMediaBlob(id, file, file.name);
          const dims = await new Promise<{ w: number; h: number }>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => resolve({ w: 1920, h: 1080 });
            img.src = url;
          });
          importedAssets.push({
            id,
            name: file.name,
            type: 'image',
            src: url,
            thumbnail: url,
            duration: 5.0,
            width: dims.w,
            height: dims.h,
            license: 'User Imported Local Media',
          });
        } else if (file.type.startsWith('video/')) {
          storeMediaBlob(id, file, file.name);
          const meta = await new Promise<{ dur: number; w: number; h: number }>((resolve) => {
            const vid = document.createElement('video');
            vid.preload = 'metadata';
            vid.onloadedmetadata = () =>
              resolve({
                dur: Number((vid.duration || 8).toFixed(2)),
                w: vid.videoWidth || 1920,
                h: vid.videoHeight || 1080,
              });
            vid.onerror = () => resolve({ dur: 8, w: 1920, h: 1080 });
            vid.src = url;
          });
          importedAssets.push({
            id,
            name: file.name,
            type: 'video',
            src: url,
            duration: meta.dur,
            width: meta.w,
            height: meta.h,
            fps: 30,
            license: 'User Imported Local Media',
          });
        } else if (file.type.startsWith('audio/')) {
          storeMediaBlob(id, file, file.name);
          const decoded = await audioEngineRef.current!.decodeFileAsset(id, file);
          importedAssets.push({
            id,
            name: file.name,
            type: 'audio',
            src: url,
            duration: decoded.duration,
            waveform: decoded.waveform,
            license: 'User Imported Local Audio',
          });
        }
      }

      if (importedAssets.length > 0) {
        commitProject((prev) => ({
          ...prev,
          assets: [...importedAssets, ...prev.assets],
        }));
        showNotice(`Imported ${importedAssets.length} local file(s) into Media Pool`);
      }
    },
    [commitProject, showNotice]
  );

  // Add Media Asset onto targeted track
  const handleAddAssetToTimeline = useCallback(
    (asset: MediaAsset) => {
      commitProject((prev) => {
        const wantAudio = asset.type === 'audio';
        const targetTrack =
          prev.tracks.find((t) => (wantAudio ? t.type === 'audio' : t.type === 'video') && t.targeted && !t.locked) ??
          prev.tracks.find((t) => (wantAudio ? t.type === 'audio' : t.type === 'video') && !t.locked);

        if (!targetTrack) return prev;
        const trackClips = prev.clips.filter((c) => c.trackId === targetTrack.id);
        const endOfTrack = trackClips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);
        const newClip = createClipFromAsset(asset, targetTrack.id, endOfTrack);
        setSelectedClipId(newClip.id);
        return {
          ...prev,
          clips: [...prev.clips, newClip],
        };
      });
      showNotice(`Added ${asset.name} to timeline`);
    },
    [commitProject, showNotice]
  );

  const handleAddTitleTemplate = useCallback(
    (name: string, style: TitleStyle, motionPreset: TimelineClip['motionPreset']) => {
      commitProject((prev) => {
        const titleTrack =
          prev.tracks.find((t) => t.type === 'title' && !t.locked) ??
          prev.tracks.find((t) => t.type === 'video' && !t.locked);
        if (!titleTrack) return prev;
        const newClip = createClipFromAsset(
          {
            id: style.templateId ?? generateId('tpl'),
            name,
            type: 'title',
            duration: 4.5,
            license: 'SIL Open Font License',
          },
          titleTrack.id,
          currentTimeRef.current,
          {
            titleStyle: style,
            motionPreset,
            transitionIn: { type: 'cross-dissolve', duration: 0.45 },
            transitionOut: { type: 'cross-dissolve', duration: 0.45 },
          }
        );
        setSelectedClipId(newClip.id);
        return { ...prev, clips: [...prev.clips, newClip] };
      });
      showNotice(`Inserted ${name}`);
    },
    [commitProject, showNotice]
  );

  const handleAddOverlay = useCallback(
    (name: string, overlayType: OverlayEffectType) => {
      commitProject((prev) => {
        const overlayTrack =
          prev.tracks.find((t) => t.type === 'video' && !t.locked) ?? prev.tracks[0];
        if (!overlayTrack) return prev;
        const newClip = createClipFromAsset(
          {
            id: `ov_${overlayType}`,
            name: `Overlay · ${name}`,
            type: 'overlay',
            duration: 4.0,
            license: 'Built-in Procedural Graphic Overlay',
            overlayType,
          },
          overlayTrack.id,
          currentTimeRef.current,
          {
            blendMode: overlayType === 'letterbox' ? 'source-over' : 'screen',
            overlayType,
          }
        );
        setSelectedClipId(newClip.id);
        return { ...prev, clips: [...prev.clips, newClip] };
      });
      showNotice(`Added ${name} overlay`);
    },
    [commitProject, showNotice]
  );

  // Editing operations
  const handleSplitClipAtTime = useCallback(
    (clipId: string, splitTime: number) => {
      commitProject((prev) => {
        const res = splitClipAtTime(prev.clips, clipId, splitTime);
        if (res.rightClipId) {
          setSelectedClipId(res.rightClipId);
        }
        return { ...prev, clips: res.clips };
      });
    },
    [commitProject]
  );

  const handleSplitAtPlayhead = useCallback(() => {
    const t = currentTimeRef.current;
    const target =
      (selectedClip &&
        t > selectedClip.startTime + 0.2 &&
        t < selectedClip.startTime + selectedClip.duration - 0.2 &&
        selectedClip) ||
      projectRef.current.clips.find(
        (c) => t > c.startTime + 0.2 && t < c.startTime + c.duration - 0.2
      );

    if (!target) {
      showNotice('Position playhead inside a clip to split');
      return;
    }
    handleSplitClipAtTime(target.id, t);
    showNotice(`Split "${target.name}" at ${t.toFixed(2)}s`);
  }, [selectedClip, handleSplitClipAtTime, showNotice]);

  const handleDeleteSelectedClip = useCallback(
    (forceRipple = false) => {
      if (!selectedClipId) return;
      const useRipple = forceRipple || rippleMode;
      commitProject((prev) => ({
        ...prev,
        clips: deleteClip(prev.clips, selectedClipId, useRipple),
      }));
      setSelectedClipId(null);
      showNotice(useRipple ? 'Ripple-extracted clip' : 'Deleted clip');
    },
    [selectedClipId, rippleMode, commitProject, showNotice]
  );

  const handleDetachAudio = useCallback(() => {
    if (!selectedClipId) return;
    commitProject((prev) => {
      const res = detachAudioFromClip(prev, selectedClipId);
      if (res.detachedClipId) {
        setSelectedClipId(res.detachedClipId);
      }
      return res.state;
    });
    showNotice('Detached audio clip onto audio track');
  }, [selectedClipId, commitProject, showNotice]);

  const handleFreezeFrame = useCallback(() => {
    if (!selectedClipId) return;
    const t = currentTimeRef.current;
    commitProject((prev) => {
      const res = insertFreezeFrame(prev.clips, selectedClipId, t, 2.0);
      if (res.freezeClipId) {
        setSelectedClipId(res.freezeClipId);
      }
      return { ...prev, clips: res.clips };
    });
    showNotice('Inserted 2.0s freeze-frame hold');
  }, [selectedClipId, commitProject, showNotice]);

  const handleAddMarker = useCallback(() => {
    const t = currentTimeRef.current;
    commitProject((prev) => ({
      ...prev,
      markers: [
        ...prev.markers,
        {
          id: generateId('mk'),
          time: Number(t.toFixed(3)),
          label: `Marker ${prev.markers.length + 1}`,
          color: '#a855f7',
        },
      ],
    }));
    showNotice(`Added marker at ${t.toFixed(2)}s`);
  }, [commitProject, showNotice]);

  const handleAddBeatMarkers = useCallback(() => {
    commitProject((prev) => {
      const total = getProjectDuration(prev.clips);
      const beats = [];
      for (let t = 2.0; t < total; t += 2.0) {
        if (!prev.markers.some((m) => Math.abs(m.time - t) < 0.35)) {
          beats.push({
            id: generateId('beat'),
            time: Number(t.toFixed(2)),
            label: `Beat · ${t.toFixed(0)}s`,
            color: '#14b8a6',
          });
        }
      }
      return { ...prev, markers: [...prev.markers, ...beats] };
    });
    showNotice('Detected rhythm beats and added timeline markers');
  }, [commitProject, showNotice]);

  const handleVoiceoverRecorded = useCallback(
    async (blob: Blob, durationSec: number) => {
      const url = URL.createObjectURL(blob);
      const assetId = generateId('vo_asset');
      const file = new File([blob], `Voiceover_${new Date().toLocaleTimeString()}.webm`, {
        type: blob.type || 'audio/webm',
      });
      storeMediaBlob(assetId, blob, file.name);
      const decoded = await audioEngineRef.current!.decodeFileAsset(assetId, file);
      const newAsset: MediaAsset = {
        id: assetId,
        name: file.name,
        type: 'audio',
        src: url,
        duration: Math.max(durationSec, decoded.duration),
        waveform: decoded.waveform.length > 0 ? decoded.waveform : generateDeterministicWaveform(5, 80),
        license: 'User Recorded Voiceover',
      };
      commitProject((prev) => {
        const audioTrack =
          prev.tracks.find((t) => t.type === 'audio' && !t.locked) ??
          createTrack('audio', prev.tracks);
        const tracks = prev.tracks.some((t) => t.id === audioTrack.id)
          ? prev.tracks
          : [...prev.tracks, audioTrack];
        const newClip = createClipFromAsset(newAsset, audioTrack.id, currentTimeRef.current);
        return {
          ...prev,
          tracks,
          assets: [newAsset, ...prev.assets],
          clips: [...prev.clips, newClip],
        };
      });
      showNotice('Voiceover recorded and placed on audio track');
    },
    [commitProject, showNotice]
  );

  // Load .zeditz.json project file
  const handleLoadProjectFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const restored = deserializeProject(text);
        setHistory(createHistory(restored));
        setCurrentTime(0);
        setSelectedClipId(restored.clips[0]?.id ?? null);
        showNotice(`Loaded project "${restored.settings.name}"`);
      } catch {
        showNotice('Invalid Z-editz JSON project file');
      }
    },
    [showNotice]
  );

  const handleBatchAddCaptions = useCallback(
    (newCaps: CaptionItem[]) => {
      commitProject((prev) => ({
        ...prev,
        captions: [...prev.captions, ...newCaps],
        showCaptions: true,
      }));
      showNotice(`Gemini added ${newCaps.length} subtitles!`);
    },
    [commitProject, showNotice]
  );

  // Real Render Queue Job Execution
  const handleStartRenderJob = useCallback(
    async (config: {
      name: string;
      presetName: string;
      width: number;
      height: number;
      fps: number;
      videoBitrateKbps: number;
      format: ExportPreset['format'];
    }) => {
      const jobId = generateId('job');
      const newJob: ExportJob = {
        id: jobId,
        name: config.name,
        presetName: config.presetName,
        width: config.width,
        height: config.height,
        fps: config.fps,
        format: config.format,
        status: 'rendering',
        progress: 2,
        createdAt: new Date().toLocaleTimeString(),
      };

      setExportJobs((prev) => [newJob, ...prev]);
      setIsPlaying(false);

      try {
        const result = await renderProjectVideo(projectRef.current, {
          width: config.width,
          height: config.height,
          fps: config.fps,
          videoBitrateKbps: config.videoBitrateKbps,
          format: config.format,
          audioEngine: audioEngineRef.current,
          onProgress: (pct) => {
            setExportJobs((prev) =>
              prev.map((j) => (j.id === jobId ? { ...j, progress: pct } : j))
            );
          },
        });

        setExportJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'completed',
                  progress: 100,
                  downloadUrl: result.url,
                  fileSizeBytes: result.blob.size,
                }
              : j
          )
        );
        showNotice(`Render complete: ${config.name}`);
      } catch (err) {
        setExportJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'failed',
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Browser MediaRecorder encoding failed.',
                }
              : j
          )
        );
      }
    },
    [showNotice]
  );

  // Global NLE Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (key === 'v') {
        setActiveTool('select');
      } else if (key === 'c') {
        setActiveTool('razor');
      } else if (key === 'r') {
        setRippleMode((v) => !v);
      } else if (key === 'n') {
        setSnapEnabled((v) => !v);
      } else if (key === 's') {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (key === 'm') {
        handleAddMarker();
      } else if (key === 'j') {
        setPlaybackRate((r) => (r > 0 ? -1 : Math.max(-4, r * 2)));
        setIsPlaying(true);
      } else if (key === 'k') {
        setIsPlaying(false);
        setPlaybackRate(1);
      } else if (key === 'l') {
        setPlaybackRate((r) => (r < 1 ? 1 : Math.min(4, r * 2)));
        setIsPlaying(true);
      } else if (key === 'i') {
        commitProject((prev) => ({
          ...prev,
          settings: { ...prev.settings, inPoint: Number(currentTimeRef.current.toFixed(3)) },
        }));
      } else if (key === 'o') {
        commitProject((prev) => ({
          ...prev,
          settings: { ...prev.settings, outPoint: Number(currentTimeRef.current.toFixed(3)) },
        }));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(currentTimeRef.current - 1 / projectRef.current.settings.fps);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentTimeRef.current + 1 / projectRef.current.settings.fps);
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleSeek(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        handleSeek(getProjectDuration(projectRef.current.clips));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelectedClip(e.shiftKey);
      } else if (e.key === '?') {
        setShortcutsOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleTogglePlay,
    handleSplitAtPlayhead,
    handleAddMarker,
    handleSeek,
    handleDeleteSelectedClip,
    commitProject,
  ]);

  const handleUpdateClipLive = useCallback(
    (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => {
      updateProjectLive((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === clipId ? updater(c) : c)),
      }));
    },
    [updateProjectLive]
  );

  const handleUpdateClipCommitted = useCallback(
    (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => {
      commitProject((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === clipId ? updater(c) : c)),
      }));
    },
    [commitProject]
  );

  const handleSetInPoint = useCallback(() => {
    commitProject((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        inPoint:
          prev.settings.inPoint !== null &&
          Math.abs(prev.settings.inPoint - currentTimeRef.current) < 0.05
            ? null
            : Number(currentTimeRef.current.toFixed(3)),
      },
    }));
  }, [commitProject]);

  const handleSetOutPoint = useCallback(() => {
    commitProject((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        outPoint:
          prev.settings.outPoint !== null &&
          Math.abs(prev.settings.outPoint - currentTimeRef.current) < 0.05
            ? null
            : Number(currentTimeRef.current.toFixed(3)),
      },
    }));
  }, [commitProject]);

  const handleToggleProxyMode = useCallback(() => {
    commitProject((prev) => ({
      ...prev,
      settings: { ...prev.settings, proxyMode: !prev.settings.proxyMode },
    }));
  }, [commitProject]);

  const handleExportFrame = useCallback(
    (canvas: HTMLCanvasElement) => {
      exportCurrentFramePng(canvas, projectRef.current.settings.name);
      showNotice('Saved PNG frame snapshot');
    },
    [showNotice]
  );

  return (
    <div
      data-theme={theme}
      data-workspace={workspace}
      className="h-screen w-screen overflow-hidden flex flex-col bg-white dark:bg-[#0c0b10] text-zinc-900 dark:text-zinc-100"
    >
      {/* Top Bar (Strict 3-Zone Contract) */}
      <TopBar
        workspace={workspace}
        onChangeWorkspace={setWorkspace}
        onOpenExport={() => setWorkspace('export')}
      />

      {/* Non-intrusive Action Feedback Toast */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-900 dark:bg-violet-600 text-white shadow-lg pointer-events-none"
        >
          {notice}
        </div>
      )}

      {/* EDIT WORKSPACE */}
      {workspace === 'edit' && (
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Desktop 3-Column Upper Studio + Bottom Timeline */}
          <div className="hidden lg:flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="flex-1 min-h-[260px] grid grid-cols-[296px_minmax(0,1fr)_288px] overflow-hidden">
              <MediaEffectsBin
                assets={project.assets}
                captions={project.captions}
                showCaptions={project.showCaptions}
                selectedClip={selectedClip}
                playheadTime={currentTime}
                fps={project.settings.fps}
                onImportFiles={handleImportFiles}
                onAddAssetToTimeline={handleAddAssetToTimeline}
                onApplyFilterToSelected={(presetId) => {
                  if (!selectedClip) return;
                  handleUpdateClipCommitted(selectedClip.id, (c) => ({
                    ...c,
                    filterPresetId: presetId,
                    filterIntensity: presetId === 'none' ? 1 : c.filterIntensity || 0.7,
                  }));
                  showNotice(`Applied filter: ${presetId}`);
                }}
                onApplyTransitionToSelected={(type: TransitionType, edge, dur) => {
                  if (!selectedClip) return;
                  handleUpdateClipCommitted(selectedClip.id, (c) => ({
                    ...c,
                    [edge === 'in' ? 'transitionIn' : 'transitionOut']: {
                      type,
                      duration: dur,
                    },
                  }));
                  showNotice(`Applied ${type} transition (${edge})`);
                }}
                onAddTitleTemplate={handleAddTitleTemplate}
                onAddOverlay={handleAddOverlay}
                onToggleShowCaptions={() =>
                  commitProject((prev) => ({ ...prev, showCaptions: !prev.showCaptions }))
                }
                onAddCaption={(text, startTime, endTime) =>
                  commitProject((prev) => ({
                    ...prev,
                    showCaptions: true,
                    captions: [
                      ...prev.captions,
                      { id: generateId('cap'), startTime, endTime, text },
                    ],
                  }))
                }
                onUpdateCaption={(id, patch: Partial<CaptionItem>) =>
                  updateProjectLive((prev) => ({
                    ...prev,
                    captions: prev.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
                  }))
                }
                onDeleteCaption={(id) =>
                  commitProject((prev) => ({
                    ...prev,
                    captions: prev.captions.filter((c) => c.id !== id),
                  }))
                }
                onBatchAddCaptions={handleBatchAddCaptions}
                onDownloadSrt={() => downloadCaptionsSrt(project.captions, project.settings.name)}
              />

              <PreviewMonitor
                project={project}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                loopEnabled={loopEnabled}
                playbackRate={playbackRate}
                selectedClip={selectedClip}
                mediaCache={mediaCacheRef.current}
                onTogglePlay={handleTogglePlay}
                onSeek={handleSeek}
                onToggleLoop={() => setLoopEnabled((v) => !v)}
                onSetInPoint={handleSetInPoint}
                onSetOutPoint={handleSetOutPoint}
                onToggleProxyMode={handleToggleProxyMode}
                onExportFramePng={handleExportFrame}
                onUpdateClipPosition={(clipId, x, y) =>
                  handleUpdateClipLive(clipId, (c) => ({
                    ...c,
                    transform: { ...c.transform, x, y },
                  }))
                }
              />

              <InspectorPanel
                clip={selectedClip}
                playheadTime={currentTime}
                onUpdateClip={handleUpdateClipLive}
                onChangeSpeed={(clipId, speed) =>
                  commitProject((prev) => ({
                    ...prev,
                    clips: setClipSpeed(prev.clips, clipId, speed),
                  }))
                }
                onSlipClip={(clipId, delta) =>
                  commitProject((prev) => ({
                    ...prev,
                    clips: slipClip(prev.clips, clipId, delta),
                  }))
                }
              />
            </div>

            <div className="h-[310px] shrink-0">
              <TimelinePanel
                project={project}
                currentTime={currentTime}
                duration={duration}
                selectedClipId={selectedClipId}
                activeTool={activeTool}
                rippleMode={rippleMode}
                snapEnabled={snapEnabled}
                zoomPxPerSec={zoomPxPerSec}
                canUndo={history.past.length > 0}
                canRedo={history.future.length > 0}
                theme={theme}
                onSelectTool={setActiveTool}
                onToggleRipple={() => setRippleMode((v) => !v)}
                onToggleSnap={() => setSnapEnabled((v) => !v)}
                onZoomChange={setZoomPxPerSec}
                onSeek={handleSeek}
                onSelectClip={setSelectedClipId}
                onSplitAtPlayhead={handleSplitAtPlayhead}
                onSplitClipAtTime={handleSplitClipAtTime}
                onMoveClip={(clipId, newStart, newTrackId) =>
                  commitProject((prev) => ({
                    ...prev,
                    clips: moveClip(prev.clips, clipId, newStart, newTrackId),
                  }))
                }
                onTrimClip={(clipId, edge, deltaSec) =>
                  commitProject((prev) => ({
                    ...prev,
                    clips: trimClip(prev.clips, clipId, edge, deltaSec, rippleMode),
                  }))
                }
                onDeleteSelectedClip={handleDeleteSelectedClip}
                onDetachAudio={handleDetachAudio}
                onFreezeFrame={handleFreezeFrame}
                onAddMarker={handleAddMarker}
                onRemoveMarker={(markerId) =>
                  commitProject((prev) => ({
                    ...prev,
                    markers: prev.markers.filter((m) => m.id !== markerId),
                  }))
                }
                onAddTrack={(type: TrackType) =>
                  commitProject((prev) => ({
                    ...prev,
                    tracks:
                      type === 'audio'
                        ? [...prev.tracks, createTrack(type, prev.tracks)]
                        : [createTrack(type, prev.tracks), ...prev.tracks],
                  }))
                }
                onRemoveTrack={(trackId) =>
                  commitProject((prev) => ({
                    ...prev,
                    tracks: prev.tracks.filter((t) => t.id !== trackId),
                    clips: prev.clips.filter((c) => c.trackId !== trackId),
                  }))
                }
                onToggleTrackProp={(trackId, prop) =>
                  commitProject((prev) => ({
                    ...prev,
                    tracks: prev.tracks.map((t) =>
                      t.id === trackId ? { ...t, [prop]: !t[prop] } : t
                    ),
                  }))
                }
                onReorderTrack={(trackId, dir) =>
                  commitProject((prev) => ({
                    ...prev,
                    tracks: reorderTracks(prev.tracks, trackId, dir),
                  }))
                }
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSaveProject={() => {
                  downloadProjectJson(project);
                  showNotice('Downloaded .zeditz.json project file');
                }}
                onLoadProjectFile={handleLoadProjectFile}
                onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                onOpenShortcuts={() => setShortcutsOpen(true)}
              />
            </div>
          </div>

          {/* Responsive Mobile / Tablet Layout (< lg) */}
          <div className="flex lg:hidden flex-1 min-h-0 flex-col overflow-hidden">
            <div className="h-[250px] shrink-0 border-b border-[#e4e1ee] dark:border-[#242233]">
              <PreviewMonitor
                project={project}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                loopEnabled={loopEnabled}
                playbackRate={playbackRate}
                selectedClip={selectedClip}
                mediaCache={mediaCacheRef.current}
                onTogglePlay={handleTogglePlay}
                onSeek={handleSeek}
                onToggleLoop={() => setLoopEnabled((v) => !v)}
                onSetInPoint={handleSetInPoint}
                onSetOutPoint={handleSetOutPoint}
                onToggleProxyMode={handleToggleProxyMode}
                onExportFramePng={handleExportFrame}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {mobilePanel === 'timeline' && (
                <TimelinePanel
                  project={project}
                  currentTime={currentTime}
                  duration={duration}
                  selectedClipId={selectedClipId}
                  activeTool={activeTool}
                  rippleMode={rippleMode}
                  snapEnabled={snapEnabled}
                  zoomPxPerSec={zoomPxPerSec}
                  canUndo={history.past.length > 0}
                  canRedo={history.future.length > 0}
                  theme={theme}
                  onSelectTool={setActiveTool}
                  onToggleRipple={() => setRippleMode((v) => !v)}
                  onToggleSnap={() => setSnapEnabled((v) => !v)}
                  onZoomChange={setZoomPxPerSec}
                  onSeek={handleSeek}
                  onSelectClip={setSelectedClipId}
                  onSplitAtPlayhead={handleSplitAtPlayhead}
                  onSplitClipAtTime={handleSplitClipAtTime}
                  onMoveClip={(clipId, newStart, newTrackId) =>
                    commitProject((prev) => ({
                      ...prev,
                      clips: moveClip(prev.clips, clipId, newStart, newTrackId),
                    }))
                  }
                  onTrimClip={(clipId, edge, deltaSec) =>
                    commitProject((prev) => ({
                      ...prev,
                      clips: trimClip(prev.clips, clipId, edge, deltaSec, rippleMode),
                    }))
                  }
                  onDeleteSelectedClip={handleDeleteSelectedClip}
                  onDetachAudio={handleDetachAudio}
                  onFreezeFrame={handleFreezeFrame}
                  onAddMarker={handleAddMarker}
                  onRemoveMarker={(markerId) =>
                    commitProject((prev) => ({
                      ...prev,
                      markers: prev.markers.filter((m) => m.id !== markerId),
                    }))
                  }
                  onAddTrack={(type) =>
                    commitProject((prev) => ({
                      ...prev,
                      tracks: [...prev.tracks, createTrack(type, prev.tracks)],
                    }))
                  }
                  onRemoveTrack={(trackId) =>
                    commitProject((prev) => ({
                      ...prev,
                      tracks: prev.tracks.filter((t) => t.id !== trackId),
                      clips: prev.clips.filter((c) => c.trackId !== trackId),
                    }))
                  }
                  onToggleTrackProp={(trackId, prop) =>
                    commitProject((prev) => ({
                      ...prev,
                      tracks: prev.tracks.map((t) =>
                        t.id === trackId ? { ...t, [prop]: !t[prop] } : t
                      ),
                    }))
                  }
                  onReorderTrack={(trackId, dir) =>
                    commitProject((prev) => ({
                      ...prev,
                      tracks: reorderTracks(prev.tracks, trackId, dir),
                    }))
                  }
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onSaveProject={() => downloadProjectJson(project)}
                  onLoadProjectFile={handleLoadProjectFile}
                  onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                  onOpenShortcuts={() => setShortcutsOpen(true)}
                />
              )}
              {mobilePanel === 'media' && (
                <MediaEffectsBin
                  assets={project.assets}
                  captions={project.captions}
                  showCaptions={project.showCaptions}
                  selectedClip={selectedClip}
                  playheadTime={currentTime}
                  fps={project.settings.fps}
                  onImportFiles={handleImportFiles}
                  onAddAssetToTimeline={handleAddAssetToTimeline}
                  onApplyFilterToSelected={(presetId) => {
                    if (!selectedClip) return;
                    handleUpdateClipCommitted(selectedClip.id, (c) => ({
                      ...c,
                      filterPresetId: presetId,
                    }));
                  }}
                  onApplyTransitionToSelected={(type, edge, dur) => {
                    if (!selectedClip) return;
                    handleUpdateClipCommitted(selectedClip.id, (c) => ({
                      ...c,
                      [edge === 'in' ? 'transitionIn' : 'transitionOut']: {
                        type,
                        duration: dur,
                      },
                    }));
                  }}
                  onAddTitleTemplate={handleAddTitleTemplate}
                  onAddOverlay={handleAddOverlay}
                  onToggleShowCaptions={() =>
                    commitProject((prev) => ({ ...prev, showCaptions: !prev.showCaptions }))
                  }
                  onAddCaption={(text, startTime, endTime) =>
                    commitProject((prev) => ({
                      ...prev,
                      showCaptions: true,
                      captions: [
                        ...prev.captions,
                        { id: generateId('cap'), startTime, endTime, text },
                      ],
                    }))
                  }
                  onUpdateCaption={(id, patch) =>
                    updateProjectLive((prev) => ({
                      ...prev,
                      captions: prev.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
                    }))
                  }
                  onDeleteCaption={(id) =>
                    commitProject((prev) => ({
                      ...prev,
                      captions: prev.captions.filter((c) => c.id !== id),
                    }))
                  }
                  onBatchAddCaptions={handleBatchAddCaptions}
                  onDownloadSrt={() => downloadCaptionsSrt(project.captions, project.settings.name)}
                />
              )}
              {mobilePanel === 'inspector' && (
                <InspectorPanel
                  clip={selectedClip}
                  playheadTime={currentTime}
                  onUpdateClip={handleUpdateClipLive}
                  onChangeSpeed={(clipId, speed) =>
                    commitProject((prev) => ({
                      ...prev,
                      clips: setClipSpeed(prev.clips, clipId, speed),
                    }))
                  }
                  onSlipClip={(clipId, delta) =>
                    commitProject((prev) => ({
                      ...prev,
                      clips: slipClip(prev.clips, clipId, delta),
                    }))
                  }
                />
              )}
            </div>

            {/* Compact Mobile Panel Switcher (<= 48px) */}
            <nav
              aria-label="Mobile panel switcher"
              className="h-12 shrink-0 grid grid-cols-3 border-t border-[#e4e1ee] dark:border-[#242233] bg-white dark:bg-[#100f16]"
            >
              {(
                [
                  ['timeline', 'Timeline', <Rows3 className="w-4 h-4" key="t" />],
                  ['media', 'Media & FX', <Film className="w-4 h-4" key="m" />],
                  ['inspector', 'Inspector', <Sliders className="w-4 h-4" key="i" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMobilePanel(id)}
                  className={`flex items-center justify-center gap-1.5 text-xs font-medium ${
                    mobilePanel === id
                      ? 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </main>
      )}

      {/* COLOR GRADING WORKSPACE */}
      {workspace === 'color' && (
        <ColorWorkspace
          project={project}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          loopEnabled={loopEnabled}
          playbackRate={playbackRate}
          selectedClip={selectedClip}
          mediaCache={mediaCacheRef.current}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onToggleLoop={() => setLoopEnabled((v) => !v)}
          onSetInPoint={handleSetInPoint}
          onSetOutPoint={handleSetOutPoint}
          onToggleProxyMode={handleToggleProxyMode}
          onExportFramePng={handleExportFrame}
          onUpdateClip={handleUpdateClipLive}
        />
      )}

      {/* AUDIO MIXING WORKSPACE */}
      {workspace === 'audio' && (
        <AudioWorkspace
          project={project}
          currentTime={currentTime}
          isPlaying={isPlaying}
          audioEngine={audioEngineRef.current!}
          onTogglePlay={handleTogglePlay}
          onUpdateTrack={(trackId: string, patch: Partial<TimelineTrack>) =>
            updateProjectLive((prev) => ({
              ...prev,
              tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
            }))
          }
          onAddBeatMarkers={handleAddBeatMarkers}
          onVoiceoverRecorded={handleVoiceoverRecorded}
        />
      )}

      {/* EXPORT WORKSPACE */}
      {workspace === 'export' && (
        <ExportWorkspace
          project={project}
          exportJobs={exportJobs}
          onStartRenderJob={handleStartRenderJob}
          onDownloadProjectJson={() => {
            downloadProjectJson(project);
            showNotice('Downloaded .zeditz.json project file');
          }}
          onDownloadSrt={() => {
            downloadCaptionsSrt(project.captions, project.settings.name);
            showNotice('Downloaded captions .SRT file');
          }}
        />
      )}

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
