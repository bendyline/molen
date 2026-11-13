/**
 * A mapped sports pitch is an outline with no sport. Its size and shape say which it is: a long
 * rectangle is a soccer or football field, a short one a tennis or basketball court, a quarter
 * circle a ball diamond. Each gets the ground and the line markings that make it recognizable.
 * The markings are the sport's standard layout fitted to the outline, not a survey of the field.
 */
import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  type TerrainLandcoverFeature,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  WEB_MERCATOR_EARTH_RADIUS_METERS,
} from '@bendyline/molen-terrain/kernel';
import type { Vec2 } from '@bendyline/molen-worldgen/kernel';
import type { TileGeometry } from './semantic-adapter';

/** Ground colors of the classes pitches add, for palettes that do not name them. */
export const SPORTS_COLORS: Readonly<Record<string, string>> = {
  sports_turf: '#7fa258',
  sports_court: '#6f8f7a',
  sports_blacktop: '#8f8e88',
  sports_dirt: '#b08a62',
  sports_line: '#eee9d4',
};

type Kind = keyof typeof SPORTS_COLORS;
/** A point as [along, across] the pitch's long axis, in ground meters from its center. */
type Local = [along: number, across: number];
interface Frame {
  center: Vec2;
  axis: Vec2;
  long: number;
  short: number;
  /** Share of the oriented rectangle the outline fills: 1 for a rectangle, π/4 for a fan. */
  fill: number;
}

const isPitch = (feature: TerrainLandcoverFeature): boolean =>
  feature.class === 'pitch' || feature.subclass === 'pitch';

function ringArea(ring: readonly Vec2[]): number {
  let twice = 0;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k] as Vec2,
      b = ring[(k + 1) % ring.length] as Vec2;
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(twice) / 2;
}

/**
 * The smallest rectangle around an outline that shares a direction with one of its edges. Edges
 * that tie (every side of a rectangle does) resolve to the least bearing, so the frame does not
 * depend on where the source starts the ring or which way round it runs.
 */
function frameOf(ring: readonly Vec2[]): Frame | undefined {
  let best: { area: number; bearing: number; frame: Omit<Frame, 'fill'> } | undefined;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k] as Vec2,
      b = ring[(k + 1) % ring.length] as Vec2;
    const length = dmath.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.5) continue;
    let ux = (b[0] - a[0]) / length,
      uz = (b[1] - a[1]) / length;
    let lo = Infinity,
      hi = -Infinity,
      low = Infinity,
      high = -Infinity;
    for (const [x, z] of ring) {
      const s = x * ux + z * uz,
        t = -x * uz + z * ux;
      if (s < lo) lo = s;
      if (s > hi) hi = s;
      if (t < low) low = t;
      if (t > high) high = t;
    }
    let long = hi - lo,
      short = high - low;
    const mid = (lo + hi) / 2,
      across = (low + high) / 2;
    const center: Vec2 = [mid * ux - across * uz, mid * uz + across * ux];
    if (short > long) {
      [long, short] = [short, long];
      [ux, uz] = [-uz, ux];
    }
    if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uz < 0)) {
      ux = -ux;
      uz = -uz;
    }
    const area = long * short,
      bearing = Math.round(dmath.atan2(uz, ux) * 1e4);
    if (
      best === undefined ||
      area < best.area * (1 - 1e-4) ||
      (area <= best.area * (1 + 1e-4) && bearing < best.bearing)
    )
      best = { area, bearing, frame: { center, axis: [ux, uz], long, short } };
  }
  if (best === undefined || !(best.area > 0)) return undefined;
  return { ...best.frame, fill: ringArea(ring) / best.area };
}

/** One pitch's added ground in ground meters, in the order it is drawn. */
interface Outline {
  kind: Kind;
  outer: Vec2[];
  holes?: Vec2[][];
}
type Marks = Outline[];

