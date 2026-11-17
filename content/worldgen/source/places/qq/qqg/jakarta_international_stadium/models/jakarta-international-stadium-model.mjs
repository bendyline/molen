/** Jakarta International Stadium in its open-roof football configuration. Dimensions are in metres. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const earcut = require('earcut').default;
const load = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = load('plan-controls');
const frame = load('map-frame');
const {
  foundationBottom,
  pitchY,
  fieldSize,
  concreteBowlY,
  concourseY,
  roofEave,
  roofHeight,
  roofSpan,
  openingSize,
  facade,
  tiers,
  eastRampWidth,
  westLink,
  rampLandingY,
} = plan.section;
const shell = frame.geometry.outline;
const nativeWay = (id) => frame.features.find((feature) => feature.id === 'way/' + id).points;
const deck = nativeWay(1369362226);

const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0 },
  screen: { slot: 'wall', graph: 'metal_perforated_round', roughness: 0.52, metallic: 0.18 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.65, metallic: 0.28 },
  membrane: {
    slot: 'roof',
    localRef: 'palette:#fefeff',
    roughness: 0.35,
    metallic: 0.02,
    baseColorFactor: [1, 1, 1, 0.76],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  field: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
};
const palette = Object.fromEntries(
  Object.entries({
    footing: '95958e',
    concrete: 'b4b7b4',
    tread: 'a4a69f',
    riser: '838984',
    rail: 'd1d1c9',
    podium: '8e9391',
    shadow: '535d5e',
    glass: '646f73',
    frame: 'd4d7d4',
    rib: 'e3e3da',
    shell: 'd3d4c9',
    shellPattern: 'c1c4bc',
    shellLight: 'd8d8cb',
    screenBacking: 'adb2ad',
    joint: '6c7776',
    roof: 'e2e4d9',
    roofEdge: 'afb6b4',
    membrane: 'd0dce0',
    seat: 'c77d4e',
    seatLight: 'd18753',
    bareSeat: '989b97',
    field: '668651',
    fieldLight: '709157',
    turfEdge: '677457',
    paint: 'dbdfcb',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function face(out, slot, points, facing, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * facing[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  quad(out, slot, points, n, color);
}
const blend = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => blend(v, b[i], t));
const radial = (points) => points.reduce(([x, , z], p) => [x + p[0], 0, z + p[2]], [0, 0, 0]);
const inward = (points) => radial(points).map((v) => -v);
const up = [0, 1, 0],
  down = [0, -1, 0];
const point = ([x, z], y) => [x, y, z];

function strip(out, slot, a, b, facing, color) {
  for (const [i, p] of a.entries()) {
    const j = (i + 1) % a.length;
    const points = [p, a[j], b[j], b[i]];
    face(out, slot, points, typeof facing === 'function' ? facing(points) : facing, color);
  }
}
function cap(out, slot, polygon, height, normal, color) {
  const indices = earcut(polygon.flat());
  if (indices.length === 0) throw new Error('Stadium deck outline could not be triangulated');
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((j) => point(polygon[j], height(polygon[j])));
    let n = normalFor(...points);
    if (n[1] * normal[1] < 0) {
      points.reverse();
      n = normalFor(...points);
    }
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      color,
    );
  }
}
const cross2 = ([x, z], [a, b]) => x * b - z * a;
function rayPoint(polygon, direction) {
  let distance = Infinity;
  for (const [i, a] of polygon.entries()) {
    const next = polygon[(i + 1) % polygon.length];
    const edge = [next[0] - a[0], next[1] - a[1]];
    const scale = cross2(direction, edge);
    if (Math.abs(scale) < 1e-8) continue;
    const along = cross2(a, direction) / scale;
    const ray = cross2(a, edge) / scale;
    if (ray > 0 && along > -1e-8 && along < 1 + 1e-8) distance = Math.min(distance, ray);
  }
  if (!Number.isFinite(distance)) throw new Error('Stadium centre lies outside a mapped enclosure');
  return direction.map((v) => v * distance);
}
function deckLanding(location, inset = 0) {
  const length = Math.hypot(...location);
  return rayPoint(
    deck,
    location.map((v) => v / length),
  ).map((v) => v * (1 - inset));
}
function directions(count, includeCorners = false) {
  const angle = Math.atan2(openingSize[1], openingSize[0]);
  const values = Array.from({ length: count }, (_, i) => (2 * Math.PI * i) / count);
  if (includeCorners) values.push(angle, Math.PI - angle, Math.PI + angle, 2 * Math.PI - angle);
  return values.sort((a, b) => a - b).map((a) => [Math.cos(a), Math.sin(a)]);
}
function ring(polygon, y, xScale = 1, zScale = xScale) {
  return polygon.map(([x, z]) => [x * xScale, y, z * zScale]);
}
function roundedRing(rays, [rx, rz, y]) {
  return rays.map(([x, z]) => {
    const a = Math.abs(x / rx),
      b = Math.abs(z / rz);
    const d = Math.pow(Math.pow(a, 3.25) + Math.pow(b, 3.25), 1 / 3.25);
    return [x / d, y, z / d];
  });
}
function rectangle(x, z) {
  return [
    [-x, -z],
    [x, -z],
    [x, z],
    [-x, z],
  ];
}
function horizontal(out, slot, x0, x1, z0, z1, y, color) {
  face(
    out,
    slot,
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    up,
    color,
  );
}
function localBox(out, slot, x, y, z, w, h, d, color) {
  box(out, slot, x, y, z, w, h, d, color);
}

function facadeScreen(out, outline, lod) {
  const rings = facade.map(({ y, scale }) => ring(outline, y, ...scale));
  // Dark inner panels are visible through the perforated skin and at the eaves.
  if (lod > 1) {
    for (const [i, r] of rings.slice(1).entries()) {
      const inner = (points) => points.map(([x, y, z]) => [x * 0.986, y, z * 0.986]);
      strip(out, 'steel', inner(rings[i]), inner(r), radial, palette.screenBacking);
    }
  }
  for (const [k, lower] of rings.slice(0, -1).entries()) {
    const upper = rings[k + 1];
    for (const [i, a] of lower.entries()) {
      const j = (i + 1) % lower.length;
      const quad = [a, lower[j], upper[j], upper[i]];
      const sample = (i / outline.length) * 2 * Math.PI;
      // Culturally inspired perforation appears as subdued bands across the cladding.
      const patterned =
        Math.sin(sample * 10 + k * 0.93) + 0.38 * Math.sin(sample * 17 - k * 0.4) > 0.73;
      const tone =
        k === 0 || patterned
          ? palette.shellPattern
          : i % 7 === 0
            ? palette.shellLight
            : palette.shell;
      face(out, lod > 1 ? 'screen' : 'steel', quad, radial(quad), tone);
      if (!lod || k === 0 || i % (lod === 3 ? 1 : 2) !== 0) continue;
      const edge = ([x, y, z]) => [x * 1.0017, y, z * 1.0017];
      const n = lod === 3 ? 0.018 : 0.027;
      const joint = [
        edge(a),
        edge(lerp(a, lower[j], n)),
        edge(lerp(upper[i], upper[j], n)),
        edge(upper[i]),
      ];
      face(out, 'steel', joint, radial(joint), palette.joint);
    }
  }
  const top = rings.at(-1);
  strip(
    out,
    'steel',
    top,
    top.map(([x, y, z]) => [x * 1.002, y + 0.73, z * 1.002]),
    radial,
    palette.roofEdge,
  );
}

function podium(out, outline, deckOutline, lod) {
  const foot = ring(outline, foundationBottom, 0.915);
  const low = ring(outline, 1.5, 0.915);
  const belt = ring(outline, concourseY - 2.25, 0.932);
  strip(out, 'concrete', foot, low, radial, palette.footing);
  strip(out, 'concrete', low, belt, radial, palette.podium);
  const inside = ring(outline, concourseY, 0.884);
  const outside = ring(deckOutline, concourseY);
  const underside = ring(deckOutline, concourseY - 1.7, 0.998);
  strip(out, 'concrete', inside, outside, up, palette.concrete);
  strip(out, 'concrete', underside, outside, radial, palette.tread);
  strip(out, 'concrete', ring(outline, concourseY - 1.7, 0.928), underside, down, palette.podium);
  if (!lod) return;
  const rail = ring(deckOutline, concourseY + 1.04, 0.998);
  const entrances = [
    nativeWay(1369716350)[1],
    westLink[1],
    nativeWay(1056370799)[1],
    nativeWay(1056370800)[1],
    nativeWay(1056370801)[0],
    nativeWay(1056370802)[0],
  ].map((p) => deckLanding(p));
  for (const [i, p] of rail.entries()) {
    const j = (i + 1) % rail.length;
    const [x, , z] = lerp(p, rail[j], 0.5);
    if (entrances.some(([a, b]) => Math.hypot(a - x, b - z) < 17)) continue;
    const upper = ([x, y, z]) => [x * 1.002, y + 0.21, z * 1.002];
    const points = [p, rail[j], upper(rail[j]), upper(p)];
    face(out, 'steel', points, radial(points), palette.rail);
    if (lod >= 2) beam(out, 'steel', outside[i], p, 0.105, 0.12, palette.rail);
  }
  for (const [i, p] of underside.entries()) {
    if (i % (lod >= 2 ? 2 : 3) !== 0) continue;
    const [x, , z] = p;
    const q = [x * 0.962, 0, z * 0.962];
    localBox(
      out,
      'concrete',
      q[0],
      foundationBottom,
      q[2],
      1.65,
      concourseY + 6.78,
      1.65,
      palette.podium,
    );
    if (lod >= 2) {
      const [a, b] = [low[(i + 1) % low.length], low[(i + 2) % low.length]];
      const pigment = i % 4 === 0 ? palette.glass : palette.shadow;
      const base = (p) => [p[0] * 1.018, 2.8, p[2] * 1.018];
      const top = (p) => [p[0] * 1.026, 10.8, p[2] * 1.026];
      const gate = [
        base(lerp(a, b, 0.18)),
        base(lerp(a, b, 0.84)),
        top(lerp(a, b, 0.84)),
        top(lerp(a, b, 0.18)),
      ];
      face(out, 'steel', gate, radial(gate), pigment);
    }
  }
}

function roof(out, lod) {
  const rays = directions([12, 28, 48, 68][lod], true);
  const spanX = Math.max(...shell.map(([x]) => x)) - Math.min(...shell.map(([x]) => x));
  const spanZ = Math.max(...shell.map(([, z]) => z)) - Math.min(...shell.map(([, z]) => z));
  const outer = ring(
    rays.map((d) => rayPoint(shell, d)),
    roofEave + 0.54,
    roofSpan[0] / spanX,
    roofSpan[1] / spanZ,
  );
  const [x, z] = openingSize.map((v) => v / 2);
  const inner = rays.map((d) => point(rayPoint(rectangle(x, z), d), 66.9));
  const innerLip = inner.map(([x, y, z]) => [x, y - 3.8, z]);
  const change = outer.map((p, i) => lerp(p, inner[i], 0.64));
  const slot = lod ? 'membrane' : 'roof';
  strip(out, 'roof', outer, change, up, palette.roof);
  strip(out, slot, change, inner, up, palette.membrane);
  strip(out, 'steel', innerLip, inner, inward, palette.roofEdge);
  const soffit = outer.map(([x, y, z]) => [x, y - 2.5, z]);
  strip(out, 'steel', soffit, outer, radial, palette.roofEdge);
  strip(
    out,
    'steel',
    soffit,
    change.map(([x, y, z]) => [x, y - 2.8, z]),
    down,
    palette.frame,
  );

  for (const sign of [-1, 1]) {
    const edgeX = sign * x,
      edgeZ = sign * z;
    beam(out, 'steel', [-x, 63.9, edgeZ], [x, 63.9, edgeZ], 0.82, 1.08, palette.frame);
    beam(out, 'steel', [edgeX, 63.9, -z], [edgeX, 63.9, z], 0.82, 1.08, palette.frame);
    const panelStart = sign * (x + 2.0),
      panelEnd = sign * (x + 61.1);
    const bays = [1, 3, 6, 9][lod];
    for (let i = 0; i < bays; i++) {
      const a = blend(panelStart, panelEnd, i / bays),
        b = blend(panelStart, panelEnd, (i + 1) / bays);
      const ridgeY = i === 0 ? roofHeight : 71.9;
      face(
        out,
        slot,
        [
          [a, 70.2, -z],
          [b, ridgeY, -z],
          [b, ridgeY, z],
          [a, 70.2, z],
        ],
        up,
        palette.membrane,
      );
      if (lod) {
        beam(out, 'steel', [a, 69.5, -z], [a, 69.5, z], lod === 3 ? 0.24 : 0.44, 0.52, palette.rib);
        beam(
          out,
          'steel',
          [b, ridgeY, -z],
          [b, ridgeY, z],
          lod === 3 ? 0.22 : 0.4,
          0.35,
          palette.rib,
        );
      }
    }
    for (const iz of [-z, z]) {
      beam(out, 'steel', [panelStart, 69.4, iz], [panelEnd, 69.4, iz], 0.52, 0.65, palette.frame);
      const side = [0, 0, Math.sign(iz)];
      face(
        out,
        'steel',
        [
          [panelStart, 64.1, iz],
          [panelEnd, 63.3, iz],
          [panelEnd, 70.22, iz],
          [panelStart, 70.22, iz],
        ],
        side,
        palette.roofEdge,
      );
      if (lod >= 2) {
        for (const t of [0.1, 0.36, 0.62, 0.88]) {
          const position = blend(panelStart, panelEnd, t);
          beam(out, 'steel', [position, 64.6, iz], [position, 69.6, iz], 0.41, 0.48, palette.frame);
        }
      }
    }
    if (lod >= 2) {
      const beats = lod === 3 ? 12 : 8;
      for (let i = 0; i < beats; i++) {
        const u = i / beats,
          v = (i + 1) / beats;
        const a = lerp([-x, 62.9, edgeZ], [x, 62.9, edgeZ], u);
        const b = lerp([-x, 66.8, edgeZ], [x, 66.8, edgeZ], v);
        beam(out, 'steel', a, b, 0.21, 0.27, palette.frame);
        const c = lerp([edgeX, 62.9, -z], [edgeX, 62.9, z], u);
        const d = lerp([edgeX, 66.8, -z], [edgeX, 66.8, z], v);
        beam(out, 'steel', c, d, 0.21, 0.27, palette.frame);
      }
    }
  }
  if (!lod) return;
  for (const [i, p] of change.entries()) {
    if (i % (lod === 3 ? 2 : 3) !== 0) continue;
    const q = inner[i];
    beam(
      out,
      'steel',
      [p[0], p[1] - 2.7, p[2]],
      [q[0], q[1] - 3.1, q[2]],
      0.27,
      0.4,
      palette.frame,
    );
    if (lod >= 2) {
      const e = soffit[i];
      beam(out, 'steel', e, [p[0], p[1] - 2.7, p[2]], 0.42, 0.6, palette.frame);
      beam(out, 'steel', e, [p[0], p[1] - 4.4, p[2]], 0.25, 0.36, palette.rib);
    }
  }
}

function seating(out, rays, lod) {
  const front = roundedRing(rays, tiers[0].front);
  cap(
    out,
    'concrete',
    front.map(([x, , z]) => [x, z]),
    () => concreteBowlY,
    up,
    palette.podium,
  );
  for (const [level, tier] of tiers.entries()) {
    const start = roundedRing(rays, tier.front);
    const end = roundedRing(rays, tier.back);
    const n = lod < 2 ? [1, 3][lod] : Math.ceil(tier.rows / (lod === 2 ? 3 : 2));
    for (let k = 0; k < n; k++) {
      const a = start.map((p, i) => lerp(p, end[i], k / n));
      const b = start.map((p, i) => lerp(p, end[i], (k + 1) / n));
      const step = b.map(([x, , z], i) => [x, a[i][1], z]);
      strip(out, 'concrete', step, b, inward, palette.riser);
      for (const [i, p] of a.entries()) {
        const j = (i + 1) % a.length;
        const seatColor =
          (i + level * 3) % 11 < 2
            ? palette.bareSeat
            : (i * 3 + k + level) % 5 === 1
              ? palette.seatLight
              : palette.seat;
        face(out, 'concrete', [p, a[j], step[j], step[i]], up, seatColor);
        if (lod >= 2 && i % (lod === 3 ? 4 : 5) === 0) {
          const aisle = [0.53, 0.53 + Math.min(0.23, (0.4 / rays.length) * lod * 4)];
          const lift = ([x, y, z]) => [x, y + 0.045, z];
          const aisleCorners = [
            lift(lerp(p, a[j], aisle[0])),
            lift(lerp(p, a[j], aisle[1])),
            lift(lerp(step[i], step[j], aisle[1])),
            lift(lerp(step[i], step[j], aisle[0])),
          ];
          face(out, 'concrete', aisleCorners, up, palette.concrete);
        }
      }
    }
    const next = tiers[level + 1]?.front ?? [126, 107, 61.2];
    const fascia = roundedRing(rays, [tier.back[0] + 0.22, tier.back[1] + 0.22, next[2] - 1.35]);
    strip(out, 'concrete', end, fascia, inward, level === 2 ? palette.frame : palette.shadow);
    strip(out, 'concrete', fascia, roundedRing(rays, next), up, palette.concrete);
    if (lod >= 2) {
      for (const [i, p] of fascia.entries()) {
        if (i % 3 !== 0) continue;
        const q = [p[0] * 0.9975, p[1] - 0.9, p[2] * 0.9975];
        beam(out, 'steel', q, [q[0], q[1] + 1.84, q[2]], 0.65, 0.61, palette.frame);
      }
    }
  }
}

function pitch(out, lod) {
  const [hx, hz] = fieldSize.map((v) => v / 2);
  horizontal(out, 'field', -57.4, 57.4, -38.6, 38.6, concreteBowlY, palette.turfEdge);
  horizontal(out, 'field', -hx, hx, -hz, hz, concreteBowlY + 0.031, palette.field);
  const lines = concreteBowlY + 0.077;
  const paint = (x0, x1, z0, z1) => horizontal(out, 'field', x0, x1, z0, z1, lines, palette.paint);
  const stripe = 0.12;
  for (const sign of [-1, 1]) {
    paint(-hx, hx, sign * hz - stripe, sign * hz + stripe);
    paint(sign * hx - stripe, sign * hx + stripe, -hz, hz);
    if (!lod) continue;
    for (const [depth, wide] of [
      [16.5, 20.16],
      [5.5, 9.16],
    ]) {
      const inside = sign * (hx - depth);
      paint(inside - stripe, inside + stripe, -wide, wide);
      for (const side of [-1, 1]) {
        const [a, b] = [inside, sign * hx].sort((a, b) => a - b);
        paint(a, b, side * wide - stripe, side * wide + stripe);
      }
    }
    if (lod >= 2) {
      const x = sign * (hx + 0.32);
      beam(out, 'steel', [x, pitchY, 3.66], [x, pitchY + 2.58, 3.66], 0.14, 0.14, palette.rail);
      beam(out, 'steel', [x, pitchY, -3.66], [x, pitchY + 2.58, -3.66], 0.14, 0.14, palette.rail);
      beam(
        out,
        'steel',
        [x, pitchY + 2.58, -3.66],
        [x, pitchY + 2.58, 3.66],
        0.14,
        0.14,
        palette.rail,
      );
    }
  }
  if (!lod) return;
  paint(-stripe, stripe, -hz, hz);
  if (lod >= 2) {
    for (let i = 0; i < 12; i += 2) {
      const start = -hx + (i * 2 * hx) / 12;
      horizontal(
        out,
        'field',
        start,
        start + (2 * hx) / 12,
        -hz,
        hz,
        concreteBowlY + 0.056,
        palette.fieldLight,
      );
    }
  }
  const raysCircle = directions(lod === 3 ? 32 : 20);
  const circle = raysCircle.map(([x, z]) => [x * 9.15, lines, z * 9.15]);
  const circleInside = raysCircle.map(([x, z]) => [
    x * (9.15 - stripe),
    lines,
    z * (9.15 - stripe),
  ]);
  strip(out, 'field', circleInside, circle, up, palette.paint);
}

function rampSlab(out, polygon, height, lod) {
  cap(out, 'concrete', polygon, height, up, palette.concrete);
  const top = polygon.map((p) => point(p, height(p)));
  const bottom = top.map(([x, y, z]) => [x, y - 1.48, z]);
  const area = polygon.reduce((sum, p, i) => sum + cross2(p, polygon[(i + 1) % polygon.length]), 0);
  const sign = Math.sign(area);
  if (lod) cap(out, 'concrete', polygon, (p) => height(p) - 1.48, down, palette.podium);
  for (const [i, p] of bottom.entries()) {
    const j = (i + 1) % bottom.length;
    const facing = [(bottom[j][2] - p[2]) * sign, 0, (p[0] - bottom[j][0]) * sign];
    face(out, 'concrete', [p, bottom[j], top[j], top[i]], facing, palette.podium);
    if (lod >= 2 && Math.hypot(bottom[j][0] - p[0], bottom[j][2] - p[2]) > 35) {
      const lift = ([x, y, z]) => [x, y + 0.98, z];
      beam(out, 'steel', lift(top[i]), lift(top[j]), 0.16, 0.21, palette.rail);
      for (const t of [0.08, 0.26, 0.44, 0.62, 0.8, 0.95]) {
        const base = lerp(top[i], top[j], t);
        beam(out, 'steel', base, lift(base), 0.12, 0.12, palette.rail);
      }
    }
  }
}
function walkway(a, b, width) {
  const vector = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(...vector);
  const cross = [((-vector[1] / length) * width) / 2, ((vector[0] / length) * width) / 2];
  const points = [
    [a[0] + cross[0], a[1] + cross[1]],
    [b[0] + cross[0], b[1] + cross[1]],
    [b[0] - cross[0], b[1] - cross[1]],
    [a[0] - cross[0], a[1] - cross[1]],
  ];
  const along = ([x, z]) => ((x - a[0]) * vector[0] + (z - a[1]) * vector[1]) / (length * length);
  const sides = (t) => [lerp(points[0], points[1], t), lerp(points[3], points[2], t)];
  return { points, along, sides };
}
function support(out, [x, z], top, size = 2.36) {
  localBox(
    out,
    'concrete',
    x,
    foundationBottom,
    z,
    size,
    top - foundationBottom - 1.25,
    size,
    palette.podium,
  );
}
function approaches(out, lod) {
  const [eastFar, eastNear] = nativeWay(1369716350);
  const eastJoint = deckLanding(eastNear, 0.035);
  const east = walkway(eastFar, eastJoint, eastRampWidth);
  const eastY = (p) => blend(rampLandingY, concourseY, east.along(p));
  rampSlab(out, east.points, eastY, lod);
  for (const t of lod ? [0.28, 0.57, 0.82] : [0.57]) {
    const center = lerp(eastFar, eastJoint, t);
    if (!lod) support(out, center, eastY(center), 4);
    else for (const p of east.sides(t).map((p) => lerp(p, center, 0.27))) support(out, p, eastY(p));
  }
  const westY = ([, z]) => blend(rampLandingY, concourseY - 0.7, Math.min(1, (z + 407.2857) / 229));
  for (const id of [980589317, 980589318]) rampSlab(out, nativeWay(id), westY, lod);
  const west = walkway(...westLink, 30);
  const linkY = (p) => blend(concourseY - 0.7, concourseY, west.along(p));
  rampSlab(out, west.points, linkY, lod);
  const westPiers = [
    [-124, -358],
    [-111, -314],
    [-100, -276],
    [-87, -219],
    [-68, -198],
  ];
  for (const p of lod ? westPiers : [westPiers[2], westPiers[4]]) support(out, p, westY(p));
  if (lod) {
    for (const p of west.sides(0.52).map((q) => lerp(q, lerp(...westLink, 0.52), 0.26)))
      support(out, p, linkY(p));
  }
  for (const [index, id] of [1056370799, 1056370800, 1056370801, 1056370802].entries()) {
    const ordered = nativeWay(id);
    const [a, b] = index > 1 ? [...ordered].reverse() : ordered;
    const stair = walkway(a, b, 19.2);
    const joint = deckLanding(b, 0.05);
    const landing = walkway(b, joint, 19.2);
    rampSlab(out, landing.points, () => concourseY - 0.018, lod);
    if (lod && Math.hypot(joint[0] - b[0], joint[1] - b[1]) > 9) {
      support(out, lerp(b, joint, 0.29), concourseY, 1.85);
    }
    const count = [1, 6, 21, 55][lod];
    const rise = (t) => blend(rampLandingY, concourseY, t);
    for (let k = 0; k < count; k++) {
      const start = stair.sides(k / count),
        end = stair.sides((k + 1) / count);
      const bottom = rise(k / count),
        top = rise((k + 1) / count);
      const [u, v] = start.map((p) => point(p, top));
      face(out, 'concrete', [u, point(end[0], top), point(end[1], top), v], up, palette.tread);
      face(
        out,
        'concrete',
        [point(start[0], bottom), u, v, point(start[1], bottom)],
        [a[0] - b[0], 0, a[1] - b[1]],
        palette.riser,
      );
      if (lod >= 2 && k % 4 === 0) {
        for (const p of [u, v])
          beam(out, 'steel', p, [p[0], p[1] + 1.1, p[2]], 0.12, 0.12, palette.rail);
      }
    }
    for (const [i, p] of stair.sides(0).entries()) {
      const q = stair.sides(1)[i];
      const side = p.map((v, j) => v - a[j]);
      face(
        out,
        'concrete',
        [
          point(p, foundationBottom),
          point(q, foundationBottom),
          point(q, concourseY),
          point(p, rampLandingY),
        ],
        [side[0], 0, side[1]],
        palette.podium,
      );
      if (lod)
        beam(
          out,
          'steel',
          point(p, rampLandingY + 1.05),
          point(q, concourseY + 1.05),
          0.14,
          0.18,
          palette.rail,
        );
    }
  }
}

function build(out, lod) {
  const rays = directions([12, 28, 48, 68][lod]);
  const outline = rays.map((d) => rayPoint(shell, d));
  const deckOutline = rays.map((d) => rayPoint(deck, d));
  podium(out, outline, deckOutline, lod);
  facadeScreen(out, outline, lod);
  seating(out, lod ? rays : directions(8), lod);
  pitch(out, lod);
  roof(out, lod);
  approaches(out, lod);
}
export const stadiumSkyline = (out) => build(out, 0);
export const stadiumDistrict = (out) => build(out, 1);
export const stadiumStreet = (out) => build(out, 2);
export const stadiumCloseup = (out) => build(out, 3);
const recipe = 'jakarta-international-stadium-model.mjs';
const camera = [-304, 193, -353],
  lookAt = [-16, 29, -33];
export const stadiumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  sourceDocuments: plan.requiredSourceDocuments,
  wikidataId: 'Q6124453',
  category: 'landmark',
  build: stadiumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Jakarta International Stadium with its perforated steel bowl, broad pale roof, open retractable panels, three seating tiers and the elevated east and west approaches.',
  camera,
  lookAt,
  sunDirection: [-61, 104, -38],
  appearance: { representedDate: plan.representedDate },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'metal_painted',
    'metal_perforated_round',
    'metal_standing_seam',
  ],
  buildingCutout: {
    outline: shell,
    basis: 'The exact mapped building outline excludes overlapping generic stadium geometry.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'southwest-concourse-and-steel-screen',
      position: [-275, 40, -289],
      lookAt: [-25, 31, -38],
    },
    { name: 'open-roof-and-football-bowl', position: [-41, 160, -32], lookAt: [0, 15, 0] },
    { name: 'east-ramp-and-stadium-edge', position: [-106, 88, 339], lookAt: [22, 28, 63] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'stadium-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'stadiumSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'stadiumDistrict', 1.25],
        ['street', 'stadiumStreet', 0.52],
        ['closeup', 'stadiumCloseup', 0.18],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Nodanodaboo dedicated the exact photograph to CC0. OpenStreetMap geometry under ODbL 1.0.',
};
