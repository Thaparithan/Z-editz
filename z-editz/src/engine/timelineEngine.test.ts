import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistory,
  createTrack,
  deleteClip,
  deserializeProject,
  detachAudioFromClip,
  formatTimecode,
  insertFreezeFrame,
  pushHistory,
  redoHistory,
  reorderTracks,
  serializeProject,
  setClipSpeed,
  slipClip,
  snapTime,
  splitClipAtTime,
  trimClip,
  undoHistory,
} from './timelineEngine';
import { createInitialSeedProject } from './presets';

test('formatTimecode renders SMPTE HH:MM:SS:FF accurately', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00:00');
  assert.equal(formatTimecode(65.5, 30), '00:01:05:15');
  assert.equal(formatTimecode(3661.2, 30), '01:01:01:06');
});

test('splitClipAtTime splits clip boundaries, preserves mediaOffset, and partitions keyframes', () => {
  const project = createInitialSeedProject();
  const target = project.clips.find((c) => c.id === 'clip_v1_coastal')!;
  const beforeCount = project.clips.length;

  const { clips, rightClipId } = splitClipAtTime(project.clips, target.id, 2.5);
  assert.ok(rightClipId, 'Right clip id should be returned');
  assert.equal(clips.length, beforeCount + 1);

  const left = clips.find((c) => c.id === target.id)!;
  const right = clips.find((c) => c.id === rightClipId)!;

  assert.equal(left.startTime, 0);
  assert.equal(left.duration, 2.5);
  assert.equal(right.startTime, 2.5);
  assert.equal(right.duration, Number((target.duration - 2.5).toFixed(3)));
  assert.equal(right.mediaOffset, 2.5);

  // Verify keyframes were partitioned cleanly
  assert.equal(left.keyframes.scale?.length, 1);
  assert.equal(right.keyframes.scale?.length, 1);
  assert.equal(right.keyframes.scale?.[0].time, Number((5.8 - 2.5).toFixed(3)));
});

test('deleteClip in Lift mode leaves subsequent clips untouched, Ripple mode closes gap', () => {
  const project = createInitialSeedProject();
  const first = project.clips.find((c) => c.id === 'clip_v1_coastal')!;
  const secondBefore = project.clips.find((c) => c.id === 'clip_v1_tokyo')!;

  const lifted = deleteClip(project.clips, first.id, false);
  const secondLifted = lifted.find((c) => c.id === secondBefore.id)!;
  assert.equal(secondLifted.startTime, secondBefore.startTime);

  const rippled = deleteClip(project.clips, first.id, true);
  const secondRippled = rippled.find((c) => c.id === secondBefore.id)!;
  assert.equal(secondRippled.startTime, 0);
});

test('trimClip right edge with ripple shifts subsequent clips on same track', () => {
  const project = createInitialSeedProject();
  const first = project.clips.find((c) => c.id === 'clip_v1_coastal')!;
  const second = project.clips.find((c) => c.id === 'clip_v1_tokyo')!;

  const trimmed = trimClip(project.clips, first.id, 'right', -1.5, true);
  const firstAfter = trimmed.find((c) => c.id === first.id)!;
  const secondAfter = trimmed.find((c) => c.id === second.id)!;

  assert.equal(firstAfter.duration, Number((first.duration - 1.5).toFixed(3)));
  assert.equal(secondAfter.startTime, Number((second.startTime - 1.5).toFixed(3)));
});

test('slipClip adjusts mediaOffset without altering timeline start or duration', () => {
  const project = createInitialSeedProject();
  const target = project.clips.find((c) => c.id === 'clip_v1_coastal')!;
  const slipped = slipClip(project.clips, target.id, 1.8);
  const after = slipped.find((c) => c.id === target.id)!;

  assert.equal(after.startTime, target.startTime);
  assert.equal(after.duration, target.duration);
  assert.equal(after.mediaOffset, 1.8);
});

test('setClipSpeed rescales timeline duration inversely with speed', () => {
  const project = createInitialSeedProject();
  const target = project.clips.find((c) => c.id === 'clip_v1_coastal')!;
  const spedUp = setClipSpeed(project.clips, target.id, 2.0);
  const after = spedUp.find((c) => c.id === target.id)!;

  assert.equal(after.speed, 2.0);
  assert.equal(after.duration, Number((target.duration / 2).toFixed(3)));
});

test('detachAudioFromClip extracts linked audio clip and mutes video source audio', () => {
  const project = createInitialSeedProject();
  const target = project.clips.find((c) => c.id === 'clip_v1_coastal')!;
  const { state, detachedClipId } = detachAudioFromClip(project, target.id);

  assert.ok(detachedClipId);
  const detached = state.clips.find((c) => c.id === detachedClipId)!;
  const updatedSource = state.clips.find((c) => c.id === target.id)!;

  assert.equal(detached.type, 'audio');
  assert.equal(detached.duration, target.duration);
  assert.equal(detached.startTime, target.startTime);
  assert.equal(updatedSource.audio.muted, true);
  assert.equal(updatedSource.linkedClipId, detachedClipId);
});

test('insertFreezeFrame splits clip and inserts a freeze-frame hold shifting later clips', () => {
  const project = createInitialSeedProject();
  const first = project.clips.find((c) => c.id === 'clip_v1_coastal')!;
  const second = project.clips.find((c) => c.id === 'clip_v1_tokyo')!;

  const { clips, freezeClipId } = insertFreezeFrame(project.clips, first.id, 2.0, 2.0);
  assert.ok(freezeClipId);
  const freeze = clips.find((c) => c.id === freezeClipId)!;
  const secondAfter = clips.find((c) => c.id === second.id)!;

  assert.equal(freeze.freezeFrame, true);
  assert.equal(freeze.startTime, 2.0);
  assert.equal(freeze.duration, 2.0);
  assert.equal(secondAfter.startTime, Number((second.startTime + 2.0).toFixed(3)));
});

test('snapTime snaps to nearest clip edge or marker within threshold', () => {
  const project = createInitialSeedProject();
  const snapped = snapTime(5.72, project.clips, project.markers, 1.0, 'clip_v1_artisan', 0.2);
  assert.equal(snapped.snapped, true);
  assert.equal(snapped.time, 5.8);
});

test('track management, project serialization round-trip, and undo/redo history work cleanly', () => {
  const project = createInitialSeedProject();
  const newTrack = createTrack('video', project.tracks);
  assert.equal(newTrack.type, 'video');

  const reordered = reorderTracks(project.tracks, project.tracks[1].id, 'up');
  assert.equal(reordered[0].id, project.tracks[1].id);

  const json = serializeProject(project);
  const restored = deserializeProject(json);
  assert.equal(restored.settings.name, project.settings.name);
  assert.equal(restored.clips.length, project.clips.length);

  let hist = createHistory(1);
  hist = pushHistory(hist, 2);
  hist = pushHistory(hist, 3);
  assert.equal(hist.present, 3);
  hist = undoHistory(hist);
  assert.equal(hist.present, 2);
  hist = redoHistory(hist);
  assert.equal(hist.present, 3);
});
