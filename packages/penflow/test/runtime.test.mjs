import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITY_PRESETS,
  computeCatchupMultiplier,
  getQualityPreset,
  isTypingBurst,
  segmentGraphemes
} from '../dist/index.js';

test('presets resolve and fallback', () => {
  assert.ok(QUALITY_PRESETS.balanced);
  assert.equal(getQualityPreset('nope').burstWindowMs, QUALITY_PRESETS.balanced.burstWindowMs);
});

test('graphemes keep combining marks', () => {
  const segments = segmentGraphemes('a\u0301🙂');
  assert.equal(segments.length, 2);
});

test('catchup grows with backlog', () => {
  const low = computeCatchupMultiplier({ backlog: 0, isTypingBurst: false });
  const high = computeCatchupMultiplier({ backlog: 3000, isTypingBurst: true, quality: 'snappy' });
  assert.ok(high > low);
});

test('burst differs by preset', () => {
  assert.equal(isTypingBurst({ elapsedMs: 160, quality: 'calm' }), true);
  assert.equal(isTypingBurst({ elapsedMs: 160, quality: 'snappy' }), false);
});
