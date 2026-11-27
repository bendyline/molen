/** Cabin fit and control helpers shared by the light-aircraft builders (Cessna 172S/182T,
 * Cherokee, Cirrus SR22T, Bonanza G36, Baron G58, DA42). Coordinates are the model frame: +Y up,
 * +Z forward, +X the pilot's left.
 */
import '../../../worldgen/scripts/install-deterministic-math.mjs';
import { skinSection, wallAt } from './cockpit-fit.mjs';
import { bar, contour, loftUp, partPalette, place, roundedBox, tube } from './cockpit-parts.mjs';
import { quad, T } from './mesh-kit.mjs';

/** A kit that places library parts (which draw at their kit's origin) at `at`, turned by
 * `rotation`, so several parts share one batch. */
export const placedKit = (d, at, rotation = [0, 0, 0]) => ({
  add: (geometry, material) => d.add(place(geometry, at, rotation), material),
});

/** A push-pull control drawn as a quadrant lever lying along -Z (toward the pilot). */
export const pushPullKit = (d, at = [0, 0, 0]) => placedKit(d, at, [-Math.PI / 2, 0, 0]);

/** Interior trim over a painted window-frame tube (a windscreen post or header): the same path
 * moved `inset` toward the cabin axis at height `center`, so from the seat the post reads as
 * cabin trim, while from outside the painted frame still covers it. */
export function frameTrim(
  d,
  points,
  material,
  { center, inset = 0.022, radius = 0.013, closed = false } = {},
) {
  const moved = points.map(([x, y, z]) => {
    const dx = -x,
      dy = center - y,
      l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * inset, y + (dy / l) * inset, z];
  });
  return d.add(tube(moved, radius, 12, closed), material);
}

/**
 * A light-aircraft toe-brake pedal at its pivot (the pad's middle), for the footwell where it is
 * seen from a meter away: the library 'ga' pedal's shape (a rounded pad leaning forward, tread
 * ribs, the arm down to the floor tube and the brake cylinder behind) at a fifth of its
 * triangles. `side` +1 is the left pedal of a pair; `tread` colors the pad (rubber or alloy).
 */
export function gaPedal(
  d,
  { side = 1, drop = 0.07, lean = 0.42, width = 0.1, tread, palette } = {},
) {
  const P = partPalette(palette),
    w = width,
    h = 0.072,
    out = side >= 0 ? 1 : -1;
  const pad = (geometry, material) => d.add(place(geometry, [0, 0, 0], [lean, 0, 0]), material);
  pad(roundedBox([w, h, 0.01], 0.012, 1), tread ?? P.alloy);
  for (const y of [-0.3, 0.05, 0.38])
    pad(bar([-w * 0.4, y * h, -0.0062], [w * 0.4, y * h, -0.0062], 0.0022, 6), P.steel);
  pad(
    place(
      roundedBox([0.018, drop, 0.009], 0.003, 1),
      [0, -h * 0.5 - drop / 2, 0.012],
      [0.12, 0, 0],
    ),
    P.steel,
  );
  pad(bar([out * w * 0.22, -h * 0.55, 0.055], [out * w * 0.22, -h * 1.3, 0.1], 0.009, 10), P.steel);
  pad(bar([out * w * 0.22, h * 0.3, 0.012], [out * w * 0.22, -h * 0.9, 0.07], 0.0055, 8), P.alloy);
}

/** A light-aircraft landing-gear switch from its pivot on the panel face: a short lever toward
 * the pilot (-Z) ending in the small wheel-shaped knob (the library 'ga' gear handle at a third
 * of its triangles). */
export function gaGearSwitch(d, { length = 0.026, radius = 0.012, palette } = {}) {
  const P = partPalette(palette);
  d.add(bar([0, 0, 0], [0, 0, -length], 0.0035, 10), P.alloy);
  d.add(place(new T.TorusGeometry(radius, 0.0045, 6, 16), [0, 0, -length - 0.004]), P.black);
  d.add(
    place(
      new T.CylinderGeometry(radius * 0.72, radius * 0.72, 0.007, 12),
      [0, 0, -length - 0.004],
      [Math.PI / 2, 0, 0],
    ),
    P.alloy,
  );
}

/**
 * The molded Beech control wheel of the Bonanza and Baron (A36/58 onward): one thick U, a broad
 * hub plate wider at its top blending into heavy arms that sweep out and rise into upright horns,
 * each capped by a flat-topped switch head. Origin at the hub, horns in the XY plane facing the
 * pilot (-Z), the column running forward (+Z) to `column`. `material` colors the molding.
 */
