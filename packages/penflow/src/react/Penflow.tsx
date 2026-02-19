import React, { useEffect, useMemo, useRef, useState } from 'react';
import Typr from 'typr.js';
import {
  clamp,
  computeCatchupMultiplier,
  getQualityPreset,
  hashSeed,
  isTypingBurst,
  seededRandom,
  segmentGraphemes,
  type Quality
} from '../core/runtime';

export type PenflowProfile = {
  brushScale?: number;
  outerOnly?: boolean;
  durationScale?: number;
};

export type PenflowProps = {
  text: string;
  fontUrl: string;
  className?: string;
  color?: string;
  size?: number;
  speed?: number;
  lineHeight?: number;
  quality?: Quality;
  seed?: string | number;
  brushScale?: number;
  profile?: PenflowProfile;
  animate?: boolean;
  incremental?: boolean;
  autoReplay?: boolean;
  playheadKey?: number;
};

type CharStroke = {
  fillPath: Path2D;
  drawSegments: number[][][];
  pathLength: number;
  brushWidth: number;
  seed: number;
  delay: number;
  duration: number;
};

type FontEntry = { fontData: any; defaults: Required<PenflowProfile> };
const fontCache = new Map<string, FontEntry>();

const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const complexityScore = (char: string): number => {
  if (/[mwMW@#%&]/.test(char)) return 1;
  if (/[ijlrtf1]/.test(char)) return 0.25;
  if (/[.,!?;:]/.test(char)) return 0.1;
  return 0.55;
};

const easeInkProgress = (progress: number, seed: number): number => {
  const attack = 0.18 + seededRandom(seed + 2) * 0.1;
  const release = 0.7 + seededRandom(seed + 3) * 0.16;
  return clamp(smoothstep(0, attack, progress) * 0.24 + smoothstep(attack, release, progress) * 0.62 + smoothstep(release, 1, progress) * 0.14, 0, 1);
};

const sampleQuadratic = (p0: number[], p1: number[], p2: number[], t: number): number[] => {
  const mt = 1 - t;
  return [mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]];
};

const sampleCubic = (p0: number[], p1: number[], p2: number[], p3: number[], t: number): number[] => {
  const mt = 1 - t;
  return [
    mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
    mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
  ];
};

const rotateToLeftmost = (points: number[][]): number[][] => {
  if (points.length < 3) return points.slice();
  let minIndex = 0;
  for (let i = 1; i < points.length; i += 1) if (points[i][0] < points[minIndex][0]) minIndex = i;
  return [...points.slice(minIndex), ...points.slice(0, minIndex)];
};

const signedArea = (points: number[][]): number => {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    area += p0[0] * p1[1] - p1[0] * p0[1];
  }
  return area * 0.5;
};

const polylineLength = (points: number[][]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return length;
};

const drawSegmentsProgress = (ctx: CanvasRenderingContext2D, segments: number[][][], targetLength: number): void => {
  let remaining = targetLength;
  ctx.beginPath();
  for (const segment of segments) {
    if (remaining <= 0) break;
    ctx.moveTo(segment[0][0], segment[0][1]);
    for (let i = 1; i < segment.length; i += 1) {
      const p0 = segment[i - 1];
      const p1 = segment[i];
      const seg = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (seg <= 0.0001) continue;
      if (remaining >= seg) {
        ctx.lineTo(p1[0], p1[1]);
        remaining -= seg;
      } else {
        const t = remaining / seg;
        ctx.lineTo(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t);
        remaining = 0;
        break;
      }
    }
  }
  ctx.stroke();
};

const deriveFontDefaults = (fontData: any, fontUrl: string): Required<PenflowProfile> => {
  const unitsPerEm = fontData?.head?.unitsPerEm ?? 1000;
  const nameBlob = JSON.stringify(fontData?.name ?? {}).toLowerCase();
  const fingerprint = `${fontUrl} ${nameBlob}`.toLowerCase();
  const scriptLike = /script|hand|signature|brittany|chancery|brush/.test(fingerprint);
  const sample = segmentGraphemes('anom');
  const widths = sample
    .map((char) => {
      const gid = Typr.U.codeToGlyph(fontData, char.codePointAt(0) ?? 0);
      return fontData?.hmtx?.aWidth?.[gid] ?? 0;
    })
    .filter((w) => w > 0);
  const avg = widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : unitsPerEm * 0.56;
  const ratio = avg / unitsPerEm;
  return {
    brushScale: clamp(0.074 + (0.56 - ratio) * 0.08 + (scriptLike ? 0.006 : 0), 0.052, 0.102),
    durationScale: clamp(1 + (ratio - 0.56) * 0.35 + (scriptLike ? -0.03 : 0.03), 0.9, 1.18),
    outerOnly: scriptLike
  };
};

