import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITY_PRESETS,
  FALLBACK_ANIMATIONS,
  computeCatchupMultiplier,
  fallbackFrame,
  getQualityPreset,
  isMissingGlyph,
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

test('missing glyphs: only .notdef or nothing, never whitespace', () => {
  assert.equal(isMissingGlyph('🙂', [0]), true);
  assert.equal(isMissingGlyph('👨‍👩‍👧', [0, 0, 0, 0, 0]), true);
  assert.equal(isMissingGlyph('🙂', []), true);
  assert.equal(isMissingGlyph('a', [68]), false);
  assert.equal(isMissingGlyph(' ', [0]), false);
  assert.equal(isMissingGlyph('\t', []), false);
});

test('emoji sequences stay one grapheme', () => {
  assert.equal(segmentGraphemes('👍🏽👨‍👩‍👧❤️').length, 3);
});

test('fallback frames start hidden and end fully shown', () => {
  for (const mode of FALLBACK_ANIMATIONS) {
    const start = fallbackFrame(mode, 0);
    assert.ok(start.alpha === 0 || start.reveal === 0, `${mode} hidden at 0`);
    const end = fallbackFrame(mode, 1);
    if (mode === 'none') assert.equal(end.alpha, 0);
    else assert.deepEqual(end, { alpha: 1, scale: 1, reveal: 1 }, `${mode} settled at 1`);
  }
});

test('fallback frames move in between', () => {
  assert.ok(fallbackFrame('fade', 0.3).alpha < 1);
  assert.ok(fallbackFrame('wipe', 0.3).reveal < 1);
  assert.ok(fallbackFrame('pop', 0.1).scale < 1);
  assert.ok(Math.max(...[0.6, 0.7, 0.8].map((p) => fallbackFrame('pop', p).scale)) > 1, 'pop overshoots');
  assert.deepEqual(fallbackFrame('instant', 0.01), { alpha: 1, scale: 1, reveal: 1 });
});
