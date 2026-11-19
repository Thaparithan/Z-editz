import type {
  AudioClipSettings,
  ClipCrop,
  ClipMask,
  ClipTransform,
  MediaAsset,
  ProjectState,
  TimelineClip,
  TimelineMarker,
  TimelineTrack,
  TrackType,
} from '../types/editor';
import { createDefaultColorGrade } from './colorPipeline';

export const MIN_CLIP_DURATION = 0.2;

export function createDefaultTransform(): ClipTransform {
  return {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flipH: false,
    flipV: false,
  };
}

export function createDefaultCrop(): ClipCrop {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function createDefaultMask(): ClipMask {
  return { shape: 'none', feather: 12, scale: 0.85, invert: false };
}

export function createDefaultAudioSettings(): AudioClipSettings {
  return {
    volume: 1,
    pan: 0,
    fadeIn: 0,
    fadeOut: 0,
    muted: false,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressor: false,
    denoise: false,
  };
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Formats seconds into SMPTE HH:MM:SS:FF timecode.
 */
export function formatTimecode(seconds: number, fps = 30): string {
  const safeSec = Math.max(0, seconds);
  const totalFrames = Math.floor(safeSec * fps + 1e-6);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hrs = Math.floor(totalMinutes / 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function getProjectDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 10;
  const maxEnd = clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0);
  return Math.max(5, Number(maxEnd.toFixed(3)));
}

export function createClipFromAsset(
  asset: MediaAsset,
  trackId: string,
  startTime: number,
  overrides: Partial<TimelineClip> = {}
): TimelineClip {
  const colorByType: Record<MediaAsset['type'], string> = {
    video: '#7c3aed',
    image: '#6d28d9',
    audio: '#0d9488',
    title: '#d97706',
    overlay: '#db2777',
  };

  return {
    id: generateId('clip'),
    assetId: asset.id,
    trackId,
    name: asset.name,
    type: asset.type,
    startTime: Math.max(0, Number(startTime.toFixed(3))),
    duration: Math.max(MIN_CLIP_DURATION, Number(asset.duration.toFixed(3))),
    mediaOffset: 0,
    sourceDuration: asset.duration,
    speed: 1,
    reversed: false,
    colorTag: colorByType[asset.type] ?? '#7c3aed',
    transform: createDefaultTransform(),
    crop: createDefaultCrop(),
    mask: createDefaultMask(),
    blendMode: asset.type === 'overlay' ? 'screen' : 'source-over',
    chromaKey: {
      enabled: false,
      keyColor: '#00b140',
      similarity: 0.32,
      smoothness: 0.14,
    },
    filterPresetId: 'none',
    filterIntensity: 1,
    colorGrade: createDefaultColorGrade(),
    transitionIn: { type: 'none', duration: 0.6 },
    transitionOut: { type: 'none', duration: 0.6 },
    motionPreset: 'none',
    keyframes: {},
    overlayType: asset.overlayType,
    audio: createDefaultAudioSettings(),
    ...overrides,
  };
}

/**
 * Splits a clip at an exact timeline timestamp `splitTime`.
 * Preserves source mediaOffset, speed, filters, keyframes (partitioned & shifted),
 * and clears internal cut transitions cleanly.
 */
export function splitClipAtTime(
  clips: TimelineClip[],
  clipId: string,
  splitTime: number
): { clips: TimelineClip[]; rightClipId: string | null } {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return { clips, rightClipId: null };

  const leftDuration = Number((splitTime - target.startTime).toFixed(3));
  const rightDuration = Number((target.startTime + target.duration - splitTime).toFixed(3));

  if (leftDuration < MIN_CLIP_DURATION || rightDuration < MIN_CLIP_DURATION) {
    return { clips, rightClipId: null };
  }

  // Partition keyframes cleanly into left and right clips
  const leftKeyframes: TimelineClip['keyframes'] = {};
  const rightKeyframes: TimelineClip['keyframes'] = {};

  for (const [channel, list] of Object.entries(target.keyframes) as [
    keyof TimelineClip['keyframes'],
    TimelineClip['keyframes'][keyof TimelineClip['keyframes']],
  ][]) {
    if (!list) continue;
    leftKeyframes[channel] = list.filter((kf) => kf.time <= leftDuration);
    rightKeyframes[channel] = list
      .filter((kf) => kf.time >= leftDuration)
      .map((kf) => ({
        ...kf,
        id: generateId('kf'),
        time: Number((kf.time - leftDuration).toFixed(3)),
      }));
  }

  const leftClip: TimelineClip = {
    ...target,
    duration: leftDuration,
    transitionOut: { type: 'none', duration: 0.5 },
    keyframes: leftKeyframes,
  };

  const rightId = generateId('clip');
  const rightClip: TimelineClip = {
    ...target,
    id: rightId,
    startTime: Number(splitTime.toFixed(3)),
    duration: rightDuration,
    mediaOffset: Number((target.mediaOffset + leftDuration * target.speed).toFixed(3)),
    transitionIn: { type: 'none', duration: 0.5 },
    keyframes: rightKeyframes,
  };

  const nextClips = clips.flatMap((c) => (c.id === clipId ? [leftClip, rightClip] : [c]));
  return { clips: nextClips, rightClipId: rightId };
}

/**
 * Deletes a clip. In ripple mode, shifts all subsequent clips on the same track
 * backward by the deleted clip's duration to close the gap automatically.
 */
export function deleteClip(
  clips: TimelineClip[],
  clipId: string,
  ripple: boolean
): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  const remaining = clips.filter((c) => c.id !== clipId);
  if (!ripple) return remaining;

  const shift = target.duration;
  return remaining.map((c) => {
    if (c.trackId === target.trackId && c.startTime >= target.startTime + target.duration - 0.005) {
      return {
        ...c,
        startTime: Math.max(0, Number((c.startTime - shift).toFixed(3))),
      };
    }
    return c;
  });
}

/**
 * Trims either the left or right edge of a clip.
 * When `ripple` is true:
 * - Right-edge trim shifts subsequent clips on the same track by delta.
 * - Left-edge trim keeps start position anchored and shifts subsequent clips by -delta (closing/opening gap).
 */
export function trimClip(
  clips: TimelineClip[],
  clipId: string,
  edge: 'left' | 'right',
  deltaSeconds: number,
  ripple: boolean
): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  if (edge === 'right') {
    const newDuration = Math.max(
      MIN_CLIP_DURATION,
      Number((target.duration + deltaSeconds).toFixed(3))
    );
    const actualDelta = Number((newDuration - target.duration).toFixed(3));
    if (Math.abs(actualDelta) < 1e-4) return clips;

    const oldEnd = target.startTime + target.duration;
    return clips.map((c) => {
      if (c.id === clipId) {
        return { ...c, duration: newDuration };
      }
      if (ripple && c.trackId === target.trackId && c.startTime >= oldEnd - 0.005) {
        return {
          ...c,
          startTime: Math.max(0, Number((c.startTime + actualDelta).toFixed(3))),
        };
      }
      return c;
    });
  } else {
    // Left-edge trim: positive delta moves start right (shortens clip), negative delta extends left
    const maxPositiveDelta = target.duration - MIN_CLIP_DURATION;
    const minNegativeDelta = -Math.min(target.startTime, target.mediaOffset / target.speed || target.startTime);
    const clampedDelta = Math.max(
      minNegativeDelta,
      Math.min(maxPositiveDelta, Number(deltaSeconds.toFixed(3)))
    );
    if (Math.abs(clampedDelta) < 1e-4) return clips;

    const newDuration = Number((target.duration - clampedDelta).toFixed(3));
    const newMediaOffset = Math.max(
      0,
      Number((target.mediaOffset + clampedDelta * target.speed).toFixed(3))
    );

    if (ripple) {
      // Ripple left trim: anchor startTime, shorten/lengthen duration, shift later clips
      const oldEnd = target.startTime + target.duration;
      return clips.map((c) => {
        if (c.id === clipId) {
          return {
            ...c,
            duration: newDuration,
            mediaOffset: newMediaOffset,
          };
        }
        if (c.trackId === target.trackId && c.startTime >= oldEnd - 0.005) {
          return {
            ...c,
            startTime: Math.max(0, Number((c.startTime - clampedDelta).toFixed(3))),
          };
        }
        return c;
      });
    }

    return clips.map((c) =>
      c.id === clipId
        ? {
            ...c,
            startTime: Math.max(0, Number((target.startTime + clampedDelta).toFixed(3))),
            duration: newDuration,
            mediaOffset: newMediaOffset,
          }
        : c
    );
  }
}