const loadTyprFont = async (fontUrl: string): Promise<FontEntry> => {
  if (fontCache.has(fontUrl)) return fontCache.get(fontUrl) as FontEntry;
  const response = await fetch(fontUrl);
  if (!response.ok) throw new Error(`Failed to load font: ${fontUrl}`);
  const buffer = await response.arrayBuffer();
  const fontData = Typr.parse(buffer);
  const entry = { fontData, defaults: deriveFontDefaults(fontData, fontUrl) };
  fontCache.set(fontUrl, entry);
  return entry;
};

const buildPath2D = (path: any, scale: number, offsetX: number, baselineY: number): Path2D => {
  const out = new Path2D();
  let i = 0;
  for (const cmd of path.cmds) {
    if (cmd === 'M') out.moveTo(offsetX + path.crds[i++] * scale, baselineY - path.crds[i++] * scale);
    else if (cmd === 'L') out.lineTo(offsetX + path.crds[i++] * scale, baselineY - path.crds[i++] * scale);
    else if (cmd === 'Q') {
      const cx = offsetX + path.crds[i++] * scale;
      const cy = baselineY - path.crds[i++] * scale;
      const x = offsetX + path.crds[i++] * scale;
      const y = baselineY - path.crds[i++] * scale;
      out.quadraticCurveTo(cx, cy, x, y);
    } else if (cmd === 'C') {
      const c1x = offsetX + path.crds[i++] * scale;
      const c1y = baselineY - path.crds[i++] * scale;
      const c2x = offsetX + path.crds[i++] * scale;
      const c2y = baselineY - path.crds[i++] * scale;
      const x = offsetX + path.crds[i++] * scale;
      const y = baselineY - path.crds[i++] * scale;
      out.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
    } else if (cmd === 'Z') out.closePath();
  }
  return out;
};

const pathToSubpaths = (path: any, scale: number, offsetX: number, baselineY: number): number[][][] => {
  const subpaths: number[][][] = [];
  let i = 0;
  let current = [0, 0];
  let start = [0, 0];
  let active: number[][] | null = null;
  const mapPoint = (x: number, y: number): number[] => [offsetX + x * scale, baselineY - y * scale];
  const push = (point: number[]) => {
    if (!active) {
      active = [point];
      subpaths.push(active);
      return;
    }
    const prev = active[active.length - 1];
    if (Math.hypot(point[0] - prev[0], point[1] - prev[1]) > 0.001) active.push(point);
  };

  for (const cmd of path.cmds) {
    if (cmd === 'M') {
      const x = path.crds[i++];
      const y = path.crds[i++];
      current = [x, y];
      start = [x, y];
      active = null;
      push(mapPoint(x, y));
    } else if (cmd === 'L') {
      const x = path.crds[i++];
      const y = path.crds[i++];
      current = [x, y];
      push(mapPoint(x, y));
    } else if (cmd === 'Q') {
      const cx = path.crds[i++], cy = path.crds[i++], x = path.crds[i++], y = path.crds[i++];
      const p0 = mapPoint(current[0], current[1]);
      const p1 = mapPoint(cx, cy);
      const p2 = mapPoint(x, y);
      for (let s = 1; s <= 14; s += 1) push(sampleQuadratic(p0, p1, p2, s / 14));
      current = [x, y];
    } else if (cmd === 'C') {
      const c1x = path.crds[i++], c1y = path.crds[i++], c2x = path.crds[i++], c2y = path.crds[i++], x = path.crds[i++], y = path.crds[i++];
      const p0 = mapPoint(current[0], current[1]);
      const p1 = mapPoint(c1x, c1y);
      const p2 = mapPoint(c2x, c2y);
      const p3 = mapPoint(x, y);
      for (let s = 1; s <= 18; s += 1) push(sampleCubic(p0, p1, p2, p3, s / 18));
      current = [x, y];
    } else if (cmd === 'Z') {
      push(mapPoint(start[0], start[1]));
      active = null;
      current = start;
    }
  }

  return subpaths.filter((segment) => segment.length > 1);
};