function drafter(frame: Frame, marks: Marks) {
  const [ax, az] = frame.axis;
  const world = ([s, t]: Local): Vec2 => [
    frame.center[0] + s * ax - t * az,
    frame.center[1] + s * az + t * ax,
  ];
  const add = (kind: Kind, ring: Local[], hole?: Local[]): void => {
    marks.push({ kind, outer: ring.map(world), ...(hole ? { holes: [hole.map(world)] } : {}) });
  };
  const line = (from: Local, to: Local, width: number): void => {
    const ds = to[0] - from[0],
      dt = to[1] - from[1],
      length = dmath.hypot(ds, dt);
    if (length < 1e-6) return;
    const ns = (-dt / length) * (width / 2),
      nt = (ds / length) * (width / 2);
    // Square ends that reach half a width past each point, so corners of a box close.
    const es = (ds / length) * (width / 2),
      et = (dt / length) * (width / 2);
    add('sports_line', [
      [from[0] - es + ns, from[1] - et + nt],
      [to[0] + es + ns, to[1] + et + nt],
      [to[0] + es - ns, to[1] + et - nt],
      [from[0] - es - ns, from[1] - et - nt],
    ]);
  };
  const box = (s0: number, t0: number, s1: number, t1: number, width: number): void => {
    line([s0, t0], [s1, t0], width);
    line([s1, t0], [s1, t1], width);
    line([s1, t1], [s0, t1], width);
    line([s0, t1], [s0, t0], width);
  };
  /** An arc of a circle as a band: `from` and `to` are turns from the long axis, radians. */
  const arc = (
    center: Local,
    radius: number,
    from: number,
    to: number,
    width: number,
    steps = 16,
  ): void => {
    // A whole circle is a ring with a hole; a band that met itself would be a degenerate outline.
    const whole = Math.abs(to - from) >= dmath.TAU - 1e-9;
    const outer: Local[] = [],
      inner: Local[] = [];
    for (let k = 0; k < (whole ? steps : steps + 1); k++) {
      const angle = from + ((to - from) * k) / steps,
        cos = dmath.cos(angle),
        sin = dmath.sin(angle);
      outer.push([center[0] + cos * (radius + width / 2), center[1] + sin * (radius + width / 2)]);
      inner.push([center[0] + cos * (radius - width / 2), center[1] + sin * (radius - width / 2)]);
    }
    if (whole) add('sports_line', outer, inner);
    else add('sports_line', [...outer, ...inner.reverse()]);
  };
  return { line, box, arc };
}

/** Touchlines, halfway line, center circle and both penalty and goal areas. */
function soccer(frame: Frame, marks: Marks, lines: boolean): void {
  const draw = drafter(frame, marks);
  if (!lines) return;
  const inset = Math.max(1, frame.short * 0.03),
    width = 0.35;
  const l = frame.long / 2 - inset,
    w = frame.short / 2 - inset;
  // Boxes keep their proportion to the pitch's width on a small-sided field.
  const k = Math.min(1, (2 * w) / 64);
  draw.box(-l, -w, l, w, width);
  draw.line([0, -w], [0, w], width);
  draw.arc([0, 0], Math.min(9.15 * k, w * 0.6), 0, dmath.TAU, width, 24);
  for (const end of [-1, 1]) {
    for (const [depth, half] of [
      [16.5 * k, 20.15 * k],
      [5.5 * k, 9.15 * k],
    ] as const) {
      if (half >= w) continue;
      draw.line([end * l, -half], [end * (l - depth), -half], width);
      draw.line([end * (l - depth), -half], [end * (l - depth), half], width);
      draw.line([end * (l - depth), half], [end * l, half], width);
    }
  }
}

/** Sidelines, end lines, goal lines and a yard line every ten yards between them. */
function gridiron(frame: Frame, marks: Marks, lines: boolean): void {
  const draw = drafter(frame, marks);
  if (!lines) return;
  const inset = Math.max(1, frame.short * 0.03),
    width = 0.35;
  const l = frame.long / 2 - inset,
    w = frame.short / 2 - inset;
  const yard = (2 * l) / 120;
  draw.box(-l, -w, l, w, width);
  for (let n = -5; n <= 5; n++) draw.line([n * 10 * yard, -w], [n * 10 * yard, w], width);
}

