/** Opaque patch meshes: several stems share one geometry and one instanced draw. */
import type { PlantPreset } from '../kernel/plant-types';
import { unit01 } from '../kernel/seed';

type Point = [number, number, number];
interface Mesh {
  readonly vertexCount: number;
  tube(points: Point[], radii: number[], sides: number, color: string): void;
  crown(
    center: Point,
    size: Point,
    color: string,
    sides: number,
    phase: number,
    bend?: number,
    tone?: number,
  ): void;
  leaf(
    root: Point,
    angle: number,
    reach: number,
    rise: number,
    width: number,
    color: string,
    coarse: boolean,
  ): void;
  triangle(a: Point, b: Point, c: Point, color: string, shade?: number): void;
  volume(start: number, center: Point, size: Point, bend?: number): void;
  /** Append what `build` draws as a foliage mass, shaded as clumps of leaves. */
  mass(build: () => void): void;
}

/** A color part way from `from` to `to`, for a level too coarse to draw blossoms one by one. */
function blend(from: string, to: string, share: number): string {
  const channel = (hex: string, at: number): number => Number.parseInt(hex.slice(at, at + 2), 16);
  let mixed = '#';
  for (const at of [1, 3, 5]) {
    const value = Math.round(channel(from, at) * (1 - share) + channel(to, at) * share);
    mixed += value.toString(16).padStart(2, '0');
  }
  return mixed;
}

/**
 * A faceted stone: a ring at the ground, a wider belly and a narrow shoulder under one apex, each
 * with its own irregular outline. Open underneath, where it is buried.
 */
function stone(
  mesh: Mesh,
  center: Point,
  size: Point,
  color: string,
  sides: number,
  rnd: (i: number) => number,
  stream: number,
): void {
  const start = mesh.vertexCount;
  const rings = [
    [0, 0.86],
    [0.42, 1],
    [0.84, 0.56],
  ].map(([y = 0, radius = 0], ring) =>
    Array.from({ length: sides }, (_, i): Point => {
      const angle = (i * Math.PI * 2) / sides + rnd(stream) * 2;
      const k = radius * (0.8 + rnd(stream + 1 + ring * sides + i) * 0.34);
      return [
        center[0] + Math.cos(angle) * size[0] * k,
        center[1] + y * size[1],
        center[2] + Math.sin(angle) * size[2] * k,
      ];
    }),
  );
  const top: Point = [center[0] + size[0] * 0.08, center[1] + size[1], center[2] - size[2] * 0.06];
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    for (let ring = 1; ring < rings.length; ring++) {
      const a = rings[ring - 1] as Point[],
        b = rings[ring] as Point[];
      const shade = 0.74 + ring * 0.1;
      mesh.triangle(a[i] as Point, b[i] as Point, a[next] as Point, color, shade);
      mesh.triangle(a[next] as Point, b[i] as Point, b[next] as Point, color, shade);
    }
    const last = rings[rings.length - 1] as Point[];
    mesh.triangle(last[i] as Point, top, last[next] as Point, color, 1);
  }
  // Mostly its own facets: a boulder is not a soft mass of leaves.
  mesh.volume(
    start,
    [center[0], center[1] + size[1] * 0.4, center[2]],
    [size[0], size[1], size[2]],
    0.2,
  );
}

