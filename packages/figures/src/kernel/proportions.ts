/**
 * Metric derivation: a resolved descriptor becomes the meters every other module reads (the
 * rig's bind pose and the body generator agree because both start here). Bipeds are stacked so
 * feet sit at y = 0 and the head top at exactly `height`; quadrupeds so the withers sit at
 * `height`.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { FigureArchetype, ResolvedFigureDescriptor } from './types';

export interface FigureMetrics {
  archetype: FigureArchetype;
  height: number;
  /** Head length along its axis (biped: up; quadruped: forward along the muzzle). */
  headLen: number;
  headWidth: number;
  headHeight: number;
  /** Quadruped head pitch below the neck line, radians. */
  headPitch: number;
  neckLen: number;
  neckPitch: number;
  /** hips → spine, spine → chest, chest → neck segment lengths. */
  hipsLen: number;
  spineLen: number;
  chestLen: number;
  upperLegLen: number;
  lowerLegLen: number;
  ankleHeight: number;
  footLen: number;
  hipHalf: number;
  shoulderHalf: number;
  upperArmLen: number;
  foreArmLen: number;
  handLen: number;
  torsoRadius: number;
  limbRadius: number;
  hipHeight: number;
  /** Hip-to-ankle (biped) or shoulder-to-ground (quadruped) length: the Froude scale. */
  legLength: number;
  bodyLength: number;
  bodyRadius: number;
  /** Quadruped leg joint height (shoulder and hip). */
  legY: number;
  hipZ: number;
  chestZ: number;
  quadUpperLen: number;
  quadLowerLen: number;
  quadFootLen: number;
  quadToesLen: number;
  tailLen: number;
  earLen: number;
  snoutLen: number;
}

/** Ratio of head length to height per age band (adults ≈ 6.5 heads tall). */
const HEAD_FRACTION = 0.16;

export function deriveMetrics(d: ResolvedFigureDescriptor): FigureMetrics {
  const P = d.proportions;
  const H = d.height;
  const b = d.build;
  if (d.archetype === 'biped') {
    const fAnkle = 0.02;
    const fLower = 0.23 * P.legRatio;
    const fUpper = 0.25 * P.legRatio;
    const fHips = 0.08 * P.torsoRatio;
    const fSpine = 0.1 * P.torsoRatio;
    const fChest = 0.12 * P.torsoRatio;
    const fNeck = 0.04 * P.neckLength;
    const fHead = HEAD_FRACTION * P.headScale;
    const k = H / (fAnkle + fLower + fUpper + fHips + fSpine + fChest + fNeck + fHead);
    const headLen = fHead * k;
    const hipHeight = (fAnkle + fLower + fUpper) * k;
    return {
      archetype: 'biped',
      height: H,
      headLen,
      headWidth: 0.78 * headLen,
      headHeight: headLen,
      headPitch: 0,
      neckLen: fNeck * k,
      neckPitch: 0,
      hipsLen: fHips * k,
      spineLen: fSpine * k,
      chestLen: fChest * k,
      upperLegLen: fUpper * k,
      lowerLegLen: fLower * k,
      ankleHeight: fAnkle * k,
      footLen: 0.14 * H,
      hipHalf: 0.06 * H * P.hipWidth * (1 + 0.25 * b),
      shoulderHalf: 0.115 * H * P.shoulderWidth * (1 + 0.15 * b),
      upperArmLen: 0.16 * H * P.armRatio,
      foreArmLen: 0.14 * H * P.armRatio,
      handLen: 0.09 * H * P.armRatio,
      torsoRadius: 0.09 * H * (1 + 0.3 * b),
      limbRadius: 0.035 * H * (1 + 0.4 * b),
      hipHeight,
      legLength: (fLower + fUpper) * k,
      bodyLength: 0,
      bodyRadius: 0,
      legY: hipHeight,
      hipZ: 0,
      chestZ: 0,
      quadUpperLen: 0,
      quadLowerLen: 0,
      quadFootLen: 0,
      quadToesLen: 0,
      tailLen: 0,
      earLen: 0.12 * headLen * P.earSize,
      snoutLen: 0,
    };
  }
  // Quadruped: withers = legY + bodyRadius = height exactly.
  const rawLeg = 0.8 * P.legRatio;
  const rawBody = 0.2 * (1 + 0.25 * b);
  const k = H / (rawLeg + rawBody);
  const legY = rawLeg * k;
  const bodyRadius = rawBody * k;
  const bodyLength = P.bodyLength * H;
  const headLen = 0.3 * H * P.headScale;
  return {
    archetype: 'quadruped',
    height: H,
    headLen,
    headWidth: 0.5 * headLen,
    headHeight: 0.55 * headLen,
    headPitch: dmath.clamp(0.5 * P.neckPitch + 0.15, 0, 1.2),
    neckLen: P.neckLength * H,
    neckPitch: P.neckPitch,
    hipsLen: 0,
    spineLen: 0,
    chestLen: 0,
    upperLegLen: 0,
    lowerLegLen: 0,
    ankleHeight: 0,
    footLen: 0,
    hipHalf: 0.55 * bodyRadius * P.hipWidth,
    shoulderHalf: 0.55 * bodyRadius * P.shoulderWidth,
    upperArmLen: 0,
    foreArmLen: 0,
    handLen: 0,
    torsoRadius: bodyRadius,
    limbRadius: 0.22 * bodyRadius * (1 + 0.4 * b),
    hipHeight: legY,
    legLength: legY,
    bodyLength,
    bodyRadius,
    legY,
    hipZ: -0.32 * bodyLength,
    chestZ: 0.3 * bodyLength,
    quadUpperLen: 0.38 * legY,
    quadLowerLen: 0.3 * legY,
    quadFootLen: 0.28 * legY,
    quadToesLen: 0.1 * legY,
    tailLen: P.tailLength * H,
    earLen: 0.35 * headLen * P.earSize,
    snoutLen: P.snoutLength * headLen,
  };
}
