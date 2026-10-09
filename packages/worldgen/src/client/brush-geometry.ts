/** Opaque patch meshes: several stems share one geometry and one instanced draw. */
import type { PlantPreset } from '../kernel/plant-types';
import { unit01 } from '../kernel/seed';

type Point = [number, number, number];
interface Mesh {
  tube(points: Point[], radii: number[], sides: number, color: string): void;
  crown(center: Point, size: Point, color: string, sides: number, phase: number): void;
  leaf(
    root: Point,
    angle: number,
    reach: number,
    rise: number,
    width: number,
    color: string,
    coarse: boolean,
  ): void;
}

export function addBrushGeometry(mesh: Mesh, p: PlantPreset, detail: boolean | 'distant'): boolean {
  const far = detail === 'distant',
    medium = detail === true;
  const h = p.height,
    r = p.width / 2;
  const rnd = (i: number) => unit01(p.shapeSeed || 701, i);
  const at = (i: number, radius: number, y: number): Point => {
    const angle = i * 2.39996 + rnd(i) * 0.8;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  };
  if (p.family === 'shrub' || p.family === 'thicket') {
    const thorn = p.form === 'branching';
    if (far) {
      mesh.crown([0, h * 0.48, 0], [r, h * 0.96, r * 0.85], p.foliage, 5, rnd(2));
      mesh.tube(
        [
          [0, 0, 0],
          [r * 0.22, h * 0.65, 0],
        ],
        [p.stemRadius, p.stemRadius * 0.25],
        3,
        p.bark,
      );
      return true;
    }
    const stems = medium ? 2 : p.family === 'thicket' ? 4 : 3;
    for (let i = 0; i < stems; i++) {
      const root = at(i, r * 0.22, 0);
      const end = at(i + 2, r * (0.5 + rnd(i + 5) * 0.25), h * (0.55 + rnd(i + 9) * 0.22));
      const bend: Point = [
        (root[0] + end[0]) / 2,
        h * (0.5 + rnd(i + 20) * 0.2),
        (root[2] + end[2]) / 2,
      ];
      mesh.tube(
        [root, bend, end],
        [p.stemRadius, p.stemRadius * 0.6, p.stemRadius * 0.12],
        medium ? 3 : 4,
        p.bark,
      );
      for (let j = 0; j < (medium ? 2 : 3); j++) {
        const t = 0.22 + j * (medium ? 0.6 : 0.35);
        const from = t < 0.5 ? root : bend;
        const to = t < 0.5 ? bend : end;
        const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
        const center: Point = [
          from[0] + (to[0] - from[0]) * f,
          from[1] + (to[1] - from[1]) * f,
          from[2] + (to[2] - from[2]) * f,
        ];
        mesh.crown(
          center,
          [r * (thorn ? 0.2 : 0.36), h * (thorn ? 0.3 : 0.66), r * (thorn ? 0.16 : 0.28)],
          p.foliage,
          medium ? 4 : 5,
          i + j,
        );
        if (!medium && thorn) {
          const twig = at(i + j + 12, r * 0.22, h * 0.16);
          mesh.tube(
            [center, [center[0] + twig[0], center[1] + twig[1], center[2] + twig[2]]],
            [p.stemRadius * 0.24, 0.004],
            3,
            p.bark,
          );
        }
      }
    }
    return true;
  }
  if ((p.family === 'grass' || p.family === 'fern' || p.family === 'reed') && p.patch) {
    const fern = p.family === 'fern';
    for (let clump = 0; clump < (fern ? 3 : 5); clump++) {
      const root = at(clump, r * (0.15 + rnd(clump + 10) * 0.5), 0.01);
      for (let i = 0; i < (fern ? 3 : 7); i++) {
        const a = i * 2.39996 + rnd(clump + 30) * 6;
        const reach = r * (fern ? 0.42 : 0.2) * (0.7 + rnd(i + clump * 9) * 0.6);
        const rise = h * (0.4 + rnd(i + clump * 11 + 50) * 0.6);
        mesh.leaf(root, a, reach, rise, r * (fern ? 0.012 : 0.018), p.foliage, true);
        if (fern)
          for (const t of [0.35, 0.65])
            for (const side of [-1, 1]) {
              const leaf: Point = [
                root[0] + Math.cos(a) * reach * t,
                root[1] + rise * t,
                root[2] + Math.sin(a) * reach * t,
              ];
              mesh.leaf(
                leaf,
                a + side,
                reach * (0.7 - t * 0.4),
                h * 0.12,
                r * 0.05,
                p.foliage,
                true,
              );
            }
      }
      // Some standing seed heads break the uniform blade silhouette.
      if (!fern) {
        const top: Point = [root[0] + r * 0.08, h * (0.7 + rnd(clump + 70) * 0.3), root[2]];
        mesh.tube([root, top], [0.012, 0.007], 3, p.bark);
        mesh.crown(top, [r * 0.025, h * 0.15, r * 0.025], p.bark, 3, clump);
      }
    }
    return true;
  }
  if (p.family === 'forb') {
    for (let i = 0; i < 5; i++) {
      const root = at(i, r * 0.48, 0);
      const top: Point = [root[0] + r * 0.05, h * (0.65 + rnd(i + 5) * 0.35), root[2]];
      mesh.tube([root, top], [p.stemRadius, 0.007], 3, p.bark);
      for (let j = 0; j < 4; j++) {
        const y = top[1] * (0.2 + j * 0.17);
        mesh.leaf(
          [root[0], y, root[2]],
          i * 2.4 + j * 2,
          r * 0.4,
          h * 0.15,
          r * 0.14,
          p.foliage,
          true,
        );
      }
      mesh.crown(top, [r * 0.065, h * 0.09, r * 0.06], p.bark, 4, i);
    }
    return true;
  }
  if (p.family === 'vine') {
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.4 + rnd(i) * 0.7;
      const points: Point[] = [];
      for (let j = 0; j < 6; j++) {
        const t = j / 5;
        const turn = angle + Math.sin(t * 6 + i) * 0.45;
        const point: Point = [
          Math.cos(turn) * r * t,
          h * (0.1 + Math.sin(t * Math.PI) * 0.5),
          Math.sin(turn) * r * t,
        ];
        points.push(point);
        if (j > 0)
          for (const side of [-1, 1])
            mesh.leaf(
              point,
              turn + side,
              r * 0.22,
              h * (0.15 + rnd(j + i * 10) * 0.25),
              r * 0.09,
              p.foliage,
              true,
            );
      }
      mesh.tube(
        points,
        points.map((_, j) => p.stemRadius * (1 - j * 0.12)),
        3,
        p.bark,
      );
    }
    return true;
  }
  if (p.family === 'mat') {
    for (let i = 0; i < 15; i++) {
      const center = at(i, r * (0.15 + rnd(i + 18) * 0.7), h * (0.25 + rnd(i + 28) * 0.5));
      if (p.form === 'paddle')
        mesh.leaf(center, i * 2.4, r * 0.35, h * 0.15, r * 0.16, i % 3 ? p.foliage : p.bark, true);
      else mesh.crown(center, [r * 0.3, h * 0.65, r * 0.25], i % 4 ? p.foliage : p.bark, 3, i);
    }
    return true;
  }
  if (p.family === 'fallenwood') {
    const points: Point[] = [
      [-r * 0.9, h * 0.22, -r * 0.1],
      [0, h * 0.3, r * 0.05],
      [r, h * 0.2, -r * 0.08],
    ];
    mesh.tube(points, [h * 0.22, h * 0.28, h * 0.13], far ? 3 : medium ? 4 : 6, p.bark);
    for (let i = 0; i < (far ? 1 : medium ? 2 : 4); i++) {
      const root: Point = [r * (i / 4 - 0.5), h * 0.25, 0];
      const tip = at(i, r * (0.32 + rnd(i) * 0.22), h * (0.65 + rnd(i + 6) * 0.25));
      mesh.tube([root, tip], [h * 0.09, h * 0.025], 3, p.bark);
    }
    return true;
  }
  return false;
}