const buildSegments = (subpaths: number[][][], outerOnly: boolean): number[][][] => {
  const normalized = subpaths
    .map((segment) => {
      const deduped = segment.slice();
      if (deduped.length > 1) {
        const first = deduped[0];
        const last = deduped[deduped.length - 1];
        if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.001) deduped.pop();
      }
      const rotated = rotateToLeftmost(deduped);
      if (rotated.length > 1 && rotated[rotated.length - 1][0] < rotated[0][0]) rotated.reverse();
      return rotated;
    })
    .filter((segment) => segment.length > 1);

  let result = normalized;
  if (outerOnly) {
    let primarySign = 0;
    let primaryMagnitude = 0;
    for (const segment of normalized) {
      const magnitude = Math.abs(signedArea(segment));
      if (magnitude > primaryMagnitude) {
        primaryMagnitude = magnitude;
        primarySign = Math.sign(signedArea(segment));
      }
    }
    result = normalized.filter((segment) => {
      const area = signedArea(segment);
      if (Math.abs(area) < 1) return true;
      return primarySign === 0 || Math.sign(area) === primarySign;
    });
  }

  result.sort((a, b) => {
    const ax = Math.min(...a.map((p) => p[0]));
    const bx = Math.min(...b.map((p) => p[0]));
    if (ax !== bx) return ax - bx;
    const ay = Math.min(...a.map((p) => p[1]));
    const by = Math.min(...b.map((p) => p[1]));
    return ay - by;
  });

  return result;
};

const buildModel = ({
  fontData,
  text,
  size,
  speed,
  lineHeight,
  profile,
  quality,
  seed
}: {
  fontData: any;
  text: string;
  size: number;
  speed: number;
  lineHeight: number;
  profile: Required<PenflowProfile>;
  quality: Quality;
  seed: string | number;
}) => {
  const baseSeed = typeof seed === 'number' ? seed : hashSeed(seed);
  const preset = getQualityPreset(quality);
  const lines = `${text ?? ''}`.split('\n');
  const fontSize = size * 0.9;
  const unitsPerEm = fontData?.head?.unitsPerEm ?? 1000;
  const scale = fontSize / unitsPerEm;
  const lineHeightPx = size * lineHeight;
  const paddingX = size * 0.24;
  const paddingTop = size * 0.28;

  const chars: CharStroke[] = [];
  let timeline = 0;
  let maxWidth = paddingX * 2 + size * 2;

  lines.forEach((line, lineIndex) => {
    const graphemes = segmentGraphemes(line);
    let cursorX = paddingX;
    const baselineY = paddingTop + lineHeightPx * lineIndex + fontSize;

    for (let index = 0; index < graphemes.length; index += 1) {
      const char = graphemes[index];
      const charSeed = lineIndex * 1021 + chars.length * 37 + (char.codePointAt(0) ?? 0) + baseSeed * 977;
      const gids = Typr.U.stringToGlyphs(fontData, char).filter((g: number) => g >= 0);
      const gid = gids[0] ?? 0;
      const next = index < graphemes.length - 1 ? graphemes[index + 1] : '';
      const nextGids = next ? Typr.U.stringToGlyphs(fontData, next).filter((g: number) => g >= 0) : [];
      const nextGid = nextGids[0] ?? 0;
      const kern = Typr.U.getPairAdjustment(fontData, gid, nextGid) || 0;
      const advanceUnits = (fontData?.hmtx?.aWidth?.[gid] ?? unitsPerEm * 0.45) + kern;
      const advance = advanceUnits * scale;

      const isSpace = char === ' ';
      const isPunct = /[.,!?;:]/.test(char);
      const glyphPath = Typr.U.glyphToPath(fontData, gid);
      const fillPath = glyphPath?.cmds?.length ? buildPath2D(glyphPath, scale, cursorX, baselineY) : null;
      const subpaths = glyphPath?.cmds?.length ? pathToSubpaths(glyphPath, scale, cursorX, baselineY) : [];
      const drawSegments = buildSegments(subpaths, profile.outerOnly);
      const pathLength = drawSegments.reduce((sum, segment) => sum + polylineLength(segment), 0);

      const rhythm = 0.86 + seededRandom(charSeed + 11) * preset.cadenceJitter;
      const drawDuration = isSpace ? 0 : clamp(((70 + pathLength * 1.2 + complexityScore(char) * 42) * rhythm * profile.durationScale) / speed, 90, 720);
      const penLift = clamp((10 + seededRandom(charSeed + 29) * 10) / speed, 6, 30);
      const letterGap = clamp(((isPunct ? 74 : 24) + seededRandom(charSeed + 47) * 18) / speed, 14, 98);
      const wordGap = clamp(120 / speed, 70, 220);

      if (!isSpace && fillPath && drawSegments.length > 0) {
        chars.push({
          fillPath,
          drawSegments,
          pathLength,
          brushWidth: Math.max(1.6, fontSize * profile.brushScale),
          seed: charSeed,
          delay: Number(timeline.toFixed(0)),
          duration: Number(drawDuration.toFixed(0))
        });
      }

      timeline += isSpace ? wordGap : drawDuration + penLift + letterGap;
      cursorX += advance;
    }

    maxWidth = Math.max(maxWidth, cursorX + paddingX);
    if (lineIndex < lines.length - 1) timeline += clamp(180 / speed, 120, 320);
  });

  return {
    width: Math.max(maxWidth, size * 3),
    height: Math.max(lineHeightPx * lines.length + paddingTop * 1.35, size * 1.7),
    chars,
    totalDuration: chars.reduce((max, item) => Math.max(max, item.delay + item.duration), 0)
  };
};

