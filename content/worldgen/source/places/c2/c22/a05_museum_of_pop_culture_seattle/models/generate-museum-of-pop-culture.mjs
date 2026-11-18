/**
 * Museum of Pop Culture (MoPOP, built 2000 as the Experience Music Project), Seattle Center:
 * Frank Gehry's cluster of undulating sheet-metal masses, each on its mapped OSM building part
 * in footprint.json and each in its own skin color: the tall rose-purple Sky Church mass in the
 * middle, sky-blue to the southwest, gold to the southeast, red along 5th Avenue North and
 * silver at the north end, with the Seattle Center Monorail's twin beams running through the
 * building between the blue and gold masses (+X east, +Z south).
 */

import { readFileSync } from 'node:fs';
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  purple: rgb('7e4069'),
  silver: rgb('aeb2b6'),
  gold: rgb('b8924c'),
  red: rgb('a3212b'),
  blue: rgb('6f9ddc'),
  glass: rgb('4a5a66'),
  mullion: rgb('8c9196'),
  concrete: rgb('b9b5ab'),
  beam: rgb('c4c0b6'),
  portal: rgb('25282c'),
};
const surfaces = {
  steelSkin: { slot: 'wall', graph: 'metal_stainless', roughness: 0.34, metallic: 0.45 },
  paintSkin: { slot: 'wall', graph: 'metal_painted', roughness: 0.5, metallic: 0 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.88, metallic: 0 },
  mullion: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.25 },
};

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));
/** The whole (unclipped) mapped piece of a feature, with its ground range. */
function part(id) {
  const feature = frame.features.find((f) => f.id === id);
  const piece = feature.pieces.filter((p) => !p.crossesTileEdge)[0];
  return {
    outline: piece.outline,
    groundMin: Math.min(...piece.groundAtVertices),
    groundMax: Math.max(...piece.groundAtVertices),
    height: feature.height,
  };
}

// ---------------------------------------------------------------- small geometry helpers
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function shoelace(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
function centroid(ring) {
  let cx = 0,
    cz = 0,
    a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length];
    const w = p[0] * q[1] - q[0] * p[1];
    a += w;
    cx += (p[0] + q[0]) * w;
    cz += (p[1] + q[1]) * w;
  }
  return [cx / (3 * a), cz / (3 * a)];
}
/** Resample a closed ring to n points at equal arc length, starting at ring[0]. */
function resample(ring, n) {
  const lengths = [0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    lengths.push(lengths[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[ring.length];
  const out = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const s = (total * k) / n;
    while (lengths[seg + 1] < s) seg++;
    const a = ring[seg],
      b = ring[(seg + 1) % ring.length];
    const t = (s - lengths[seg]) / (lengths[seg + 1] - lengths[seg] || 1);
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  }
  return out;
}
const perimeter = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }, 0);
/** One step of discrete curve-shortening: every point moves toward its neighbours' midpoint. */
const relax = (ring, lambda) =>
  ring.map((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length],
      b = ring[(i + 1) % ring.length];
    return [p[0] + lambda * ((a[0] + b[0]) / 2 - p[0]), p[1] + lambda * ((a[1] + b[1]) / 2 - p[1])];
  });
/** Outward unit normals of a ring ordered as outwardRing() orders it. */
const normals = (ring) =>
  ring.map((_, i) => {
    const a = ring[(i + ring.length - 1) % ring.length],
      b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len];
  });
/** Triangle that skips slivers the Float32 validation would reject. */
function face(out, slot, a, b, c, color) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (Math.hypot(...n) < 2e-3) return;
  tri(out, slot, a, b, c, color);
}

// ---------------------------------------------------------------- the sheet-metal masses
/**
 * A curved shell over a mapped outline: rings shrink by curve-shortening (rounding first, then
 * contracting) under a superellipse height profile, bulge out over the ground storey, lean, ripple
 * around the plan and carry crown waves; the top closes on an apex. Returns the base ring.
 */