export function beechYoke(
  d,
  { width = 0.26, column = 0, columnRadius = 0.0125, material, palette } = {},
) {
  const P = partPalette(palette),
    shell = material ?? P.grip,
    half = width / 2;
  const plate = (y, w, depth) => ({ y, points: contour(0, 0, w, depth, 16, 3.2) });
  d.add(
    loftUp([
      plate(-0.068, 0.046, 0.02),
      plate(-0.06, 0.054, 0.024),
      plate(0.026, 0.064, 0.024),
      plate(0.034, 0.058, 0.02),
    ]),
    shell,
  );
  // The emblem panel: a dark inset trapezoid with a round badge.
  d.add(
    loftUp([
      { y: -0.052, points: contour(0, -0.0245, 0.044, 0.0015, 12, 4) },
      { y: 0.022, points: contour(0, -0.0245, 0.054, 0.0015, 12, 4) },
    ]),
    P.black,
  );
  d.add(
    place(
      new T.CylinderGeometry(0.017, 0.017, 0.003, 18),
      [0, -0.008, -0.027],
      [Math.PI / 2, 0, 0],
    ),
    P.alloy,
  );
  for (const s of [-1, 1]) {
    d.add(
      tube(
        [
          [s * 0.04, -0.05, 0],
          [s * 0.085, -0.054, -0.003],
          [s * (half - 0.014), -0.042, -0.007],
          [s * half, -0.012, -0.01],
        ],
        0.017,
        14,
      ),
      shell,
    );
    const section = (y, rx, rz) => ({ y, points: contour(0, 0, rx, rz, 16, 2.4) });
    d.add(
      place(
        loftUp([
          section(-0.018, 0.017, 0.02),
          section(0.03, 0.0175, 0.021),
          section(0.075, 0.019, 0.022),
          section(0.098, 0.021, 0.023),
        ]),
        [s * half, 0, -0.01],
        [0, 0, s * 0.03],
      ),
      shell,
    );
    // Switch head: flat on top, its face chamfered toward the pilot.
    d.add(
      place(
        roundedBox([0.042, 0.03, 0.046], 0.01),
        [s * (half - 0.003), 0.11, -0.01],
        [0.18, 0, 0],
      ),
      shell,
    );
    d.add(
      place(new T.CylinderGeometry(0.0055, 0.0055, 0.007, 12), [s * (half - 0.006), 0.127, -0.016]),
      P.black,
    );
  }
  if (column > 0) d.add(bar([0, 0, 0.015], [0, 0, column], columnRadius, 16), P.alloy);
}

/**
 * One Beech power-quadrant lever (Bonanza A36/G36 and Baron 58 factory photographs): a dark flat
 * arm from the pivot rising `height`, raked `rake` along Z, to its knob. `kind` 'throttle' is a
 * black barrel lying across the slot (with the GO AROUND button on its left, +X, end when
 * `goAround`), 'prop' a blue upright block of three flutes, 'mixture' a red fluted (octagonal)
 * barrel lying across, waisted in the middle. `length` is the barrels' length across the slot.
 * The arm and the propeller block are plain boxes: the Bonanza's propeller lever shares its node
 * name with the propeller, and must stay far lighter than it (48 triangles against 114).
 */
export function beechQuadrantLever(
  d,
  { kind, height = 0.1, rake = -0.035, length = 0.046, goAround = false, palette } = {},
) {
  const P = partPalette(palette),
    tilt = Math.atan2(rake, height),
    top = (lift) => [0, height + lift * Math.cos(tilt), rake + lift * Math.sin(tilt)];
  d.add(
    place(
      new T.BoxGeometry(0.008, Math.hypot(height, rake), 0.013),
      [0, height / 2, rake / 2],
      [tilt, 0, 0],
    ),
    P.steel,
  );
  const across = (geometry, at) => place(geometry, at, [tilt, 0, Math.PI / 2]);
  if (kind === 'throttle') {
    d.add(across(new T.CylinderGeometry(0.018, 0.018, length, 18), top(0.012)), P.black);
    if (goAround)
      d.add(
        across(new T.CylinderGeometry(0.007, 0.007, 0.005, 12), [
          length / 2 + 0.002,
          ...top(0.012).slice(1),
        ]),
        P.steel,
      );
  } else if (kind === 'prop')
    for (let i = 0; i < 3; i++)
      d.add(
        place(new T.BoxGeometry(0.03, 0.0118, 0.023), top(0.008 + i * 0.0135), [tilt, 0, 0]),
        P.blue,
      );
  else
    for (const s of [-1, 1])
      d.add(
        across(new T.CylinderGeometry(0.016, 0.017, length * 0.44, 8), [
          (s * length) / 4,
          ...top(0.014).slice(1),
        ]),
        P.red,
      );
}