/** A doubles court with its singles sidelines, service boxes and net, centered in the outline. */
function tennis(frame: Frame, marks: Marks, lines: boolean): void {
  const draw = drafter(frame, marks);
  if (!lines) return;
  // Full size where the outline has its run-off; otherwise the court fills most of it.
  const k = Math.min(1, (frame.long * 0.94) / 23.77, (frame.short * 0.92) / 10.97);
  const l = 11.885 * k,
    w = 5.485 * k,
    single = 4.115 * k,
    service = 6.4 * k,
    width = 0.2;
  draw.box(-l, -w, l, w, width);
  draw.line([-l, -single], [l, -single], width);
  draw.line([-l, single], [l, single], width);
  draw.line([-service, -single], [-service, single], width);
  draw.line([service, -single], [service, single], width);
  draw.line([-service, 0], [service, 0], width);
  draw.line([0, -w - 0.9 * k], [0, w + 0.9 * k], width);
}

/** Boundary, center line and circle, and at each end the key and the three-point arc. */
function basketball(frame: Frame, marks: Marks, lines: boolean): void {
  const draw = drafter(frame, marks);
  if (!lines) return;
  const k = Math.min(1, (frame.long * 0.96) / 28, (frame.short * 0.96) / 15);
  const l = 14 * k,
    w = 7.5 * k,
    width = 0.2;
  draw.box(-l, -w, l, w, width);
  draw.line([0, -w], [0, w], width);
  draw.arc([0, 0], 1.8 * k, 0, dmath.TAU, width);
  for (const end of [-1, 1]) {
    const key = 2.45 * k,
      depth = 5.8 * k;
    draw.line([end * l, -key], [end * (l - depth), -key], width);
    draw.line([end * (l - depth), -key], [end * (l - depth), key], width);
    draw.line([end * (l - depth), key], [end * l, key], width);
    // The arc faces the middle of the court from the basket, short of the sidelines.
    const basket: Local = [end * (l - 1.575 * k), 0];
    const facing = end === 1 ? dmath.PI : 0;
    draw.arc(basket, Math.min(6.75 * k, w - 0.6 * k), facing - 1.36, facing + 1.36, width);
  }
}

/**
 * A ball diamond from home plate and the directions of its foul lines. The infield is skinned
 * dirt in a quarter circle; a full-size field keeps a grass square and a mound inside it.
 */
function infield(at: Vec2, a: Vec2, b: Vec2, reach: number, marks: Marks, lines: boolean): void {
  const point = (p: number, q: number): Vec2 => [
    at[0] + a[0] * p + b[0] * q,
    at[1] + a[1] * p + b[1] * q,
  ];
  const add = (kind: Kind, outer: Vec2[]): void => {
    marks.push({ kind, outer });
  };
  const skin = skinned(reach);
  const sector: Vec2[] = [at];
  for (let k = 0; k <= 10; k++) {
    const turn = (k / 10) * (dmath.PI / 2);
    sector.push(point(dmath.cos(turn) * skin, dmath.sin(turn) * skin));
  }
  add('sports_dirt', sector);
  const size = Math.min(1, reach / 100);
  if (reach >= 70) {
    const near = 4.5 * size,
      far = 23 * size;
    add('sports_turf', [point(near, near), point(far, near), point(far, far), point(near, far)]);
    const mound = 18.4 * size * Math.SQRT1_2;
    const circle: Vec2[] = [];
    for (let k = 0; k < 10; k++) {
      const turn = (k / 10) * dmath.TAU;
      circle.push(point(mound + dmath.cos(turn) * 2.7, mound + dmath.sin(turn) * 2.7));
    }
    add('sports_dirt', circle);
  }
  if (lines) {
    const half = 0.175;
    add('sports_line', [
      point(0, -half),
      point(reach * 0.98, -half),
      point(reach * 0.98, half),
      point(0, half),
    ]);
    add('sports_line', [
      point(-half, 0),
      point(half, 0),
      point(half, reach * 0.98),
      point(-half, reach * 0.98),
    ]);
  }
}

/** Radius of the skinned infield for foul lines of a given length, ground meters. */
const skinned = (reach: number): number => dmath.clamp(reach * 0.45, 15, 46);

const span = (a: Vec2, b: Vec2): number => dmath.hypot(b[0] - a[0], b[1] - a[1]);
const toward = (from: Vec2, to: Vec2): Vec2 => {
  const length = span(from, to);
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
};
/** Foul lines meet at about a right angle; anything else is not a diamond. */
const square = (a: Vec2, b: Vec2): boolean => Math.abs(a[0] * b[0] + a[1] * b[1]) <= 0.35;

