/** Resizable plans for a vacant lot. Local +Z points inward; the frontage is at Z=0. */
import type { Vec2 } from './types';

export const LOT_PLAN_KINDS: readonly LotPlanKind[] = [
  'cottage',
  'ranch',
  'front-garage',
  'side-garage',
  'courtyard',
  'compact',
  'shopfront',
];
export type LotPlanKind =
  | 'cottage'
  | 'ranch'
  | 'front-garage'
  | 'side-garage'
  | 'courtyard'
  | 'compact'
  | 'shopfront';
export interface LotPlanChoice {
  shape: LotPlanKind;
  weight: number;
}
export interface LotBuildingPlan {
  outline: Vec2[];
  entrance: Vec2;
  garage?: { outline: Vec2[]; entrance: Vec2 };
}

/** Plans stay inside the supplied envelope, with an open approach to every entrance. */
export function createLotBuildingPlan(
  shape: LotPlanKind,
  width: number,
  depth: number,
): LotBuildingPlan {
  if (!(width > 0 && depth > 0 && Number.isFinite(width) && Number.isFinite(depth)))
    throw new Error('Lot dimensions must be finite and positive');
  const point = (x: number, z: number): Vec2 => [x * width, z * depth];
  const ring = (p: Vec2[]): Vec2[] => p.map(([x, z]) => point(x, z));
  const rectangle = (x0: number, z0: number, x1: number, z1: number): Vec2[] =>
    ring([
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]);
  switch (shape) {
    case 'front-garage':
      return {
        outline: ring([
          [-0.5, 0.15],
          [0.12, 0.15],
          [0.12, 0.48],
          [0.5, 0.48],
          [0.5, 1],
          [-0.5, 1],
        ]),
        entrance: point(-0.2, 0.15),
        garage: { outline: rectangle(0.12, 0, 0.5, 0.48), entrance: point(0.31, 0) },
      };
    case 'side-garage':
      return {
        outline: rectangle(-0.5, 0, 0.1, 1),
        entrance: point(-0.2, 0),
        garage: { outline: rectangle(0.1, 0.2, 0.5, 0.75), entrance: point(0.3, 0.2) },
      };
    case 'ranch':
      return {
        outline: ring([
          [-0.5, 0],
          [-0.05, 0],
          [-0.05, 0.28],
          [0.5, 0.28],
          [0.5, 1],
          [-0.5, 1],
        ]),
        entrance: point(0.2, 0.28),
      };
    case 'courtyard':
      return {
        outline: ring([
          [-0.5, 0],
          [-0.22, 0],
          [-0.22, 0.48],
          [0.22, 0.48],
          [0.22, 0],
          [0.5, 0],
          [0.5, 1],
          [-0.5, 1],
        ]),
        entrance: point(0, 0.48),
      };
    case 'cottage':
      return {
        outline: ring([
          [-0.5, 0],
          [-0.12, 0],
          [-0.12, 0.14],
          [0.12, 0.14],
          [0.12, 0],
          [0.5, 0],
          [0.5, 1],
          [-0.5, 1],
        ]),
        entrance: point(0, 0.14),
      };
    default:
      return { outline: rectangle(-0.5, 0, 0.5, 1), entrance: point(0, 0) };
  }
}