/**
 * The Beech Digital Climate Control panel on the pedestal face (2012 interior onward): a black
 * plate framed by a thin blue line, an LCD window between two rows of round keys. Faces the pilot
 * (-Z) centred at `at`; `width` across.
 */
export function beechClimatePanel(d, at, { width = 0.15, palette } = {}) {
  const P = partPalette(palette),
    h = width * 0.42,
    [x, y, z] = at;
  d.add(place(roundedBox([width, h, 0.006], 0.003, 1), [x, y, z]), P.black);
  for (const [w, hh, dx, dy] of [
    [width * 0.9, 0.0015, 0, h * 0.4],
    [width * 0.9, 0.0015, 0, -h * 0.4],
    [0.0015, h * 0.8, width * 0.45, 0],
    [0.0015, h * 0.8, -width * 0.45, 0],
  ])
    d.add(place(new T.PlaneGeometry(w, hh).rotateY(Math.PI), [x + dx, y + dy, z - 0.0032]), P.blue);
  d.add(
    place(new T.PlaneGeometry(width * 0.24, h * 0.24).rotateY(Math.PI), [
      x,
      y + h * 0.13,
      z - 0.0032,
    ]),
    P.panel,
  );
  for (const row of [0.13, -0.15])
    for (const col of [-0.36, -0.25, 0.25, 0.36, ...(row < 0 ? [-0.08, 0.08] : [])])
      d.add(
        place(new T.CircleGeometry(width * 0.034, 10).rotateY(Math.PI), [
          x + col * width,
          y + row * h,
          z - 0.0034,
        ]),
        P.white,
      );
}

/** The y of the lowest skin above `yFrom` at `x`, in a section's segments. */
export function roofAt(segments, x, yFrom) {
  let best;
  for (const [[x1, y1], [x2, y2]] of segments) {
    if ((x1 - x) * (x2 - x) > 0 || x1 === x2) continue;
    const y = y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
    if (y < yFrom) continue;
    if (best === undefined || y < best) best = y;
  }
  return best;
}

/**
 * A headliner following the roof skin `inset` below it, from station `zFrom` to `zTo`, across
 * the cabin between the walls at height `yFrom`. Columns where no roof crosses (a skylight, the
 * windscreen) stay open. Faces point down.
 */
export function cabinHeadliner(
  d,
  root,
  { zFrom, zTo, yFrom, material, zSteps = 8, xSteps = 10, inset = 0.012, margin = 0.015, exclude },
) {
  const grid = [];
  for (let i = 0; i <= zSteps; i++) {
    const z = zFrom + ((zTo - zFrom) * i) / zSteps,
      segments = skinSection(root, z, { exclude }),
      left = wallAt(segments, yFrom, 1),
      right = wallAt(segments, yFrom, -1);
    grid.push(
      Array.from({ length: xSteps + 1 }, (_, j) => {
        if (left === undefined || right === undefined) return undefined;
        const x = right + margin + ((left - right - 2 * margin) * j) / xSteps,
          y = roofAt(segments, x, yFrom);
        return y === undefined ? undefined : [x, y - inset, z];
      }),
    );
  }
  for (let i = 0; i < zSteps; i++)
    for (let j = 0; j < xSteps; j++) {
      const corners = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      if (corners.some((p) => p === undefined)) continue;
      quad(d, ...corners, material, [0, -1, 0]);
    }
}

/** The x of the nearest skin wall at height `y` on one side (+1 left, -1 right), between `from`
 * and `reach` from the centerline (so a strut or wing beyond a window never counts). */
function wallWithin(segments, y, side, from, reach) {
  let best;
  for (const [[x1, y1], [x2, y2]] of segments) {
    if ((y1 - y) * (y2 - y) > 0 || y1 === y2) continue;
    const x = x1 + ((y - y1) / (y2 - y1)) * (x2 - x1);
    if (side * x < from || side * x > reach) continue;
    if (best === undefined || side * x < side * best) best = x;
  }
  return best;
}