function shell(out, outline, o) {
  const n = Math.max(40, Math.min(76, Math.round(perimeter(outline) / 2)));
  let ring = resample(outwardRing(outline), n);
  for (let k = 0; k < 3; k++) ring = relax(ring, 0.4);
  const base = ring;
  const area0 = Math.abs(shoelace(ring));
  const radius0 = Math.sqrt(area0 / Math.PI);
  const c0 = centroid(ring);
  const height = o.yTop - o.yBase;
  const us = [0, 0.2, 0.36, 0.5, 0.61, 0.7, 0.78, 0.845, 0.9, 0.94, 0.968, 0.986, 0.997];
  // A guideway mouth holds the skin plumb up to its head: add a ring row there.
  if (o.hold) us.push((o.hold - o.yBase) / height);
  us.sort((a, b) => a - b);
  const rings = [];
  let work = ring;
  for (const u of us) {
    const target = area0 * Math.pow(1 - Math.pow(u, o.p), 2 / o.p) * (1 - (o.taper ?? 0) * u);
    let guard = 0;
    while (Math.abs(shoelace(work)) > target && guard++ < 20000) work = relax(work, 0.5);
    rings.push({ u, ring: work });
  }
  // Crown shaping: travelling waves and a tilt that lifts one side of the roll-over.
  const crown = (x, z, u) => {
    let dy = 0;
    for (const w of o.waves ?? [])
      dy +=
        w.amp *
        Math.sin(w.freq * (x * w.dir[0] + z * w.dir[1]) + w.phase) *
        smoothstep(w.from ?? 0.45, 1, u);
    if (o.tilt)
      dy +=
        ((o.tilt.amp * ((x - c0[0]) * o.tilt.dir[0] + (z - c0[1]) * o.tilt.dir[1])) / radius0) *
        smoothstep(0.35, 1, u);
    return dy;
  };
  // Portals keep the skin plumb on the mapped line so the guideway mouths sit flush.
  const calm = base.map((p) =>
    (o.pinch ?? []).reduce(
      (f, [x, z, r]) => Math.min(f, smoothstep(0.55 * r, r, Math.hypot(p[0] - x, p[1] - z))),
      1,
    ),
  );
  const layers = rings.map(({ u, ring: r }) => {
    const ns = normals(r);
    const swell =
      (o.bulge ?? 0) * smoothstep(0.12, 0.5, u) * (1 - smoothstep(0.72, 1, u)) +
      (o.flare ?? 0) * smoothstep(0.3, 0.8, u) * (1 - smoothstep(0.85, 1, u));
    const lean = [(o.lean?.[0] ?? 0) * u * u, (o.lean?.[1] ?? 0) * u * u];
    return r.map((p, i) => {
      const ripple =
        (o.ripple?.amp ?? 0) *
        Math.sin((2 * Math.PI * (o.ripple?.lobes ?? 3) * i) / n + (o.ripple?.phase ?? 0)) *
        smoothstep(0.1, 0.45, u);
      const f = u < 0.75 ? calm[i] : lerp(calm[i], 1, smoothstep(0.75, 0.95, u));
      const d = (swell + ripple) * f;
      const x = p[0] + ns[i][0] * d + lean[0] * f,
        z = p[1] + ns[i][1] * d + lean[1] * f;
      const y = o.yBase + height * u + crown(x, z, u);
      // Near a mouth the skin stays on the mapped line up to the mouth head, then rolls over.
      const held = o.hold ? (1 - calm[i]) * (1 - smoothstep(o.hold, o.hold + 3, y)) : 0;
      return [lerp(x, base[i][0], held), y, lerp(z, base[i][1], held)];
    });
  });
  const skin = o.surface;
  for (let j = 0; j + 1 < layers.length; j++) {
    const lo = layers[j],
      hi = layers[j + 1];
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(out, skin, lo[i], lo[k], hi[k], o.color);
      face(out, skin, lo[i], hi[k], hi[i], o.color);
    }
  }
  const top = layers.at(-1);
  const c = centroid(top.map((p) => [p[0], p[2]]));
  const apex = [c[0], o.yTop + crown(c[0], c[1], 1), c[1]];
  for (let i = 0; i < n; i++) face(out, skin, top[i], top[(i + 1) % n], apex, o.color);
  return base;
}

