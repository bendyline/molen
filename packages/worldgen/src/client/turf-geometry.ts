/**
 * A tuft of grass: pointed blades fanned from one root, for the turf a host stands round its
 * camera (`./turf`). One unit tall and about one unit from root to the farthest tip (the far
 * level a little more), so an instance's scale is its height and its spread in meters.
 *
 * Three levels, because a blade is a finger wide and a tuft is seen from an arm's length to the
 * far side of a field. Near, a tuft is two dozen narrow blades, each bent once so it arches;
 * past a few meters, fourteen straight ones; and far out, where a tuft is a few pixels, seven
 * broad ones that hold its outline. Narrow blades far away would cover less than a pixel each
 * and shimmer; broad ones up close read as an agave, not as grass.
 *
 * A blade is flat and drawn from both sides, as two faces with one normal: the scatter material
 * culls back faces, and a blade lit by its facet would flash dark and bright with every turn of
 * the camera. The normals lean a little out from straight up instead, so a tuft takes the light
 * as the ground under it does, with a lit side and a shaded one. The colors run from under the
 * ground's own tone at the root to a paler, greener tip (an instance's color is that ground
 * tone): seen from above a sward is lighter than the soil between its tufts, and that is most
 * of what makes it read as grass and not as marks on the ground.
 *
 * The scatter material shades a plant by its height, half its color at the base: right for a
 * crown standing in its own shade, and far too dark for a blade a hand tall lying open to the
 * sky. So every vertex here carries the canopy value of a plant's top, and the blade's own
 * colors do the shading.
 */
import * as THREE from 'three';
import { unit01 } from '../kernel/seed';
import { SCATTER_CANOPY_ATTRIBUTE } from './scatter-material';

type Point = [number, number, number];

/** Which tuft: 0 the near one, 1 the one past a few meters, 2 the far one. */
export type TuftLevel = 0 | 1 | 2;

interface Level {
  blades: number;
  /** A blade's width at its root, as a share of the tuft's spread. */
  width: number;
  /** Bent once (three faces a side) or straight (one). */
  bent: boolean;
  /** How far the blades reach, against the near tuft's. */
  spread: number;
  /** Linear tone at the root and at the tip, times the instance's color. */
  root: Point;
  tip: Point;
}

/**
 * The far levels' blades are one face from root to tip, most of it near the root, so their roots
 * are lighter: at the near tuft's root tone a sward seen from the air was darker than its ground.
 * Their tips are paler too, and the far tuft reaches a little wider: a tuft a few pixels across
 * shows as its tips or not at all, where the same contrast an arm's length away is straw.
 */
const LEVELS: readonly [Level, Level, Level] = [
  {
    blades: 22,
    width: 0.055,
    bent: true,
    spread: 1,
    root: [0.7, 0.72, 0.7],
    tip: [1.3, 1.38, 0.98],
  },
  {
    blades: 14,
    width: 0.09,
    bent: false,
    spread: 1,
    root: [0.86, 0.88, 0.85],
    tip: [1.44, 1.5, 1.02],
  },
  {
    blades: 7,
    width: 0.18,
    bent: false,
    spread: 1.2,
    root: [0.92, 0.94, 0.9],
    tip: [1.58, 1.6, 1.06],
  },
];
/** How far below the ground a blade starts, as a share of the tuft's height: no root shows on a slope. */
const ROOT_DEPTH = 0.12;
/** How far a blade's normal leans out from straight up. */
const NORMAL_LEAN = 0.4;
/** The scatter material's canopy value for the top of a plant: no shade of its own. */
const OPEN_CANOPY = 2;
const GOLDEN_TURN = 2.39996;
const SEED = 4177;

/**
 * A tuft's geometry at a level (see `TuftLevel`): 132, 28 and 14 triangles. Position, normal,
 * color and the scatter material's canopy value; a library adds its atlas coordinate.
 */
export function createTuftGeometry(level: TuftLevel): THREE.BufferGeometry {
  const { blades, width, bent, spread, root: rootTone, tip: tipTone } = LEVELS[level];
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const tone = (t: number): Point => [
    rootTone[0] + (tipTone[0] - rootTone[0]) * t,
    rootTone[1] + (tipTone[1] - rootTone[1]) * t,
    rootTone[2] + (tipTone[2] - rootTone[2]) * t,
  ];
  for (let i = 0; i < blades; i++) {
    const angle = i * GOLDEN_TURN + (unit01(SEED, i) - 0.5) * 0.9;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    // The first blades stand tall near the middle; later ones are shorter and lean out farther.
    const order = blades > 1 ? i / (blades - 1) : 0;
    const length = 1 - 0.55 * order * (0.55 + 0.45 * unit01(SEED, i + 20));
    const reach = (0.12 + 0.78 * order) * (0.7 + 0.3 * unit01(SEED, i + 40)) * spread;
    const half = (width * (0.8 + 0.4 * unit01(SEED, i + 60)) * spread) / 2;
    const out = (0.03 + 0.09 * unit01(SEED, i + 80)) * (0.4 + 0.6 * order);
    const root: Point = [cos * out, -ROOT_DEPTH, sin * out];
    const tip: Point = [cos * (out + reach), length, sin * (out + reach)];
    const side = (at: Point, across: number, sign: number): Point => [
      at[0] - sin * across * sign,
      at[1],
      at[2] + cos * across * sign,
    ];
    const normal = new THREE.Vector3(cos * NORMAL_LEAN, 1, sin * NORMAL_LEAN).normalize();
    const face = (a: Point, b: Point, c: Point, ta: number, tb: number, tc: number): void => {
      // Front and back: the same three corners wound each way.
      for (const [p, q, r, tp, tq, tr] of [
        [a, b, c, ta, tb, tc],
        [a, c, b, ta, tc, tb],
      ] as Array<[Point, Point, Point, number, number, number]>) {
        positions.push(...p, ...q, ...r);
        colors.push(...tone(tp), ...tone(tq), ...tone(tr));
        for (let k = 0; k < 3; k++) normals.push(normal.x, normal.y, normal.z);
      }
    };
    const rootLeft = side(root, half, 1),
      rootRight = side(root, half, -1);
    if (!bent) {
      face(rootLeft, rootRight, tip, 0, 0, 1);
      continue;
    }
    // Up most of its height before it leans out: a blade arches, it does not slant.
    const bendAt = 0.6;
    const bend: Point = [
      cos * (out + reach * 0.28),
      -ROOT_DEPTH + (length + ROOT_DEPTH) * bendAt,
      sin * (out + reach * 0.28),
    ];
    const bendLeft = side(bend, half * 0.75, 1),
      bendRight = side(bend, half * 0.75, -1);
    face(rootLeft, rootRight, bendRight, 0, 0, bendAt);
    face(rootLeft, bendRight, bendLeft, 0, bendAt, bendAt);
    face(bendLeft, bendRight, tip, bendAt, bendAt, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute(
    SCATTER_CANOPY_ATTRIBUTE,
    new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3).fill(OPEN_CANOPY), 1),
  );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
