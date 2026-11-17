import { pointInPolygon } from './geometry2d';
import { resolveInteriorProfile } from './interior-catalog';
import type { InteriorCatalogDoc, InteriorSite } from './interior-types';
import type { MeshBufferBuilder } from './mesh-buffers';
import { parseColor } from './schema-common';
import { hashString, unit01 } from './seed';
import type { RGB, Vec2, Vec3 } from './types';

/** One hinged leaf of a door, closed. */
export interface InteriorDoorLeaf {
  /** Foot of the hinge axis, in the site frame, midway through the leaf's thickness. */
  hinge: Vec3;
  /** Unit horizontal direction across the closed leaf, from the hinge to the latch edge. */
  along: Vec2;
  width: number;
}
/**
 * A door that closes a site's entrance. Data only: a host draws its leaves, swings them, and
 * decides when it opens. Leaves are drawn closed. Turning leaf `i` about a vertical axis through
 * its `hinge` by `swing[i]` radians (right-handed about +Y, as three.js's `rotation.y`) opens it
 * into the building, and by `-swing[i]` out of it.
 */
export interface InteriorDoor {
  /** `<site identity>#door<n>`, `n` counting the site's doors. Stable across regeneration. */
  id: string;
  /** Index of the doorway in `site.openings`. */
  opening: number;
  /** Middle of the threshold at floor height, in the site frame. */
  center: Vec3;
  /** Unit horizontal direction along the wall, from the opening's start to its end. */
  along: Vec2;
  /** Unit horizontal direction from the doorway into the building. */
  inward: Vec2;
  /** Clear width between the jambs. */
  width: number;
  /** Height of the leaves above the threshold; a fixed transom fills any opening above. */
  height: number;
  /** Top of the opening, absolute. */
  top: number;
  /** `panel`: a painted house door. `glazed`: a framed glass door, for shops and offices. */
  look: 'panel' | 'glazed';
  /** Paint of a panel door, or the frame of a glazed one. */
  color: string;
  /** Knob or pull. */
  hardware: string;
  /** A panel door with a glass light in its upper half. */
  light: boolean;
  /** Per leaf, the signed angle about +Y that opens it into the building. */
  swing: number[];
  leaves: InteriorDoorLeaf[];
}

/** Thickness of a leaf, and how far its outer face stands back from the wall plane. */
export const INTERIOR_DOOR_THICKNESS = 0.045;
const SET_BACK = 0.02;
/** Gap between a leaf and its jambs, threshold and neighbour. */
const GAP = 0.001;
/** How far a leaf turns when fully open: just short of square, clear of the jamb. */
export const INTERIOR_DOOR_OPEN_ANGLE: number = (88 * Math.PI) / 180;

// Front doors in the colors streets of houses actually wear: deep reds, navy, green, black, oiled
// wood, white and a few brighter accents. Shopfront doors are aluminium or bronze framed glass.
const HOUSE_PAINT = [
  '#7a2b27',
  '#1f2b3d',
  '#2f4a37',
  '#262626',
  '#6b4a2f',
  '#e6e1d4',
  '#3d5f6a',
  '#9a7a33',
  '#583045',
  '#8c8f86',
];
const SHOP_FRAME = ['#3a3530', '#a3a7a9', '#2a2a2a', '#5d5245'];
const GLASS = '#26333a';

/**
 * The doors that close a site's entrances. A car park's openings stay open for cars. Houses
 * (the `residential` layout) get painted panel doors, everything else framed glass; doorways
 * 1.8 m or wider take a pair of leaves.
 */