/** Storefront glazing just proud of the vertical base of a shell, inside the given boxes. */
function glazing(out, ring, zones, y0, y1) {
  const n = ring.length;
  const ns = normals(ring);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (
      !zones.some(
        ([x0, z0, x1, z1]) => mid[0] >= x0 && mid[0] <= x1 && mid[1] >= z0 && mid[1] <= z1,
      )
    )
      continue;
    const na = ns[i],
      nb = ns[(i + 1) % n];
    const pa = [a[0] + na[0] * 0.12, a[1] + na[1] * 0.12],
      pb = [b[0] + nb[0] * 0.12, b[1] + nb[1] * 0.12];
    quad4(
      out,
      'glass',
      [pa[0], y0, pa[1]],
      [pb[0], y0, pb[1]],
      [pb[0], y1, pb[1]],
      [pa[0], y1, pa[1]],
      col.glass,
    );
    // Mullion at each panel joint and a head rail.
    const F = facade(pa, [pb[0] - pa[0], pb[1] - pa[1]]);
    const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    fbox(out, 'mullion', F, -0.08, 0.08, y0, y1, 0, 0.12, col.mullion);
    fbox(out, 'mullion', F, 0, len, y1 - 0.25, y1 + 0.1, 0, 0.16, col.mullion);
  }
}

// ---------------------------------------------------------------- the monorail
// Seattle Center Monorail through MoPOP (OSM ways 505897789 and 916411048, tunnel=building_passage),
// converted to this frame; each line runs 3.5 m or more past the mapped building at both ends.
const tracks = [
  [
    [-34.49, 21.51],
    [-31, 21.72],
    [-23.64, 22.8],
    [-16.43, 24.56],
    [-9.42, 27],
    [-2.66, 30.07],
    [3.78, 33.77],
    [9.84, 38.07],
    [15.47, 42.91],
    [20.62, 48.27],
    [23.05, 50.79],
  ],
  [
    [-34.22, 25.34],
    [-30.73, 25.54],
    [-24.4, 26.68],
    [-17.55, 28.36],
    [-10.89, 30.67],
    [-4.47, 33.6],
    [1.64, 37.11],
    [7.4, 41.2],
    [12.75, 45.8],
    [15.26, 48.41],
    [19.07, 52.38],
  ],
];
const beamTop = 9.6;
const beamDepth = 1.52; // 5 ft deep, 3 ft wide prestressed concrete guideway
const beamWidth = 0.91;

/** A level rectangular beam along a polyline with mitred joints and end caps. */
function beamAlong(out, slot, points, width, y0, y1, color) {
  const n = points.length;
  const side = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    // Outward = direction turned clockwise seen from above.
    return [-dz / len, dx / len];
  });
  const L = points.map((p, i) => [
    p[0] - (side[i][0] * width) / 2,
    p[1] - (side[i][1] * width) / 2,
  ]);
  const R = points.map((p, i) => [
    p[0] + (side[i][0] * width) / 2,
    p[1] + (side[i][1] * width) / 2,
  ]);
  const at = (q, y) => [q[0], y, q[1]];
  for (let i = 0; i + 1 < n; i++) {
    quad4(out, slot, at(R[i], y0), at(R[i + 1], y0), at(R[i + 1], y1), at(R[i], y1), color);
    quad4(out, slot, at(L[i + 1], y0), at(L[i], y0), at(L[i], y1), at(L[i + 1], y1), color);
    quad4(out, slot, at(R[i], y1), at(R[i + 1], y1), at(L[i + 1], y1), at(L[i], y1), color);
    quad4(out, slot, at(L[i], y0), at(L[i + 1], y0), at(R[i + 1], y0), at(R[i], y0), color);
  }
  quad4(out, slot, at(L[0], y0), at(R[0], y0), at(R[0], y1), at(L[0], y1), color);
  quad4(out, slot, at(R[n - 1], y0), at(L[n - 1], y0), at(L[n - 1], y1), at(R[n - 1], y1), color);
}

