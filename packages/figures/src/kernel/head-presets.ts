/**
 * Human head presets: twelve points in the head-shape space (see FigureHeadShape). `01` is the
 * reference head (every parameter 0). The others are a Latin-hypercube design over the fourteen
 * parameters, chosen so every parameter takes eleven evenly spaced values across them and no two
 * parameters move together (the largest pairwise correlation is 0.53): a broad nose does not come
 * with full lips, nor a wide face with a strong brow. They are shapes, not portraits of any group,
 * and are named by number for that reason.
 */

import type { FigureHeadInput, FigureHeadPresetId, FigureHeadShape } from './types';

const ZERO: FigureHeadShape = {
  faceWidth: 0,
  jaw: 0,
  chin: 0,
  cheeks: 0,
  cheekbones: 0,
  brow: 0,
  noseBridge: 0,
  noseWidth: 0,
  noseTip: 0,
  eyeSpacing: 0,
  eyeSize: 0,
  eyeTilt: 0,
  lips: 0,
  crown: 0,
};

/** The head-shape parameter names, in a stable order. */
export const FIGURE_HEAD_PARAMS: readonly (keyof FigureHeadShape)[] = Object.keys(
  ZERO,
) as (keyof FigureHeadShape)[];

const head = (values: Partial<FigureHeadShape>): FigureHeadShape => ({ ...ZERO, ...values });

export const FIGURE_HEAD_PRESETS: Readonly<Record<FigureHeadPresetId, FigureHeadShape>> = {
  '01': head({}),
  '02': head({
    jaw: -0.6,
    chin: -0.15,
    cheeks: 0.3,
    cheekbones: 0.45,
    brow: -0.3,
    noseBridge: 0.3,
    noseWidth: -0.45,
    eyeSpacing: -0.3,
    eyeSize: -0.15,
    eyeTilt: 0.15,
    lips: 0.3,
    crown: -0.3,
  }),
  '03': head({
    faceWidth: -0.15,
    jaw: 0.3,
    chin: 0.15,
    cheeks: -0.3,
    cheekbones: 0.6,
    brow: 0.3,
    noseBridge: -0.3,
    noseWidth: 0.15,
    noseTip: -0.45,
    eyeSpacing: -0.45,
    eyeSize: -0.3,
    eyeTilt: -0.3,
  }),
  '04': head({
    faceWidth: -0.6,
    jaw: 0.15,
    chin: 0.6,
    cheeks: 0.75,
    cheekbones: 0.3,
    noseBridge: 0.6,
    noseWidth: 0.45,
    noseTip: 0.3,
    eyeSpacing: 0.15,
    eyeSize: 0.6,
    eyeTilt: -0.45,
    lips: -0.3,
    crown: 0.75,
  }),
  '05': head({
    faceWidth: 0.6,
    jaw: -0.45,
    chin: 0.3,
    cheeks: -0.45,
    cheekbones: -0.3,
    brow: -0.45,
    noseBridge: 0.15,
    noseWidth: 0.75,
    noseTip: -0.15,
    eyeSpacing: 0.3,
    eyeSize: -0.45,
    eyeTilt: 0.3,
    lips: 0.45,
    crown: 0.6,
  }),
  '06': head({
    faceWidth: 0.75,
    jaw: -0.75,
    chin: -0.45,
    cheeks: -0.6,
    cheekbones: -0.15,
    brow: 0.6,
    noseBridge: -0.75,
    noseWidth: 0.3,
    noseTip: 0.6,
    eyeSpacing: -0.15,
    eyeSize: 0.3,
    eyeTilt: -0.75,
    lips: -0.45,
    crown: 0.45,
  }),
  '07': head({
    faceWidth: 0.45,
    jaw: -0.3,
    chin: -0.3,
    cheeks: 0.15,
    cheekbones: -0.45,
    brow: -0.15,
    noseBridge: 0.75,
    noseWidth: 0.6,
    noseTip: 0.45,
    eyeSpacing: -0.6,
    eyeSize: 0.75,
    lips: 0.6,
    crown: 0.15,
  }),
  '08': head({
    faceWidth: 0.3,
    jaw: 0.75,
    chin: 0.75,
    cheeks: -0.75,
    brow: -0.6,
    noseWidth: -0.6,
    noseTip: 0.75,
    eyeSpacing: 0.75,
    eyeTilt: -0.15,
    lips: 0.15,
    crown: -0.15,
  }),
  '09': head({
    faceWidth: -0.45,
    jaw: 0.6,
    chin: -0.75,
    cheeks: -0.15,
    cheekbones: -0.6,
    brow: 0.45,
    noseBridge: 0.45,
    noseTip: 0.15,
    eyeSize: -0.6,
    eyeTilt: 0.6,
    lips: -0.75,
    crown: -0.6,
  }),
  '10': head({
    faceWidth: -0.3,
    jaw: 0.45,
    cheeks: 0.45,
    cheekbones: 0.15,
    brow: -0.75,
    noseBridge: -0.6,
    noseWidth: -0.3,
    noseTip: -0.3,
    eyeSpacing: -0.75,
    eyeSize: 0.15,
    eyeTilt: -0.6,
    lips: -0.6,
    crown: -0.75,
  }),
  '11': head({
    faceWidth: -0.75,
    chin: 0.45,
    cheekbones: -0.75,
    brow: 0.75,
    noseBridge: -0.45,
    noseWidth: -0.75,
    noseTip: -0.6,
    eyeSpacing: 0.6,
    eyeSize: -0.75,
    eyeTilt: 0.45,
    lips: -0.15,
    crown: 0.3,
  }),
  '12': head({
    faceWidth: 0.15,
    jaw: -0.15,
    chin: -0.6,
    cheeks: 0.6,
    cheekbones: 0.75,
    brow: 0.15,
    noseBridge: -0.15,
    noseWidth: -0.15,
    noseTip: -0.75,
    eyeSpacing: 0.45,
    eyeSize: 0.45,
    eyeTilt: 0.75,
    lips: 0.75,
    crown: -0.45,
  }),
};

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

/** A full head shape from an authored head: its preset (or the reference head) plus overrides. */
export function resolveFigureHead(input: FigureHeadInput): FigureHeadShape {
  const base = input.preset !== undefined ? FIGURE_HEAD_PRESETS[input.preset] : ZERO;
  const out = { ...(base ?? ZERO) };
  for (const key of FIGURE_HEAD_PARAMS) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = clamp1(value);
  }
  return out;
}
