/** Opaque, faceted plant families with bounded geometry and independent near/medium/far meshes. */
import * as THREE from 'three';
import type { PlantPreset } from '../kernel/plant-types';
import { unit01 } from '../kernel/seed';
import { addBrushGeometry, addClimberGeometry } from './brush-geometry';

type Point = [number, number, number];
type Detail = boolean | 'distant';
const TAU = Math.PI * 2;

class PlantMesh {
  constructor(private readonly seed = 0) {}
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  private readonly colorCache = new Map<string, THREE.Color>();

  triangle(a: Point, b: Point, c: Point, hex: string, shade = 1): void {
    let color = this.colorCache.get(hex);
    if (color === undefined) {
      color = new THREE.Color(hex);
      this.colorCache.set(hex, color);
    }
    for (const point of [a, b, c]) {
      this.positions.push(...point);
      this.colors.push(color.r * shade, color.g * shade, color.b * shade);
    }
  }

  /** Closed tapered tube, with its rings perpendicular to each path segment. */
  tube(points: Point[], radii: number[], sides: number, hex: string, irregularity = 0): void {
    const rings: Point[][] = [];
    for (let i = 0; i < points.length; i++) {
      const center = new THREE.Vector3(...(points[i] as Point));
      const previous = new THREE.Vector3(...(points[Math.max(0, i - 1)] as Point));
      const next = new THREE.Vector3(...(points[Math.min(points.length - 1, i + 1)] as Point));
      const tangent = next.sub(previous).normalize();
      const axis =
        Math.abs(tangent.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const u = new THREE.Vector3().crossVectors(axis, tangent).normalize();
      const v = new THREE.Vector3().crossVectors(tangent, u).normalize();
      rings.push(
        Array.from({ length: sides }, (_, side): Point => {
          const angle = (side * TAU) / sides;
          const phase = this.seed ? unit01(this.seed, 40) * TAU : 0;
          const radius =
            (radii[i] as number) *
            (1 + irregularity * Math.sin(angle * 3 + i * 0.9 + phase)) *
            (this.seed ? 0.94 + 0.12 * unit01(this.seed, i + 50) : 1);
          const point = center
            .clone()
            .addScaledVector(u, Math.cos(angle) * radius)
            .addScaledVector(v, Math.sin(angle) * radius);
          return [point.x, point.y, point.z];
        }),
      );
    }
    for (let ring = 1; ring < rings.length; ring++) {
      for (let side = 0; side < sides; side++) {
        const lower = rings[ring - 1] as Point[],
          upper = rings[ring] as Point[];
        const a = lower[side] as Point,
          b = lower[(side + 1) % sides] as Point;
        const c = upper[side] as Point,
          d = upper[(side + 1) % sides] as Point;
        const shade = 0.78 + (0.2 * ring) / (rings.length - 1) + 0.02 * (side % 2);
        this.triangle(a, b, c, hex, shade);
        this.triangle(b, d, c, hex, shade);
      }
    }
    for (let side = 1; side < sides - 1; side++) {
      const bottom = rings[0] as Point[],
        top = rings[rings.length - 1] as Point[];
      this.triangle(
        bottom[0] as Point,
        bottom[side + 1] as Point,
        bottom[side] as Point,
        hex,
        0.75,
      );
      this.triangle(top[0] as Point, top[side] as Point, top[side + 1] as Point, hex);
    }
  }

  /** A closed irregular crown; tip rings have one vertex, so no degenerate triangles. */
  crown(center: Point, size: Point, hex: string, sides: number, phase: number): void {
    if (this.seed) phase += unit01(this.seed, 41) * TAU;
    const profiles =
      sides >= 8
        ? [
            [0.2, 0.68],
            [0.5, 1],
            [0.8, 0.72],
          ]
        : [
            [0.32, 0.85],
            [0.68, 0.9],
          ];
    const rings = profiles.map(([y = 0, radius = 0]) =>
      Array.from({ length: sides }, (_, i): Point => {
        const angle = (i * TAU) / sides;
        const r = radius * (1 + 0.12 * Math.sin(angle * 3 + phase));
        return [
          center[0] + Math.cos(angle) * size[0] * r,
          center[1] + (y - 0.5) * size[1],
          center[2] + Math.sin(angle) * size[2] * r,
        ];
      }),
    );
    const bottom: Point = [center[0], center[1] - size[1] / 2, center[2]];
    const top: Point = [center[0] + size[0] * 0.06, center[1] + size[1] / 2, center[2]];
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      this.triangle(
        bottom,
        (rings[0] as Point[])[i] as Point,
        (rings[0] as Point[])[next] as Point,
        hex,
        0.76,
      );
      for (let j = 1; j < rings.length; j++) {
        const a = rings[j - 1] as Point[],
          b = rings[j] as Point[];
        this.triangle(a[i] as Point, b[i] as Point, a[next] as Point, hex, 0.81 + j * 0.055);
        this.triangle(a[next] as Point, b[i] as Point, b[next] as Point, hex, 0.84 + j * 0.045);
      }
      const last = rings[rings.length - 1] as Point[];
      this.triangle(last[i] as Point, top, last[next] as Point, hex);
    }
  }

