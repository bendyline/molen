import type { MaterialSlot } from './types';

// Hand-written contract for a validated (defaults-applied) material graph. The Zod schema in
// schema.ts is the validation engine; this interface is the API contract (the codebase keeps
// Zod-inferred types out of exported positions for isolatedDeclarations). Keep in sync — the
// cross-validation tests catch drift.

export interface RampStop {
  t: number;
  color: string;
}

interface NodeCommon {
  id: string;
  input?: string;
  inputs?: Record<string, string>;
}

export type MatNode =
  | (NodeCommon & { type: 'const'; params: { value: number | [number, number, number, number] } })
  | (NodeCommon & { type: 'uv'; params: Record<string, never> })
  | (NodeCommon & {
      type: 'uv-transform';
      params: { scale: number; offset: [number, number]; rotateDeg: number };
    })
  | (NodeCommon & {
      type: 'noise';
      params: {
        kind: 'simplex' | 'value';
        octaves: number;
        lacunarity: number;
        gain: number;
        scale: number;
        seedOffset: number;
      };
    })
  | (NodeCommon & {
      type: 'worley';
      params: { scale: number; jitter: number; output: 'f1' | 'f2' | 'f2-f1' };
    })
  | (NodeCommon & { type: 'gradient'; params: { kind: 'linear' | 'radial'; angleDeg: number } })
  | (NodeCommon & { type: 'checker'; params: { scale: number } })
  | (NodeCommon & {
      type: 'bricks';
      params: { rows: number; cols: number; mortarWidth: number; offset: number };
    })
  | (NodeCommon & { type: 'ramp'; params: { stops: RampStop[] } })
  | (NodeCommon & {
      type: 'blend';
      params: { mode: 'mix' | 'multiply' | 'add' | 'screen' | 'overlay'; factor: number };
    })
  | (NodeCommon & { type: 'threshold'; params: { edge: number; smoothness: number } })
  | (NodeCommon & { type: 'invert'; params: Record<string, never> })
  | (NodeCommon & {
      type: 'levels';
      params: { inMin: number; inMax: number; gamma: number; outMin: number; outMax: number };
    })
  | (NodeCommon & { type: 'height-to-normal'; params: { strength: number } });

export interface MatGraphDoc {
  format: 'molen/matgraph@1';
  size: [number, number];
  seed: number;
  nodes: MatNode[];
  outputs: Partial<Record<MaterialSlot, string>>;
}