/**
 * Sidewall liners `inset` inside the skin from `yFrom` to `yTo`, between stations `zFrom` and
 * `zTo`. Unlike a fixed grid, each station finds the exact heights where skin exists (so a
 * sloping window sill or header leaves no painted band), and stations are added where a window
 * starts or ends (so door posts are lined to their edges). Faces point inboard.
 */
export function cabinLiner(
  d,
  root,
  {
    zFrom,
    zTo,
    yFrom,
    yTo,
    material,
    zSteps = 14,
    rows = 6,
    scan = 0.02,
    inset = 0.01,
    sides = [1, -1],
    from = 0.05,
    reach = Infinity,
    minLength = 0.03,
    tolerance = 0.03,
    depth = 5,
    exclude,
  },
) {
  const cache = new Map();
  const sectionAt = (z) => {
    if (!cache.has(z)) cache.set(z, skinSection(root, z, { exclude }));
    return cache.get(z);
  };
  const wall = (z, y, side) => wallWithin(sectionAt(z), y, side, from, reach);
  // Heights where skin exists at one station: scanned, then each boundary refined by bisection.
  const intervals = (z, side) => {
    const count = Math.max(2, Math.ceil((yTo - yFrom) / scan));
    const ys = Array.from({ length: count + 1 }, (_, i) => yFrom + ((yTo - yFrom) * i) / count);
    const has = ys.map((y) => wall(z, y, side) !== undefined);
    const edge = (lo, hi) => {
      // lo is defined, hi is not (or the reverse): return the defined side within 1 mm.
      let inside = lo,
        outside = hi;
      for (let k = 0; k < 8 && Math.abs(outside - inside) > 0.001; k++) {
        const mid = (inside + outside) / 2;
        if (wall(z, mid, side) !== undefined) inside = mid;
        else outside = mid;
      }
      return inside;
    };
    const out = [];
    let start;
    for (let i = 0; i <= count; i++) {
      if (has[i] && start === undefined) start = i === 0 ? ys[0] : edge(ys[i], ys[i - 1]);
      if (start !== undefined && (!has[i] || i === count)) {
        const end = has[i] ? ys[i] : edge(ys[i - 1], ys[i]);
        if (end - start >= minLength) out.push([start, end]);
        start = undefined;
      }
    }
    return out;
  };
  for (const side of sides) {
    // Stations: uniform, subdivided wherever the openings change between neighbours (a window
    // begins, a sill steps), so no strip is stretched across a window corner.
    const jump = (a, b) =>
      a.length !== b.length
        ? Infinity
        : Math.max(
            0,
            ...a.map((r, k) => Math.max(Math.abs(r[0] - b[k][0]), Math.abs(r[1] - b[k][1]))),
          );
    const runs = [];
    const refine = (p, q, depth) => {
      if (depth === 0 || jump(p.list, q.list) <= tolerance) return;
      const z = (p.z + q.z) / 2,
        m = { z, list: intervals(z, side) };
      refine(p, m, depth - 1);
      runs.push(m);
      refine(m, q, depth - 1);
    };
    let previous;
    for (let i = 0; i <= zSteps; i++) {
      const z = zFrom + ((zTo - zFrom) * i) / zSteps,
        run = { z, list: intervals(z, side) };
      if (previous) refine(previous, run, depth);
      runs.push(run);
      previous = run;
    }
    const point = (z, y) => {
      const x = wall(z, y, side);
      return x === undefined ? undefined : [x - side * inset, y, z];
    };
    for (let i = 0; i < runs.length - 1; i++) {
      const p = runs[i],
        q = runs[i + 1];
      const overlap = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
      for (const A of p.list)
        for (const B of q.list) {
          if (overlap(A, B) <= 0) continue;
          // A run that splits (a window begins between the stations) joins only the shared part.
          const single =
            p.list.filter((a) => overlap(a, B) > 0).length === 1 &&
            q.list.filter((b) => overlap(A, b) > 0).length === 1;
          const a = single ? A : [Math.max(A[0], B[0]), Math.min(A[1], B[1])],
            b = single ? B : a;
          for (let r = 0; r < rows; r++) {
            const t0 = r / rows,
              t1 = (r + 1) / rows;
            const corners = [
              point(p.z, a[0] + (a[1] - a[0]) * t0),
              point(q.z, b[0] + (b[1] - b[0]) * t0),
              point(q.z, b[0] + (b[1] - b[0]) * t1),
              point(p.z, a[0] + (a[1] - a[0]) * t1),
            ];
            if (corners.some((c) => c === undefined)) continue;
            quad(d, ...corners, material, [-side, 0, 0]);
          }
        }
    }
  }
}