/** T-pylon under both beams: a column and a crossarm across the guideways. */
function pylon(out, center, across, groundY) {
  const F = facade(center, [-across[1], across[0]]);
  const armBottom = beamTop - beamDepth - 1.1;
  fbox(out, 'concrete', F, -0.6, 0.6, groundY - 1, armBottom, -0.9, 0.9, col.concrete);
  fbox(out, 'concrete', F, -0.75, 0.75, armBottom, beamTop - beamDepth, -3.1, 3.1, col.concrete);
}

/** Guideway mouth: a dark opening just proud of the held, plumb skin, with a slim head rail. */
function mouth(out, ring, m) {
  const n = ring.length;
  const ns = normals(ring);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    if (Math.hypot((a[0] + b[0]) / 2 - m.c[0], (a[1] + b[1]) / 2 - m.c[1]) > m.hw) continue;
    const na = ns[i],
      nb = ns[(i + 1) % n];
    const pa = [a[0] + na[0] * 0.14, a[1] + na[1] * 0.14],
      pb = [b[0] + nb[0] * 0.14, b[1] + nb[1] * 0.14];
    quad4(
      out,
      'glass',
      [pa[0], m.y0, pa[1]],
      [pb[0], m.y0, pb[1]],
      [pb[0], m.y1, pb[1]],
      [pa[0], m.y1, pa[1]],
      col.portal,
    );
    const F = facade(pa, [pb[0] - pa[0], pb[1] - pa[1]]);
    const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    fbox(out, 'mullion', F, -0.05, len + 0.05, m.y1, m.y1 + 0.4, 0, 0.25, col.mullion);
  }
}

// Portal wall lines and the skin pinches that keep them plumb.
const westPortal = { pinch: [-31, 23.5, 11], mouth: { c: [-31, 23.5], hw: 5, y0: 7.2, y1: 13.6 } };
const eastPortal = { pinch: [18, 48.6, 11], mouth: { c: [18, 48.6], hw: 5.4, y0: 7.2, y1: 13.6 } };

function monorail(out) {
  for (const t of tracks)
    beamAlong(out, 'concrete', t, beamWidth, beamTop - beamDepth, beamTop, col.beam);
  pylon(out, [-32.4, 23.5], [-0.06, 1], 2.6);
  pylon(out, [20.3, 50.8], [-0.69, 0.72], 0.7);
}

