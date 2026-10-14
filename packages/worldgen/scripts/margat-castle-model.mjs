/** Picture-led Margat exterior, with standard PMTiles inner building controls and ground. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sy/sy1/n0310_margat/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  means = read('surface-means.json');
const scope = read('review-scope.json');
const palette = {
  basalt: '#b3b0a3',
  limestone: '#e4d9bf',
  roof: '#c0b8a2',
  recess: '#4e514c',
  metal: '#656b67',
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(
  Object.entries(palette).map(([key, color]) => [key, linear(color)]),
);
export function margatGround(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw new Error('Margat footing outside PMTiles grid');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
const add = (a, b) => a.map((v, i) => v + b[i]);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const point = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const area = (p) =>
  p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
const ccw = (p) => (area(p) < 0 ? [...p].reverse() : p);
function writer(target, detail) {
  return (surface, polygon, targetNormal, tint = colors[surface]) => {
    let p = polygon.map((v) => v.map(Math.fround));
    if (
      targetNormal &&
      normalFor(p[0], p[1], p[2]).reduce((s, v, i) => s + v * targetNormal[i], 0) < 0
    )
      p = p.reverse();
    const c = detail === 0 ? tint.map((v, i) => v * means[surface][i]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        raw = cross(
          tri[1].map((v, j) => v - tri[0][j]),
          tri[2].map((v, j) => v - tri[0][j]),
        );
      if (Math.hypot(...raw) < 1e-9) continue;
      target.addTriangle(
        surface,
        'palette:#ffffff',
        tri,
        normalFor(...tri),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        c,
      );
    }
  };
}
function cap(face, rings, y, surface = 'roof', down = false) {
  const p = rings.flat(),
    holes = [];
  let count = rings[0].length;
  for (const ring of rings.slice(1)) {
    holes.push(count);
    count += ring.length;
  }
  const indices = earcut(p.flat(), holes, 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      surface,
      indices.slice(i, i + 3).map((k) => point(p[k], y)),
      [0, down ? -1 : 1, 0],
    );
}
function shell(face, outline, bottom, top, surface = 'basalt', inward = false) {
  const p = ccw(outline);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      normal = [b[1] - a[1], 0, a[0] - b[0]].map((v) => (inward ? -v : v));
    face(surface, [point(a, bottom), point(b, bottom), point(b, top), point(a, top)], normal);
  }
}
function solid(face, outline, bottom, top, surface = 'basalt') {
  shell(face, outline, bottom, top, surface);
  cap(face, [outline], top);
}
function clipZ(outline, limit, greater) {
  const inside = (p) => (greater ? p[1] >= limit : p[1] <= limit);
  const result = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) result.push(mix(a, b, (limit - a[1]) / (b[1] - a[1])));
  }
  return result;
}
function gateWing(face, outline, floor, top, gate, segments) {
  const low = gate[1] - 2.25,
    high = gate[1] + 2.25;
  for (const p of [clipZ(outline, low, false), clipZ(outline, high, true)])
    if (p.length >= 3) solid(face, p, floor, top);
  for (let i = 0; i < segments; i++) {
    const z0 = low + (4.5 * i) / segments,
      z1 = low + (4.5 * (i + 1)) / segments,
      p = clipZ(clipZ(outline, z0, true), z1, false),
      crown = (p) => 4.8 + 2.1 * (1 - Math.pow(Math.abs(((p[1] - low) / 4.5) * 2 - 1), 1.3));
    if (p.length < 3) continue;
    solid(face, p, crown, top);
    cap(face, [p], crown, 'basalt', true);
  }
}
function wall(
  face,
  a,
  b,
  top,
  thickness,
  floor = (p) => margatGround(...p) - 0.6,
  minimumHeight = 3.2,
) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  const p = [
    add(
      a,
      n.map((v) => (v * thickness) / 2),
    ),
    add(
      b,
      n.map((v) => (v * thickness) / 2),
    ),
    add(
      b,
      n.map((v) => (-v * thickness) / 2),
    ),
    add(
      a,
      n.map((v) => (-v * thickness) / 2),
    ),
  ];
  const crest = (p) => Math.max(typeof top === 'function' ? top(p) : top, floor(p) + minimumHeight);
  solid(face, p, floor, crest);
}
function cylinder(face, center, radius, bottom, top, sides, hollow = false, batter = 0) {
  const ring = (r, y) =>
    Array.from({ length: sides }, (_, i) =>
      point(
        [
          center[0] + r * Math.cos((i * Math.PI * 2) / sides),
          center[1] + r * Math.sin((i * Math.PI * 2) / sides),
        ],
        y,
      ),
    );
  const a = ring(radius + batter, bottom),
    b = ring(radius, top);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    face('basalt', [a[i], a[j], b[j], b[i]], [b[i][0] - center[0], 0, b[i][2] - center[1]]);
  }
  const outer = b.map((p) => [p[0], p[2]]);
  if (hollow) {
    const inner = ring(radius - 1.4, top).map((p) => [p[0], p[2]]);
    shell(face, inner, typeof bottom === 'number' ? bottom + 2 : 8, top, 'basalt', true);
    cap(face, [outer, [...inner].reverse()], top);
    cap(face, [inner], 8.2, 'roof');
  } else cap(face, [outer], top);
}
function archWall(
  face,
  a,
  b,
  bottom,
  top,
  depth,
  width,
  spring,
  rise,
  segments,
  surface = 'basalt',
) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    inward = [-u[1], u[0]];
  const at = (t, y, d = 0) =>
    point(
      add(
        a,
        add(
          u.map((v) => v * t),
          inward.map((v) => v * d),
        ),
      ),
      y,
    );
  const l = (length - width) / 2,
    r = l + width,
    roof = top,
    normal = [u[1], 0, -u[0]];
  for (const d of [0, depth]) {
    const normalD = normal.map((v) => (d === 0 ? v : -v));
    face(surface, [at(0, bottom, d), at(l, bottom, d), at(l, roof, d), at(0, roof, d)], normalD);
    face(
      surface,
      [at(r, bottom, d), at(length, bottom, d), at(length, roof, d), at(r, roof, d)],
      normalD,
    );
    for (let i = 0; i < segments; i++) {
      const s = i / segments,
        t = (i + 1) / segments;
      const h = (q) => bottom + spring + rise * (1 - Math.pow(Math.abs(q * 2 - 1), 1.3));
      face(
        surface,
        [
          at(l + width * s, h(s), d),
          at(l + width * t, h(t), d),
          at(l + width * t, roof, d),
          at(l + width * s, roof, d),
        ],
        normalD,
      );
      if (d === 0)
        face('basalt', [
          at(l + width * s, h(s)),
          at(l + width * t, h(t)),
          at(l + width * t, h(t), depth),
          at(l + width * s, h(s), depth),
        ]);
    }
  }
  for (const t of [0, length, l, r])
    face('basalt', [at(t, bottom), at(t, roof), at(t, roof, depth), at(t, bottom, depth)]);
  face(
    'roof',
    [at(0, roof), at(length, roof), at(length, roof, depth), at(0, roof, depth)],
    [0, 1, 0],
  );
}
function niche(face, center, u, width, height, y, inset, detail) {
  const n = [u[1], -u[0]],
    origin = add(
      center,
      n.map((v) => v * inset),
    ),
    at = (s, h) =>
      point(
        add(
          origin,
          u.map((v) => v * s),
        ),
        h,
      );
  face(
    'recess',
    [at(-width / 2, y), at(width / 2, y), at(width / 2, y + height), at(-width / 2, y + height)],
    [n[0], 0, n[1]],
  );
  if (detail >= 2) {
    const w = width / 2 + 0.24;
    face(
      'limestone',
      [at(-w, y - 0.12), at(w, y - 0.12), at(w, y + 0.12), at(-w, y + 0.12)],
      [n[0], 0, n[1]],
    );
  }
}
function build(target, detail) {
  const face = writer(target, detail),
    r = frame.reconstruction,
    buildings = frame.geometry.rawFeatures;
  const sides = [6, 12, 24, 32, 80][detail],
    archSegments = [4, 8, 14, 24, 40][detail];
  const floor = (p) => Math.min(8, margatGround(...p) - 0.45);
  // Open ward follows the four adjacent mapped hall corners; its level is reconstructed.
  solid(
    face,
    [
      [-15.9, -47.6],
      [31.98, -44.68],
      [8.79, -0.73],
      [-8.79, -3.91],
    ],
    (p) => margatGround(...p) - 0.45,
    r.innerFloorY,
    'basalt',
  );
  // Original PMTiles polygons leave the inner court genuinely open.
  for (const f of buildings) {
    if (String(f.id).endsWith('934')) continue;
    const top = String(f.id).endsWith('936') ? 19.2 : String(f.id).endsWith('933') ? 15 : 16.2;
    if (String(f.id).endsWith('933'))
      gateWing(face, f.points, floor, top, r.westernGate, archSegments);
    else solid(face, f.points, floor, top);
    if (detail >= 1) {
      const outline = ccw(f.points);
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i],
          b = outline[(i + 1) % outline.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 8) continue;
        const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
          count = Math.max(1, Math.floor(len / (detail === 1 ? 16 : 7)));
        for (let j = 0; j < count; j++)
          niche(
            face,
            mix(a, b, (j + 0.5) / count),
            u,
            detail === 1 ? 0.8 : 1.1,
            1.8,
            top - 4.2,
            0.08,
            detail,
          );
      }
    }
  }
  // Round southern keep sits in its mapped arc, above the court attachment plane.
  const keep = r.keepCenter;
  cylinder(face, keep, 9.2, floor, 30.5, sides, detail >= 2, 1.5);
  if (detail >= 1) {
    for (let i = 0; i < [0, 6, 10, 14, 18][detail]; i++) {
      const facet = Math.floor((i * sides) / [0, 6, 10, 14, 18][detail]),
        a = ((facet + 0.5) * Math.PI * 2) / sides,
        u = [-Math.sin(a), Math.cos(a)];
      for (const y of detail >= 2 ? [16, 23.1] : [16]) {
        const foot = floor([keep[0] + 10.7 * Math.cos(a), keep[1] + 10.7 * Math.sin(a)]),
          radius = (9.2 + (1.5 * (30.5 - y)) / (30.5 - foot)) * Math.cos(Math.PI / sides),
          p = [keep[0] + radius * Math.cos(a), keep[1] + radius * Math.sin(a)];
        niche(face, p, u, y === 16 ? 0.8 : 0.65, y === 16 ? 1.9 : 1.6, y, 0.12, detail);
      }
    }
  }
  // Picture-based outer curtain and battered bastions; never labeled as mapped outlines.
  const outer = r.outerCurtain;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    const crest = (p) => Math.max(5.5, margatGround(...p) + 7.5);
    if (i === 7) {
      const atZ = (z) => mix(a, b, (z - a[1]) / (b[1] - a[1]));
      wall(face, a, atZ(r.westernGate[1] + 4), crest, 3.1);
      wall(face, atZ(r.westernGate[1] - 4), b, crest, 3.1);
    } else if (detail < 2 || i !== 0) wall(face, a, b, crest, 3.1);
  }
  for (const i of [0, 2, 3, 4, 5, 6, 7]) {
    const p = outer[i],
      top = Math.max(8.5, margatGround(...p) + 10);
    cylinder(
      face,
      p,
      i === 6 ? 7.1 : 5.9,
      (p) => margatGround(...p) - 0.6,
      top,
      sides,
      detail >= 2,
      2.2,
    );
    if (detail >= 2)
      for (let j = 0; j < 3; j++) {
        const a = j * 1.9 + i * 0.8,
          u = [-Math.sin(a), Math.cos(a)];
        niche(
          face,
          [p[0] + 5.97 * Math.cos(a), p[1] + 5.97 * Math.sin(a)],
          u,
          0.75,
          1.2,
          top - 3,
          0.04,
          detail,
        );
      }
  }
  // Western dogleg gate has a real opening and open passage, not a painted doorway.
  const gate = r.westernGate,
    a = add(gate, [0, 10]),
    b = add(gate, [0, -10]);
  archWall(face, add(a, [-1, 0]), add(b, [-1, 0]), -0.8, 16.5, 5.5, 4.5, 5.6, 2.1, archSegments);
  wall(face, add(gate, [5.5, -10]), add(gate, [15, -10]), 11, 2.1, () => -0.8);
  wall(face, add(gate, [5.5, 10]), add(gate, [15, 10]), 11, 2.1, () => -0.8);
  cap(
    face,
    [
      [
        add(gate, [-1, -2.25]),
        add(gate, [19, -2.25]),
        add(gate, [19, 2.25]),
        add(gate, [-1, 2.25]),
      ],
    ],
    -0.65,
  );
  // Picture-led elevated approach from the coarse hill to the carved entrance.
  const start = add(gate, [-35, 0]),
    end = add(gate, [-1, 0]),
    startY = margatGround(...start) + 0.2,
    steps = detail >= 2 ? 18 : 1;
  for (let i = 0; i < steps; i++) {
    const p = mix(start, end, i / steps),
      q = mix(start, end, (i + 1) / steps),
      top = startY + ((-0.65 - startY) * (i + 1)) / steps;
    solid(
      face,
      [add(p, [0, -2.4]), add(q, [0, -2.4]), add(q, [0, 2.4]), add(p, [0, 2.4])],
      (p) => margatGround(...p) - 0.6,
      top,
    );
  }
  // Chapel: mapped oblique rectangle, pale pointed portal, surviving barrel-vault impression.
  const chapel = buildings.find((f) => String(f.id).endsWith('934')).points,
    origin = chapel[0];
  const length = Math.hypot(chapel[1][0] - origin[0], chapel[1][1] - origin[1]),
    u = chapel[1].map((v, i) => (v - origin[i]) / length),
    v = [-u[1], u[0]];
  const width = Math.hypot(chapel[3][0] - origin[0], chapel[3][1] - origin[1]),
    at = (s, t) =>
      add(
        origin,
        add(
          u.map((n) => n * s),
          v.map((n) => n * t),
        ),
      );
  const cp = at(0, width / 2),
    rear = at(length, width / 2);
  wall(face, at(0, 0), at(length, 0), 15.5, 1.7, floor);
  wall(face, at(0, width), at(length, width), 15.5, 1.7, floor);
  archWall(face, at(0, width), at(0, 0), 8.2, 20.5, 1.7, 4.6, 5.2, 2.6, archSegments);
  wall(face, at(length, 0), at(length, width), 17, 1.7, floor);
  cap(face, [chapel], 8.15);
  // Pale archivolt follows the portal crown with joined voussoir faces.
  if (detail >= 1) {
    const w = 4.6,
      h = (q) => 13.4 + 2.6 * (1 - Math.pow(Math.abs(q * 2 - 1), 1.3));
    const p = (q, y, offset) =>
      point(
        add(
          cp,
          add(
            v.map((n) => n * ((q - 0.5) * w)),
            u.map((n) => -offset),
          ),
        ),
        y,
      );
    for (let i = 0; i < archSegments; i++) {
      const a = i / archSegments,
        b = (i + 1) / archSegments;
      face(
        'limestone',
        [p(a, h(a) + 0.55, 0.08), p(b, h(b) + 0.55, 0.08), p(b, h(b), 0.08), p(a, h(a), 0.08)],
        [-u[0], 0, -u[1]],
      );
    }
    for (const s of [-1, 1])
      wall(
        face,
        add(
          cp,
          v.map((n) => n * s * 2.55),
        ),
        add(
          cp,
          add(
            v.map((n) => n * s * 2.55),
            u.map((n) => n * -0.3),
          ),
        ),
        13.4,
        0.45,
        () => 8.2,
      );
    const windowFace = (half, base, crown, offset) => {
      const coords = [
        [-half, base],
        [half, base],
        [half, crown - 0.45],
        [0, crown],
        [-half, crown - 0.45],
      ];
      return coords.map(([t, y]) =>
        point(
          add(
            cp,
            add(
              v.map((n) => n * t),
              u.map((n) => -offset * n),
            ),
          ),
          y,
        ),
      );
    };
    face('limestone', windowFace(1.2, 17.3, 19.8, 0.09), [-u[0], 0, -u[1]]);
    face('recess', windowFace(0.8, 17.6, 19.35, 0.12), [-u[0], 0, -u[1]]);
  }
  // Eastern portion survives; keep the western vault cut open as in the entrance picture.
  const panels = [4, 8, 14, 22, 36][detail];
  for (let i = 0; i < panels; i++) {
    const a = (i * Math.PI) / panels,
      b = ((i + 1) * Math.PI) / panels;
    const p = (s, angle) =>
      point(at(s, width / 2 + (width / 2 - 0.8) * Math.cos(angle)), 15.5 + 5 * Math.sin(angle));
    face('basalt', [p(length * 0.52, a), p(length, a), p(length, b), p(length * 0.52, b)]);
  }
  if (detail >= 2) {
    // Sparse ruin-crown stones and buttresses, rather than fictitious regular battlements.
    for (let i = 0; i < 9; i++) {
      const a = i * 0.71,
        p = [keep[0] + 8.7 * Math.cos(a), keep[1] + 8.7 * Math.sin(a)],
        z = 0.8 + (i % 3) * 0.35;
      solid(
        face,
        [
          [p[0] - 0.8, p[1] - 0.65],
          [p[0] + 0.8, p[1] - 0.65],
          [p[0] + 0.8, p[1] + 0.65],
          [p[0] - 0.8, p[1] + 0.65],
        ],
        30.5,
        30.5 + z,
      );
    }
    for (const s of [4, 12, 22]) wall(face, at(s, width), at(s, width + 3), 15.7, 1.4, floor);
    // Three open vault bays on the western curtain retain the exposed arches seen in the wall picture.
    const q = outer[0],
      end = outer[1],
      dir = end.map((n, i) => n - q[i]);
    for (let i = 0; i < 3; i++) {
      const a = mix(q, end, i / 3),
        b = mix(q, end, (i + 1) / 3),
        y = Math.max(margatGround(...a), margatGround(...b)) + 3;
      const len = Math.hypot(...dir),
        offset = [(-dir[1] / len) * 1.25, (dir[0] / len) * 1.25];
      wall(face, add(a, offset), add(b, offset), y, 2.5, (p) => margatGround(...p) - 0.6, 0);
      archWall(face, a, b, y, y + 5.5, 2.5, Math.hypot(...dir) / 3 - 1.5, 2.4, 1.7, archSegments);
    }
  }
  if (detail >= 3) {
    // Selected broad coping bands at two floor lines; mortar remains in the shared graph.
    for (const f of buildings.slice(0, 2))
      for (let i = 0; i < f.points.length; i++) {
        const a = f.points[i],
          b = f.points[(i + 1) % f.points.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 10) wall(face, a, b, 12.1, 0.25, () => 11.85, 0);
      }
  }
}
export const buildMargatSkyline = (out) => build(out, 0);
export const buildMargatDistrict = (out) => build(out, 1);
export const buildMargatStreet = (out) => build(out, 2);
export const buildMargatCloseup = (out) => build(out, 3);
export const margatStudy = {
  id: 'N0310',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  key: 'margat',
  title: 'Margat',
  category: 'castle',
  wikidataId: 'Q906516',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Margat basalt fortress: mapped inner ward and open courts, southern round keep, separate pointed chapel portal and cut barrel vault, western dogleg gate, surrounding battered bastions and surviving curtain walls.',
  sourceFacts: {
    horizontalBasis: 'Five standard PMTiles building polygons and named Qal`at al Marqab point',
    publishedArchitecturalHeights: 'None used; elevations are picture-led estimates.',
  },
  reconstruction: {
    ...frame.reconstruction,
    innerFloorY: 8,
    keepTop: 30.5,
    sourceMaster:
      'Highest authored geometric detail retained independently of four browser levels.',
  },
  scaleBasis:
    'Standard PMTiles horizontal building controls; picture-led architectural elevations and outer fortifications, explicitly approximate.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license. PMTiles-derived map controls © OpenStreetMap contributors, ODbL-1.0. Pictures remain external references and are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Shared basalt, limestone and gravel surfaces; no unique bitmap textures, embedded photographs or borrowed meshes.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Battered basalt outer bastions',
      'Round keep and open mapped inner ward',
      'Pale pointed chapel portal and western dogleg gate',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Architectural heights, outer curtains/bastion locations, broken profiles, portal bearing and precise terrain contact are reconstructed from pictures and coarse standard PMTiles, not surveyed.',
    'Northern settlement, lost fortifications, vegetation, frescoes, room interiors and certified traversable collision are excluded. No claim of complete archaeological or engineering reconstruction.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: { position: [-225, 145, 280], lookAt: [0, 8, -8], fov: 43 },
  qaCameras: [
    { name: 'inner-ward-and-keep', position: [110, 100, 150], lookAt: [8, 13, 5] },
    { name: 'chapel-portal-vault', position: [-17, 30, 5.2], lookAt: [-3.6, 14.35, 5.2] },
    { name: 'chapel-cut-roof', position: [-18, 40, -8], lookAt: [10, 14, 8] },
    { name: 'western-dogleg-gate', position: [-74, 20, 21], lookAt: [-23, 7, 19] },
    { name: 'outer-bastions', position: [-130, 50, -125], lookAt: [-19, 7, -62] },
    { name: 'north-wing-court', position: [-85, 82, -100], lookAt: [1, 11, -17] },
  ],
};