/**
 * Home plate of a fan and the directions of its foul lines: the two long edges that stand square
 * to each other, met where their lines cross (a backstop usually chamfers the corner itself).
 * `real` marks the corners the source mapped, as opposed to those its clipping made, for the
 * piece of a fan a tile edge left in this tile. A piece must also show the arc leaving the far
 * end of one line: a short edge and then a gentle turn, where a rectangle turns square again.
 */
function homePlate(
  ring: readonly Vec2[],
  real?: readonly boolean[],
): { at: Vec2; a: Vec2; b: Vec2; reach: number } | undefined {
  const n = ring.length;
  const edges: Array<{ k: number; from: Vec2; to: Vec2; length: number }> = [];
  for (let k = 0; k < n; k++) {
    // An edge between two clipped corners runs along the clip boundary, not the pitch.
    if (real && !real[k] && !real[(k + 1) % n]) continue;
    const from = ring[k] as Vec2,
      to = ring[(k + 1) % n] as Vec2;
    const length = span(from, to);
    if (length >= 30) edges.push({ k, from, to, length });
  }
  edges.sort((p, q) => q.length - p.length || p.k - q.k);
  const arcLeaves = (end: number, step: number, foul: number): boolean => {
    if (!real) return true;
    const next = (end + step + n) % n,
      after = (next + step + n) % n;
    if (!real[end] || !real[next]) return false;
    const from = ring[end] as Vec2,
      via = ring[next] as Vec2;
    if (span(from, via) >= foul * 0.5) return false;
    const first = toward(from, via),
      second = toward(via, ring[after] as Vec2);
    const turn = Math.abs(
      dmath.atan2(
        first[0] * second[1] - first[1] * second[0],
        first[0] * second[0] + first[1] * second[1],
      ),
    );
    return turn > 0.05 && turn < 0.87;
  };
  const longest = edges.slice(0, 4);
  for (let i = 0; i < longest.length; i++)
    for (let j = i + 1; j < longest.length; j++) {
      const e = longest[i] as (typeof edges)[number],
        f = longest[j] as (typeof edges)[number];
      const de = toward(e.from, e.to),
        df = toward(f.from, f.to);
      if (!square(de, df)) continue;
      const along =
        ((f.from[0] - e.from[0]) * df[1] - (f.from[1] - e.from[1]) * df[0]) /
        (de[0] * df[1] - de[1] * df[0]);
      const at: Vec2 = [e.from[0] + de[0] * along, e.from[1] + de[1] * along];
      // Each line runs from its end nearer home to the far one, where the arc begins.
      const leg = (edge: (typeof edges)[number]) => {
        const first = span(at, edge.from),
          second = span(at, edge.to);
        return first <= second
          ? { near: first, far: edge.to, end: (edge.k + 1) % n, step: 1, length: second }
          : { near: second, far: edge.from, end: edge.k, step: -1, length: first };
      };
      const one = leg(e),
        other = leg(f);
      if (one.near > 15 || other.near > 15) continue;
      if (
        !arcLeaves(one.end, one.step, one.length) &&
        !arcLeaves(other.end, other.step, other.length)
      )
        continue;
      return {
        at,
        a: toward(at, one.far),
        b: toward(at, other.far),
        reach: Math.min(one.length, other.length),
      };
    }
  return undefined;
}

/**
 * Add each pitch's ground and markings after the tile's own land cover. A pitch the source cut
 * at a tile edge cannot be measured, so both tiles holding a piece draw it as turf; the one that
 * holds a diamond's home plate adds the infield.
 */
