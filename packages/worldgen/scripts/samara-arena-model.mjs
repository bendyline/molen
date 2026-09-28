/** Samara: mapped star perimeter, spherical roof and32 three-chord radial cantilevers. */
import { beam } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { samaraPlan } from './samara-plan.mjs';
import { chair, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2;
const white = [0.87, 0.89, 0.88],
  steel = [0.76, 0.8, 0.79],
  concrete = [0.58, 0.61, 0.6],
  blue = [0.025, 0.28, 0.53],
  darkBlue = [0.02, 0.11, 0.2],
  glass = [0.13, 0.26, 0.31];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rad = (a, r, y = 0) => [r * Math.sin(a), y, r * Math.cos(a)];
const topY = (r) => 60 + Math.sqrt(306.4 ** 2 - r * r) - Math.sqrt(306.4 ** 2 - 73.3 ** 2);
const poly = samaraPlan.outer.slice(0, -1);
const corners = poly.map((p) => ((Math.atan2(p[0], p[1]) % TAU) + TAU) % TAU).sort((a, b) => a - b);
const roofAngles = corners.flatMap((a, i) => {
  const b = i + 1 === corners.length ? corners[0] + TAU : corners[i + 1];
  return Array.from({ length: 6 }, (_, j) => a + ((b - a) * j) / 6);
});
const spikes = poly.filter((p) => Math.hypot(...p) > 160);
const phase =
  Math.atan2(
    spikes.reduce((n, p) => n + Math.sin(32 * Math.atan2(p[0], p[1])), 0),
    spikes.reduce((n, p) => n + Math.cos(32 * Math.atan2(p[0], p[1])), 0),
  ) / 32;
function radiusAt(a, points = poly) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length],
      vx = q[0] - p[0],
      vz = q[1] - p[1],
      det = dx * vz - dz * vx;
    if (Math.abs(det) < 1e-9) continue;
    const r = (p[0] * vz - p[1] * vx) / det,
      t = (p[0] * dz - p[1] * dx) / det;
    if (r > 0 && t >= -1e-6 && t <= 1 + 1e-6) best = Math.min(best, r);
  }
  return Number.isFinite(best) ? best : 170;
}
function roof(a, t, dy = 0) {
  const inner = radiusAt(a, samaraPlan.roofOpening.slice(0, -1)),
    r =
      t <= 0.875
        ? inner + (148 - inner) * (t / 0.875)
        : 148 + (radiusAt(a) - 148) * ((t - 0.875) / 0.125);
  return rad(a, r, topY(r) + dy);
}
function round(a, hx, hz, r, y = 0) {
  const x = Math.sin(a),
    z = Math.cos(a),
    ax = Math.abs(x),
    az = Math.abs(z);
  let lo = 0,
    hi = Math.hypot(hx, hz);
  for (let i = 0; i < 28; i++) {
    const d = (lo + hi) / 2;
    if (Math.hypot(Math.max(0, d * ax - (hx - r)), Math.max(0, d * az - (hz - r))) > r) hi = d;
    else lo = d;
  }
  return [x * lo, y, z * lo];
}
function rail(out, points, height = 1.06) {
  for (let i = 0; i < points.length - 1; i++) {
    for (const h of [height, height * 0.5])
      tube(
        out,
        'metal',
        points[i].map((v, j) => v + (j === 1 ? h : 0)),
        points[i + 1].map((v, j) => v + (j === 1 ? h : 0)),
        0.025,
        steel,
        6,
      );
    tube(
      out,
      'metal',
      points[i],
      points[i].map((v, j) => v + (j === 1 ? height : 0)),
      0.032,
      steel,
      6,
    );
  }
}
function roofStructure(out) {
  // Published32 triangular CHS consoles; three chords and actual pyramidal support radius.
  for (let k = 0; k < 32; k++) {
    const a = phase + (k * TAU) / 32,
      inner = radiusAt(a, samaraPlan.roofOpening.slice(0, -1)),
      outer = radiusAt(a),
      count = 20;
    const section = (r) => {
      const w = 2.4 + 2.8 * Math.sin((Math.PI * (r - inner)) / (outer - inner)),
        depth = 3.5 + 6.7 * Math.exp(-(((r - 135.2) / 32) ** 2)),
        y = topY(r) - 0.65;
      return [
        [r * Math.sin(a) - w * Math.cos(a), y, r * Math.cos(a) + w * Math.sin(a)],
        [r * Math.sin(a) + w * Math.cos(a), y, r * Math.cos(a) - w * Math.sin(a)],
        rad(a, r, y - depth),
      ];
    };
    for (let j = 0; j < count; j++) {
      const r = inner + ((outer - inner) * j) / count,
        R = inner + ((outer - inner) * (j + 1)) / count,
        p = section(r),
        q = section(R);
      for (let c = 0; c < 3; c++) tube(out, 'metal', p[c], q[c], c === 2 ? 0.37 : 0.26, steel, 32);
      for (const c of [0, 1]) {
        tube(out, 'metal', p[2], q[c], 0.115, steel, 8);
        tube(out, 'metal', p[c], q[2], 0.1, steel, 8);
        tube(out, 'metal', p[c], p[2], 0.105, steel, 8);
      }
      tube(out, 'metal', p[0], q[1], 0.085, steel, 8);
      tube(out, 'metal', p[0], p[1], 0.085, steel, 8);
    }
    const apex = section(135.2)[2];
    for (const [rr, da] of [
      [145, -0.045],
      [145, 0.045],
      [124, 0],
    ]) {
      const foot = rad(a + da, rr, 0.48);
      tube(out, 'metal', foot, apex, 0.54, steel, 48);
      box(
        out,
        'concrete',
        [foot[0] - 1.6, 0, foot[2] - 1.6],
        [foot[0] + 1.6, 0.6, foot[2] + 1.6],
        concrete,
      );
      box(
        out,
        'metal',
        [foot[0] - 0.78, 0.6, foot[2] - 0.78],
        [foot[0] + 0.78, 0.72, foot[2] + 0.78],
        steel,
      );
      for (const x of [-0.57, 0.57])
        for (const z of [-0.57, 0.57])
          tube(
            out,
            'metal',
            [foot[0] + x, 0.7, foot[2] + z],
            [foot[0] + x, 0.86, foot[2] + z],
            0.058,
            [0.35, 0.4, 0.42],
            8,
          );
    }
    const left = rad(a - TAU / 64, 150.2, topY(150.2)),
      right = rad(a + TAU / 64, 150.2, topY(150.2)),
      tip = rad(a, outer, topY(outer));
    tube(out, 'metal', left, tip, 0.19, steel, 12);
    tube(out, 'metal', right, tip, 0.19, steel, 12);
    tube(out, 'metal', apex, tip, 0.24, steel, 12);
  }
  // Circumferential lattice ties and fine secondary purlins follow the sphere.
  for (const r of [74, 82, 94, 106, 118, 130, 142, 150]) {
    for (let i = 0; i < 256; i++) {
      const a = phase + (i * TAU) / 256,
        b = phase + ((i + 1) * TAU) / 256,
        y = topY(r) - 0.6;
      tube(out, 'metal', rad(a, r, y), rad(b, r, y), r === 74 ? 0.22 : 0.115, steel, 10);
      tube(out, 'metal', rad(a, r, y - 2.2), rad(b, r, y - 2.2), 0.08, steel, 8);
      tube(out, 'metal', rad(a, r, y - 2.2), rad(b, r, y), 0.065, steel, 6);
    }
  }
  for (let i = 0; i < roofAngles.length; i++)
    for (let j = 0; j < 32; j++) {
      const a = roofAngles[i],
        b = roofAngles[(i + 1) % roofAngles.length],
        t = j / 32,
        u = (j + 1) / 32;
      const p = [roof(a, t), roof(b, t), roof(b, u), roof(a, u)];
      face(
        out,
        j < 3 ? 'translucentRoof' : 'metal',
        p,
        j < 3 ? [0.82, 0.9, 0.92] : [0.79, 0.82, 0.83],
        [0, 1, 0],
      );
      if (j >= 3)
        face(
          out,
          'metal',
          p.map((v) => [v[0], v[1] - 0.12, v[2]]),
          [0.71, 0.75, 0.74],
          [0, -1, 0],
        );
      if (i % 3 === 0)
        beam(
          out,
          'metal',
          p[0].map((v, k) => v + (k === 1 ? 0.035 : 0)),
          p[3].map((v, k) => v + (k === 1 ? 0.035 : 0)),
          0.026,
          0.06,
          [0.61, 0.66, 0.67],
        );
      if (j % 2 === 0)
        beam(
          out,
          'metal',
          p[0].map((v, k) => v + (k === 1 ? 0.028 : 0)),
          p[1].map((v, k) => v + (k === 1 ? 0.028 : 0)),
          0.022,
          0.05,
          [0.65, 0.7, 0.7],
        );
    }
  for (let i = 0; i < 256; i++) {
    const a = phase + (i * TAU) / 256,
      b = phase + ((i + 1) * TAU) / 256,
      p = roof(a, 0),
      q = roof(b, 0);
    tube(out, 'metal', p, q, 0.22, steel, 10);
    const inner = rad(a, Math.hypot(p[0], p[2]) + 3, p[1] - 3.3),
      next = rad(b, Math.hypot(q[0], q[2]) + 3, q[1] - 3.3);
    beam(out, 'metal', inner, next, 0.8, 0.12, [0.38, 0.43, 0.43]);
    if (i % 2 === 0) {
      tube(out, 'metal', p, inner, 0.036, steel, 8);
      const tangent = transformed(out, a, inner);
      box(tangent, 'metal', [-0.4, -0.12, -0.34], [0.4, 0.12, 0.34], [0.3, 0.36, 0.37]);
      box(tangent, 'plastic', [-0.34, -0.145, -0.3], [0.34, -0.12, 0.3], [0.94, 0.96, 0.84]);
    }
  }
}
function seat(a, t, row) {
  return round(
    a,
    t ? 66 + row * 0.78 : 39 + row * 0.79,
    t ? 86 + row * 0.78 : 62 + row * 0.79,
    t ? 28 + row * 0.55 : 12 + row * 0.12,
    t ? 24.5 + row * 0.46 : 0.8 + row * 0.38,
  );
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, 0.12, 0]));
  for (let t = 0; t < 2; t++) {
    const rows = t ? 23 : 29;
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < 400; i++) {
        const a = (i * TAU) / 400,
          b = ((i + 1) * TAU) / 400,
          p = seat(a, t, row),
          q = seat(b, t, row),
          r = seat(b, t, row + 1),
          s = seat(a, t, row + 1),
          sector = ((((a / TAU) * 32) % 1) + 1) % 1;
        face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]);
        if (sector < 0.065 || sector > 0.935) continue;
        const count = Math.max(1, Math.floor(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.51));
        for (let j = 0; j < count; j++) {
          const v = mix(p, q, (j + 0.5) / count);
          let h =
            (Math.imul(i + 17, 73856093) ^
              Math.imul(row + 3, 19349663) ^
              Math.imul(j + 9, 83492791)) >>>
            0;
          h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
          const wave = Math.sin(a * 7 + row * 0.08) * 3 + Math.sin(a * 13) * 1.5;
          const light = t ? Math.abs(row - 10 - wave) < 3.5 : row > 14 + wave;
          chair(
            out,
            Math.atan2(-(q[2] - p[2]), q[0] - p[0]),
            v,
            h % 100 < (light ? 82 : 14) ? white : (h >>> 8) % 3 === 0 ? blue : darkBlue,
          );
        }
      }
    for (let i = 0; i < 400; i++) {
      const a = (i * TAU) / 400,
        b = ((i + 1) * TAU) / 400,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        r = seat(b, t, rows),
        s = seat(a, t, rows),
        down = (v) => [v[0], v[1] - 0.7, v[2]];
      face(out, 'concrete', [down(p), down(q), down(r), down(s)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [s, r, down(r), down(s)], concrete, [Math.sin(a), 0, Math.cos(a)]);
    }
    for (let k = 0; k < 32; k++) {
      const a = (k * TAU) / 32;
      rail(
        out,
        Array.from({ length: rows + 1 }, (_, r) => seat(a + 0.009, t, r)),
      );
      const p = seat(a, t, t ? 5 : 15),
        o = transformed(out, a, p);
      box(o, 'concrete', [-1.35, 0, -1], [1.35, 3.1, 2.7], concrete);
      box(o, 'plastic', [-1.12, 0.05, -1.03], [1.12, 2.8, -1.01], [0.025, 0.045, 0.053]);
      box(o, 'plastic', [-1.32, 2.83, -1.05], [1.32, 3.12, -1.02], blue);
    }
  }
  // Three hospitality ribbons are prominent in the architect's built interior photograph.
  for (const y of [12.7, 16.45, 20.2])
    for (let i = 0; i < 256; i++) {
      const a = (i * TAU) / 256,
        b = ((i + 1) * TAU) / 256,
        p = round(a, 64.4, 87.4, 19, y),
        q = round(b, 64.4, 87.4, 19, y);
      face(out, 'glass', [p, q, [q[0], y + 2.6, q[2]], [p[0], y + 2.6, p[2]]], glass, [
        -Math.sin(a),
        0,
        -Math.cos(a),
      ]);
      beam(out, 'metal', p, [p[0], y + 2.7, p[2]], 0.045, 0.075, white);
      const P = round(a, 62.7, 85.7, 19, y - 0.35),
        Q = round(b, 62.7, 85.7, 19, y - 0.35);
      face(out, 'concrete', [P, Q, q, p], white, [0, 1, 0]);
      beam(
        out,
        'metal',
        P.map((v, j) => v + (j === 1 ? 1.1 : 0)),
        Q.map((v, j) => v + (j === 1 ? 1.1 : 0)),
        0.07,
        0.09,
        white,
      );
    }
  for (const sign of [-1, 1]) {
    const o = transformed(out, sign < 0 ? Math.PI : 0, [0, 44.4, sign * 77]);
    box(o, 'metal', [-8.7, -0.2, -0.45], [8.7, 9.2, 0.15], steel);
    box(o, 'plastic', [-8.45, 0.05, -0.49], [8.45, 8.9, -0.46], [0.025, 0.035, 0.04]);
    for (const x of [-7, 7]) tube(o, 'metal', [x, 8.7, 0], [x, 14.6, 0], 0.12, steel, 10);
  }
}
function exterior(out) {
  // Actual building remains recessed within the broad roof's open triangulated perimeter.
  for (let i = 0; i < 256; i++) {
    const a = phase + (i * TAU) / 256,
      b = phase + ((i + 1) * TAU) / 256;
    for (const y of [0, 8.4, 16.8, 25.2]) {
      const r = y === 0 ? 118 : 121.8,
        p = rad(a, r, y + 0.15),
        q = rad(b, r, y + 0.15);
      face(
        out,
        'concrete',
        [rad(a, r - 8, y), rad(b, r - 8, y), rad(b, r, y), rad(a, r, y)],
        concrete,
        [0, 1, 0],
      );
      face(out, 'glass', [p, q, rad(b, r, y + 6), rad(a, r, y + 6)], glass, [
        Math.sin(a),
        0,
        Math.cos(a),
      ]);
      beam(out, 'metal', p, rad(a, r, y + 6.5), 0.055, 0.085, white);
      beam(out, 'concrete', rad(a, r, y + 6.4), rad(b, r, y + 6.4), 0.45, 0.6, white);
    }
    // Open lower circulation walk between building and pyramidal frames.
    face(
      out,
      'concrete',
      [rad(a, 121.8, 8.4), rad(b, 121.8, 8.4), rad(b, 142, 8.4), rad(a, 142, 8.4)],
      concrete,
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      [rad(a, 142, 7.95), rad(b, 142, 7.95), rad(b, 142, 8.4), rad(a, 142, 8.4)],
      white,
      [Math.sin(a), 0, Math.cos(a)],
    );
    if (i % 2 === 0) rail(out, [rad(a, 141.8, 8.4), rad(b, 141.8, 8.4)]);
    if (i % 4 === 0) {
      tube(out, 'concrete', rad(a, 125, 0), rad(a, 125, 25.2), 0.44, concrete, 10);
      for (const y of [8.4, 16.8])
        beam(out, 'concrete', rad(a, 116, y), rad(a, y === 8.4 ? 142 : 125, y), 0.5, 0.7, concrete);
    }
  }
  for (let k = 0; k < 32; k++) {
    const a = phase + ((k + 0.5) * TAU) / 32,
      o = transformed(out, a, rad(a, 148, 0));
    // Broad outdoor stairs face the main perimeter paths, no invented opaque façade.
    for (let j = 0; j < 48; j++)
      box(
        o,
        'concrete',
        [-2.3, j * 0.175, 14 - j * 0.42],
        [2.3, (j + 1) * 0.175, 14.42 - j * 0.42],
        concrete,
      );
    for (const x of [-2.35, 0, 2.35])
      rail(
        o,
        Array.from({ length: 13 }, (_, i) => [x, i * 0.7, 14.3 - i * 1.68]),
      );
    for (const x of [-2.5, 2.5]) beam(o, 'plastic', [x, 0.6, 14.4], [x, 9, -5.8], 0.2, 0.95, blue);
    box(o, 'plastic', [-2.9, 8.75, -6.25], [2.9, 10.2, -5.85], white);
    for (let i = 0; i < 5; i++)
      box(o, 'plastic', [-2.3 + i * 0.9, 9.1, -5.82], [-1.85 + i * 0.9, 9.7, -5.78], blue);
  }
  for (const sign of [-1, 1])
    for (const z of [-16, 16]) {
      const o = transformed(out, (sign * Math.PI) / 2, [sign * 36.3, 0.15, z]);
      for (let j = 0; j < 17; j++) chair(o, 0, [-5.1 + j * 0.6, 0, 0], blue);
      for (let i = 0; i < 16; i++) {
        const f = (t, x) => [x, 0.9 + 1.4 * Math.sin(t), 0.6 + 1.4 * Math.cos(t)],
          a = (i * Math.PI) / 32,
          b = ((i + 1) * Math.PI) / 32;
        face(
          o,
          'glassClear',
          [f(a, -5.5), f(a, 5.5), f(b, 5.5), f(b, -5.5)],
          [0.7, 0.84, 0.87],
          [0, 1, 1],
        );
        if (i % 4 === 0) beam(o, 'metal', f(a, -5.5), f(a, 5.5), 0.035, 0.045, steel);
      }
    }
}
export function buildSamara(out) {
  bowl(out);
  exterior(out);
  roofStructure(out);
}
export const samaraStudy = {
  id: 'N0701',
  key: 'samara_arena',
  wikidataId: 'Q4439099',
  title: 'Samara Arena',
  build: buildSamara,
  metricTriangleUv: true,
  smoothNormalSlots: [],
  size: [340, 60, 340],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Exact mapped pitch center at field/streetY0. +Z points north-northwest; roof-star phase comes from exact mapped tips.',
  },
  previewCamera: { position: [258, 170, 305], lookAt: [0, 24, 0] },
  visualBrief:
    'Distinctive spherical silver spacecraft roof over a precisely mapped32point star, central circular opening and inner translucent ring.32three-chord tubular cantilevers, pyramidal steel feet, ring lattices and faceted pointed perimeter bays remain visible from ground and bowl. Open peripheral circulation and32stair banks frame a recessed glass building; two blue/white seating tiers flank three stacked glazed hospitality ribbons, goal-end screens and roof lights.',
  sourceFacts: {
    published:
      'Roof engineer Stalproekt:32radial spherical three-chord cantilevers,91m maximum cantilever and pyramidal supports. NIC Construction3(18)2018pp54–55:306.4m sphere radius,60m roof height,10.2m maximum truss depth,135.2m support radius. Architect Dmitry Bush/PI Arena published built photographs, floor plans and cross/longitudinal sections confirm star flaps and three hospitality floors.',
    reconstructed:
      'Exact mapped building relation8142258 has150m valley/170m tip radii and~73.3m circular opening. Pitch way572625509 defines long-axis direction. Detailed metal-member sections, individual roof-sheet/purlin counts, seating rows/colors, stair widths and recessed façade divisions are photo/section reconstructions. Published paper wording300m radius is inconsistent with the drawing/map; it is treated as nominal300m main-dome diameter, excluding projecting tips.',
  },
  referencePages: [
    'https://steel-project.ru/project/stadion-samara-arena',
    'https://archvestnik.ru/2018/09/21/vokrug-futbola-o-novykh-stadionakh-rossii/',
    'https://smr2018.ru/arena/',
    'https://samaraarena.info/about',
    'https://www.normacs.info/uploads/ckeditor/attachments/4750/%D0%92%D0%B5%D1%81%D1%82%D0%BD%D0%B8%D0%BA_3_18_2018.pdf',
    'https://www.openstreetmap.org/relation/8142258',
    'https://www.openstreetmap.org/way/572625509',
  ],
  referenceRights:
    'Architect/engineer reference photographs and drawings were consulted, not embedded. Original authored mesh and shared procedural surfaces. Mapped outlines credit OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: samaraPlan.anchor,
    heading: samaraPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Section drawings place pitch and exterior entry on the same ground datum. Ground footings startY0; raised circulation walk is8.4m above with physical outdoor stair access. Small rail section ends can enter paving as embedded fixings.',
    source: 'https://www.openstreetmap.org/relation/8142258',
    featureIds: ['relation/8142258', 'way/572625511', 'way/572625510', 'way/572625509'],
    notes:
      'Exact roof multipolygon and pitch replace the former599m leisure-site parcel. Native+Z follows north-northwest pitch axis;32roof-tip phase comes from mapped maxima, preserving geographic star orientation. Stadium ground contact isY0; outer paving/security estate stays in ordinary map data.',
  },
  limitations: [
    'Detailed permanent exterior and visible bowl. Exact fabrication/row/stair inventories and minor glass divisions remain reconstructed. Closed rooms, temporary2018event lettering, current sponsor branding and remote estate buildings are outside this architectural mesh.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-star-bays', position: [173, 26, 84], lookAt: [135, 24, 65] },
    { name: 'near-pyramid-support', position: [151, 6, 55], lookAt: [129, 23, 47] },
    { name: 'near-outer-stair', position: [5, 7, 181], lookAt: [0, 5, 147] },
    { name: 'near-peripheral-concourse', position: [144, 11, 30], lookAt: [120, 12, 22] },
    { name: 'near-sphere-seams', position: [26, 74, 115], lookAt: [18, 46, 113] },
    { name: 'near-aperture', position: [7, 80, 55], lookAt: [0, 49, 76] },
    { name: 'near-cantilever', position: [58, 33, 20], lookAt: [102, 43, 38] },
    { name: 'near-blue-white-bowl', position: [0, 8, 0], lookAt: [62, 24, 0] },
    { name: 'near-hospitality', position: [38, 17, 4], lookAt: [64, 18, 0] },
    { name: 'near-scoreboard', position: [0, 29, 10], lookAt: [0, 47, 77] },
    { name: 'near-dugout', position: [28, 2, -16], lookAt: [36, 1.6, -16] },
    { name: 'far-northwest', position: [259, 86, 313], lookAt: [0, 23, 0] },
  ],
};
