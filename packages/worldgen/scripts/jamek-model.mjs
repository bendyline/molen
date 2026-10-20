/** Jamek Mosque: mapped connected halls,three onion domes,two banded lantern minarets. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/w2/w28/n0474_sultan_abdul_samad_jamek_mosque/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  rec = frame.reconstruction,
  plans = rec.plans,
  floor = rec.floorY;
const palette = {
    wall: '#bd8069',
    trim: '#e2dfd0',
    roof: '#dddcd0',
    metal: '#586967',
    floor: '#c8c2b3',
    glass: '#536772',
  },
  colors = Object.fromEntries(
    Object.entries(palette).map(([k, h]) => [
      k,
      h
        .slice(1)
        .match(/../g)
        .map((q) => {
          const v = parseInt(q, 16) / 255;
          return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        }),
    ]),
  );
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]],
  center = (r) => [0, 1].map((k) => r.reduce((s, p) => s + p[k], 0) / r.length),
  sign = (r) =>
    Math.sign(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ),
  scaled = (r, f) => {
    const p = center(r);
    return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
  },
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
export function jamekGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Jamek footing outside source terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
const footing = (p) => Math.min(-0.35, floor - 0.3, jamekGround(...p) - 0.35);
function writer(out, d) {
  return (slot, p, direction) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction)
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((s, v, k) => s + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    const col = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        col,
      );
    }
  };
}
function cap(face, r, y, slot, holes = [], down = false) {
  const ps = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(ps.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(ps[k], y)),
      [0, down ? -1 : 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function profile(face, r, levels, slot) {
  const p = center(r);
  let prev = scaled(r, levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const next = scaled(r, levels[i][1]);
    for (let k = 0; k < r.length; k++) {
      const j = (k + 1) % r.length;
      face(
        slot,
        [
          at(prev[k], levels[i - 1][0]),
          at(prev[j], levels[i - 1][0]),
          at(next[j], levels[i][0]),
          at(next[k], levels[i][0]),
        ],
        [(prev[k][0] + prev[j][0]) / 2 - p[0], 0.1, (prev[k][1] + prev[j][1]) / 2 - p[1]],
      );
    }
    prev = next;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
function coping(face, r, y, h, slot = 'trim', f = 1.012) {
  const outer = scaled(r, f);
  sides(face, outer, y, y + h, slot);
  cap(face, outer, y + h, slot, [r]);
  cap(face, outer, y, slot, [r], true);
}
function subdivide(r, max) {
  return r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
}
function archShape(width, bottom, height, d) {
  const w = width / 2,
    s = height * 0.59,
    r = height - s;
  const right =
    d <= 1
      ? [
          [w, bottom + s],
          [w * 0.65, bottom + s + r * 0.65],
          [0, bottom + height],
        ]
      : d === 2
        ? [
            [w, bottom + s],
            [w * 0.57, bottom + s + r * 0.4],
            [w * 0.73, bottom + s + r * 0.58],
            [w * 0.36, bottom + s + r * 0.85],
            [0, bottom + height],
          ]
        : [
            [w, bottom + s],
            [w * 0.98, bottom + s + r * 0.17],
            [w * 0.76, bottom + s + r * 0.36],
            [w * 0.57, bottom + s + r * 0.4],
            [w * 0.73, bottom + s + r * 0.58],
            [w * 0.64, bottom + s + r * 0.76],
            [w * 0.4, bottom + s + r * 0.87],
            [w * 0.22, bottom + s + r * 0.9],
            [0, bottom + height],
          ];
  return [
    [-w, bottom],
    [w, bottom],
    ...right,
    ...right
      .slice(0, -1)
      .toReversed()
      .map(([x, y]) => [-x, y]),
  ];
}
function edgeData(r) {
  const sg = sign(r);
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return { a, b, len, axis, normal: [axis[1] * sg, -axis[0] * sg] };
  });
}
export function jamekArcades(d = 3) {
  const all = [];
  for (const p of [...plans.bodies, ...plans.connectors]) {
    const cx = center(p.outline)[0];
    for (const [i, e] of edgeData(p.outline).entries()) {
      if (e.len < 4.5) continue;
      const rear = e.normal[1] < -0.65,
        primary =
          p.role === 'main-hall'
            ? e.normal[1] > 0.65
            : p.role === 'side-wing'
              ? e.normal[0] * (cx < -12 ? 1 : -1) > 0.65 || e.normal[1] > 0.65
              : true;
      if (d === 0 && (!primary || p.role === 'low-connector')) continue;
      const step =
          d === 0
            ? e.len / (p.role === 'main-hall' ? 4 : p.role === 'side-wing' ? 3 : 1)
            : d === 1
              ? primary
                ? 9.5
                : 14
              : rear
                ? 6
                : 4.2,
        count = Math.max(
          d === 1 && primary ? (p.role === 'main-hall' ? 3 : 2) : 1,
          Math.floor(e.len / step),
        ),
        bay = e.len / count,
        width = Math.min(d === 0 ? bay * 0.63 : rear ? 2.0 : 3.0, bay - 0.8),
        bottom = rear ? 1.65 : 0.35,
        height = rear ? 3.5 : p.wallTop - 1.55 - bottom;
      for (let j = 0; j < count; j++)
        all.push({
          name: `${p.id}-${i}-${j}`,
          bodyId: p.id,
          edge: i,
          u: bay * (j + 0.5),
          width,
          bottom,
          height,
          closed: rear,
          center: e.a.map((v, k) => v + e.axis[k] * bay * (j + 0.5)),
          axis: e.axis,
          normal: e.normal,
          wallTop: p.wallTop,
        });
    }
  }
  return all;
}
function arcadeWall(face, e, hs, top, d) {
  const thickness = 0.42,
    point = (u, y, n = 0) => [
      e.a[0] + e.axis[0] * u + e.normal[0] * n,
      floor + y,
      e.a[1] + e.axis[1] * u + e.normal[1] * n,
    ],
    holes = hs.map((h) => archShape(h.width, h.bottom, h.height, d).map(([u, y]) => [u + h.u, y])),
    r = [
      [0, 0.3],
      [e.len, 0.3],
      [e.len, top - 0.25],
      [0, top - 0.25],
    ],
    ps = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(ps.flat(), starts, 2);
  for (const [off, dir] of d === 0
    ? [[0, 1]]
    : [
        [0, 1],
        [-thickness, -1],
      ])
    for (let i = 0; i < ids.length; i += 3)
      face(
        'wall',
        ids.slice(i, i + 3).map((k) => point(...ps[k], off)),
        [e.normal[0] * dir, 0, e.normal[1] * dir],
      );
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i],
      inner = archShape(h.width, h.bottom, h.height, d),
      outer = archShape(h.width + 0.5, h.bottom - 0.15, h.height + 0.3, d);
    for (let j = 0; j < inner.length; j++) {
      const k = (j + 1) % inner.length,
        a = inner[j],
        b = inner[k],
        du = b[0] - a[0],
        dy = b[1] - a[1];
      if (d >= 1)
        face(
          'trim',
          [
            point(a[0] + h.u, a[1]),
            point(b[0] + h.u, b[1]),
            point(b[0] + h.u, b[1], -thickness),
            point(a[0] + h.u, a[1], -thickness),
          ],
          [-dy * e.axis[0], du, -dy * e.axis[1]],
        );
      if (d >= 1)
        for (const [off, dir] of d <= 2
          ? [[0.025, 1]]
          : [
              [0.025, 1],
              [-thickness - 0.025, -1],
            ])
          face(
            'trim',
            [
              point(outer[j][0] + h.u, outer[j][1], off),
              point(outer[k][0] + h.u, outer[k][1], off),
              point(b[0] + h.u, b[1], off),
              point(a[0] + h.u, a[1], off),
            ],
            [e.normal[0] * dir, 0, e.normal[1] * dir],
          );
    }
    if (h.closed) {
      const p = inner.map(([u, y]) => point(u + h.u, y, -0.22)),
        tri = earcut(inner.flat(), null, 2);
      for (let j = 0; j < tri.length; j += 3)
        for (const side of [1, -1])
          face(
            'glass',
            tri.slice(j, j + 3).map((k) => p[k]),
            [e.normal[0] * side, 0, e.normal[1] * side],
          );
    }
  }
}
function body(face, p, d, arches) {
  const r = p.outline;
  sides(face, d === 0 ? r : subdivide(r, 2.5), footing, 0.3, 'floor');
  cap(face, r, 0.3, 'floor');
  for (const [i, e] of edgeData(r).entries())
    arcadeWall(
      face,
      e,
      arches.filter((h) => h.bodyId === p.id && h.edge === i),
      p.wallTop,
      d,
    );
  cap(face, r, p.wallTop, 'roof');
  cap(face, r, p.wallTop - 0.25, 'trim', [], true);
  if (d >= 2) {
    coping(face, r, p.wallTop - 0.25, 0.25, 'trim');
    coping(face, r, p.wallTop, 0.18, 'metal', 1.016);
  } else {
    sides(face, r, p.wallTop - 0.25, p.wallTop, 'trim');
    if (d === 1) sides(face, scaled(r, 1.016), p.wallTop, p.wallTop + 0.18, 'metal');
  }
  if (d >= 2)
    for (const e of edgeData(r)) {
      const count = Math.floor(e.len / 4.2);
      for (let i = 0; i <= count; i++) {
        if (!count) continue;
        const q = e.a.map((v, k) => v + (e.axis[k] * e.len * i) / count);
        profile(
          face,
          circle(q, 0.24, 4),
          [
            [p.wallTop + 0.18, 1],
            [p.wallTop + 0.52, 1.6],
            [p.wallTop + 0.9, 0],
          ],
          'trim',
        );
      }
    }
}
function finial(face, p, y, h, d) {
  profile(
    face,
    circle(p, d === 0 ? 0.2 : 0.14, d <= 1 ? 4 : 8),
    [
      [y, 1],
      [y + h * 0.25, 1.3],
      [y + h, 0],
    ],
    'metal',
  );
}
function onion(face, p, r, base, top, d) {
  const ring = circle(p, r, [6, 8, 12, 20, 24][d]),
    h = top - base;
  profile(
    face,
    ring,
    d === 0
      ? [
          [base, 0.78],
          [base + h * 0.4, 1],
          [top, 0.06],
        ]
      : [
          [base, 0.78],
          [base + h * 0.22, 1],
          [base + h * 0.5, 0.92],
          [base + h * 0.77, 0.56],
          [top, 0.06],
        ],
    'roof',
  );
}
function dome(face, p, d) {
  const mapped = p.outline,
    ring = d <= 1 ? circle(p.center, p.radius, d === 0 ? 6 : 8) : mapped;
  profile(
    face,
    ring,
    [
      [8, 1],
      [11, 1],
    ],
    'trim',
  );
  if (d >= 2) coping(face, ring, 10.8, 0.2, 'trim');
  onion(face, p.center, p.radius, 11, p.roofTop, d);
  finial(face, p.center, p.roofTop, p.totalHeight - p.roofTop, d);
}
function column(face, p, b, t, r, d, slot = 'trim') {
  solid(face, circle(p, r, d <= 1 ? 4 : 8), b, t, slot);
}
function lantern(face, p, r, base, top, d) {
  const n = d === 0 ? 4 : 8,
    ring = circle(p, r, n);
  if (d === 0) sides(face, ring, base, top, 'trim');
  else {
    for (const q of ring) column(face, q, base, top - 0.2, r * 0.13, d);
    coping(face, ring, top - 0.2, 0.25, 'trim', 1.08);
  }
  cap(face, scaled(ring, 1.2), top, 'metal');
  cap(face, scaled(ring, 1.2), top - 0.07, 'trim', [], true);
}
function minaret(face, p, d) {
  const n = [6, 8, 12, 16, 20][d],
    r = p.outline,
    center = p.center;
  solid(face, r, footing, 8, 'wall');
  if (d >= 1) coping(face, r, 6.4, 1.0, 'trim', 1.012);
  profile(
    face,
    circle(center, 1.9, n),
    [
      [8, 1],
      [10.2, 1],
      [21.4, 0.86],
    ],
    'wall',
  );
  for (const y of d === 0 ? [14.0] : [10.7, 15.4, 19.4])
    profile(
      face,
      circle(center, 1.96, n),
      [
        [y, 1],
        [y + 0.85, 1],
      ],
      'trim',
    );
  profile(
    face,
    circle(center, 1.9, n),
    [
      [21.4, 0.86],
      [22.1, 1.45],
      [22.45, 1.45],
    ],
    'trim',
  );
  if (d >= 1) {
    sides(face, circle(center, 2.8, n), 22.4, 23.5, 'trim');
    cap(face, circle(center, 2.8, n), 23.5, 'trim', [circle(center, 2.48, n)]);
  }
  profile(
    face,
    circle(center, 1.55, n),
    [
      [22.4, 1],
      [25, 1],
    ],
    'wall',
  );
  lantern(face, center, 1.85, 25, 28, d);
  onion(face, center, 1.9, 28.1, 30.6, d);
  finial(face, center, 30.6, 1.4, d);
}
function chhatri(face, p, d) {
  if (d <= 1) {
    profile(
      face,
      circle(p, 0.8, 4),
      [
        [8, 0.8],
        [10.5, 0.8],
        [11, 1.2],
        [12, 0.1],
      ],
      'trim',
    );
    return;
  }
  const b = 8,
    n = d <= 1 ? 4 : 8;
  solid(face, circle(p, 0.8, n), b, b + 1.2, 'wall');
  coping(face, circle(p, 0.8, n), b + 1, 0.22, 'metal', 1.15);
  lantern(face, p, 0.72, b + 1.2, b + 3, d);
  onion(face, p, 0.82, b + 3.1, b + 4, d);
  finial(face, p, b + 4, 0.8, d);
}
export function jamekChhatris(d = 3) {
  const ps = [];
  for (const b of plans.bodies.filter((p) => p.role === 'side-wing')) {
    const r = b.outline;
    for (const p of r.filter((_, i) => (d <= 1 ? i === 1 || i === 2 : true))) ps.push(p);
  }
  return ps;
}
function build(out, d) {
  const face = writer(out, d),
    arches = jamekArcades(d);
  for (const p of [...plans.bodies, ...plans.connectors]) body(face, p, d, arches);
  for (const p of plans.domes) dome(face, p, d);
  for (const p of plans.minarets) minaret(face, p, d);
  for (const p of jamekChhatris(d)) chhatri(face, p, d);
}
export const buildJamekSkyline = (o) => build(o, 0),
  buildJamekDistrict = (o) => build(o, 1),
  buildJamekStreet = (o) => build(o, 2),
  buildJamekCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const jamekStudy = {
  id: 'N0474',
  key: 'sultan_abdul_samad_jamek_mosque',
  title: 'Sultan Abdul Samad Jamek Mosque',
  category: 'mosque',
  wikidataId: 'Q1143296',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Five shared 256² longformat brick,raw/coursed limestone,lime plaster and painted metal graphs;six merged roles including opaque glazing. Metric UVs,linear tints,no embedded image,unique atlas,copied ornament or baked light.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'One detailed daylight picture and a distant river-context view guide the exterior. Scalloped cream arches,brick/cream bands,three onion domes,twin open-lantern minarets and selected chhatris are recognizable approximations. Exact dome heights,ornament,pinnacle count,current finish and attached-wing roles are unverified. Public open galleries are unfurnished;no navigable or historical interior is claimed. Detached service buildings,courtyard,umbrellas,river mist,lighting/signs and surrounding towers are excluded. Physical-device/full-city timing remains pending.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('three-white-onion-domes', [-47, 29, -63], [-12, 12, -35]),
    cam('paired-banded-minarets', [-57, 25, 20], [-12, 20, -10]),
    cam('cusped-cream-arcade', [-10, 5, -1], [-11, 4, -11]),
    cam('side-wing-and-connector', [-63, 19, -3], [-36, 5, -20]),
    cam('corner-chhatri', [-57, 15, -2], [-51, 10, -6]),
    cam('mapped-connected-plan', [-12, 155, -25], [-12, 5, -25.1]),
  ],
};
