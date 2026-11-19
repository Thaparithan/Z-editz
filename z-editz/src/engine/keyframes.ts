import type {
  InterpolationMode,
  Keyframe,
  KeyframeChannel,
  KeyframeMap,
  TimelineClip,
} from '../types/editor';

export function applyEasing(t: number, mode: InterpolationMode): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (mode) {
    case 'ease-in':
      return clamped * clamped;
    case 'ease-out':
      return 1 - (1 - clamped) * (1 - clamped);
    case 'ease-in-out':
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
    case 'linear':
    default:
      return clamped;
  }
}

/**
 * Evaluates a keyframe channel at a given local clip time (seconds from clip start).
 * Falls back to `defaultValue` when no keyframes exist on the channel.
 */
export function evaluateKeyframes(
  keyframes: Keyframe[] | undefined,
  localTime: number,
  defaultValue: number
): number {
  if (!keyframes || keyframes.length === 0) {
    return defaultValue;
  }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  if (localTime <= sorted[0].time) {
    return sorted[0].value;
  }
  const last = sorted[sorted.length - 1];
  if (localTime >= last.time) {
    return last.value;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (localTime >= k0.time && localTime <= k1.time) {
      const span = k1.time - k0.time;
      if (span <= 1e-6) return k1.value;
      const rawT = (localTime - k0.time) / span;
      const easedT = applyEasing(rawT, k0.interpolation);
      return k0.value + (k1.value - k0.value) * easedT;
    }
  }

  return defaultValue;
}

export function evaluateClipTransformAtTime(clip: TimelineClip, localTime: number) {
  return {
    x: evaluateKeyframes(clip.keyframes.x, localTime, clip.transform.x),
    y: evaluateKeyframes(clip.keyframes.y, localTime, clip.transform.y),
    scale: evaluateKeyframes(clip.keyframes.scale, localTime, clip.transform.scale),
    rotation: evaluateKeyframes(
      clip.keyframes.rotation,
      localTime,
      clip.transform.rotation
    ),
    opacity: Math.max(
      0,
      Math.min(1, evaluateKeyframes(clip.keyframes.opacity, localTime, clip.transform.opacity))
    ),
    volume: Math.max(
      0,
      Math.min(2, evaluateKeyframes(clip.keyframes.volume, localTime, clip.audio.volume))
    ),
  };
}

/**
 * Inserts or updates a keyframe on a channel within a small time epsilon (0.04s).
 */
export function upsertKeyframe(
  map: KeyframeMap,
  channel: KeyframeChannel,
  time: number,
  value: number,
  interpolation: InterpolationMode = 'ease-in-out'
): KeyframeMap {
  const safeTime = Math.max(0, Number(time.toFixed(3)));
  const existing = [...(map[channel] ?? [])];
  const idx = existing.findIndex((kf) => Math.abs(kf.time - safeTime) <= 0.04);

  if (idx >= 0) {
    existing[idx] = {
      ...existing[idx],
      time: safeTime,
      value,
      interpolation,
    };
  } else {
    existing.push({
      id: `kf_${channel}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: safeTime,
      value,
      interpolation,
    });
  }

  existing.sort((a, b) => a.time - b.time);
  return {
    ...map,
    [channel]: existing,
  };
}

export function removeKeyframeAtTime(
  map: KeyframeMap,
  channel: KeyframeChannel,
  time: number,
  epsilon = 0.06
): KeyframeMap {
  const existing = map[channel];
  if (!existing || existing.length === 0) return map;
  const filtered = existing.filter((kf) => Math.abs(kf.time - time) > epsilon);
  return {
    ...map,
    [channel]: filtered,
  };
}

export function hasKeyframeNearTime(
  map: KeyframeMap,
  channel: KeyframeChannel,
  time: number,
  epsilon = 0.06
): boolean {
  const existing = map[channel];
  if (!existing) return false;
  return existing.some((kf) => Math.abs(kf.time - time) <= epsilon);
}