  /** Closed four-sided frond, thick enough to read from below without alpha or two-sided cards. */
  leaf(
    root: Point,
    angle: number,
    reach: number,
    rise: number,
    width: number,
    hex: string,
    coarse: boolean,
  ): void {
    const tip: Point = [
      root[0] + Math.cos(angle) * reach,
      root[1] + rise,
      root[2] + Math.sin(angle) * reach,
    ];
    const center: Point = [
      root[0] + Math.cos(angle) * reach * 0.48,
      root[1] + rise * 0.48 + Math.max(0.003, Math.min(reach * 0.12, width * 0.4)),
      root[2] + Math.sin(angle) * reach * 0.48,
    ];
    const left: Point = [
      center[0] - Math.sin(angle) * width,
      center[1],
      center[2] + Math.cos(angle) * width,
    ];
    const right: Point = [
      center[0] + Math.sin(angle) * width,
      center[1],
      center[2] - Math.cos(angle) * width,
    ];
    if (coarse) {
      this.triangle(root, tip, left, hex, 0.82);
      this.triangle(root, right, tip, hex, 0.82);
      this.triangle(root, left, right, hex);
      this.triangle(left, tip, right, hex);
    } else {
      const ridge: Point = [center[0], center[1] + Math.max(0.025, width * 0.2), center[2]];
      const below: Point = [center[0], center[1] - Math.max(0.02, width * 0.1), center[2]];
      for (const [a, b] of [
        [root, left],
        [left, tip],
        [tip, right],
        [right, root],
      ] as Array<[Point, Point]>) {
        this.triangle(a, b, ridge, hex);
        this.triangle(b, a, below, hex, 0.82);
      }
    }
  }

  /** Closed arched paddle leaf with an oval blade and a narrow stalk (banana/large herbs). */
  blade(
    root: Point,
    angle: number,
    reach: number,
    rise: number,
    width: number,
    hex: string,
    medium: boolean,
  ): void {
    const profile = medium
      ? [
          [0, 0.03],
          [0.55, 1],
          [1, 0.015],
        ]
      : [
          [0, 0.03],
          [0.18, 0.3],
          [0.4, 1],
          [0.65, 0.95],
          [0.87, 0.58],
          [1, 0.015],
        ];
    const rings = profile.map(([t = 0, w = 0]) => {
      const x = root[0] + Math.cos(angle) * reach * t,
        z = root[2] + Math.sin(angle) * reach * t;
      const y = root[1] + rise * t + reach * 0.2 * Math.sin(t * Math.PI);
      const thick = Math.max(0.004, width * w * 0.045);
      return [
        [x + Math.sin(angle) * width * w, y, z - Math.cos(angle) * width * w],
        [x, y + thick, z],
        [x - Math.sin(angle) * width * w, y, z + Math.cos(angle) * width * w],
        [x, y - thick, z],
      ] as Point[];
    });
    for (let i = 1; i < rings.length; i++) {
      const lower = rings[i - 1] as Point[],
        upper = rings[i] as Point[];
      for (let side = 0; side < 4; side++) {
        const a = lower[side] as Point,
          b = lower[(side + 1) % 4] as Point,
          c = upper[side] as Point,
          d = upper[(side + 1) % 4] as Point;
        this.triangle(a, b, c, hex, side < 2 ? 1 : 0.87);
        this.triangle(b, d, c, hex, side < 2 ? 1 : 0.87);
      }
    }
    const bottom = rings[0] as Point[],
      top = rings[rings.length - 1] as Point[];
    for (let i = 1; i < 3; i++) {
      this.triangle(bottom[0] as Point, bottom[i + 1] as Point, bottom[i] as Point, hex);
      this.triangle(top[0] as Point, top[i] as Point, top[i + 1] as Point, hex);
    }
  }

