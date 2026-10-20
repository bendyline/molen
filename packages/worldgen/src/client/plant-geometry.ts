/**
 * Faceted plant families with bounded geometry and independent near/medium/far meshes. Broadleaf
 * crowns are leaf cards around a solid core up close; everything else is closed and opaque.
 */
import * as THREE from 'three';
import type { PlantPreset } from '../kernel/plant-types';
import { unit01 } from '../kernel/seed';
import { addBrushGeometry, addClimberGeometry } from './brush-geometry';
import {
  SCATTER_CARD_FILL,
  SCATTER_CARD_UVS,
  SCATTER_SOLID_UV,
  SCATTER_SPRAY_UVS,
} from './scatter-material';

type Point = [number, number, number];
type Detail = boolean | 'distant';
const TAU = Math.PI * 2;

/** Share of a foliage normal taken from its volume's rounded surface rather than its facet. */
const FOLIAGE_BEND = 0.65;

const SCRATCH = new THREE.Vector3();

/** Leaf cards' color gain, offsetting the leaf atlas's average tone below white. */
const CARD_GAIN = 1.24;

class PlantMesh {
  constructor(private readonly seed = 0) {}
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly uvs: number[] = [];
  /** What can be seen of the plant: every solid point, and each card's leaves but not its corners. */
  readonly extent = new THREE.Box3();
  private readonly colorCache = new Map<string, THREE.Color>();
  /** Foliage vertex ranges, each shaded as one rounded volume (an ellipsoid) over its facets. */
  private readonly volumes: {
    start: number;
    end: number;
    center: Point;
    size: Point;
    bend: number;
  }[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  /** Shade everything appended since `start` as a soft mass of foliage centered on `center`. */
  /**
   * Bend the normals of vertices from `start` on toward an ellipsoid. Volumes apply in order, so
   * a lobe can keep a little of its own roundness under the canopy registered after it.
   */
  volume(start: number, center: Point, size: Point, bend = FOLIAGE_BEND): void {
    if (this.vertexCount > start)
      this.volumes.push({ start, end: this.vertexCount, center, size, bend });
  }

  /** The canopy a set of lobes belongs to: the vertex range of every lobe crown built since. */
  canopy(ranges: readonly [number, number][], center: Point, size: Point, bend: number): void {
    for (const [start, end] of ranges) this.volumes.push({ start, end, center, size, bend });
  }

  private color(hex: string): THREE.Color {
    let color = this.colorCache.get(hex);
    if (color === undefined) {
      color = new THREE.Color(hex);
      this.colorCache.set(hex, color);
    }
    return color;
  }

  /** One triangle; `shade` is one value for the face or one per vertex. */
  triangle(
    a: Point,
    b: Point,
    c: Point,
    hex: string,
    shade: number | readonly [number, number, number] = 1,
  ): void {
    const color = this.color(hex);
    for (const [i, point] of [a, b, c].entries()) {
      const k = typeof shade === 'number' ? shade : (shade[i] as number);
      this.positions.push(...point);
      this.colors.push(color.r * k, color.g * k, color.b * k);
      this.uvs.push(...SCATTER_SOLID_UV);
      this.extent.expandByPoint(SCRATCH.set(...point));
    }
  }

  /**
   * A leaf card: a quad the atlas cuts out along a sprig of leaves, with a face either way so
   * back-face culling keeps the one toward the camera. `across` and `up` are its half extents;
   * `turn` quarter-turns the sprig so neighboring cards do not repeat it. Its lower edge takes
   * `shade[0]` and its upper edge `shade[1]`. A bough card passes the fir spray's `uvs`, root
   * along its lower edge, and the share of the card the spray `fill`s.
   */
  card(
    center: Point,
    across: Point,
    up: Point,
    hex: string,
    shade: readonly [number, number],
    turn: number,
    uvs: readonly (readonly [number, number])[] = SCATTER_CARD_UVS,
    fill = SCATTER_CARD_FILL,
  ): void {
    const color = this.color(hex);
    // The sprig is a disc in the card's plane; along each axis it reaches this far.
    const reach = new THREE.Vector3(
      Math.hypot(across[0], up[0]),
      Math.hypot(across[1], up[1]),
      Math.hypot(across[2], up[2]),
    ).multiplyScalar(fill);
    const middle = new THREE.Vector3(...center);
    this.extent.expandByPoint(middle.clone().sub(reach)).expandByPoint(middle.add(reach));
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(
      ([a = 0, b = 0]): Point => [
        center[0] + across[0] * a + up[0] * b,
        center[1] + across[1] * a + up[1] * b,
        center[2] + across[2] * a + up[2] * b,
      ],
    );
    for (const corner of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) {
      const k = (corner < 2 ? shade[0] : shade[1]) * CARD_GAIN;
      this.positions.push(...(corners[corner] as Point));
      this.colors.push(color.r * k, color.g * k, color.b * k);
      this.uvs.push(...(uvs[(corner + turn) % 4] as readonly [number, number]));
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
        // One shade per ring band: alternating shades per side striped a cone into facets.
        const shade = 0.78 + (0.2 * ring) / (rings.length - 1);
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
  crown(
    center: Point,
    size: Point,
    hex: string,
    sides: number,
    phase: number,
    bend = FOLIAGE_BEND,
    tone = 1,
  ): [number, number] {
    const start = this.vertexCount;
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
    // Close up the outline also ripples ring by ring, so a crown reads as clustered foliage
    // rather than a lathe-turned solid; near lobes get a lumpy, irregular outline the same way.
    const ripple = sides >= 10 ? 0.08 : 0;
    const lumps = sides >= 6 ? 0.13 : 0;
    const rings = profiles.map(([y = 0, radius = 0], ring) =>
      Array.from({ length: sides }, (_, i): Point => {
        const angle = (i * TAU) / sides;
        const r =
          radius *
          (1 + 0.12 * Math.sin(angle * 3 + phase)) *
          (1 + ripple * Math.sin(angle * 2 + ring * 2.1 + phase * 1.7)) *
          (1 + lumps * Math.sin(i * 2.7 + ring * 4.3 + phase * 5.1));
        return [
          center[0] + Math.cos(angle) * size[0] * r,
          center[1] + (y - 0.5) * size[1],
          center[2] + Math.sin(angle) * size[2] * r,
        ];
      }),
    );
    const bottom: Point = [center[0], center[1] - size[1] / 2, center[2]];
    const top: Point = [center[0] + size[0] * 0.06, center[1] + size[1] / 2, center[2]];
    // Shade runs smoothly from the crown's shaded underside to its sunlit top, ring by ring, so
    // a lobe reads as one soft puff rather than banded facets.
    const ringShade = (j: number): number => (0.8 + (0.17 * (j + 1)) / (rings.length + 1)) * tone;
    const low = 0.72 * tone,
      high = tone;
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const first = ringShade(0);
      this.triangle(
        bottom,
        (rings[0] as Point[])[i] as Point,
        (rings[0] as Point[])[next] as Point,
        hex,
        [low, first, first],
      );
      for (let j = 1; j < rings.length; j++) {
        const a = rings[j - 1] as Point[],
          b = rings[j] as Point[];
        const below = ringShade(j - 1),
          above = ringShade(j);
        this.triangle(a[i] as Point, b[i] as Point, a[next] as Point, hex, [below, above, below]);
        this.triangle(a[next] as Point, b[i] as Point, b[next] as Point, hex, [
          below,
          above,
          above,
        ]);
      }
      const last = rings[rings.length - 1] as Point[];
      const lastShade = ringShade(rings.length - 1);
      this.triangle(last[i] as Point, top, last[next] as Point, hex, [lastShade, high, lastShade]);
    }
    this.volume(start, center, [size[0], size[1] / 2, size[2]], bend);
    return [start, this.vertexCount];
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
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.computeVertexNormals();
    // Foliage facets catch the sun like cut gems; bend their normals toward the rounded volume
    // they belong to, so a crown shades as one soft mass with a hint of its facets left.
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const facet = new THREE.Vector3();
    const round = new THREE.Vector3();
    for (const { start, end, center, size, bend } of this.volumes)
      for (let i = start; i < end; i++) {
        round
          .set(
            ((this.positions[i * 3] ?? 0) - center[0]) / (size[0] * size[0] || 1),
            ((this.positions[i * 3 + 1] ?? 0) - center[1]) / (size[1] * size[1] || 1),
            ((this.positions[i * 3 + 2] ?? 0) - center[2]) / (size[2] * size[2] || 1),
          )
          .normalize();
        facet
          .fromBufferAttribute(normal, i)
          .multiplyScalar(1 - bend)
          .addScaledVector(round, bend)
          .normalize();
        normal.setXYZ(i, facet.x, facet.y, facet.z);
      }
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
  // Understory shrubs project to a pixel or two by the distance their far level would take
  // over, yet drew one batch per species in every distant batch; the ground color carries them.
  if (far && h < 2.5) return mesh.finish();
  const trunkTop: Point = [p.lean * h, base, 0];
  const trunk = (top = trunkTop, radius = p.stemRadius, sides = far ? 3 : medium ? 4 : 6): void => {
    mesh.tube(
      far ? [[0, 0, 0], top] : [[0, 0, 0], [top[0] * 0.3, top[1] * 0.5, 0], top],
      far ? [radius, radius * 0.42] : [radius, radius * 0.76, radius * 0.42],
      sides,
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
    // A medium tree's trunk mostly hides under its skirts; its triangles go to boughs instead.
    if (!far) trunk([p.lean * h * 0.5, h * 0.55, 0], p.stemRadius, medium ? 3 : 6);
    const span = h - base;
    // Stacked, drooping bough tiers: each skirt flares out over the narrower top of the one
    // below, so the tree reads as a fir or cedar rather than a smooth cone. The medium tree
    // keeps all but the small top skirt.
    const skirts = [
      [0.08, 1],
      [0.27, 0.84],
      [0.48, 0.66],
      [0.68, 0.48],
      [0.86, 0.28],
    ].slice(0, medium ? 4 : 5) as [number, number][];
    // The narrow neck above each skirt; the top skirt's is the tree's tip.
    const necks = [
      [0.22, 0.62],
      [0.43, 0.48],
      [0.63, 0.34],
      [0.82, 0.2],
      [1, 0],
    ];
    const profile = far
      ? [
          [base, r],
          [h, 0.005],
        ]
      : [
          [base, r * 0.55],
          ...skirts.flatMap(([at, radius], i) => {
            const [neck = 0, narrow = 0] = necks[i - 1] ?? [];
            return [
              ...(i > 0 ? [[base + span * neck, r * narrow]] : []),
              [base + span * at, r * radius],
            ];
          }),
          [h, 0.005],
        ];
    const start = mesh.vertexCount;
    mesh.tube(
      profile.map(([y = 0]): Point => [p.lean * y, y, 0]),
      profile.map(([, radius = 0]) => radius),
      far ? 5 : medium ? 5 : 12,
      far ? p.foliage : `#${new THREE.Color(p.foliage).multiplyScalar(0.86).getHexString()}`,
      far ? 0 : 0.12,
    );
    // Bough cards: fir sprays laid along each skirt from its neck down past its rim, so the
    // skirt shows needles and its edge is feathered rather than cut in facets.
    if (!far)
      for (const [j, [at, radius]] of skirts.entries()) {
        const count = medium ? (j < 2 ? 3 : 2) : ([10, 9, 8, 6, 4][j] as number);
        const [neck = 0, narrow = 0] = necks[j] ?? [];
        const rim = r * radius,
          inner = r * narrow * 0.9;
        const rimY = base + span * at,
          neckY = base + span * neck;
        for (let i = 0; i < count; i++) {
          const angle = angleFor(((i + 0.5 * j) * Math.PI * 2) / count, j * 9 + i + 20);
          const c = Math.cos(angle),
            sn = Math.sin(angle);
          // Along the skirt's slope, from just under its neck to a fifth past its rim, and a
          // little proud of it.
          const outward = 0.05 * rim;
          const at0 = (radius: number, y: number): Point => [
            p.lean * y + c * (radius + outward),
            y,
            sn * (radius + outward),
          ];
          const root = at0(inner, neckY - 0.1 * (neckY - rimY));
          const tip = at0(rim + 0.22 * (rim - inner), rimY - 0.22 * (neckY - rimY));
          const half: Point = [
            (tip[0] - root[0]) / 2,
            (tip[1] - root[1]) / 2,
            (tip[2] - root[2]) / 2,
          ];
          const width = Math.max(
            Math.hypot(...half) * 1.4,
            ((Math.PI * 2 * (rim + inner)) / 2 / count) * 1.35,
          );
          const tone = 0.92 + 0.18 * (seed ? unit01(seed, 300 + j * 9 + i) : (i * 0.618) % 1);
          mesh.card(
            [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2],
            [(-sn * width) / 2, 0, (c * width) / 2],
            half,
            p.foliage,
            [tone * 0.72, tone],
            0,
            SCATTER_SPRAY_UVS,
            0.95,
          );
        }
      }
    // Centered low in the cone, so its upper boughs face the sky and its skirt the ground.
    const middle = base + span * 0.3;
    mesh.volume(start, [p.lean * middle, middle, 0], [r, span * 0.7, r]);
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
      // Leaf clusters spread over the canopy's shell, each a few crossed leaf cards around one
      // point, so the silhouette breaks into sprigs of leaves; mangroves spend their medium
      // budget on prop roots and keep three clusters there. A solid core in the crown's own
      // shade keeps the crown from reading as see-through. The normals bend mostly toward the
      // shared canopy, so it shades as one mass.
      const ranges: [number, number][] = [
        mesh.crown(
          [p.lean * h, base + canopyHeight * 0.5, 0],
          [r * 0.56, canopyHeight * 0.66, r * 0.54],
          p.foliage,
          medium ? 5 : 6,
          0,
          0.7,
          0.66,
        ),
      ];
      const clusters = medium ? (p.family === 'mangrove' ? 3 : 6) : p.climber ? 14 : 20;
      const limbs = medium ? 2 : 5;
      const random = (stream: number, fallback: number): number =>
        seed ? unit01(seed, stream) : fallback % 1;
      for (let i = 0; i < clusters; i++) {
        // A golden-angle spiral from the crown top down its sides.
        const t = clusters > 1 ? i / (clusters - 1) : 0;
        const height = 0.9 - 0.58 * t;
        const shell = Math.sin(Math.PI * Math.min(0.95, 0.22 + 0.78 * t)) * (medium ? 0.55 : 0.64);
        const angle = angleFor(i * 2.39996, i),
          x = p.lean * h + Math.cos(angle) * r * shell,
          z = Math.sin(angle) * r * shell;
        const y = base + vary(canopyHeight * height, 0.08, i);
        if (i < limbs) {
          const branchBase = base * (0.55 + (i % 3) * 0.06);
          mesh.tube(
            [
              [p.lean * h * 0.3, branchBase, 0],
              [x * 0.8, base + (y - base) * 0.7, z * 0.8],
            ],
            [p.stemRadius * 0.48, p.stemRadius * 0.18],
            medium ? 3 : 4,
            p.bark,
          );
        }
        // Each cluster catches the light a little differently, so the canopy reads as clumps
        // of leaves rather than one swatch.
        const tone = 0.86 + 0.22 * random(70 + i, i * 0.618);
        const reach = r * (medium ? 0.62 : 0.46 + 0.08 * ((i * 0.43) % 1));
        const tall = Math.min(reach * 1.15, Math.max(reach * 0.8, canopyHeight * 0.3));
        const start = mesh.vertexCount;
        const yaw = angle + random(100 + i, i * 0.37) * Math.PI;
        const upright = medium ? 2 : 3;
        for (let k = 0; k <= upright; k++) {
          const turn = k === upright ? 0.5 : (k * Math.PI) / upright;
          const a = yaw + turn;
          // The last card lies nearly flat, so the cluster has leaves seen from above too.
          const tilt =
            k === upright
              ? 1.25 + 0.2 * random(110 + i, i * 0.29)
              : (random(120 + i * 4 + k, i * 0.37 + k * 0.29) - 0.5) * 0.6;
          mesh.card(
            [x, y, z],
            [Math.cos(a) * reach, 0, Math.sin(a) * reach],
            [
              -Math.sin(a) * Math.sin(tilt) * tall,
              Math.cos(tilt) * tall,
              Math.cos(a) * Math.sin(tilt) * tall,
            ],
            p.foliage,
            [tone * 0.8, tone],
            (i + k) % 4,
          );
        }
        mesh.volume(start, [x, y, z], [reach, tall, reach], 0.5);
        ranges.push([start, mesh.vertexCount]);
      }
      const middle = base + canopyHeight * 0.55;
      mesh.canopy(ranges, [p.lean * h, middle, 0], [r, canopyHeight * 0.6, r], 0.6);
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
  // Sized by what can be seen, so a card's clear corners do not shrink the crown.
  const box = mesh.extent;
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