export function addBrushGeometry(
  mesh: Mesh,
  p: PlantPreset,
  detail: boolean | 'distant' | 'horizon',
): boolean {
  const far = detail === 'distant' || detail === 'horizon',
    medium = detail === true;
  const h = p.height,
    r = p.width / 2;
  const rnd = (i: number) => unit01(p.shapeSeed || 701, i);
  const bloom = p.bloom;
  if (p.family === 'crop') {
    const grain = p.cropKind === 'cereal' || p.cropKind === 'rice';
    const maize = p.cropKind === 'maize' || p.cropKind === 'cane';
    const broad = p.cropKind === 'broadleaf' || p.cropKind === 'roots' || p.cropKind === 'cotton';
    const count = grain ? 7 : maize ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const x = -r * 0.85 + (i / (count - 1)) * r * 1.7;
      const z = (rnd(i + 9) - 0.5) * r * 0.16;
      const height = h * (0.82 + rnd(i + 3) * 0.18);
      const top: Point = [x + h * 0.025, height, z];
      mesh.tube([[x, 0, z], top], [p.stemRadius, p.stemRadius * 0.45], 3, p.bark);
      if (p.cropStage === 'stubble') continue;
      const leaves = grain ? 3 : 6;
      for (let j = 0; j < leaves; j++) {
        const y = height * (0.18 + (j * 0.65) / leaves);
        const a = i * 0.7 + j * 2.4;
        mesh.leaf(
          [x, y, z],
          a,
          broad ? r * 0.31 : r * 0.34,
          height * (broad ? 0.15 : 0.22),
          r * (broad ? 0.19 : maize ? 0.085 : 0.045),
          p.foliage,
          true,
        );
      }
      if (p.cropStage === 'sown' || p.cropStage === 'growing') continue;
      if (p.cropKind === 'maize')
        mesh.crown(
          [x + r * 0.04, height * 0.63, z],
          [r * 0.035, h * 0.14, r * 0.035],
          p.foliage,
          4,
          i,
        );
      if (grain || p.cropKind === 'maize')
        mesh.crown(top, [r * 0.025, h * 0.2, r * 0.025], p.bark, 3, i);
      if (p.cropKind === 'sunflower') {
        mesh.crown(top, [r * 0.13, h * 0.1, r * 0.1], '#d4b851', 6, i);
        mesh.crown(
          [top[0], top[1] + h * 0.04, top[2]],
          [r * 0.065, h * 0.04, r * 0.055],
          '#756146',
          5,
          i,
        );
      }
      if (p.cropKind === 'cotton')
        for (const side of [-1, 1])
          mesh.crown(
            [x + side * r * 0.11, height * 0.75, z],
            [r * 0.07, h * 0.12, r * 0.07],
            '#e0dcc7',
            4,
            i,
          );
    }
    return true;
  }
  const at = (i: number, radius: number, y: number): Point => {
    const angle = i * 2.39996 + rnd(i) * 0.8;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  };
  if (p.family === 'shrub' || p.family === 'thicket') {
    const thorn = p.form === 'branching';
    if (far) {
      // One solid from far off, shaded as the clumps of leaves it stands for.
      mesh.mass(() => {
        mesh.crown(
          [0, h * 0.48, 0],
          [r, h * 0.96, r * 0.85],
          bloom ? blend(p.foliage, bloom, 0.22) : p.foliage,
          5,
          rnd(2),
        );
      });
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
        const lobe: Point = [
          r * (thorn ? 0.2 : 0.36),
          h * (thorn ? 0.3 : 0.66),
          r * (thorn ? 0.16 : 0.28),
        ];
        // At medium range a flowering shrub's outer lobes carry the blossom color between them.
        mesh.crown(
          center,
          lobe,
          bloom && medium && j > 0 ? blend(p.foliage, bloom, 0.4) : p.foliage,
          medium ? 4 : 5,
          i + j,
        );
        if (bloom && !medium)
          // Trusses of blossom stud the lobe from its shoulder to its crown: small enough to
          // read as flowers among leaves, not as a cap on each lobe.
          for (let k = 0; k < (thorn ? 1 : p.family === 'thicket' ? 2 : 3); k++) {
            const angle = (i * 3 + j * 5 + k * 2) * 1.19 + rnd(i * 7 + j + 40) * 2;
            // Higher on the lobe is nearer its axis.
            const lift = 0.02 + k * 0.15 + rnd(i * 5 + j * 3 + k + 60) * 0.06;
            const out = 0.92 - lift * 1.1;
            mesh.crown(
              [
                center[0] + Math.cos(angle) * lobe[0] * out,
                center[1] + lobe[1] * lift,
                center[2] + Math.sin(angle) * lobe[2] * out,
              ],
              [lobe[0] * 0.3, lobe[1] * 0.15, lobe[2] * 0.34],
              bloom,
              3,
              k + j,
            );
          }
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
        // A plumed grass carries a feathery head several times a seed head's size.
        if (bloom) mesh.crown(top, [r * 0.07, h * 0.3, r * 0.07], bloom, 4, clump);
        else mesh.crown(top, [r * 0.025, h * 0.15, r * 0.025], p.bark, 3, clump);
      }
    }
    return true;
  }
  if (p.family === 'forb') {
    // A patch is a bed: more stems, spread to the edge, rather than one loose clump.
    const stems = p.patch ? 7 : 5;
    for (let i = 0; i < stems; i++) {
      const root = at(i, r * (p.patch ? 0.2 + (i / stems) * 0.62 : 0.48), 0);
      const top: Point = [root[0] + r * 0.05, h * (0.65 + rnd(i + 5) * 0.35), root[2]];
      mesh.tube([root, top], [p.stemRadius, 0.007], 3, p.bark);
      for (let j = 0; j < (p.patch ? 3 : 4); j++) {
        const y = top[1] * (0.2 + j * 0.17);
        mesh.leaf(
          [root[0], y, root[2]],
          i * 2.4 + j * 2,
          r * (p.patch ? 0.26 : 0.4),
          h * 0.15,
          r * (p.patch ? 0.1 : 0.14),
          p.foliage,
          true,
        );
      }
      if (!bloom) mesh.crown(top, [r * 0.065, h * 0.09, r * 0.06], p.bark, 4, i);
      else if (p.form === 'columnar')
        // A flower spike down the top third of the stem.
        mesh.crown(
          [top[0], top[1] - h * 0.13, top[2]],
          [r * 0.075, h * 0.34, r * 0.075],
          bloom,
          4,
          i,
        );
      // An open flower head, flat for daisies and domed for clustered blooms.
      else
        mesh.crown(top, [r * 0.13, h * (p.form === 'round' ? 0.06 : 0.13), r * 0.13], bloom, 5, i);
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
              // A flowering runner opens a bloom at every other node, on one side.
              bloom && side === 1 && j % 2 === 0 ? bloom : p.foliage,
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
  if (p.family === 'mat' && p.form === 'fan') {
    // A dressed bed: one low, slightly domed patch of ground, with a few clods on it. A scatter of
    // loose leaves reads as litter; mulch and gravel are a surface.
    const sides = 9;
    const rim = Array.from({ length: sides }, (_, i): Point => {
      const angle = (i * Math.PI * 2) / sides;
      const reach = r * (0.72 + rnd(i + 4) * 0.28);
      return [Math.cos(angle) * reach, 0, Math.sin(angle) * reach];
    });
    const start = mesh.vertexCount;
    for (let i = 0; i < sides; i++)
      mesh.triangle(
        rim[i] as Point,
        [0, h * 0.5, 0],
        rim[(i + 1) % sides] as Point,
        p.foliage,
        0.86 + rnd(i + 20) * 0.14,
      );
    mesh.volume(start, [0, 0, 0], [r, h * 6, r], 0.5);
    for (let i = 0; i < 4; i++)
      mesh.crown(
        at(i, r * (0.25 + rnd(i + 30) * 0.4), h * 0.5),
        [r * 0.1, h, r * 0.09],
        p.bark,
        3,
        i,
      );
    return true;
  }
  if (p.family === 'mat') {
    for (let i = 0; i < 15; i++) {
      const center = at(i, r * (0.15 + rnd(i + 18) * 0.7), h * (0.25 + rnd(i + 28) * 0.5));
      // A flowering carpet shows its color in a third of its leaves or cushions.
      const flower = bloom !== undefined && i % 3 === 1 ? bloom : undefined;
      if (p.form === 'paddle')
        mesh.leaf(
          center,
          i * 2.4,
          r * 0.35,
          h * 0.15,
          r * 0.16,
          flower ?? (i % 3 ? p.foliage : p.bark),
          true,
        );
      else
        mesh.crown(
          center,
          [r * 0.3, h * 0.65, r * 0.25],
          flower ?? (i % 4 ? p.foliage : p.bark),
          3,
          i,
        );
    }
    return true;
  }
  if (p.family === 'hedge') {
    const sprig = bloom ?? p.foliage;
    if (p.form === 'columnar') {
      // A clipped run: flat faces, a beveled shoulder and a top that is not quite level. Its
      // length lies along x; scatter turns it.
      const depth = r * 0.34;
      const stations = far ? 2 : medium ? 3 : 5;
      const start = mesh.vertexCount;
      const section = (i: number): Point[] => {
        const x = -r + (2 * r * i) / (stations - 1);
        const top = h * (0.94 + rnd(i + 3) * 0.06);
        const d = depth * (0.92 + rnd(i + 13) * 0.12);
        return medium || far
          ? [
              [x, 0, -d],
              [x, top, -d * 0.82],
              [x, top, d * 0.82],
              [x, 0, d],
            ]
          : [
              [x, 0, -d],
              [x, top * 0.82, -d * 0.96],
              [x, top, -d * 0.62],
              [x, top, d * 0.62],
              [x, top * 0.82, d * 0.96],
              [x, 0, d],
            ];
      };
      for (let i = 1; i < stations; i++) {
        const a = section(i - 1),
          b = section(i);
        // Lit from above: the top bright, the shoulders between it and the shaded faces.
        const shades = a.length === 6 ? [0.78, 0.9, 1, 0.9, 0.78] : [0.78, 1, 0.78];
        for (let k = 1; k < a.length; k++) {
          const shade = shades[k - 1] as number;
          mesh.triangle(a[k - 1] as Point, a[k] as Point, b[k - 1] as Point, p.foliage, shade);
          mesh.triangle(b[k - 1] as Point, a[k] as Point, b[k] as Point, p.foliage, shade);
        }
      }
      for (const [end, flip] of [
        [section(0), false],
        [section(stations - 1), true],
      ] as Array<[Point[], boolean]>)
        for (let k = 1; k < end.length - 1; k++) {
          const a = end[0] as Point,
            b = end[k] as Point,
            c = end[k + 1] as Point;
          if (flip) mesh.triangle(a, b, c, p.foliage, 0.8);
          else mesh.triangle(a, c, b, p.foliage, 0.8);
        }
      mesh.volume(start, [0, h * 0.5, 0], [r, h * 0.5, depth], 0.25);
      // New growth breaks the clipped line up close, in the blossom color where it flowers.
      if (!medium && !far)
        for (let i = 0; i < 6; i++)
          mesh.crown(
            [
              -r * 0.82 + ((i + rnd(i + 30) * 0.6) / 6) * r * 1.7,
              h * (0.9 + rnd(i + 40) * 0.06),
              (rnd(i + 50) - 0.5) * depth * 1.1,
            ],
            [r * 0.11, h * 0.16, depth * 0.42],
            sprig,
            3,
            i,
          );
      return true;
    }
    if (p.form === 'umbrella') {
      // A cloud-pruned specimen: a bent trunk carrying a few flattened pads.
      const pads = far ? 1 : medium ? 3 : 5;
      const top: Point = [r * 0.18, h * 0.78, 0];
      mesh.tube(
        far ? [[0, 0, 0], top] : [[0, 0, 0], [-r * 0.16, h * 0.42, r * 0.06], top],
        far
          ? [p.stemRadius, p.stemRadius * 0.5]
          : [p.stemRadius, p.stemRadius * 0.8, p.stemRadius * 0.45],
        far || medium ? 3 : 5,
        p.bark,
      );
      for (let i = 0; i < pads; i++) {
        const tier = pads === 1 ? 1 : i / (pads - 1);
        const reach = i === pads - 1 ? 0 : r * (0.62 - tier * 0.2);
        const pad = at(i, reach, h * (0.42 + tier * 0.44));
        if (!far && !medium && reach > 0)
          mesh.tube(
            [[top[0] * tier, pad[1] - h * 0.12, 0], pad],
            [p.stemRadius * 0.4, p.stemRadius * 0.22],
            3,
            p.bark,
          );
        mesh.crown(
          pad,
          [r * (0.46 - tier * 0.1), h * 0.2, r * (0.4 - tier * 0.08)],
          i % 2 === 1 ? sprig : p.foliage,
          far ? 5 : medium ? 5 : 8,
          i,
        );
      }
      return true;
    }
    // Clipped globes of three sizes, as a planted group.
    const globes = far ? 1 : medium ? 2 : 3;
    for (let i = 0; i < globes; i++) {
      const radius = r * ([0.52, 0.38, 0.3][i] as number);
      const center = i === 0 ? ([-r * 0.34, 0, r * 0.06] as Point) : at(i + 1, r * 0.56, 0);
      const tall = h * ([1, 0.72, 0.56][i] as number);
      mesh.crown(
        [center[0], tall * 0.5, center[2]],
        [radius, tall, radius],
        i === 2 ? sprig : p.foliage,
        far || medium ? 5 : 8,
        i,
      );
    }
    return true;
  }
  if (p.family === 'rock') {
    // Boulders, or flat slabs where the form is a paddle. `bark` is the weathered or mossy tone.
    const slab = p.form === 'paddle';
    const count = far ? 1 : medium ? 2 : slab ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const scale = i === 0 ? 1 : 0.34 + rnd(i + 8) * 0.34;
      const center = i === 0 ? ([0, 0, 0] as Point) : at(i, r * (0.5 + rnd(i + 3) * 0.3), 0);
      stone(
        mesh,
        center,
        [r * 0.56 * scale, h * (slab ? 0.6 : 1) * (i === 0 ? 1 : scale + 0.12), r * 0.5 * scale],
        i % 3 === 2 ? p.bark : p.foliage,
        far ? 4 : medium ? 5 : 6,
        rnd,
        60 + i * 31,
      );
    }
    return true;
  }
  if (p.family === 'fallenwood' && p.form === 'columnar') {
    // A cut stump on its root flare, mossed over on top where foliage differs from bark.
    const trunk = r * 0.46;
    const coarse = medium || far;
    mesh.tube(
      coarse
        ? [
            [0, 0, 0],
            [r * 0.03, h, 0],
          ]
        : [
            [0, 0, 0],
            [0, h * 0.5, 0],
            [r * 0.03, h, 0],
          ],
      coarse ? [trunk * 1.2, trunk * 0.9] : [trunk * 1.25, trunk, trunk * 0.92],
      far ? 3 : medium ? 4 : 7,
      p.bark,
    );
    for (let i = 0; i < (far ? 0 : medium ? 2 : 4); i++) {
      const tip = at(i, r * (0.8 + rnd(i + 4) * 0.2), 0);
      mesh.tube(
        [[tip[0] * 0.3, h * 0.42, tip[2] * 0.3], tip],
        [trunk * 0.42, trunk * 0.14],
        3,
        p.bark,
      );
    }
    if (!coarse && p.foliage !== p.bark)
      mesh.crown([r * 0.03, h * 0.97, 0], [trunk * 0.8, h * 0.14, trunk * 0.8], p.foliage, 5, 2);
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