export function Penflow({
  text,
  fontUrl,
  className,
  color = '#0f1117',
  size = 84,
  speed = 1,
  lineHeight = 1.32,
  quality = 'balanced',
  seed = 0,
  brushScale,
  profile,
  animate = true,
  incremental = true,
  autoReplay = false,
  playheadKey = 0
}: PenflowProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef({ text: '', penTime: 0, lastUpdate: 0, playheadKey: 0 });
  const [fontEntry, setFontEntry] = useState<FontEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTyprFont(fontUrl)
      .then((entry) => {
        if (!cancelled) setFontEntry(entry);
      })
      .catch(() => {
        if (!cancelled) setFontEntry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fontUrl]);

  useEffect(() => {
    streamRef.current = { text: '', penTime: 0, lastUpdate: 0, playheadKey };
  }, [playheadKey]);

  const model = useMemo(() => {
    if (!fontEntry) return null;
    const merged: Required<PenflowProfile> = {
      ...fontEntry.defaults,
      ...(profile ?? {}),
      ...(brushScale == null ? {} : { brushScale })
    };
    return buildModel({ fontData: fontEntry.fontData, text, size, speed, lineHeight, profile: merged, quality, seed });
  }, [brushScale, fontEntry, lineHeight, profile, quality, seed, size, speed, text]);

  useEffect(() => {
    if (!canvasRef.current || !model) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.ceil(model.width * dpr);
    canvas.height = Math.ceil(model.height * dpr);
    canvas.style.width = `${model.width}px`;
    canvas.style.height = `${model.height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    const previous = streamRef.current;
    const canAppend =
      incremental && !autoReplay && previous.playheadKey === playheadKey && typeof text === 'string' && text.startsWith(previous.text);

    const now = performance.now();
    const elapsedSinceUpdate = previous.lastUpdate ? now - previous.lastUpdate : 1000;
    const burst = canAppend && isTypingBurst({ elapsedMs: elapsedSinceUpdate, quality });
    let penTime = canAppend ? Math.min(previous.penTime, model.totalDuration) : 0;

    let frame = 0;
    let lastTs = 0;

    const draw = (ts: number) => {
      if (lastTs === 0) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;

      if (animate) {
        const backlog = Math.max(0, model.totalDuration - penTime);
        penTime += dt * computeCatchupMultiplier({ backlog, isTypingBurst: burst, quality });
        if (autoReplay && model.totalDuration > 0) penTime %= model.totalDuration;
        else penTime = Math.min(penTime, model.totalDuration);
      }

      ctx.clearRect(0, 0, model.width, model.height);

      for (const item of model.chars) {
        const progress = clamp((penTime - item.delay) / item.duration, 0, 1);
        if (progress <= 0) continue;
        ctx.save();
        ctx.clip(item.fillPath);
        ctx.lineWidth = item.brushWidth;
        drawSegmentsProgress(ctx, item.drawSegments, item.pathLength * easeInkProgress(progress, item.seed));
        ctx.restore();
      }

      streamRef.current = { text, penTime, lastUpdate: now, playheadKey };

      if (autoReplay || penTime < model.totalDuration) frame = requestAnimationFrame(draw);
    };

    if (!animate) {
      ctx.clearRect(0, 0, model.width, model.height);
      for (const item of model.chars) {
        ctx.save();
        ctx.clip(item.fillPath);
        ctx.lineWidth = item.brushWidth;
        drawSegmentsProgress(ctx, item.drawSegments, item.pathLength);
        ctx.restore();
      }
      streamRef.current = { text, penTime: model.totalDuration, lastUpdate: now, playheadKey };
      return;
    }

    streamRef.current = { text, penTime, lastUpdate: now, playheadKey };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [animate, autoReplay, color, incremental, model, playheadKey, quality, text]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={text}
      style={{ width: '100%', maxWidth: `${model?.width ?? size * 3}px`, height: 'auto', display: 'block' }}
    />
  );
}
