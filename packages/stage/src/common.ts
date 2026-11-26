import {
  ENVIRONMENT_PRESET_NAMES,
  type EnvironmentPresetName,
  type JsonObject,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { z } from 'zod';

// What the film and game documents share: looks, figure presets, colors, issue helpers.

/** Every compiled scene runs at 30 ticks a second; documents speak in seconds. */
export const TICK_RATE = 30;

export type Look = EnvironmentPresetName;
export const LOOKS: readonly Look[] = ENVIRONMENT_PRESET_NAMES;

export type FigurePreset =
  | 'human.adult'
  | 'human.child'
  | 'human.elder'
  | 'dog'
  | 'cat'
  | 'horse'
  | 'deer'
  | 'cow'
  | 'sheep';

export interface FigurePresetInfo {
  /** Standing height in meters, for framing. */
  height: number;
  /** Walking speed in meters per second. */
  walk: number;
  /** Running speed in meters per second. */
  run: number;
}

export const FIGURE_PRESETS: Readonly<Record<FigurePreset, FigurePresetInfo>> = {
  'human.adult': { height: 1.75, walk: 1.3, run: 3.6 },
  'human.child': { height: 1.15, walk: 1.1, run: 3 },
  'human.elder': { height: 1.65, walk: 0.9, run: 2 },
  dog: { height: 0.6, walk: 1.4, run: 5 },
  cat: { height: 0.28, walk: 1, run: 3.5 },
  horse: { height: 1.55, walk: 1.6, run: 7 },
  deer: { height: 1.05, walk: 1.4, run: 6 },
  cow: { height: 1.35, walk: 1, run: 3 },
  sheep: { height: 0.8, walk: 1, run: 3 },
};

export const FIGURE_PRESET_NAMES: readonly FigurePreset[] = Object.keys(
  FIGURE_PRESETS,
) as FigurePreset[];

export const colorField: z.ZodString = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: 'a color like "#c0392b"' });

export const lookField: z.ZodType<Look> = z
  .enum(LOOKS as [Look, ...Look[]])
  .describe('Light: morning, noon (default), evening, night or overcast.');

/** An environment entity for a look: the preset keeps every frame readable. */
export function environmentFor(look: Look | undefined): JsonObject {
  return {
    environment: { preset: look ?? 'noon', shadows: 'medium', sun: { castShadow: true } },
  };
}

export function issue(path: string, code: string, message: string, hint?: string): ValidationIssue {
  return { path, code, message, ...(hint !== undefined ? { hint } : {}) };
}

/** A scene name from a document name: lowercase, dashes. */
export function slug(name: string, fallback: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

/** A primitive renderable. */
export function primitive(
  ref: 'box' | 'sphere' | 'cylinder',
  size: [number, number, number],
  color: string,
): JsonObject {
  return { kind: 'primitive', ref, materialRef: `palette:${color}`, primitive: { size } };
}

export const round3 = (v: number): number => Math.round(v * 1000) / 1000;
