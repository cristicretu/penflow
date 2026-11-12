export type Quality = 'calm' | 'balanced' | 'snappy';

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const QUALITY_PRESETS = {
  calm: { burstWindowMs: 170, burstBoost: 1.08, backlogStart: 260, backlogRange: 2600, backlogMaxBoost: 1.05, cadenceJitter: 0.15 },
  balanced: { burstWindowMs: 150, burstBoost: 1.22, backlogStart: 180, backlogRange: 1800, backlogMaxBoost: 1.8, cadenceJitter: 0.35 },
  snappy: { burstWindowMs: 130, burstBoost: 1.35, backlogStart: 120, backlogRange: 1300, backlogMaxBoost: 2.4, cadenceJitter: 0.44 }
} as const;

export const getQualityPreset = (quality: Quality = 'balanced') => QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.balanced;

export const segmentGraphemes = (input: string): string[] => {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(input), (p) => p.segment);
  }
  return Array.from(input);
};

export const isTypingBurst = ({ elapsedMs, quality = 'balanced' as Quality }: { elapsedMs: number; quality?: Quality }): boolean =>
  elapsedMs < getQualityPreset(quality).burstWindowMs;

export const computeCatchupMultiplier = ({
  backlog,
  isTypingBurst,
  quality = 'balanced' as Quality
}: {
  backlog: number;
  isTypingBurst: boolean;
  quality?: Quality;
}): number => {
  const preset = getQualityPreset(quality);
  const backlogBoost = 1 + clamp((Math.max(0, backlog) - preset.backlogStart) / preset.backlogRange, 0, preset.backlogMaxBoost);
  return backlogBoost * (isTypingBurst ? preset.burstBoost : 1);
};

export const seededRandom = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

export const hashSeed = (value: string | number): number => {
  const text = `${value}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * How a character the font has no glyph for (usually an emoji) shows up while
 * the text writes itself. It can't be traced like a letter, so it's drawn with
 * a system font instead and arrives in its turn:
 * - `fade`: fades in
 * - `pop`: scales up with a small overshoot while fading in
 * - `wipe`: revealed left to right, like the pen passing over it
 * - `instant`: appears at once
 * - `none`: isn't drawn (the old behaviour)
 */
export type FallbackAnimation = 'fade' | 'pop' | 'wipe' | 'instant' | 'none';

export const FALLBACK_ANIMATIONS: readonly FallbackAnimation[] = ['fade', 'pop', 'wipe', 'instant', 'none'];

export const DEFAULT_FALLBACK_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';

/** true when the font has nothing to trace for this grapheme (only .notdef or no glyphs at all) */
export const isMissingGlyph = (char: string, gids: number[]): boolean => {
  if (!char || /^\s+$/u.test(char)) return false;
  return gids.every((gid) => gid <= 0);
};

const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const backOut = (t: number): number => {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/** what a fallback glyph looks like `progress` (0..1) of the way through its turn */
export const fallbackFrame = (
  animation: FallbackAnimation,
  progress: number
): { alpha: number; scale: number; reveal: number } => {
  const p = clamp(progress, 0, 1);
  if (animation === 'none' || p <= 0) return { alpha: 0, scale: 1, reveal: 0 };
  if (animation === 'fade') return { alpha: easeOut(p), scale: 1, reveal: 1 };
  if (animation === 'pop') return { alpha: clamp(p * 2.5, 0, 1), scale: 0.35 + 0.65 * backOut(p), reveal: 1 };
  if (animation === 'wipe') return { alpha: 1, scale: 1, reveal: easeOut(p) };
  return { alpha: 1, scale: 1, reveal: 1 };
};