/**
 * Slip edit: shifts mediaOffset inside the source without moving timeline startTime or duration.
 */
export function slipClip(
  clips: TimelineClip[],
  clipId: string,
  deltaOffset: number
): TimelineClip[] {
  return clips.map((c) => {
    if (c.id !== clipId) return c;
    const maxOffset = Math.max(0, c.sourceDuration - c.duration * c.speed);
    const nextOffset = Math.max(0, Math.min(maxOffset, Number((c.mediaOffset + deltaOffset).toFixed(3))));
    return { ...c, mediaOffset: nextOffset };
  });
}

/**
 * Updates clip playback speed and rescales timeline duration proportionally.
 */
export function setClipSpeed(
  clips: TimelineClip[],
  clipId: string,
  newSpeed: number
): TimelineClip[] {
  const clamped = Math.max(0.25, Math.min(8, Number(newSpeed.toFixed(2))));
  return clips.map((c) => {
    if (c.id !== clipId) return c;
    const ratio = c.speed / clamped;
    const nextDuration = Math.max(MIN_CLIP_DURATION, Number((c.duration * ratio).toFixed(3)));
    return { ...c, speed: clamped, duration: nextDuration };
  });
}

/**
 * Snaps a candidate timestamp to playhead, markers, or nearby clip edges within threshold.
 */
