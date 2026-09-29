/** Executed Kaliningrad stadium: mapped angular envelope, 32 stayed box trusses and blue/white sheet facade. */
import { beam } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { rostecPlan } from './rostec-plan.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.88, 0.91, 0.92],
  blue = [0.018, 0.17, 0.36],
  paleBlue = [0.06, 0.33, 0.56],
  concrete = [0.59, 0.62, 0.61],
  dark = [0.035, 0.055, 0.07],
  steel = [0.73, 0.77, 0.78];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const outline = rostecPlan.outer.slice(0, -1),
  lengths = outline.map((p, i) =>
    Math.hypot(
      p[0] - outline[(i + 1) % outline.length][0],
      p[1] - outline[(i + 1) % outline.length][1],
    ),
  );
const perimeter = lengths.reduce((a, b) => a + b, 0);
function outer(t, y = 0, inset = 0) {
  let d = (((t % 1) + 1) % 1) * perimeter;
  for (let i = 0; i < outline.length; i++) {
    if (d <= lengths[i] || i === outline.length - 1) {
      const p = mix(outline[i], outline[(i + 1) % outline.length], d / lengths[i]),
        r = Math.hypot(...p);
      return [p[0] * (1 - inset / r), y, p[1] * (1 - inset / r)];
    }
    d -= lengths[i];
  }
}
function rounded(a, hx, hz, r, y = 0) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return [t * Math.sin(a), y, t * Math.cos(a)];
}
function roofPoint(t, f) {
  const q = outer(t, 33.8),
    a = Math.atan2(q[0], q[2]),
    p = rounded(a, 44.7, 63.45, 3, 32.3);
  return mix(p, q, f);
}
function rail(out, points) {
  for (const y of [0.53, 1.07])
    curve(
      out,
      points.map((p) => [p[0], p[1] + y, p[2]]),
      0.027,
      steel,
      'metal',
    );
  for (let i = 0; i < points.length; i += 2)
    tube(
      out,
      'metal',
      points[i],
      [points[i][0], points[i][1] + 1.07, points[i][2]],
      0.027,
      steel,
      8,
    );
}
function roof(out) {
  // Published original structure:32 independent stayed radial trusses, box sections and Macalloy ties.
  for (let i = 0; i < 32; i++) {
    const t = i / 32,
      p = outer(t, 0, 10.2),
      tip = [p[0], 47, p[2]],
      o = outer(t, 33.8),
      inner = roofPoint(t, 0);
    beam(out, 'metal', [p[0], 17, p[2]], tip, 0.5, 0.5, white);
    for (const f of [0.22, 0.64]) tube(out, 'metal', tip, roofPoint(t, f), 0.055, steel, 10);
    tube(out, 'metal', tip, [o[0], 24, o[2]], 0.06, steel, 10);
    for (let j = 0; j < 14; j++) {
      const a = roofPoint(t, j / 14),
        b = roofPoint(t, (j + 1) / 14),
        A = [a[0], a[1] - 2.7, a[2]],
        B = [b[0], b[1] - 2.7, b[2]];
      beam(out, 'metal', a, b, 0.26, 0.3, white);
      beam(out, 'metal', A, B, 0.23, 0.25, white);
      beam(out, 'metal', A, b, 0.13, 0.15, white);
      beam(out, 'metal', A, a, 0.13, 0.15, white);
    }
    for (const y of [6, 10, 15, 20, 25, 29])
      box(
        out,
        'metal',
        [p[0] - 0.8, y - 0.12, p[2] - 0.8],
        [p[0] + 0.8, y + 0.12, p[2] + 0.8],
        steel,
      );
    // Saddles/bolted gussets and roof maintenance equipment remain actual geometry.
    box(out, 'metal', [p[0] - 0.5, 33, p[2] - 0.5], [p[0] + 0.5, 34.3, p[2] + 0.5], steel);
    for (const dx of [-0.35, 0.35])
      for (const dz of [-0.35, 0.35])
        tube(
          out,
          'metal',
          [p[0] + dx, 34.31, p[2] + dz],
          [p[0] + dx, 34.39, p[2] + dz],
          0.055,
          steel,
          8,
        );
    if (i % 2 === 0) {
      const a = outer(t, 30.7, 13),
        b = outer((i + 1) / 32, 30.7, 13);
      beam(out, 'metal', a, b, 1.15, 0.12, steel);
      rail(out, [a, mix(a, b, 0.5), b]);
    }
    void inner;
  }
  // Ring trusses, wind bracing and narrow inner polycarbonate strip, never a moving roof.
  for (let j = 0; j <= 8; j++)
    for (let i = 0; i < 256; i++) {
      const f = j / 8,
        p = roofPoint(i / 256, f),
        q = roofPoint((i + 1) / 256, f);
      beam(out, 'metal', p, q, 0.085, 0.14, white);
      if (j === 0 || j === 8 || j === 4) {
        const a = [p[0], p[1] - 2.65, p[2]],
          b = [q[0], q[1] - 2.65, q[2]];
        beam(out, 'metal', a, b, 0.16, 0.18, white);
        beam(out, 'metal', i % 2 ? p : a, i % 2 ? b : q, 0.08, 0.09, white);
      }
    }
  for (let i = 0; i < 384; i++)
    for (let j = 0; j < 16; j++) {
      const a = i / 384,
        b = (i + 1) / 384,
        f = j / 16,
        F = (j + 1) / 16,
        ps = [roofPoint(a, f), roofPoint(b, f), roofPoint(b, F), roofPoint(a, F)];
      face(
        out,
        j < 4 ? 'translucentRoof' : 'metal',
        ps,
        j < 4 ? [0.8, 0.9, 0.92] : [0.69, 0.74, 0.75],
        [0, 1, 0],
      );
      if (i % 2 === 0) beam(out, 'metal', ps[0], ps[3], 0.025, 0.045, steel);
      if (i % 12 === 0 && j % 2 === 0)
        beam(
          out,
          'metal',
          [ps[0][0], ps[0][1] - 0.22, ps[0][2]],
          [ps[2][0], ps[2][1] - 0.22, ps[2][2]],
          0.03,
          0.035,
          steel,
        );
      if (j === 15)
        face(
          out,
          'metal',
          [ps[3], ps[2], [ps[2][0], 34.5, ps[2][2]], [ps[3][0], 34.5, ps[3][2]]],
          white,
          [ps[3][0], 0, ps[3][2]],
        );
    }
  for (let k = 0; k < 96; k++) {
    const p = roofPoint(k / 96, 0.025);
    box(
      out,
      'metal',
      [p[0] - 0.38, p[1] - 1.25, p[2] - 0.36],
      [p[0] + 0.38, p[1] - 0.9, p[2] + 0.36],
      steel,
    );
    face(
      out,
      'glass',
      [
        [p[0] - 0.32, p[1] - 1.26, p[2] - 0.29],
        [p[0] + 0.32, p[1] - 1.26, p[2] - 0.29],
        [p[0] + 0.32, p[1] - 1.26, p[2] + 0.29],
        [p[0] - 0.32, p[1] - 1.26, p[2] + 0.29],
      ],
      [0.87, 0.95, 0.97],
      [0, -1, 0],
    );
  }
}
function seat(a, t, row) {
  return rounded(
    a,
    t ? 62 + row * 0.84 : 38 + row * 0.8,
    t ? 81 + row * 0.82 : 57.5 + row * 0.8,
    t ? 30 + row * 0.48 : 12 + row * 0.3,
    t ? 18.3 + row * 0.52 : 1 + row * 0.43,
  );
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, 0.12, 0]));
  for (let t = 0; t < 2; t++) {
    const rows = t ? 25 : 24;
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < 384; i++) {
        const a = (i * TAU) / 384,
          b = ((i + 1) * TAU) / 384,
          p = seat(a, t, row),
          q = seat(b, t, row),
          r = seat(b, t, row + 1),
          s = seat(a, t, row + 1);
        face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]);
        const count = Math.max(1, Math.floor(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.51));
        for (let j = 0; j < count; j++) {
          const v = mix(p, q, (j + 0.5) / count),
            u = ((((a / TAU) * 32) % 1) + 1) % 1;
          if (u < 0.04 || u > 0.96) continue;
          // Stable blue/white mosaic from contractor interior photos, not a seat inventory.
          let h = (i * 7919 + row * 104729 + j * 317 + t * 83) >>> 0;
          h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
          h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
          h = ((h ^ (h >>> 16)) >>> 0) % 101;
          const tint = h < (t ? 19 : 40) ? white : h < 54 ? paleBlue : blue;
          chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), v, tint);
        }
      }
    for (let i = 0; i < 384; i++) {
      const a = (i * TAU) / 384,
        b = ((i + 1) * TAU) / 384,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        r = seat(b, t, rows),
        s = seat(a, t, rows),
        down = (v) => [v[0], v[1] - 0.55, v[2]];
      face(out, 'concrete', [down(p), down(q), down(r), down(s)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [s, r, down(r), down(s)], concrete, [Math.sin(a), 0, Math.cos(a)]);
      face(out, 'concrete', [p, q, [q[0], q[1] + 0.75, q[2]], [p[0], p[1] + 0.75, p[2]]], white, [
        -Math.sin(a),
        0,
        -Math.cos(a),
      ]);
    }
    for (let k = 0; k < 32; k++) {
      const a = (k * TAU) / 32,
        ps = Array.from({ length: rows + 1 }, (_, r) => seat(a, t, r));
      rail(out, ps);
      const p = seat(a, t, t ? 10 : 14),
        o = transformed(out, a, p);
      box(o, 'concrete', [-1.25, 0, -0.12], [1.25, 2.4, 2.4], white);
      box(o, 'glass', [-1.1, 0.05, -0.14], [1.1, 2.2, -0.13], dark);
    }
  }
  // Glazed hospitality ribbon and small seating balcony between the two principal tiers.
  for (let i = 0; i < 256; i++) {
    const a = (i * TAU) / 256,
      b = ((i + 1) * TAU) / 256,
      p = rounded(a, 60, 79.4, 26, 14),
      q = rounded(b, 60, 79.4, 26, 14),
      n = [-Math.sin(a), 0, -Math.cos(a)];
    face(out, 'glass', [p, q, [q[0], 17.3, q[2]], [p[0], 17.3, p[2]]], [0.12, 0.21, 0.28], n);
    beam(out, 'metal', p, q, 0.14, 0.3, white);
    beam(out, 'metal', [p[0], 17.3, p[2]], [q[0], 17.3, q[2]], 0.2, 0.28, white);
    if (i % 2 === 0) beam(out, 'metal', p, [p[0], 17.3, p[2]], 0.07, 0.07, white);
    const f = rounded(a, 57.8, 77.2, 25, 12.1),
      g = rounded(b, 57.8, 77.2, 25, 12.1);
    face(out, 'concrete', [f, g, q, p], white, [0, 1, 0]);
    if (i % 2 === 0) rail(out, [f, g]);
  }
  for (const s of [-1, 1]) {
    const o = transformed(out, s > 0 ? 0 : Math.PI, [0, 22, s * 89]);
    box(o, 'metal', [-7.1, 0, -0.3], [7.1, 8, 0.3], white);
    box(o, 'glass', [-6.8, 0.25, -0.32], [6.8, 7.75, -0.31], dark);
    for (const x of [-6, 6]) beam(o, 'metal', [x, 8, 0], [x, 10.8, 0], 0.11, 0.14, steel);
  }
  for (const z of [-17, 17]) {
    const o = transformed(out, Math.PI / 2, [35.5, 0.15, z]);
    for (let j = 0; j < 18; j++) chair(o, 0, [-5.4 + j * 0.6, 0, 0], paleBlue);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 32,
        b = ((i + 1) * Math.PI) / 32;
      const f = (t, x) => [x, 0.8 + 1.5 * Math.sin(t), 0.5 + 1.5 * Math.cos(t)];
      face(o, 'glassClear', [f(a, -6), f(a, 6), f(b, 6), f(b, -6)], [0.63, 0.85, 0.9], [0, 1, 1]);
      if (i % 4 === 0) beam(o, 'metal', f(a, -6), f(a, 6), 0.04, 0.05, white);
    }
  }
}
function skin(out) {
  const panelCount = Math.ceil(perimeter / 1.9);
  for (let i = 0; i < panelCount; i++) {
    const t = i / panelCount,
      u = (i + 1) / panelCount,
      p = outer(t),
      q = outer(u),
      n = [(p[0] + q[0]) / 2, 0, (p[2] + q[2]) / 2];
    const point = (f, y) => outer(f, y, Math.max(0, (32 - y) * 0.25));
    const boundary = (f, k) =>
      10 + k * 3.55 + 0.5 * Math.sin(f * TAU * 2 + 0.2) * Math.sin((Math.PI * k) / 6);
    for (let band = 0; band < 6; band++) {
      const y = boundary(t, band),
        Y = boundary(u, band),
        h = boundary(t, band + 1),
        H = boundary(u, band + 1),
        th = 0.55 + 0.9 * (0.5 + 0.5 * Math.cos(t * TAU * 2 + band * 0.22)),
        TH = 0.55 + 0.9 * (0.5 + 0.5 * Math.cos(u * TAU * 2 + band * 0.22));
      face(
        out,
        'perforatedRound',
        [point(t, y), point(u, Y), point(u, H - TH), point(t, h - th)],
        white,
        n,
      );
      face(
        out,
        'perforatedRound',
        [point(t, h - th), point(u, H - TH), point(u, H), point(t, h)],
        blue,
        n,
      );
      beam(out, 'metal', point(t, y), point(t, h), 0.014, 0.045, [0.7, 0.76, 0.8]);
      if (band === 0 || band === 5)
        beam(
          out,
          'metal',
          point(t, band === 0 ? y : h),
          point(u, band === 0 ? Y : H),
          0.08,
          0.1,
          white,
        );
    }
    // Structure behind the perforated veil and open circulation below its skirt.
    if (i % 5 === 0) {
      const p = outer(t, 0, 12),
        q = outer(t, 32, 8);
      beam(out, 'concrete', p, q, 0.64, 0.72, concrete);
      for (const y of [5, 10, 15, 20, 25])
        beam(out, 'concrete', outer(t, y, 11), outer(t, y, 26), 0.48, 0.8, concrete);
    }
    {
      const a = outer(t, 5, 8),
        b = outer(u, 5, 8),
        c = outer(t, 5, 22),
        d = outer(u, 5, 22);
      face(out, 'concrete', [a, b, d, c], concrete, [0, 1, 0]);
      for (const y of [10, 15, 20, 25])
        face(
          out,
          'concrete',
          [outer(t, y, 11), outer(u, y, 11), outer(u, y, 24), outer(t, y, 24)],
          concrete,
          [0, 1, 0],
        );
    }
    const a = outer(t, 0.25, 12),
      b = outer(u, 0.25, 12),
      c = outer(u, 4.6, 12),
      d = outer(t, 4.6, 12);
    face(out, 'glass', [a, b, c, d], i % 7 === 0 ? [0.1, 0.18, 0.23] : dark, n);
    if (i % 3 === 0) beam(out, 'metal', a, d, 0.07, 0.09, white);
  }
  // Raised ring deck supported on an open ground-level arcade, with eight broad stair banks.
  for (let i = 0; i < 256; i++) {
    const t = i / 256,
      u = (i + 1) / 256,
      a = outer(t, 4.9, -5),
      b = outer(u, 4.9, -5),
      c = outer(u, 4.9, 8),
      d = outer(t, 4.9, 8);
    face(out, 'concrete', [a, b, c, d], [0.72, 0.72, 0.68], [0, 1, 0]);
    beam(out, 'concrete', a, b, 0.3, 0.45, white);
    if (i % 8 === 0) {
      const p = outer(t, 0, -2);
      box(out, 'concrete', [p[0] - 0.4, 0, p[2] - 0.4], [p[0] + 0.4, 4.9, p[2] + 0.4], concrete);
    }
  }
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.25) / 8,
      p = outer(t, 4.9, -5),
      yaw = Math.atan2(p[0], p[2]),
      o = transformed(out, yaw, p);
    for (let j = 0; j < 28; j++) {
      const z = j * 0.34,
        y = (-4.9 * (j + 1)) / 28;
      box(o, 'concrete', [-6, y, z], [6, y + 0.175, z + 0.34], concrete);
    }
    for (const x of [-5.8, 0, 5.8])
      rail(
        o,
        Array.from({ length: 29 }, (_, j) => [x, (-j * 4.9) / 28, j * 0.34]),
      );
    for (const x of [-6.1, 6.1])
      beam(o, 'concrete', [x, -0.3, 0], [x, -4.8, 9.52], 0.3, 0.5, white);
  }
}
export function buildRostec(out) {
  bowl(out);
  skin(out);
  roof(out);
}
export const rostecStudy = {
  id: 'N0700',
  key: 'rostec_arena',
  wikidataId: 'Q4439098',
  title: 'Rostec Arena',
  build: buildRostec,
  metricTriangleUv: true,
  smoothNormalSlots: [],
  embeddedCanonicalGraphs: ['metal_perforated_round'],
  size: [211, 47, 260],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center at field/street datumY0. Native+Z north-northwest end; +X west-southwest side.',
  },
  previewCamera: { position: [215, 141, 247], lookAt: [0, 18, 0] },
  visualBrief:
    'As-built Kaliningrad stadium with angular rounded rectangle footprint, flared six-course white and deep-blue microperforated sheet cladding, open lower arcade and raised deck with broad stair banks,32needle masts with forward rod stays and backstays, box-section radial and ring trusses, opaque metal roof with clear polycarbonate inner strip, two blue-white mosaic seating tiers, glazed hospitality ribbon, suspended goal-end screens and dugouts.',
  sourceFacts: {
    published:
      'Operator47m maximum height and35,000 capacity. P.G.Yeremeyev, Metal structures of football stadiums of World Cup2018, NIC Construction journal3(18),pp50–51:166.65×203.65m structural axes,126.9×89.4m roof opening,32radial box-section stayed trusses with38.2m cantilevers, Macalloy ties, profiled steel roof and transparent polycarbonate inner strip.',
    reconstructed:
      'Actual outer way552139952 and pitch623571034 establish plan and geographic direction. Mapped outer skin is about189×231m, larger than published structural axes; mast line is inset10.2m. Contractor completed2018 photographs establish six white/blue stripes, folded angular corners, raised circulation deck, truss depth and blue-white seats. Exact band waviness, perforation fabrication schedule, concourse levels, stair inventory, row counts and member sections are reconstructed. Original abandoned retractable-roof designs are explicitly excluded.',
  },
  referencePages: [
    'https://www.rostec-arena.ru/pages/about-stadium',
    'https://www.steelcon.ru/products/kaliningrad/',
    'https://smartal.ru/stroitelstvo-stadiona-v-kaliningrade/',
    'https://www.crocusgroup.ru/projects/civil-construction/stadiony-k-chempionatu-mira-po-futbolu-2018-goda-v-kaliningrade-i-rostove-na-donu/',
    'https://www.normacs.info/uploads/ckeditor/attachments/4750/%D0%92%D0%B5%D1%81%D1%82%D0%BD%D0%B8%D0%BA_3_18_2018.pdf',
    'https://www.openstreetmap.org/relation/8940837',
    'https://www.openstreetmap.org/way/623571034',
  ],
  referenceRights:
    'Reference photographs and drawings used only for architectural research. No reference imagery or downloaded mesh embedded. Original geometry and reusable procedural surfaces; OSM coordinate attribution OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: rostecPlan.anchor,
    heading: rostecPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Ground-floor column bases and pitch areY0; the circulation podium stands4.9m above ground. Angled stair parapet section corners enter the ground slightly as intended embedded foundations.',
    source: 'https://www.openstreetmap.org/relation/8940837',
    featureIds: ['relation/8940837', 'way/552139952', 'way/623571034'],
    notes:
      'Exact pitch long sides averaged to direct+Z north-northwest; model retains asymmetric mapped perimeter. Existing polygon hole marks grass margins, not roof aperture; roof aperture uses primary structural dimensions. Ground-floor piers and pitch are placed on terrainY0, raised circulation deck stands above it. Site landscaping and perimeter security buildings remain separate map features.',
  },
  limitations: [
    'Permanent current exterior with fixed roof; no fictitious retractable panel or abandoned2012architectural scheme. Exact panel fabrication/perforation and seat inventory, ramp/stair sub-layout, internal rooms and event sponsor dressing are not claimed. Microscopic hole schedule uses the canonical4mm/12mm reusable surface as a documented visual reconstruction.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-blue-white-facade', position: [122, 23, 1], lookAt: [91, 22, 0] },
    { name: 'near-perforated-cladding', position: [90.65, 22, 2], lookAt: [89.65, 22, 2] },
    { name: 'near-angular-corner', position: [106, 27, 119], lookAt: [77, 24, 91] },
    { name: 'near-mast-stays', position: [112, 51, 22], lookAt: [82, 39, 6] },
    { name: 'near-roof-lattice', position: [23, 24, 4], lookAt: [65, 32, 0] },
    { name: 'near-clear-roof-strip', position: [22, 51, 90], lookAt: [20, 33, 66] },
    { name: 'near-blue-mosaic-bowl', position: [0, 8, -8], lookAt: [65, 16, 4] },
    { name: 'near-hospitality', position: [34, 15, 9], lookAt: [60, 15, 0] },
    { name: 'near-entrance-stairs', position: [78, 10, 144], lookAt: [62, 5, 111] },
    { name: 'near-ground-arcade', position: [111, 3, 9], lookAt: [82, 3, 0] },
    { name: 'near-dugouts', position: [28, 2, -20], lookAt: [40, 1.5, -17] },
    { name: 'far-northwest', position: [211, 74, 225], lookAt: [0, 21, 0] },
  ],
};
