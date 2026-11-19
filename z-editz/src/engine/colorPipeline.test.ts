import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyColorPipelineToPixels,
  buildCurveLUT,
  computeHistogram,
  computeTransitionState,
  createDefaultColorGrade,
} from './colorPipeline';

test('buildCurveLUT maps half-output curve accurately', () => {
  const lut = buildCurveLUT([
    { x: 0, y: 0 },
    { x: 1, y: 0.5 },
  ]);
  assert.equal(lut[0], 0);
  assert.equal(lut[255], 128);
  assert.ok(Math.abs(lut[128] - 64) <= 1);
});

test('applyColorPipelineToPixels halves red channel when red curve is set to half output', () => {
  const pixels = new Uint8ClampedArray([200, 100, 50, 255]);
  const grade = createDefaultColorGrade();
  grade.curves.red = [
    { x: 0, y: 0 },
    { x: 1, y: 0.5 },
  ];

  applyColorPipelineToPixels(pixels, grade);
  assert.ok(Math.abs(pixels[0] - 100) <= 1, `Expected red ~100, got ${pixels[0]}`);
  assert.equal(pixels[1], 100);
  assert.equal(pixels[2], 50);
  assert.equal(pixels[3], 255);
});

test('applyColorPipelineToPixels desaturates to monochrome at saturation -100', () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255]);
  const grade = createDefaultColorGrade();
  grade.saturation = -100;

  applyColorPipelineToPixels(pixels, grade);
  assert.equal(pixels[0], pixels[1]);
  assert.equal(pixels[1], pixels[2]);
  assert.ok(Math.abs(pixels[0] - 54) <= 1);
});

test('applyColorPipelineToPixels keys out green screen pixels when chroma key is enabled', () => {
  const pixels = new Uint8ClampedArray([
    0, 177, 64, 255, // exact green screen pixel
    220, 40, 40, 255, // red subject pixel
  ]);
  const grade = createDefaultColorGrade();
  applyColorPipelineToPixels(pixels, grade, {
    enabled: true,
    keyColor: '#00b140',
    similarity: 0.3,
    smoothness: 0.1,
  });

  assert.equal(pixels[3], 0, 'Green pixel should become transparent');
  assert.equal(pixels[7], 255, 'Subject pixel should remain opaque');
});

test('computeTransitionState returns accurate cross-dissolve and wipe ratios', () => {
  const midDissolve = computeTransitionState('cross-dissolve', 0.5, 'in');
  assert.equal(midDissolve.opacity, 0.5);

  const outDissolve = computeTransitionState('cross-dissolve', 0.25, 'out');
  assert.equal(outDissolve.opacity, 0.75);

  const wipe = computeTransitionState('wipe-left', 0.4, 'in');
  assert.equal(wipe.clipWipe?.edge, 'left');
  assert.equal(wipe.clipWipe?.ratio, 0.4);
});

test('computeHistogram aggregates pixel bins accurately', () => {
  const pixels = new Uint8ClampedArray(64); // 16 pixels
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 180;
    pixels[i + 1] = 120;
    pixels[i + 2] = 60;
    pixels[i + 3] = 255;
  }
  const hist = computeHistogram(pixels);
  assert.ok(hist.histogramR[180] > 0);
  assert.ok(hist.histogramG[120] > 0);
  assert.ok(hist.histogramB[60] > 0);
});