/** Climbers have real supports in their host mesh; arbitrary walls/trees are never guessed. */
export function addClimberGeometry(mesh: Mesh, p: PlantPreset): void {
  if (!p.climber) return;
  const points: Point[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7,
      angle = t * 9;
    const fraction = 0.05 + t * 0.9;
    const y = p.height * p.crownBase * fraction;
    const stemX =
      p.lean * p.height * (fraction < 0.5 ? fraction * 0.6 : 0.3 + (fraction - 0.5) * 1.4);
    const radius =
      p.stemRadius * (fraction < 0.5 ? 1 - fraction * 0.48 : 0.76 - (fraction - 0.5) * 0.68) * 1.04;
    const point: Point = [stemX + Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    points.push(point);
    mesh.leaf(point, angle, Math.min(0.7, p.width * 0.07), p.height * 0.016, 0.13, p.climber, true);
  }
  mesh.tube(
    points,
    points.map(() => 0.022),
    3,
    p.climber,
  );
  for (let i = 0; i < 2; i++) {
    const seed = p.shapeSeed ?? 0;
    const angle = i * 2.4 + (seed ? (unit01(seed, i + 80) * 2 - 1) * 0.42 : 0);
    const y =
      p.crownBase * p.height +
      p.height *
        (1 - p.crownBase) *
        (0.45 + (i % 3) * 0.09) *
        (seed ? 1 + (unit01(seed, i) * 2 - 1) * 0.15 : 1);
    const root: Point = [
      p.lean * p.height + Math.cos(angle) * p.width * 0.21,
      y,
      Math.sin(angle) * p.width * 0.21,
    ];
    const middle: Point = [root[0] + 0.12, y - p.height * 0.12, root[2] + 0.1];
    const tip: Point = [root[0] - 0.1, y - p.height * 0.25, root[2]];
    mesh.tube([root, middle, tip], [0.025, 0.022, 0.012], 3, p.climber);
    for (const point of [middle, tip])
      mesh.leaf(point, angle + 1, 0.35, 0.05, 0.12, p.climber, true);
  }
}