  finish(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/** Generated once per model/LOD and shared by all instances. */
export function createPlantGeometry(p: PlantPreset, detail: Detail = false): THREE.BufferGeometry {
  const seed = p.shapeSeed ?? 0;
  const mesh = new PlantMesh(seed);
  const vary = (value: number, amount: number, stream: number): number =>
    value * (seed ? 1 + (unit01(seed, stream) * 2 - 1) * amount : 1);
  const angleFor = (angle: number, index: number): number =>
    angle + (seed ? (unit01(seed, index + 80) * 2 - 1) * 0.42 : 0);
  const h = p.height,
    r = p.width / 2,
    base = p.crownBase * h;
  const far = detail === 'distant',
    medium = detail === true;
  const ground = ['grass', 'fern', 'reed', 'forb', 'vine', 'mat', 'crop'].includes(p.family);
  if (ground && detail !== false) return mesh.finish();
  const trunkTop: Point = [p.lean * h, base, 0];
  const trunk = (top = trunkTop, radius = p.stemRadius): void => {
    mesh.tube(
      far ? [[0, 0, 0], top] : [[0, 0, 0], [top[0] * 0.3, top[1] * 0.5, 0], top],
      far ? [radius, radius * 0.42] : [radius, radius * 0.76, radius * 0.42],
      far ? 3 : medium ? 4 : 6,
      p.bark,
    );
  };

  if (addBrushGeometry(mesh, p, detail)) {
    // Patch families share the same normalization, materials and LOD cache as trees.
  } else if (p.leafless === true && (p.family === 'broadleaf' || p.family === 'conifer')) {
    const needle = p.family === 'conifer';
    const top = h * (needle ? 1 : 0.86);
    mesh.tube(
      [
        [0, 0, 0],
        [p.lean * h * 0.4, h * 0.4, 0],
        [p.lean * h, top, 0],
      ],
      [p.stemRadius, p.stemRadius * 0.6, p.stemRadius * 0.035],
      far ? 3 : medium ? 4 : 6,
      p.bark,
    );
    const count = far ? 2 : medium ? 4 : 9;
    for (let i = 0; i < count; i++) {
      const angle = angleFor(i * 2.39996, i);
      const y = h * (p.crownBase * 0.7 + (i / count) * (0.76 - p.crownBase * 0.7));
      const reach = r * (p.family === 'conifer' ? 1 - i / (count + 1) : 0.62 + (i % 3) * 0.18);
      const tip: Point = [
        p.lean * y + Math.cos(angle) * reach,
        needle ? Math.min(h * 0.97, y + h * 0.15) : h * (0.72 + (0.23 * i) / count),
        Math.sin(angle) * reach,
      ];
      mesh.tube(
        [[p.lean * y, y, 0], tip],
        [p.stemRadius * 0.35, p.stemRadius * 0.06],
        far || medium ? 3 : 4,
        p.bark,
      );
      if (!far) {
        for (const side of medium ? [1] : [-1, 1]) {
          const split: Point = [(tip[0] + p.lean * y) * 0.5, (tip[1] + y) * 0.5, tip[2] * 0.5];
          mesh.tube(
            [
              split,
              [
                split[0] + Math.cos(angle + side * 0.65) * reach * 0.55,
                tip[1] + h * 0.04,
                split[2] + Math.sin(angle + side * 0.65) * reach * 0.55,
              ],
            ],
            [p.stemRadius * 0.12, p.stemRadius * 0.018],
            3,
            p.bark,
          );
        }
      }
    }
  } else if (p.family === 'banana') {
    trunk([0, h * 0.72, 0], p.stemRadius);
    const count = far ? 3 : medium ? 5 : 8;
    for (let i = 0; i < count; i++) {
      const angle = angleFor(i * 2.39996, i);
      if (far)
        mesh.leaf(
          [0, h * (0.58 + 0.03 * (i % 4)), 0],
          angle,
          r * (0.72 + 0.14 * (i % 3)),
          h * (0.22 - 0.085 * (i % 4)),
          r * 0.22,
          p.foliage,
          true,
        );
      else
        mesh.blade(
          [0, h * (0.53 + 0.04 * (i % 4)), 0],
          angle,
          vary(r * (0.75 + 0.12 * (i % 3)), 0.16, i),
          h * (0.24 - 0.1 * (i % 4)),
          r * 0.25,
          p.foliage,
          medium,
        );
    }
  } else if (p.family === 'palm') {
    trunk([p.lean * h, h * 0.78, 0]);
    const leaves = far ? 3 : 8;
    for (let i = 0; i < leaves; i++) {
      const angle = angleFor((i * TAU) / leaves + Math.sin(i * 2.4) * 0.1, i);
      const root: Point = [p.lean * h, h * 0.78, 0];
      const reach = vary(r * (0.8 + (0.2 * (i % 3)) / 2), 0.16, i);
      const rise = vary(r * (0.6 - 0.4 * (i % 4)), 0.2, i + 12);
      if (!medium && !far && p.form === 'feather') {
        mesh.leaf(root, angle, reach, rise, r * 0.11, p.foliage, true);
        const arch = reach * 0.16;
        mesh.tube(
          [
            root,
            [
              root[0] + Math.cos(angle) * reach * 0.5,
              root[1] + rise * 0.5 + arch,
              root[2] + Math.sin(angle) * reach * 0.5,
            ],
            [root[0] + Math.cos(angle) * reach, root[1] + rise, root[2] + Math.sin(angle) * reach],
          ],
          [r * 0.015, r * 0.01, r * 0.002],
          3,
          p.foliage,
        );
        for (let j = 1; j <= 4; j++) {
          const t = j / 5;
          const at: Point = [
            root[0] + Math.cos(angle) * reach * t,
            root[1] + rise * t + (t < 0.5 ? t * 2 : (1 - t) * 2) * arch,
            root[2] + Math.sin(angle) * reach * t,
          ];
          for (const side of [-1, 1])
            mesh.leaf(
              at,
              angle + side * 1.12,
              reach * 0.5 * (1 - t * 0.55),
              -reach * 0.09,
              r * 0.09,
              p.foliage,
              true,
            );
        }
      } else
        mesh.leaf(root, angle, reach, rise, r * (p.form === 'fan' ? 0.29 : 0.1), p.foliage, far);
    }
  } else if (p.family === 'cactus') {
    const radius = p.form === 'round' ? r : p.stemRadius;
    mesh.tube(
      [
        [0, 0, 0],
        [0, h * 0.9, 0],
        [0, h * 0.97, 0],
        [0, h, 0],
      ],
      [radius, radius * 0.94, radius * 0.65, radius * 0.08],
      far ? 3 : medium ? 4 : 10,
      p.foliage,
    );
    if (p.form === 'branching')
      for (let i = 0; i < (far ? 2 : 3); i++) {
        const angle = angleFor(i * 2.5, i),
          reach = r * (i === 0 ? 0.8 : 0.65),
          y = vary(h * (0.35 + i * 0.14), 0.12, i);
        const end = y + h * (0.34 - i * 0.035);
        if (far) {
          mesh.tube(
            [
              [0, y, 0],
              [Math.cos(angle) * reach, y + h * 0.08, Math.sin(angle) * reach],
              [Math.cos(angle) * reach, end, Math.sin(angle) * reach],
            ],
            [radius * 0.65, radius * 0.61, radius * 0.3],
            3,
            p.foliage,
          );
          continue;
        }
        mesh.tube(
          [
            [0, y, 0],
            [Math.cos(angle) * reach * 0.85, y + h * 0.02, Math.sin(angle) * reach * 0.85],
            [Math.cos(angle) * reach, y + h * 0.09, Math.sin(angle) * reach],
            [Math.cos(angle) * reach, end, Math.sin(angle) * reach],
            [Math.cos(angle) * reach, end + radius * 0.45, Math.sin(angle) * reach],
          ],
          [radius * 0.65, radius * 0.65, radius * 0.61, radius * 0.5, radius * 0.1],
          medium ? 3 : 6,
          p.foliage,
        );
      }
    if (p.form === 'paddle')
      for (let i = 0; i < (far ? 2 : 5); i++)
        mesh.crown(
          [Math.cos(i * 2.4) * r * 0.5, h * (0.3 + i * 0.13), Math.sin(i * 2.4) * r * 0.5],
          [r * 0.55, h * 0.45, r * 0.15],
          p.foliage,
          far ? 3 : medium ? 4 : 6,
          i,
        );
  } else if (p.family === 'fern') {
    for (let i = 0; i < 3; i++) {
      const angle = angleFor((i * TAU) / 3, i);
      const root: Point = [0, 0.16, 0];
      mesh.leaf(root, angle, r, h * 0.62, r * 0.025, p.foliage, true);
      for (const t of [0.3, 0.6]) {
        const at: Point = [Math.cos(angle) * r * t, 0.16 + h * 0.62 * t, Math.sin(angle) * r * t];
        for (const side of [-1, 1])
          mesh.leaf(
            at,
            angle + side * 0.9,
            vary(r * (0.65 - t * 0.3), 0.18, i),
            h * 0.12,
            r * 0.1,
            p.foliage,
            true,
          );
      }
    }
  } else if (p.family === 'succulent' || ground) {
    const leaves = p.family === 'succulent' ? (far ? 3 : medium ? 7 : 12) : 7;
    for (let i = 0; i < leaves; i++) {
      const angle = angleFor(i * 2.39996, i),
        spread = vary((0.45 + (i % 3) * 0.27) * r, 0.18, i);
      mesh.leaf(
        [Math.cos(angle) * r * 0.08, 0.16, Math.sin(angle) * r * 0.08],
        angle,
        spread,
        h * (0.55 + (i % 3) * 0.22),
        r * (p.family === 'succulent' ? 0.18 : 0.045),
        p.foliage,
        far,
      );
    }
  } else if (p.family === 'bamboo') {
    const stems = far ? 2 : medium ? 3 : 5;
    for (let i = 0; i < stems; i++) {
      const angle = angleFor(i * 2.4, i),
        x = Math.cos(angle) * r * 0.3,
        z = Math.sin(angle) * r * 0.3;
      const top = h * (0.7 + (0.3 * (i + 1)) / stems);
      mesh.tube(
        [
          [x, 0, z],
          [x + h * 0.035, top, z],
        ],
        [p.stemRadius, p.stemRadius * 0.65],
        far ? 3 : 5,
        p.bark,
      );
      if (far) mesh.crown([x, top * 0.82, z], [r * 0.5, h * 0.3, r * 0.35], p.foliage, 3, i);
      else
        for (let j = 0; j < (medium ? 2 : 3); j++) {
          const y = top * (0.42 + j * (medium ? 0.35 : 0.22));
          const at: Point = [x + (h * 0.035 * y) / top, y, z];
          if (!medium && j < 2)
            mesh.tube(
              [
                [at[0], y - 0.025, z],
                [at[0], y + 0.025, z],
              ],
              [p.stemRadius * 1.25, p.stemRadius * 1.25],
              3,
              '#bbc18e',
            );
          for (let leaf = 0; leaf < 3; leaf++)
            mesh.leaf(
              at,
              angle + j * 1.7 + leaf * 0.65,
              r * (0.42 + leaf * 0.13),
              h * (0.015 - leaf * 0.023),
              r * 0.08,
              p.foliage,
              true,
            );
        }
      if (!far && !medium)
        for (let leaf = 0; leaf < 3; leaf++)
          mesh.leaf(
            [x + h * 0.035, top * 0.97, z],
            angle + leaf * 1.4,
            r * 0.38,
            -h * 0.025,
            r * 0.08,
            p.foliage,
            true,
          );
    }
  } else if (p.family === 'deadwood') {
    mesh.tube(
      [
        [0, 0, 0],
        [h * p.lean, h, 0],
      ],
      [p.stemRadius, p.stemRadius * 0.5],
      far ? 3 : medium ? 5 : 8,
      p.bark,
    );
    if (!far)
      for (let i = 0; i < 3; i++) {
        const y = h * (0.35 + i * 0.2),
          angle = angleFor(i * 2.4, i);
        mesh.tube(
          [
            [y * p.lean, y, 0],
            [y * p.lean + Math.cos(angle) * r, y + h * 0.15, Math.sin(angle) * r],
          ],
          [p.stemRadius * 0.35, 0.025],
          medium ? 3 : 5,
          p.bark,
        );
      }
  } else if (p.family === 'conifer') {
    if (!far) trunk([p.lean * h * 0.5, h * 0.55, 0]);
    const profile = far
      ? [
          [base, r],
          [h, 0.005],
        ]
      : [
          [base, r * 0.7],
          [base + (h - base) * 0.08, r],
          [base + (h - base) * 0.25, r * 0.72],
          [base + (h - base) * 0.34, r * 0.78],
          [base + (h - base) * 0.55, r * 0.46],
          [base + (h - base) * 0.65, r * 0.5],
          [base + (h - base) * 0.82, r * 0.24],
          [h, 0.005],
        ];
    mesh.tube(
      profile.map(([y = 0]): Point => [p.lean * y, y, 0]),
      profile.map(([, radius = 0]) => radius),
      far ? 5 : medium ? 6 : 10,
      p.foliage,
      far ? 0 : 0.12,
    );
  } else {
    const canopyHeight = h - base;
    if (far)
      mesh.crown(
        [p.lean * h, base + canopyHeight / 2, 0],
        [r, canopyHeight, r * 0.94],
        p.foliage,
        5,
        1,
      );
    else {
      trunk();
      const lobes = medium ? 3 : p.climber ? 4 : 5;
      for (let i = 0; i < lobes; i++) {
        const angle = angleFor(i * 2.4, i),
          x = p.lean * h + Math.cos(angle) * r * 0.42,
          z = Math.sin(angle) * r * 0.42;
        const y = base + vary(canopyHeight * (0.45 + (i % 3) * 0.09), 0.15, i);
        const branchBase = base * (0.55 + (i % 3) * 0.06);
        mesh.tube(
          [
            [p.lean * h * 0.3, branchBase, 0],
            [x, y, z],
          ],
          [p.stemRadius * 0.48, p.stemRadius * 0.18],
          medium ? 3 : 4,
          p.bark,
        );
        mesh.crown(
          [x, y, z],
          [r * 0.64, canopyHeight * 0.85, r * 0.62],
          p.foliage,
          medium ? 5 : 8,
          i,
        );
      }
      if (p.family === 'mangrove')
        for (let i = 0; i < (medium ? 3 : 5); i++) {
          const angle = angleFor(i * 2.4, i);
          mesh.tube(
            [
              [0, base * 0.45, 0],
              [Math.cos(angle) * r * 0.55, 0, Math.sin(angle) * r * 0.55],
            ],
            [p.stemRadius * 0.45, p.stemRadius * 0.25],
            3,
            p.bark,
          );
        }
    }
  }
  if (!far && !medium && !p.leafless) addClimberGeometry(mesh, p);
  const geometry = mesh.finish();
  const box = geometry.boundingBox as THREE.Box3;
  const size = box.getSize(new THREE.Vector3());
  geometry.translate(0, -box.min.y, 0);
  geometry.scale(
    p.width / Math.max(size.x, size.z, 0.001),
    p.height / Math.max(size.y, 0.001),
    p.width / Math.max(size.x, size.z, 0.001),
  );
  if (ground) geometry.translate(0, 0.15, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
