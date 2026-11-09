/**
 * Metric derivation: a resolved descriptor becomes the meters every other module reads (the
 * rig's bind pose and the body generator agree because both start here). Bipeds are stacked so
 * feet sit at y = 0 and the head top at exactly `height`; quadrupeds so the withers sit at
 * `height`.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { FigureArchetype, FigureForm, FigureSpecies, ResolvedFigureDescriptor } from './types';

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

/**
 * Head joint-to-crown length as a fraction of height. The drawn head (chin to crown) is 0.9 of
 * it, 0.13 of stature: adults are about 7.5 heads tall.
 */
const HEAD_FRACTION = 0.145;

/**
 * Body-form multipliers over the neutral adult (shoulder joint spread, hip and waist breadth,
 * chest depth, neck and upper-arm radius). Fitted to adult anthropometric means: biacromial breadth is about
 * 0.23 of stature for men and 0.22 for women, hip breadth 0.19 against 0.22.
 */
export interface FigureFormShape {
  shoulder: number;
  hip: number;
  waist: number;
  chest: number;
  neck: number;
  arm: number;
}

export const FIGURE_FORMS: Readonly<Record<FigureForm, FigureFormShape>> = {
  neutral: { shoulder: 1, hip: 1, waist: 1, chest: 1, neck: 1, arm: 1 },
  masculine: { shoulder: 1.06, hip: 0.96, waist: 1.03, chest: 1.04, neck: 1.08, arm: 1.05 },
  feminine: { shoulder: 0.92, hip: 1.08, waist: 0.88, chest: 0.96, neck: 0.9, arm: 0.9 },
};

/**
 * Quadruped head and limb shape by species: head width and depth as fractions of its length,
 * how far the face drops below the neck line (radians, before 0.3 of the neck pitch), and the
 * limb radius as a fraction of the body radius. Measured against side and front photographs:
 * a horse's head is about 0.4 of its length across the cheeks, a cat's nearly as wide as long.
 */
const QUADRUPED_SHAPES: Readonly<
  Partial<
    Record<FigureSpecies, { headWidth: number; headHeight: number; headDrop: number; limb: number }>
  >
> & { dog: { headWidth: number; headHeight: number; headDrop: number; limb: number } } = {
  dog: { headWidth: 0.62, headHeight: 0.7, headDrop: 0.05, limb: 0.21 },
  cat: { headWidth: 0.9, headHeight: 0.8, headDrop: -0.06, limb: 0.21 },
  horse: { headWidth: 0.42, headHeight: 0.6, headDrop: 0.6, limb: 0.2 },
  deer: { headWidth: 0.5, headHeight: 0.6, headDrop: 0.25, limb: 0.2 },
  cow: { headWidth: 0.52, headHeight: 0.6, headDrop: 0.5, limb: 0.22 },
  sheep: { headWidth: 0.56, headHeight: 0.66, headDrop: 0.28, limb: 0.21 },
};

export function deriveMetrics(d: ResolvedFigureDescriptor): FigureMetrics {
  const P = d.proportions;
  const H = d.height;
  const b = d.build;
  if (d.archetype === 'biped') {
    const form = FIGURE_FORMS[d.features.form] ?? FIGURE_FORMS.neutral;
    // Landmarks (adult, fractions of stature): knee 0.25, hip joint 0.50, base of the neck
    // 0.825, shoulder joint 0.80, chin 0.87. Earlier tables put the neck base at 0.80 and the
    // chin at 0.856, which read as a long neck under a large head.
    const fAnkle = 0.02;
    const fLower = 0.23 * P.legRatio;
    const fUpper = 0.25 * P.legRatio;
    const fHips = 0.08 * P.torsoRatio;
    const fSpine = 0.105 * P.torsoRatio;
    const fChest = 0.14 * P.torsoRatio;
    const fNeck = 0.03 * P.neckLength;
    const fHead = HEAD_FRACTION * P.headScale;
    const k = H / (fAnkle + fLower + fUpper + fHips + fSpine + fChest + fNeck + fHead);
    const headLen = fHead * k;
    const hipHeight = (fAnkle + fLower + fUpper) * k;
    return {
      archetype: 'biped',
      height: H,
      headLen,
      // Skull breadth about 0.62 of the chin-to-crown height before the face profile narrows it.
      headWidth: 0.73 * headLen,
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
      hipHalf: 0.06 * H * P.hipWidth * form.hip * (1 + 0.25 * b),
      // The shoulder joint, not the outside of the deltoid: about 0.2 of stature apart.
      shoulderHalf: 0.099 * H * P.shoulderWidth * form.shoulder * (1 + 0.12 * b),
      upperArmLen: 0.17 * H * P.armRatio,
      foreArmLen: 0.146 * H * P.armRatio,
      handLen: 0.1 * H * P.armRatio,
      // Half the chest depth: about 0.135 of stature front to back.
      torsoRadius: 0.07 * H * form.chest * (1 + 0.3 * b),
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
  const rawLeg = 0.74 * P.legRatio;
  const rawBody = 0.26 * (1 + 0.25 * b);
  const k = H / (rawLeg + rawBody);
  const legY = rawLeg * k;
  const bodyRadius = rawBody * k;
  const bodyLength = P.bodyLength * H;
  const headLen = (d.species === 'cat' ? 0.34 : 0.3) * H * P.headScale;
  const shape = QUADRUPED_SHAPES[d.species] ?? QUADRUPED_SHAPES.dog;
  return {
    archetype: 'quadruped',
    height: H,
    headLen,
    headWidth: shape.headWidth * headLen,
    headHeight: shape.headHeight * headLen,
    headPitch: dmath.clamp(shape.headDrop + 0.3 * P.neckPitch, 0, 1.2),
    neckLen: P.neckLength * H * (d.species === 'cat' ? 0.65 : 1),
    neckPitch: P.neckPitch,
    hipsLen: 0,
    spineLen: 0,
    chestLen: 0,
    upperLegLen: 0,
    lowerLegLen: 0,
    ankleHeight: 0,
    footLen: 0,
    hipHalf: 0.72 * bodyRadius * P.hipWidth,
    shoulderHalf: 0.7 * bodyRadius * P.shoulderWidth,
    upperArmLen: 0,
    foreArmLen: 0,
    handLen: 0,
    torsoRadius: bodyRadius,
    limbRadius: shape.limb * bodyRadius * (1 + 0.4 * b),
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
