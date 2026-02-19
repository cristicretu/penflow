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