export function snapTime(
  candidateTime: number,
  clips: TimelineClip[],
  markers: TimelineMarker[],
  playheadTime: number,
  excludeClipId: string | null,
  thresholdSeconds = 0.22
): { time: number; snapped: boolean } {
  const targets: number[] = [0, playheadTime];
  for (const m of markers) targets.push(m.time);
  for (const c of clips) {
    if (c.id === excludeClipId) continue;
    targets.push(c.startTime, c.startTime + c.duration);
  }

  let closest = candidateTime;
  let minDiff = thresholdSeconds;
  let snapped = false;

  for (const t of targets) {
    const diff = Math.abs(candidateTime - t);
    if (diff < minDiff) {
      minDiff = diff;
      closest = t;
      snapped = true;
    }
  }

  return { time: Math.max(0, Number(closest.toFixed(3))), snapped };
}

export function moveClip(
  clips: TimelineClip[],
  clipId: string,
  newStartTime: number,
  newTrackId?: string
): TimelineClip[] {
  return clips.map((c) =>
    c.id === clipId
      ? {
          ...c,
          startTime: Math.max(0, Number(newStartTime.toFixed(3))),
          trackId: newTrackId ?? c.trackId,
        }
      : c
  );
}

/**
 * Detaches audio from a video clip onto a dedicated audio track (creating one if needed)
 * and mutes the original video clip's embedded audio.
 */
export function detachAudioFromClip(
  state: ProjectState,
  clipId: string
): { state: ProjectState; detachedClipId: string | null } {
  const sourceClip = state.clips.find((c) => c.id === clipId);
  if (!sourceClip || (sourceClip.type !== 'video' && sourceClip.type !== 'image')) {
    return { state, detachedClipId: null };
  }

  let audioTrack = state.tracks.find((t) => t.type === 'audio' && !t.locked);
  let nextTracks = state.tracks;

  if (!audioTrack) {
    audioTrack = createTrack('audio', state.tracks);
    nextTracks = [...state.tracks, audioTrack];
  }

  const detachedId = generateId('clip_aud');
  const detachedClip: TimelineClip = {
    ...sourceClip,
    id: detachedId,
    trackId: audioTrack.id,
    name: `${sourceClip.name} (Audio)`,
    type: 'audio',
    colorTag: '#0d9488',
    linkedClipId: sourceClip.id,
    audio: {
      ...sourceClip.audio,
      muted: false,
    },
  };

  const nextClips = [
    ...state.clips.map((c) =>
      c.id === sourceClip.id
        ? {
            ...c,
            linkedClipId: detachedId,
            audio: { ...c.audio, muted: true },
          }
        : c
    ),
    detachedClip,
  ];

  return {
    state: { ...state, tracks: nextTracks, clips: nextClips },
    detachedClipId: detachedId,
  };
}