export function interiorDoors(site: InteriorSite, catalog: InteriorCatalogDoc): InteriorDoor[] {
  if (site.parking) return [];
  const house = resolveInteriorProfile(site.labels, catalog).algorithm === 'residential';
  const seed = hashString(site.identity);
  const doors: InteriorDoor[] = [];
  site.openings.forEach((opening, index) => {
    if (opening.kind !== 'door') return;
    const a = site.outline[opening.edge],
      b = site.outline[(opening.edge + 1) % site.outline.length];
    if (a === undefined || b === undefined) return;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const width = opening.end - opening.start;
    if (length <= 0 || width < 0.5) return;
    const along: Vec2 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    const middle = (opening.start + opening.end) / 2;
    const mid: Vec2 = [a[0] + along[0] * middle, a[1] + along[1] * middle];
    let inward: Vec2 = [-along[1], along[0]];
    if (
      !pointInPolygon(
        [mid[0] + inward[0] * 0.3, mid[1] + inward[1] * 0.3],
        site.outline,
        site.holes,
      )
    )
      inward = [along[1], -along[0]];
    const floor = site.floor;
    const room = opening.top - floor;
    // A house door is a door's height with a fanlight over it; a shop's is taller.
    const wanted = house ? 2.1 : 2.4;
    const height = (room - wanted > 0.14 ? wanted : room - GAP) - GAP;
    if (height < 1.6) return;
    const number = doors.length;
    const draw = (stream: number): number => unit01(seed, stream * 7 + number);
    const depth = SET_BACK + INTERIOR_DOOR_THICKNESS / 2;
    const at = (s: number): Vec3 => [
      a[0] + along[0] * s + inward[0] * depth,
      floor + GAP,
      a[1] + along[1] * s + inward[1] * depth,
    ];
    const reverse: Vec2 = [-along[0], -along[1]];
    const leaves: InteriorDoorLeaf[] =
      width >= 1.8
        ? [
            { hinge: at(opening.start + GAP), along, width: (width - 3 * GAP) / 2 },
            { hinge: at(opening.end - GAP), along: reverse, width: (width - 3 * GAP) / 2 },
          ]
        : draw(1) < 0.5
          ? [{ hinge: at(opening.start + GAP), along, width: width - 2 * GAP }]
          : [{ hinge: at(opening.end - GAP), along: reverse, width: width - 2 * GAP }];
    // A right-handed quarter turn about +Y takes (x, z) to (z, -x).
    const swing = leaves.map((leaf) =>
      leaf.along[1] * inward[0] - leaf.along[0] * inward[1] > 0
        ? INTERIOR_DOOR_OPEN_ANGLE
        : -INTERIOR_DOOR_OPEN_ANGLE,
    );
    const pick = (list: readonly string[], u: number): string =>
      list[Math.min(list.length - 1, Math.floor(u * list.length))] as string;
    doors.push({
      id: `${site.identity}#door${number}`,
      opening: index,
      center: [mid[0], floor, mid[1]],
      along,
      inward,
      width,
      height,
      top: opening.top,
      look: house ? 'panel' : 'glazed',
      color: house ? pick(HOUSE_PAINT, draw(2)) : pick(SHOP_FRAME, draw(2)),
      hardware: house ? (draw(3) < 0.6 ? '#b39046' : '#1e1e1e') : '#c4c8ca',
      light: house && draw(4) < 0.35,
      swing,
      leaves,
    });
  });
  return doors;
}

