/** Native refinery tank/hall layout; cleared NIOC photographs guide industrial detailing. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/tj/tj6/abadan_refinery/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const pale = rgb('c2c4b6'),
  steel = rgb('737f7a'),
  dark = rgb('515d5c'),
  ochre = rgb('b9a37e'),
  roof = rgb('88968f'),
  concrete = rgb('ada995');
const surfaces = {
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.86, metallic: 0.17 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.22 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  base: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
const ref = 'palette:#ffffff';
const area = (r) =>
  r.reduce((n, p, i) => {
    const b = r[(i + 1) % r.length];
    return n + p[0] * b[1] - b[0] * p[1];
  }, 0) / 2;
const center = (r) => [0, 1].map((k) => r.reduce((n, p) => n + p[k], 0) / r.length);
const structures = plan.buildings.map((b) => {
  const c = center(b.outline),
    r = Math.sqrt(b.areaMeters2 / Math.PI);
  return {
    ...b,
    c,
    r,
    height:
      Number(b.tags.height) ||
      Number(b.tags['building:levels']) * 4 ||
      (b.tags.man_made === 'storage_tank' ? Math.max(7, Math.min(18, r * 0.8)) : 8),
  };
});
const tanks = structures
    .filter((b) => b.tags.man_made === 'storage_tank')
    .sort((a, b) => b.areaMeters2 - a.areaMeters2),
  halls = structures
    .filter((b) => b.tags.man_made !== 'storage_tank')
    .sort((a, b) => b.areaMeters2 - a.areaMeters2);
function tri(out, slot, p, col) {
  out.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    col,
  );
}
function cap(out, slot, r, y, col, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3) {
    let ps = ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
    if (normalFor(...ps)[1] > 0 !== up) ps = [ps[0], ps[2], ps[1]];
    tri(out, slot, ps, col);
  }
}
function shell(out, slot, rings, col) {
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length,
        ps = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]];
      quad(out, slot, ps, normalFor(...ps), col);
    }
}
function cylinder(out, c, r, y, h, col, n, slot = 'metal', d = 0) {
  const heights = d === 3 ? [y, y + h * 0.49, y + h * 0.495, y + h] : [y, y + h];
  const rings = heights.map((v) => radialRing(v, r, r, n, c));
  for (let i = 1; i < rings.length; i++)
    shell(out, slot, [rings[i - 1], rings[i]], i === 2 ? steel : col);
  cap(
    out,
    slot,
    rings[0].map((p) => [p[0], p[2]]),
    y,
    col,
    false,
  );
  return rings.at(-1);
}
function tank(out, b, d, index) {
  const n = [4, 6, 10, 20][d],
    top = cylinder(out, b.c, b.r, -0.3, b.height + 0.3, pale, n, 'metal', d);
  const rise = Math.min(1.5, b.r * 0.045);
  for (let i = 0; i < n; i++)
    tri(out, 'metal', [top[i], top[(i + 1) % n], [b.c[0], b.height + rise, b.c[1]]], roof);
  if (d > 1 && index < 10) {
    const angle = -0.9,
      dx = Math.cos(angle),
      dz = Math.sin(angle),
      x = b.c[0] + dx * (b.r + 0.4),
      z = b.c[1] + dz * (b.r + 0.4);
    for (const sign of [-1, 1])
      beam(
        out,
        'steel',
        [x - dz * sign * 0.32, 0, z + dx * sign * 0.32],
        [x - dz * sign * 0.32, b.height + 0.9, z + dx * sign * 0.32],
        0.12,
        0.12,
        dark,
      );
    if (d === 3)
      for (let y = 0.4; y < b.height; y += 0.6)
        beam(
          out,
          'steel',
          [x + dz * 0.32, y, z - dx * 0.32],
          [x - dz * 0.32, y, z + dx * 0.32],
          0.085,
          0.085,
          steel,
        );
    const vent = cylinder(out, b.c, 0.36, b.height + rise, 0.65, steel, 6, 'steel');
    cap(
      out,
      'steel',
      vent.map((p) => [p[0], p[2]]),
      b.height + rise + 0.65,
      steel,
    );
  }
}
function gableRoof(out, r, h) {
  let edge = 0;
  for (let i = 1; i < r.length; i++)
    if (
      Math.hypot(...r[i].map((v, k) => v - r[(i + 1) % r.length][k])) >
      Math.hypot(...r[edge].map((v, k) => v - r[(edge + 1) % r.length][k]))
    )
      edge = i;
  const a = r[edge],
    b = r[(edge + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
    u = (p) => p[0] * n[0] + p[1] * n[1],
    us = r.map(u),
    lo = Math.min(...us),
    hi = Math.max(...us),
    mid = (lo + hi) / 2,
    half = (hi - lo) / 2,
    rise = Math.min(4, half * 0.25),
    y = (p) => h + rise * (1 - Math.abs(u(p) - mid) / half);
  for (const sign of [-1, 1]) {
    const ring = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        ua = u(a) - mid,
        ub = u(b) - mid;
      if (ua * sign >= -1e-7) ring.push(a);
      if (ua * ub < 0) {
        const t = -ua / (ub - ua);
        ring.push(a.map((v, k) => v + t * (b[k] - v)));
      }
    }
    const ix = earcut(ring.flat());
    for (let i = 0; i < ix.length; i += 3) {
      let ps = ix.slice(i, i + 3).map((j) => [ring[j][0], y(ring[j]), ring[j][1]]);
      if (normalFor(...ps)[1] < 0) ps = [ps[0], ps[2], ps[1]];
      tri(out, 'metal', ps, roof);
    }
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      crosses = (u(a) - mid) * (u(b) - mid) < 0,
      ring = crosses
        ? [a, a.map((v, k) => v + ((mid - u(a)) / (u(b) - u(a))) * (b[k] - v)), b]
        : [a, b];
    for (let j = 1; j < ring.length; j++) {
      const a = ring[j - 1],
        b = ring[j];
      if (Math.max(y(a), y(b)) - h < 1e-7) continue;
      const ps = [
        [a[0], h, a[1]],
        [b[0], h, b[1]],
        [b[0], y(b), b[1]],
        [a[0], y(a), a[1]],
      ];
      if (y(a) - h < 1e-7) tri(out, 'wall', ps.slice(0, 3), ochre);
      else if (y(b) - h < 1e-7) tri(out, 'wall', [ps[0], ps[1], ps[3]], ochre);
      else quad(out, 'wall', ps, normalFor(...ps), ochre);
    }
  }
}
function hall(out, b, d) {
  let r = b.outline;
  if (area(r) > 0) r = [...r].reverse();
  const h = b.height,
    rs = [-0.25, h].map((y) => r.map((p) => [p[0], y, p[1]]));
  shell(out, 'wall', rs, ochre);
  cap(out, 'base', r, -0.25, concrete, false);
  if (r.length === 4 || b.tags['building:roof'] === 'gabled') gableRoof(out, r, h);
  else cap(out, 'metal', r, h, roof);
  if (d < 3) return;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 12) continue;
    const dx = (b[0] - a[0]) / len,
      dz = (b[1] - a[1]) / len,
      nx = -dz,
      nz = dx;
    const count = Math.max(1, Math.floor(len / 12));
    for (let j = 0; j < count; j++) {
      const t = ((j + 0.5) * len) / count,
        x = a[0] + dx * t + nx * 0.08,
        z = a[1] + dz * t + nz * 0.08;
      beam(
        out,
        'steel',
        [x - dx * 1.4, h * 0.7, z - dz * 1.4],
        [x + dx * 1.4, h * 0.7, z + dz * 1.4],
        0.7,
        0.12,
        dark,
      );
    }
    if (d === 3) beam(out, 'metal', [a[0], h + 0.06, a[1]], [b[0], h + 0.06, b[1]], 0.2, 0.2, pale);
  }
}
const processCenters = [
  [-350, 100],
  [-500, 300],
  [-800, 500],
];
function process(out, c, d, index) {
  const columns = d === 0 ? 1 : d === 1 ? 2 : 3;
  for (let j = 0; j < columns; j++) {
    const p = [c[0] + j * 19, c[1] + j * 5],
      r = j === 0 ? 3.6 : 2.6,
      h = [49, 34, 25][j] - index * 3,
      n = [4, 6, 10, 20][d],
      top = cylinder(out, p, r, 0, h, pale, n);
    cap(
      out,
      'metal',
      top.map((p) => [p[0], p[2]]),
      h,
      pale,
    );
    if (d > 0)
      for (let y = 8; y < h - 2; y += d < 3 ? 15 : 9) {
        const ring = radialRing(y, r + 1.15, r + 1.15, n, p),
          upper = radialRing(y + 0.22, r + 1.15, r + 1.15, n, p);
        shell(out, 'steel', [ring, upper], dark);
        cap(
          out,
          'steel',
          upper.map((p) => [p[0], p[2]]),
          y + 0.22,
          steel,
        );
        if (d > 1) {
          for (let k = 0; k < n; k++) {
            const next = (k + 1) % n,
              a = ring[k],
              b = ring[next];
            beam(out, 'steel', [a[0], y + 1.15, a[2]], [b[0], y + 1.15, b[2]], 0.1, 0.1, dark);
            if (d === 3 && k % 2 === 0)
              beam(out, 'steel', [a[0], y, a[2]], [a[0], y + 1.2, a[2]], 0.1, 0.1, dark);
          }
        }
      }
    if (d > 1)
      for (const sign of [-1, 1])
        beam(
          out,
          'steel',
          [p[0] + r + 0.6, 0, p[1] + sign * 0.34],
          [p[0] + r + 0.6, h, p[1] + sign * 0.34],
          0.1,
          0.1,
          dark,
        );
  }
  if (d < 2) return;
  for (let i = 0; i < 4; i++) {
    const x = c[0] + i * 18,
      z = c[1] - 20;
    for (const side of [-1, 1])
      beam(out, 'steel', [x, 0, z + side * 5], [x, 8, z + side * 5], 0.35, 0.35, steel);
    beam(out, 'steel', [x, 8, z - 5], [x, 8, z + 5], 0.4, 0.4, steel);
  }
  for (const off of [-2, 0, 2])
    beam(
      out,
      'steel',
      [c[0], 8.5, c[1] - 20 + off],
      [c[0] + 54, 8.5, c[1] - 20 + off],
      0.45,
      0.45,
      steel,
    );
  for (let i = 0; i < 3; i++) {
    const x = c[0] + i * 11,
      z = c[1] + 19;
    B(out, 'base', x, 0, z, 3, 2.4, 9, concrete);
    const n = d === 3 ? 16 : 8,
      rs = [-6, 6].map((v) =>
        Array.from({ length: n }, (_, k) => {
          const t = (k / n) * Math.PI * 2;
          return [x + Math.cos(t) * 2.1, 4.7 + Math.sin(t) * 2.1, z + v];
        }),
      );
    shell(out, 'metal', rs, pale);
    for (const [end, original] of rs.entries()) {
      const ring = end === 0 ? [...original].reverse() : original;
      const centroid = [x, 4.7, ring[0][2]];
      for (let k = 0; k < n; k++) tri(out, 'metal', [ring[k], ring[(k + 1) % n], centroid], pale);
    }
  }
}
function build(out, _frame, d = 3) {
  const selectedTanks = d === 0 ? tanks.slice(0, 26) : d === 1 ? tanks.slice(0, 112) : tanks,
    selectedHalls = d === 0 ? halls.slice(0, 12) : d === 1 ? halls.slice(0, 24) : halls;
  for (let i = 0; i < selectedTanks.length; i++) tank(out, selectedTanks[i], d, i);
  for (const b of selectedHalls) hall(out, b, d);
  for (let i = 0; i < processCenters.length; i++) process(out, processCenters[i], d, i);
}
export const abadanSkyline = (o, f) => build(o, f, 0);
export const abadanDistrict = (o, f) => build(o, f, 1);
export const abadanStreet = (o, f) => build(o, f, 2);
export const abadanRefineryModel = {
  id: 'abadan_refinery',
  key: 'abadan_refinery',
  recipe: 'structure-abadan-refinery.mjs',
  cell: 'tj/tj6',
  title: 'Abadan Refinery',
  category: 'industrial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete mapped refinery structure layout:204native oil-storage tanks and74halls/other structures, using full original ways/nodes and tagged heights. Pale metal cylinders, low conical roofs, concrete footings, industrial halls, ladders, vessel catwalks and pipe racks interpret two cleared1970NIOC photographs. Unmapped process equipment is approximate and explicitly identified; adjacent city and detached river industry excluded.',
  camera: [2200, 1800, 2800],
  lookAt: [0, 12, 0],
  mediumFiContext: { scale: 19 },
  qaCameras: [
    { name: 'native-storage-tank-farm', position: [1200, 250, -700], lookAt: [500, 10, -600] },
    { name: 'process-columns-and-pipe-racks', position: [-210, 90, 245], lookAt: [-330, 20, 95] },
    { name: 'southern-industrial-halls', position: [-270, 170, 1450], lookAt: [-530, 6, 1050] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original mapped service-road point near the story position fixes a shared dry-yard datum before terrain acquisition. Individual tank bottoms and hall footings extend0.25-0.3m below it; low-relief multi-kilometer host-ground contact remains approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-abadan-refinery.mjs',
    level: 'skyline',
    export: 'abadanSkyline',
    errorMeters: 25,
    surfaces,
    authoredLevels: {
      district: { export: 'abadanDistrict', errorMeters: 12, surfaces },
      street: { export: 'abadanStreet', errorMeters: 4, surfaces },
    },
  },
  limitations: [
    'Full original native ways/nodes locate204tagged oil-storage tanks and74other mapped structures. Tagged heights/levels are retained; missing heights, small roof falls, ladders, hall openings and material colors are photographic medium-fi estimates. Fine components retire in distant LODs while large tank-farm groups and principal halls remain.',
    'Two Qualla-published NIOC photographs explicitly dated1970-09 and carrying PD Iran control industrial form/material typology. The native plan is current mapping, not a claim that every1970equipment item survives unchanged. Original pixels are not textures.',
    'Three compact process-column/rack/vessel groups in the open process quarter are photographic interpretations of intrinsic refinery equipment absent from mapping. Their exact locations, inventory, pipe routing and heights are approximate, not an engineering or current as-built survey. No branded labels, people, flame/smoke or active process simulation.',
    'The site spans about2.8by3.1km. Host terrain and foundation contact use one approximate shared dry-yard datum; source terrain is preserved and no whole-site platform or blanket ground cutout is introduced. City, hospital, airport and detached river industry are excluded.',
  ],
};