/**
 * Inserts a freeze-frame hold clip of `holdDuration` seconds at `playheadTime`,
 * splitting the active clip and shifting the remainder right.
 */
export function insertFreezeFrame(
  clips: TimelineClip[],
  clipId: string,
  playheadTime: number,
  holdDuration = 2.0
): { clips: TimelineClip[]; freezeClipId: string | null } {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return { clips, freezeClipId: null };
  if (playheadTime <= target.startTime + 0.05 || playheadTime >= target.startTime + target.duration - 0.05) {
    return { clips, freezeClipId: null };
  }

  const splitRes = splitClipAtTime(clips, clipId, playheadTime);
  if (!splitRes.rightClipId) return { clips, freezeClipId: null };

  const freezeId = generateId('clip_frz');
  const localOffset = target.mediaOffset + (playheadTime - target.startTime) * target.speed;

  const freezeClip: TimelineClip = {
    ...target,
    id: freezeId,
    name: `${target.name} (Freeze)`,
    startTime: Number(playheadTime.toFixed(3)),
    duration: holdDuration,
    mediaOffset: Number(localOffset.toFixed(3)),
    freezeFrame: true,
    colorTag: '#0284c7',
    transitionIn: { type: 'none', duration: 0.5 },
    transitionOut: { type: 'none', duration: 0.5 },
    keyframes: {},
  };

  const shiftedClips = splitRes.clips.map((c) => {
    if (c.trackId === target.trackId && c.startTime >= playheadTime - 0.005) {
      return {
        ...c,
        startTime: Number((c.startTime + holdDuration).toFixed(3)),
      };
    }
    return c;
  });

  return {
    clips: [...shiftedClips, freezeClip],
    freezeClipId: freezeId,
  };
}

export function createTrack(type: TrackType, existing: TimelineTrack[]): TimelineTrack {
  const countOfType = existing.filter((t) => t.type === type).length + 1;
  const prefix = type === 'video' ? 'V' : type === 'title' ? 'T' : 'A';
  const label = type === 'video' ? 'Video' : type === 'title' ? 'Title' : 'Audio';
  return {
    id: generateId(`trk_${prefix.toLowerCase()}`),
    name: `${prefix}${countOfType} · ${label}`,
    type,
    muted: false,
    hidden: false,
    locked: false,
    solo: false,
    targeted: countOfType === 1,
    volume: 1,
    pan: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    compressor: false,
  };
}

export function reorderTracks(
  tracks: TimelineTrack[],
  trackId: string,
  direction: 'up' | 'down'
): TimelineTrack[] {
  const idx = tracks.findIndex((t) => t.id === trackId);
  if (idx < 0) return tracks;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= tracks.length) return tracks;
  const copy = [...tracks];
  [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
  return copy;
}

export function serializeProject(project: ProjectState): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(json: string): ProjectState {
  const parsed = JSON.parse(json) as ProjectState;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.settings ||
    !Array.isArray(parsed.tracks) ||
    !Array.isArray(parsed.clips) ||
    !Array.isArray(parsed.assets)
  ) {
    throw new Error('Invalid Z-editz project file structure.');
  }
  return parsed;
}

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [] };
}

export function pushHistory<T>(
  history: HistoryState<T>,
  next: T,
  maxDepth = 80
): HistoryState<T> {
  const nextPast = [...history.past, history.present];
  if (nextPast.length > maxDepth) {
    nextPast.shift();
  }
  return {
    past: nextPast,
    present: next,
    future: [],
  };
}

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
