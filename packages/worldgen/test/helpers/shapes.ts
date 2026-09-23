import type { Vec2 } from '../../src/kernel/types';

export function ring(points: readonly (readonly [number, number])[]): Vec2[] {
  return points.map((point): Vec2 => [point[0], point[1]]);
}

/** Canonical test outlines in meters (positive orientation). */
export const SHAPES: Readonly<Record<string, Vec2[]>> = {
  box: ring([
    [0, 0],
    [12, 0],
    [12, 8],
    [0, 8],
  ]),
  L: ring([
    [0, 0],
    [12, 0],
    [12, 6],
    [6, 6],
    [6, 12],
    [0, 12],
  ]),
  T: ring([
    [0, 0],
    [14, 0],
    [14, 5],
    [9, 5],
    [9, 12],
    [5, 12],
    [5, 5],
    [0, 5],
  ]),
  U: ring([
    [0, 0],
    [14, 0],
    [14, 10],
    [10, 10],
    [10, 4],
    [4, 4],
    [4, 10],
    [0, 10],
  ]),
  Z: ring([
    [0, 0],
    [8, 0],
    [8, 5],
    [14, 5],
    [14, 10],
    [6, 10],
    [6, 5],
    [0, 5],
  ]),
  stair: ring([
    [0, 0],
    [6, 0],
    [6, 4],
    [10, 4],
    [10, 8],
    [14, 8],
    [14, 12],
    [0, 12],
  ]),
  H: ring([
    [0, 0],
    [4, 0],
    [4, 5],
    [10, 5],
    [10, 0],
    [14, 0],
    [14, 14],
    [10, 14],
    [10, 9],
    [4, 9],
    [4, 14],
    [0, 14],
  ]),
  plus: ring([
    [4, 0],
    [8, 0],
    [8, 4],
    [12, 4],
    [12, 8],
    [8, 8],
    [8, 12],
    [4, 12],
    [4, 8],
    [0, 8],
    [0, 4],
    [4, 4],
  ]),
  courtyardOuter: ring([
    [0, 0],
    [20, 0],
    [20, 16],
    [0, 16],
  ]),
  courtyardHole: ring([
    [7, 5],
    [13, 5],
    [13, 11],
    [7, 11],
  ]),
  skewedBox: ring([
    [0, 0],
    [12, 0.6],
    [12, 8.6],
    [0, 8],
  ]),
  parallelogram: ring([
    [0, 0],
    [12, 4.37],
    [12, 12.37],
    [0, 8],
  ]),
  bowtie: ring([
    [0, 0],
    [10, 8],
    [10, 0],
    [0, 6],
  ]),
  sliver: ring([
    [0, 0],
    [20, 0],
    [20, 1],
    [0, 1],
  ]),
};

export function regularPolygon(sides: number, radius: number): Vec2[] {
  const points: Vec2[] = [];
  for (let index = 0; index < sides; index++) {
    const angle = (index / sides) * Math.PI * 2;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

export function rotate(points: readonly Vec2[], degrees: number): Vec2[] {
  const c = Math.cos((degrees * Math.PI) / 180);
  const s = Math.sin((degrees * Math.PI) / 180);
  return points.map((point): Vec2 => [c * point[0] - s * point[1], s * point[0] + c * point[1]]);
}

export function translate(points: readonly Vec2[], dx: number, dz: number): Vec2[] {
  return points.map((point): Vec2 => [point[0] + dx, point[1] + dz]);
}