function shade(color: RGB, factor: number): RGB {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

/** Faces of a leaf in its own frame: `u` across from the hinge, `y` up, `t` inward from mid-leaf. */
class LeafFrame {
  constructor(
    private readonly leaf: InteriorDoorLeaf,
    private readonly inward: Vec2,
    private readonly out: MeshBufferBuilder,
  ) {}
  point(u: number, y: number, t: number): Vec3 {
    const { hinge, along } = this.leaf;
    return [
      hinge[0] + along[0] * u + this.inward[0] * t,
      hinge[1] + y,
      hinge[2] + along[1] * u + this.inward[1] * t,
    ];
  }
  /** A face rectangle at depth `t`, facing inward (`side` 1) or outward (`side` -1). */
  face(u0: number, u1: number, y0: number, y1: number, t: number, side: 1 | -1, color: RGB): void {
    this.out.addQuad(
      'trim',
      'palette:#ffffff',
      [this.point(u0, y0, t), this.point(u1, y0, t), this.point(u1, y1, t), this.point(u0, y1, t)],
      [this.inward[0] * side, 0, this.inward[1] * side],
      [
        [u0, y0],
        [u1, y0],
        [u1, y1],
        [u0, y1],
      ],
      color,
    );
  }
  /** A downward face at height `y`, spanning [u0, u1] × [t0, t1]. */
  underside(u0: number, u1: number, y: number, t0: number, t1: number, color: RGB): void {
    this.out.addQuad(
      'trim',
      'palette:#ffffff',
      [this.point(u0, y, t0), this.point(u1, y, t0), this.point(u1, y, t1), this.point(u0, y, t1)],
      [0, -1, 0],
      [
        [u0, t0],
        [u1, t0],
        [u1, t1],
        [u0, t1],
      ],
      color,
    );
  }
  /** A cuboid spanning [u0, u1] × [y0, y1] × [t0, t1]. */
  box(u0: number, u1: number, y0: number, y1: number, t0: number, t1: number, color: RGB): void {
    this.face(u0, u1, y0, y1, t1, 1, color);
    this.face(u0, u1, y0, y1, t0, -1, color);
    const { along } = this.leaf;
    for (const [u, sign] of [
      [u0, -1],
      [u1, 1],
    ] as const)
      this.out.addQuad(
        'trim',
        'palette:#ffffff',
        [
          this.point(u, y0, t0),
          this.point(u, y0, t1),
          this.point(u, y1, t1),
          this.point(u, y1, t0),
        ],
        [along[0] * sign, 0, along[1] * sign],
        [
          [t0, y0],
          [t1, y0],
          [t1, y1],
          [t0, y1],
        ],
        color,
      );
    for (const [y, sign] of [
      [y0, -1],
      [y1, 1],
    ] as const)
      this.out.addQuad(
        'trim',
        'palette:#ffffff',
        [
          this.point(u0, y, t0),
          this.point(u1, y, t0),
          this.point(u1, y, t1),
          this.point(u0, y, t1),
        ],
        [0, sign, 0],
        [
          [u0, t0],
          [u1, t0],
          [u1, t1],
          [u0, t1],
        ],
        color,
      );
  }
}

/**
 * One leaf of `door`, closed, into `out` (slot `trim`, material `palette:#ffffff`). Panels,
 * glass and hardware are on both faces. A host that swings the leaf rotates exactly the vertices
 * this call adds about the leaf's hinge.
 */
export function buildInteriorDoorLeaf(
  door: InteriorDoor,
  leafIndex: number,
  out: MeshBufferBuilder,
): void {
  const leaf = door.leaves[leafIndex];
  if (leaf === undefined) return;
  const frame = new LeafFrame(leaf, door.inward, out);
  const w = leaf.width,
    h = door.height,
    half = INTERIOR_DOOR_THICKNESS / 2;
  const paint = parseColor(door.color);
  const hardware = parseColor(door.hardware);
  const glass = parseColor(GLASS);
  frame.box(0, w, 0, h, -half, half, paint);
  // A region holds a hundred or more of these, built as its buildings arrive: hardware is one
  // cuboid through the leaf, showing on both faces, rather than a part per face.
  if (door.look === 'glazed') {
    // Narrow stiles and a deep kick rail round one pane, and a pull bar standing off both faces.
    for (const side of [1, -1] as const)
      frame.face(0.1, w - 0.1, 0.3, h - 0.11, side * (half + 0.004), side, glass);
    frame.box(w - 0.116, w - 0.084, 0.72, 1.42, -half - 0.08, half + 0.08, hardware);
    return;
  }
  for (const side of [1, -1] as const) {
    const t = side * (half + 0.004);
    // Four raised panels (two where the leaf is narrow); a light replaces the upper pair.
    const margin = Math.min(0.13, w * 0.14);
    const columns = w >= 0.75 ? 2 : 1;
    const mullion = 0.09;
    const span = (w - 2 * margin - (columns - 1) * mullion) / columns;
    const panel = shade(paint, 0.86);
    const rows: Array<[y0: number, y1: number, glazed: boolean]> = [
      [0.22, Math.min(0.95, h * 0.45), false],
      [Math.min(1.12, h * 0.53), h - 0.14, door.light],
    ];
    for (const [y0, y1, glazed] of rows) {
      if (glazed) {
        frame.face(margin, w - margin, y0, y1, t, side, glass);
        continue;
      }
      for (let column = 0; column < columns; column++) {
        const u0 = margin + column * (span + mullion);
        frame.face(u0, u0 + span, y0, y1, t, side, panel);
      }
    }
  }
  // A knob each side at the latch edge.
  frame.box(w - 0.103, w - 0.047, 0.92, 0.976, -half - 0.06, half + 0.06, hardware);
}

/**
 * The fixed parts round `door`'s leaves: a head rail and a glazed transom over them where the
 * opening is taller than the door. Adds nothing when the leaves fill the opening.
 */
export function buildInteriorDoorFrame(door: InteriorDoor, out: MeshBufferBuilder): void {
  const bottom = door.center[1] + GAP + door.height + GAP;
  const top = door.top;
  if (top - bottom < 0.1) return;
  const start: Vec3 = [
    door.center[0] - (door.along[0] * door.width) / 2,
    0,
    door.center[2] - (door.along[1] * door.width) / 2,
  ];
  const frame = new LeafFrame(
    {
      hinge: [
        start[0] + door.inward[0] * (SET_BACK + INTERIOR_DOOR_THICKNESS / 2),
        bottom,
        start[2] + door.inward[1] * (SET_BACK + INTERIOR_DOOR_THICKNESS / 2),
      ],
      along: door.along,
      width: door.width,
    },
    door.inward,
    out,
  );
  const half = INTERIOR_DOOR_THICKNESS / 2;
  const rail = door.look === 'panel' ? parseColor('#ebe7dc') : parseColor(door.color);
  const glass = parseColor(GLASS);
  const height = top - bottom;
  // Faces only: the rails' ends meet the jambs and the top meets the head of the opening.
  for (const side of [1, -1] as const) {
    frame.face(0, door.width, 0, 0.06, side * half, side, rail);
    frame.face(0, door.width, height - 0.04, height, side * half, side, rail);
    frame.face(0, door.width, 0.06, height - 0.04, side * half * 0.4, side, glass);
  }
  frame.underside(0, door.width, 0, -half, half, rail);
}