// ---------------------------------------------------------------- the building
function building(out) {
  const purple = part('35185906997820');
  const silverWest = part('35185906997821');
  const silverNorth = part('35185906997822');
  const blue = part('35185906997823');
  const red = part('35185906997824');
  const redWedge = part('35185906997825');
  const gold = part('35185906997826');

  // Sky Church: the tallest mass, its crown 85 ft above the Seattle Center entrance level,
  // leaning in over the middle of the cluster (mapped roof:shape=pyramidal).
  const skyChurch = shell(out, purple.outline, {
    surface: 'steelSkin',
    color: col.purple,
    yBase: purple.groundMin - 1,
    yTop: 26.5,
    p: 2.0,
    taper: 0.45,
    bulge: 1.6,
    lean: [4.5, -2.2],
    ripple: { amp: 0.9, lobes: 3, phase: 0.7 },
    tilt: { amp: 2.5, dir: [0.8, -0.6] },
    waves: [{ amp: 1.0, freq: 0.32, dir: [0.8, 0.6], phase: 0.4 }],
  });
  // Silver at the northwest corner rolls up toward Harrison Street.
  shell(out, silverWest.outline, {
    surface: 'steelSkin',
    color: col.silver,
    yBase: silverWest.groundMin - 1,
    yTop: silverWest.groundMin + silverWest.height - 0.5,
    p: 2.8,
    bulge: 1.4,
    lean: [-3.6, -3.0],
    ripple: { amp: 1.1, lobes: 4, phase: 2.1 },
    tilt: { amp: 4.0, dir: [-0.6, -0.8] },
    waves: [{ amp: 1.3, freq: 0.42, dir: [1, 0.25], phase: 1.2 }],
  });
  // The north mass rises in a run of silver waves (mapped roof:shape=sawtooth).
  shell(out, silverNorth.outline, {
    surface: 'steelSkin',
    color: col.silver,
    yBase: silverNorth.groundMin - 1,
    yTop: silverNorth.groundMin + silverNorth.height,
    p: 3.4,
    bulge: 1.6,
    lean: [2.0, -3.6],
    ripple: { amp: 1.3, lobes: 5, phase: 0.3 },
    waves: [
      { amp: 2.8, freq: 0.6, dir: [0.94, 0.34], phase: 0.5, from: 0.3 },
      { amp: 0.8, freq: 0.3, dir: [-0.3, 0.95], phase: 1.9 },
    ],
  });
  // Sky blue facing the Space Needle, overhanging its southwest side; the guideways leave
  // through its west wall.
  const blueBase = shell(out, blue.outline, {
    surface: 'paintSkin',
    color: col.blue,
    yBase: blue.groundMin - 1,
    yTop: blue.groundMin + blue.height,
    p: 2.5,
    bulge: 1.5,
    lean: [-3.4, 3.6],
    ripple: { amp: 1.0, lobes: 3, phase: 1.4 },
    tilt: { amp: 3.6, dir: [-0.6, 0.8] },
    waves: [{ amp: 0.9, freq: 0.36, dir: [0.6, -0.8], phase: 0.2 }],
    pinch: [westPortal.pinch],
    hold: westPortal.mouth.y1 + 0.6,
  });
  // Red along 5th Avenue North: a butterfly crown (mapped roof:shape=butterfly) leaning out
  // over the sidewalk.
  const redBase = shell(out, red.outline, {
    surface: 'paintSkin',
    color: col.red,
    yBase: red.groundMin - 1,
    yTop: red.groundMin + red.height,
    p: 3.0,
    bulge: 1.3,
    lean: [4.2, 0.6],
    ripple: { amp: 1.0, lobes: 4, phase: 2.6 },
    waves: [{ amp: -3.2, freq: 0.16, dir: [0.2, 0.98], phase: 1.75 }],
  });
  shell(out, redWedge.outline, {
    surface: 'paintSkin',
    color: col.red,
    yBase: redWedge.groundMin - 1,
    yTop: redWedge.groundMin + redWedge.height,
    p: 2.4,
    bulge: 0.6,
    lean: [0.6, 0.6],
  });
  // Gold sweeps down toward the southeast corner, over the guideways' east mouth.
  const goldBase = shell(out, gold.outline, {
    surface: 'steelSkin',
    color: col.gold,
    yBase: gold.groundMin - 1,
    yTop: gold.groundMin + gold.height + 2,
    p: 2.6,
    bulge: 1.6,
    lean: [2.6, 3.2],
    ripple: { amp: 1.2, lobes: 4, phase: 0.9 },
    tilt: { amp: -4.5, dir: [0.6, 0.8] },
    waves: [{ amp: 1.1, freq: 0.3, dir: [0.7, 0.7], phase: 2.2 }],
    pinch: [eastPortal.pinch],
    hold: eastPortal.mouth.y1 + 0.6,
  });

  // Entrances: the Seattle Center (west) doors under the Sky Church and silver masses, and the
  // 5th Avenue North doors under the red and gold.
  glazing(out, skyChurch, [[-40, -16, -24, 16]], purple.groundMax - 0.5, purple.groundMax + 4.2);
  glazing(out, redBase, [[29, -12, 40, 8]], red.groundMax - 0.6, red.groundMax + 3.8);
  glazing(out, goldBase, [[22, 8, 40, 30]], -0.2, 3.9);
  mouth(out, blueBase, westPortal.mouth);
  mouth(out, goldBase, eastPortal.mouth);
  glazing(out, blueBase, [[-34, 26, -26, 50]], blue.groundMax - 0.4, blue.groundMax + 3.6);
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A05',
  title: 'Museum of Pop Culture, Seattle',
  wikidataId: 'Q1384356',
  brief:
    "Frank Gehry's 2000 Museum of Pop Culture (built as the Experience Music Project): a cluster of undulating sheet-metal masses on the mapped building parts, each clad in its own color of stainless steel or painted aluminum shingles: the tall rose-purple Sky Church crown in the middle, sky blue to the southwest, gold to the southeast, red along 5th Avenue North and rippling silver at the north end; the Seattle Center Monorail's twin concrete guideways pass through the building between the blue and gold masses; glazed entrances on the Seattle Center and 5th Avenue sides.",
  surfaces,
  smooth: { steelSkin: 50, paintSkin: 50 },
  build(out) {
    building(out);
    monorail(out);
  },
  dimensions: [
    {
      fact: 'Plan: the mapped OSM building 35184533676574 (way 161587742, MoPOP) and its seven parts 35185906997820-35185906997826; each part is one colored mass',
      source: 'footprint.json',
    },
    {
      fact: 'Part colors as mapped: 1534908988 maroon (h 22, tallest, the purple Sky Church crown), 1534908989 and 1534908990 silver (h 20), 1534908991 #6495ED blue (h 20), 1534908992 and 1534908993 red (h 19, 18), 1534908994 gold (h 19)',
      source: 'https://www.openstreetmap.org/way/1534908988',
    },
    {
      fact: '140,000 sq ft on a 35,000 sq ft footprint; highest point 85 ft at the Sky Church; widest 210 ft at W Harrison St; 360 ft long on 5th Ave N; about 3,000 panels of 21,000 stainless steel and painted aluminum shingles',
      source: 'https://www.mopop.org/building',
    },
    {
      fact: 'Purple, gold and silver skins are stainless steel; red and blue skins are painted aluminum; curved steel ribs carry the skin',
      source: 'https://special.seattletimes.com/o/special/emp/bldg/cons20.html',
    },
    {
      fact: 'The Sky Church is the purple-skinned central tower',
      source: 'https://www.thestranger.com/news/its-a-bird-its-a-plane-4134/',
    },
    {
      fact: 'Monorail guideways: OSM ways 505897789 and 916411048 (tunnel=building_passage) through the building; beams 3 ft wide by 5 ft deep, about 20 ft clear underneath',
      source: 'https://en.wikipedia.org/wiki/Seattle_Center_Monorail',
    },
  ],
  limitations: [
    'Each mass is a smooth lofted shell over its mapped outline with an estimated profile, lean and crown ripple; the real crumpled folds, fins and shingle courses are not modelled, and crown heights follow the mapped part heights above local ground (the Sky Church crown is set to the published 85 ft).',
    'Colors are the mapped part colors matched to published finishes; the iridescent shift of the stainless skins is a single tint per mass.',
    'The monorail passage is shown as twin beams on two T-pylons with dark tunnel mouths where the mapped passage meets the skin; beam height is estimated from the published 20 ft clearance. Trains are not part of the model.',
    'Entrance glazing, the glass canopy and interior spaces are simplified or omitted.',
  ],
});
