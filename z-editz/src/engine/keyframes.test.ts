import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEasing,
  evaluateKeyframes,
  hasKeyframeNearTime,
  removeKeyframeAtTime,
  upsertKeyframe,
} from './keyframes';
import type { Keyframe } from '../types/editor';

test('evaluateKeyframes interpolates linearly between two keyframes', () => {
  const kfs: Keyframe[] = [
    { id: 'k1', time: 0, value: 0, interpolation: 'linear' },
    { id: 'k2', time: 4, value: 100, interpolation: 'linear' },
  ];

  assert.equal(evaluateKeyframes(kfs, -1, 50), 0);
  assert.equal(evaluateKeyframes(kfs, 0, 50), 0);
  assert.equal(evaluateKeyframes(kfs, 2, 50), 50);
  assert.equal(evaluateKeyframes(kfs, 3, 50), 75);
  assert.equal(evaluateKeyframes(kfs, 5, 50), 100);
});

test('evaluateKeyframes supports ease-in, ease-out, and ease-in-out curves', () => {
  assert.equal(applyEasing(0.5, 'ease-in'), 0.25);
  assert.equal(applyEasing(0.5, 'ease-out'), 0.75);
  assert.equal(applyEasing(0.5, 'ease-in-out'), 0.5);

  const kfs: Keyframe[] = [
    { id: 'k1', time: 0, value: 1.0, interpolation: 'ease-in' },
    { id: 'k2', time: 2, value: 2.0, interpolation: 'linear' },
  ];
  assert.equal(evaluateKeyframes(kfs, 1.0, 1.0), 1.25);
});

test('upsertKeyframe and removeKeyframeAtTime manage channel keyframes cleanly', () => {
  let map = upsertKeyframe({}, 'opacity', 1.0, 0.5, 'linear');
  assert.equal(hasKeyframeNearTime(map, 'opacity', 1.0), true);
  assert.equal(map.opacity?.length, 1);

  // Updating near the same timestamp replaces rather than duplicates
  map = upsertKeyframe(map, 'opacity', 1.02, 0.8, 'ease-out');
  assert.equal(map.opacity?.length, 1);
  assert.equal(map.opacity?.[0].value, 0.8);

  map = upsertKeyframe(map, 'opacity', 3.0, 1.0, 'linear');
  assert.equal(map.opacity?.length, 2);

  map = removeKeyframeAtTime(map, 'opacity', 1.0);
  assert.equal(map.opacity?.length, 1);
  assert.equal(map.opacity?.[0].time, 3.0);
});