export function withPitches(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  buffer: number,
): TerrainSemanticTile {
  if (geom.levelBelowMax > 1) return tile;
  const { size, metersPerUnit: scale } = geom;
  const lines = geom.levelBelowMax === 0;
  const edge = buffer - 1e-6;
  const clipped = ([u, v]: Vec2): boolean =>
    u <= -edge || v <= -edge || u >= 1 + edge || v >= 1 + edge;
  const added: TerrainLandcoverFeature[] = [];
  let index = 0;
  for (const feature of tile.landcover) {
    if (!isPitch(feature)) continue;
    for (const polygon of feature.polygons) {
      const number = index++;
      const ring = [...polygon.outer];
      // Sources may close a ring by repeating its first point.
      const last = ring[ring.length - 1] as Vec2,
        start = ring[0] as Vec2;
      if (ring.length > 3 && last[0] === start[0] && last[1] === start[1]) ring.pop();
      if (ring.length < 3 || !ring.some(([u, v]) => u >= 0 && v >= 0 && u <= 1 && v <= 1)) continue;
      // Work in ground meters on the projected grid, rounded to a centimeter: the two tiles that
      // see a pitch in their shared buffer then lay it out from identical numbers.
      const projected = ring.map(
        ([u, v]): Vec2 => [
          Math.round(((geom.originX + u * size) / scale) * 100) / 100,
          Math.round(((geom.originZ + v * size) / scale) * 100) / 100,
        ],
      );
      const northing =
        projected.reduce((sum, p) => sum + p[1], 0) /
        projected.length /
        WEB_MERCATOR_EARTH_RADIUS_METERS;
      const shrink = 2 / (dmath.exp(northing) + dmath.exp(-northing));
      const ground = projected.map(([x, z]): Vec2 => [x * shrink, z * shrink]);
      const toTile = ([x, z]: Vec2): Vec2 => [
        ((x / shrink) * scale - geom.originX) / size,
        ((z / shrink) * scale - geom.originZ) / size,
      ];
      const marks: Marks = [];
      let base: Kind | undefined;
      if (ring.some(clipped)) {
        base = 'sports_turf';
        const room = (point: Vec2): number => {
          const [u, v] = toTile(point);
          return ((Math.min(u, v, 1 - u, 1 - v) * size) / scale) * shrink;
        };
        // The tile that holds home plate draws the infield, where all of it fits.
        const home = homePlate(
          ground,
          ring.map((point) => !clipped(point)),
        );
        if (home && room(home.at) >= skinned(home.reach) + 1)
          infield(home.at, home.a, home.b, home.reach, marks, lines);
      } else {
        const frame = frameOf(ground);
        if (frame === undefined) continue;
        const { long, short, fill } = frame;
        if (fill >= 0.9 && long >= 20 && long <= 45 && short >= 9 && short <= 25) {
          if (long >= 31 || long / short >= 2.05) {
            base = 'sports_court';
            tennis(frame, marks, lines);
          } else {
            base = 'sports_blacktop';
            basketball(frame, marks, lines);
          }
        } else if (fill >= 0.9 && long >= 10 && long < 20 && short >= 5) {
          // Too small to tell the game: a court with its boundary line.
          base = 'sports_court';
          const l = long / 2 - 0.4,
            w = short / 2 - 0.4;
          if (lines) drafter(frame, marks).box(-l, -w, l, w, 0.2);
        } else if (long >= 45) {
          // Field-sized: turf, with the markings of the game its shape gives away.
          base = 'sports_turf';
          if (fill >= 0.9 && long <= 130 && short >= 25 && short <= 80) {
            if (long >= 85 && long / short >= 1.9) gridiron(frame, marks, lines);
            else soccer(frame, marks, lines);
          } else if (fill >= 0.68 && fill < 0.9 && long / short < 1.35) {
            const home = homePlate(ground);
            if (home) infield(home.at, home.a, home.b, home.reach, marks, lines);
          }
        }
      }
      if (base === undefined) continue;
      const fitted = (outline: Outline): TerrainSemanticPolygon => ({
        outer: outline.outer.map(toTile),
        ...(outline.holes ? { holes: outline.holes.map((hole) => hole.map(toTile)) } : {}),
      });
      // The ground paints larger features first, so each patch of dirt or grass is its own
      // feature (a mound inside a grass square inside the skinned infield) and all of a pitch's
      // lines are one, smaller than any ground they cross.
      added.push({ id: `site:pitch:${number}`, class: base, polygons: [polygon] });
      const painted: TerrainSemanticPolygon[] = [];
      for (const [k, outline] of marks.entries()) {
        if (outline.kind === 'sports_line') painted.push(fitted(outline));
        else
          added.push({
            id: `site:pitch:${number}:${k}`,
            class: outline.kind,
            polygons: [fitted(outline)],
          });
      }
      if (painted.length > 0)
        added.push({ id: `site:pitch:${number}:lines`, class: 'sports_line', polygons: painted });
    }
  }
  return added.length > 0 ? { ...tile, landcover: [...tile.landcover, ...added] } : tile;
}
