/** Independent Emirates tower exteriors from NORR's published plans/sections. */
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  commonLimit,
  face,
  grid,
  mappedCap,
  mappedSolid,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const S = 55.5,
  H = (S * Math.sqrt(3)) / 2,
  rear = -H / 3,
  tip = (H * 2) / 3;
const plan = [
  [tip, 0],
  [rear, -S / 2],
  [rear, S / 2],
];
const silver = [0.72, 0.75, 0.75],
  dark = [0.055, 0.075, 0.083],
  glazing = [0.32, 0.43, 0.47],
  copper = [0.46, 0.32, 0.23];
const point = (p, y) => [p[0], y, p[1]];
function edges(ring) {
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return {
      a,
      b,
      len,
      at: (u, y, d = 0) => [
        a[0] + (b[0] - a[0]) * u - ((b[1] - a[1]) / len) * d,
        y,
        a[1] + (b[1] - a[1]) * u + ((b[0] - a[0]) / len) * d,
      ],
    };
  });
}
function quad(out, at, u0, u1, y0, y1, slot = 'metal', color = silver, d = 0) {
  if (u1 - u0 < 1e-7 || y1 - y0 < 0.01) return;
  face(out, slot, [at(u0, y0, d), at(u1, y0, d), at(u1, y1, d), at(u0, y1, d)], color);
}
function panels(out, at, u0, u1, y0, y1, width, slot = 'metal', color = silver) {
  const nu = Math.max(1, Math.ceil((width * (u1 - u0)) / 1.5)),
    nv = Math.max(1, Math.ceil((y1 - y0) / 1.25));
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = u0 + ((u1 - u0) * i) / nu,
        b = u0 + ((u1 - u0) * (i + 1)) / nu,
        c = y0 + ((y1 - y0) * j) / nv,
        d = y0 + ((y1 - y0) * (j + 1)) / nv;
      const tint = color.map((v) => v * (1 + (((i * 13 + j * 7) % 7) - 3) * 0.004));
      quad(out, at, a, b, c, d, slot, tint);
      if (j < nv - 1)
        beam(out, 'metal', at(a, d, 0.015), at(b, d, 0.015), 0.022, 0.024, [0.46, 0.5, 0.51]);
      if (i < nu - 1)
        beam(out, 'metal', at(b, c, 0.015), at(b, d, 0.015), 0.022, 0.024, [0.46, 0.5, 0.51]);
    }
}
function panes(out, at, u0, u1, y0, y1, width, color = glazing) {
  const count = Math.ceil((width * (u1 - u0)) / 1.42);
  for (let i = 0; i < count; i++) {
    const a = u0 + ((u1 - u0) * i) / count,
      b = u0 + ((u1 - u0) * (i + 1)) / count;
    grid(
      out,
      [at(a, y0), at(b, y0), at(b, y1), at(a, y1)],
      color,
      2,
      y1 - y0,
      0.045,
      silver,
      'metal',
    );
  }
}
function ribbonFacade(out, edge, bottom, top, pitch) {
  const { at, len } = edge,
    l = 4.2 / len,
    r = 1 - 3.0 / len;
  panels(out, at, 0, l, bottom, top, len);
  panels(out, at, r, 1, bottom, top, len);
  for (let y = bottom; y < top - 0.1; y += pitch) {
    const end = Math.min(top, y + pitch),
      sill = Math.min(end, y + 1.3);
    panels(out, at, l, r, y, sill, len);
    if (end - sill > 0.05) {
      panes(out, (u, v) => at(u, v, -0.12), l, r, sill, end, len);
      face(
        out,
        'metal',
        [at(l, sill), at(r, sill), at(r, sill, -0.12), at(l, sill, -0.12)],
        silver,
      );
      face(out, 'metal', [at(l, end, -0.12), at(r, end, -0.12), at(r, end), at(l, end)], silver);
      for (const u of [l, r])
        beam(out, 'metal', at(u, sill, -0.08), at(u, end, -0.08), 0.055, 0.07, silver);
      beam(out, 'metal', at(l, sill, 0.065), at(r, sill, 0.065), 0.1, 0.18, silver);
    }
  }
}
function curvedFace(out, y0, y1, pitch, color = glazing) {
  // The broad outer facade is an actual bowed curtain wall within a metal frame.
  const radius = 29.7,
    center = rear + 24.2,
    spread = Math.asin(17.8 / radius),
    steps = 30;
  const at = (t, y) => [center - radius * Math.cos(t), y, radius * Math.sin(t)];
  const cap = [
    [rear, -17.8],
    ...Array.from({ length: steps + 1 }, (_, i) => {
      const [x, _y, z] = at(-spread + (i * 2 * spread) / steps, y0);
      return [x, z];
    }),
    [rear, 17.8],
  ];
  mappedCap(out, 'metal', cap, y0, silver, [], true);
  mappedCap(out, 'metal', cap, y1, silver);
  for (let y = y0; y < y1 - 0.05; y += pitch) {
    const hi = Math.min(y1, y + pitch);
    for (let k = 0; k < steps; k++) {
      const a = -spread + (k * 2 * spread) / steps,
        b = -spread + ((k + 1) * 2 * spread) / steps;
      grid(
        out,
        [at(a, y), at(b, y), at(b, hi), at(a, hi)],
        color,
        2,
        hi - y,
        0.065,
        silver,
        'metal',
      );
    }
  }
  const e = edges(plan)[1];
  for (const [a, b] of [
    [0, (S / 2 - 17.8) / S],
    [(S / 2 + 17.8) / S, 1],
  ])
    panels(out, e.at, a, b, y0, y1, S);
  for (const sign of [-1, 1]) {
    const a = e.at((S / 2 + sign * 17.8) / S, y0),
      b = at(sign * spread, y0);
    face(out, 'metal', [a, b, [b[0], y1, b[2]], [a[0], y1, a[2]]], silver);
  }
}
function drum(out, height) {
  const r = 17.0,
    sides = 90;
  for (let j = 0; j < 8; j++) {
    const y0 = (j * height) / 8,
      y1 = ((j + 1) * height) / 8;
    const a = radialRing(y0, r, r, sides),
      b = radialRing(y1, r, r, sides);
    for (let i = 0; i < sides; i++)
      grid(
        out,
        [a[i], a[(i + 1) % sides], b[(i + 1) % sides], b[i]],
        [0.25, 0.36, 0.39],
        2,
        y1 - y0,
        0.07,
        silver,
        'metal',
      );
    loft(
      out,
      'metal',
      [radialRing(y1 - 0.18, r + 0.15, r + 0.15, sides), radialRing(y1, r + 0.15, r + 0.15, sides)],
      silver,
      { cap: false },
    );
  }
  mappedCap(
    out,
    'foundation',
    radialRing(0, r, r, sides).map(([x, _y, z]) => [x, z]),
    0,
    [0.38, 0.39, 0.39],
    [],
    true,
  );
  // Three full-depth triangular supports are open around the smaller drum.
  for (let i = 0; i < 3; i++) {
    const a = plan[i],
      prev = plan[(i + 2) % 3],
      next = plan[(i + 1) % 3];
    const p = [
      a,
      [a[0] + (next[0] - a[0]) * 0.16, a[1] + (next[1] - a[1]) * 0.16],
      [a[0] + (prev[0] - a[0]) * 0.16, a[1] + (prev[1] - a[1]) * 0.16],
    ];
    mappedSolid(out, 'metal', p, 0.5, height + 1.7, silver);
    mappedSolid(out, 'stone', p, 0, 0.5, [0.18, 0.2, 0.21]);
  }
  mappedCap(out, 'metal', plan, height, silver, [], true);
}
function beacon(out, bottom, top) {
  const center = tip - 5.6,
    r = 4.7;
  const a = radialRing(bottom, r, r, 64, [center, 0]),
    b = radialRing(top, r, r, 64, [center, 0]);
  for (let i = 0; i < 64; i++) {
    face(out, 'glass', [a[i], a[(i + 1) % 64], b[(i + 1) % 64], b[i]], copper);
    if (i % 4 === 0) tube(out, 'metal', a[i], b[i], 0.035, silver, 6);
  }
  for (let y = bottom; y < top; y += 1.3) {
    const ring = radialRing(y, r + 0.015, r + 0.015, 64, [center, 0]);
    for (let i = 0; i < 64; i++) tube(out, 'metal', ring[i], ring[(i + 1) % 64], 0.025, silver, 4);
  }
  loft(
    out,
    'metal',
    [
      radialRing(top, r + 0.18, r + 0.18, 64, [center, 0]),
      radialRing(top + 0.45, r + 0.18, r + 0.18, 64, [center, 0]),
    ],
    silver,
  );
}
function crown(out, bodyTop, low, high, height) {
  const cut = tip - 10,
    w = ((tip - cut) * S) / (2 * H),
    upperPlan = [
      [cut, -w],
      [rear, -S / 2],
      [rear, S / 2],
      [cut, w],
    ];
  beacon(out, bodyTop, low);
  // The recessed beacon meets a closed ledge below and the gable soffit above.
  mappedCap(out, 'metal', plan, bodyTop, silver);
  mappedCap(out, 'metal', plan, low, silver, [], true);
  const es = edges(upperPlan);
  for (let i = 0; i < es.length; i++) {
    const { at, len } = es[i];
    if (i === 3) {
      panels(out, at, 0, 1, bodyTop, low, len);
      continue;
    }
    panels(out, at, 0, 1, bodyTop, bodyTop + 2.2, len);
    panels(out, at, 0, 1, low - 2, low, len);
    if (i === 1) {
      curvedFace(out, bodyTop + 2.2, low - 2, 2, copper);
      continue;
    }
    const count = 5,
      start = 0.29,
      end = 0.76,
      pitch = (end - start) / count;
    let u = 0;
    for (let k = 0; k < count; k++) {
      const l = start + k * pitch,
        r = l + pitch * 0.47;
      panels(out, at, u, l, bodyTop + 2.2, low - 2, len);
      panes(out, (a, y) => at(a, y, -0.18), l, r, bodyTop + 2.2, low - 2, len, [0.22, 0.33, 0.36]);
      u = r;
      for (const v of [l, r])
        beam(out, 'metal', at(v, bodyTop + 2.2), at(v, low - 2), 0.1, 0.12, silver);
    }
    panels(out, at, u, 1, bodyTop + 2.2, low - 2, len);
  }
  // Two solid cladded triangular gables flank a genuine sloped glass roof.
  const roofY = (x) => low + ((x - rear) / H) * (high - low);
  for (const edge of [edges(plan)[0], edges(plan)[2]]) {
    const { at } = edge,
      n = 40;
    for (let i = 0; i < n; i++) {
      const a = i / n,
        b = (i + 1) / n,
        ta = roofY(at(a, 0)[0]),
        tb = roofY(at(b, 0)[0]);
      if (Math.max(ta, tb) - low < 0.02) continue;
      const y = low;
      if (Math.min(ta, tb) - y < 0.02)
        tri(out, 'metal', [at(a, y), at(b, y), at(ta > tb ? a : b, Math.max(ta, tb))], silver);
      else face(out, 'metal', [at(a, y), at(b, y), at(b, tb), at(a, ta)], silver);
      for (let yy = low + 1.3; yy < Math.min(ta, tb); yy += 1.3)
        beam(out, 'metal', at(a, yy, 0.014), at(b, yy, 0.014), 0.025, 0.03, [0.5, 0.53, 0.54]);
      if (Math.min(ta, tb) > low + 0.03)
        beam(out, 'metal', at(b, low, 0.014), at(b, tb, 0.014), 0.025, 0.03, [0.5, 0.53, 0.54]);
    }
    for (let y = high - 26; y < high - 17; y += 1.5) {
      const nearTip = edge.a[0] > edge.b[0] ? [0.06, 0.29] : [0.71, 0.94];
      const cuts = nearTip.map((u) => edge.at(u, y, 0.08));
      if (cuts.every((p) => roofY(p[0]) > y + 0.5))
        beam(out, 'metal', cuts[0], cuts[1], 0.55, 0.3, dark);
    }
  }
  const q = plan.map((p) => point(p, roofY(p[0])));
  tri(out, 'glass', q, [0.27, 0.37, 0.38]);
  // Subdivide the triangular roof into physical diamond-grid framing and glass panes.
  for (let j = 0; j <= 24; j++) {
    const t = j / 24,
      x = rear + H * t,
      z = ((1 - t) * S) / 2,
      y = roofY(x) + 0.1;
    if (z > 0.1) beam(out, 'metal', [x, y, -z], [x, y, z], 0.14, 0.17, silver);
    if (j < 24) {
      for (const sign of [-1, 1]) {
        const start = [rear, low + 0.1, ((sign * S) / 2) * (1 - 2 * t)],
          end = [rear + H * (1 - t), roofY(rear + H * (1 - t)) + 0.1, ((-sign * S) / 2) * t];
        if (Math.hypot(...start.map((v, k) => v - end[k])) > 0.2)
          beam(out, 'metal', start, end, 0.11, 0.14, silver);
      }
    }
  }
  for (let i = 0; i < 3; i++) beam(out, 'metal', q[i], q[(i + 1) % 3], 0.5, 0.65, silver);
  // Rectangular two-stage pinnacle with a solid lower plate and narrow upper fin.
  const x = tip - 0.3;
  box(out, 'metal', [x - 0.48, high - 5, -0.48], [x + 0.48, height - 22, 0.48], silver);
  box(
    out,
    'stainless',
    [x - 0.22, height - 22, -0.22],
    [x + 0.22, height, 0.22],
    [0.61, 0.66, 0.68],
  );
  for (let y = high + 1; y < height - 22; y += 1.4)
    beam(out, 'metal', [x - 0.51, y, -0.5], [x + 0.51, y, 0.5], 0.04, 0.04, [0.45, 0.5, 0.51]);
  for (let k = 0; k < 3; k++) {
    const xx = rear + 8 + k * 9,
      zz = -S / 2 + 8 + k * 5;
    tube(out, 'metal', [xx, roofY(xx) + 0.4, zz], [xx + 3, roofY(xx) + 3.2, zz], 0.15, silver, 8);
  }
}
function entrance(out, isHotel) {
  const roof = [
    [rear - 1, 6.8, -12],
    [rear - 1, 6.8, 12],
    [rear - 18, 5.3, 0],
  ];
  tri(out, 'glass', roof, [0.27, 0.38, 0.41]);
  tri(out, 'glass', roof.toReversed(), [0.27, 0.38, 0.41]);
  for (let i = 0; i < 3; i++) beam(out, 'metal', roof[i], roof[(i + 1) % 3], 0.35, 0.4, silver);
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    beam(
      out,
      'metal',
      [rear - 1 - 17 * t, 6.8 - 1.5 * t, -12 * (1 - t)],
      [rear - 1 - 17 * t, 6.8 - 1.5 * t, 12 * (1 - t)],
      0.09,
      0.1,
      silver,
    );
  }
  for (const z of [-9, 9])
    tube(out, 'stainless', [rear - 4.8, 0, z], [rear - 4.8, 6.46, z], 0.16, silver, 12);
  for (const z of [-5, 0, 5]) {
    const r = 1.25,
      cx = rear - 1.5;
    const a = radialRing(0.1, r, r, 40, [cx, z]),
      b = radialRing(3.25, r, r, 40, [cx, z]);
    for (let i = 0; i < 40; i++)
      grid(
        out,
        [a[i], a[(i + 1) % 40], b[(i + 1) % 40], b[i]],
        [0.29, 0.39, 0.41],
        1,
        1,
        0.045,
        silver,
        'metal',
      );
    loft(
      out,
      'metal',
      [
        radialRing(3.25, r + 0.12, r + 0.12, 40, [cx, z]),
        radialRing(3.6, r + 0.12, r + 0.12, 40, [cx, z]),
      ],
      silver,
    );
  }
  // Small tower-owned arrival apron only; the shared retail complex is not duplicated.
  const apron = [
    [rear - 21, -16],
    [rear - 21, 16],
    [rear + 2, 23],
    [rear + 2, -23],
  ];
  mappedSolid(out, 'stone', apron, 0, 0.12, [0.29, 0.29, 0.28]);
  if (isHotel) {
    for (const sign of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const z = sign * (12.5 + i * 0.46);
        box(
          out,
          'stone',
          [rear - 15, 0.12, z - 0.18],
          [rear - 3, 0.25 + (0.6 - i * 0.06), z + 0.18],
          [0.28, 0.29, 0.28],
        );
      }
  }
}
export function buildEmirates(out, _mapped, hotel = false) {
  const bottom = hotel ? 31.8 : 38.5,
    bodyTop = hotel ? 176 : 218.5,
    low = hotel ? 215 : 253,
    high = hotel ? 263.3 : 301,
    height = hotel ? 309 : 355;
  drum(out, bottom);
  const e = edges(plan);
  ribbonFacade(out, e[0], bottom, bodyTop, hotel ? 3.6 : 4.5);
  ribbonFacade(out, e[2], bottom, bodyTop, hotel ? 3.6 : 4.5);
  curvedFace(out, bottom, bodyTop, hotel ? 3.6 : 4.5);
  for (const [a, b] of [
    [bottom, bottom + 1.4],
    [bodyTop - 1.6, bodyTop],
  ]) {
    for (const edge of e) panels(out, edge.at, 0, 1, a, b, edge.len);
  }
  crown(out, bodyTop, low, high, height);
  entrance(out, hotel);
}

const refs = [
  'https://norrgroup.com/jumeirah-emirates-towers-office/',
  'https://www.multiplex.global/projects/emirates-towers/',
  'https://www.turnerconstruction.com/projects/emirates-towers',
  'https://modularsa.com/wp-content/uploads/2021/01/The_Architecture_of_the_United_Arab_Emirates.pdf',
  'https://www.investindubai.gov.ae/fr/dubai-for-events/venues/-/media/venues/files/jumeirah-emirates-towers/floorplan.pdf',
  'https://www.jumeirah.com/en/stay/dubai/jumeirah-emirates-towers',
  'https://www.servcorp.ae/en/serviced-offices/locations/dubai/emirates-tower/',
];
export const emiratesStudies = [false, true].map((hotel) => ({
  id: hotel ? 'N0199' : 'N0194',
  key: hotel ? 'jumeirah_emirates_towers_hotel' : 'emirates_office_tower',
  wikidataId: hotel ? 'Q1049027' : 'Q845182',
  title: hotel ? 'Jumeirah Emirates Towers Hotel' : 'Emirates Office Tower',
  height: hotel ? 309 : 355,
  build: (out, m) => buildEmirates(out, m, hotel),
  mapFrame: 'map-frame.json',
  brief:
    'A separately registered triangular Emirates tower with three open base piers, eight-storey glass drum, bowed outer curtain wall, horizontal ribbon facades, copper-glass beacon, slit-window upper floors and sloping glazed roof with a rectangular pinnacle.',
  sourceFacts: {
    architect: 'Hazel Wong, NORR',
    completed: 2000,
    equilateralPlanSideMeters: 55.5,
    typicalFloorHeightMeters: hotel ? 3.6 : 4.5,
    publishedFloors: hotel ? 56 : 54,
    architecturalHeightMeters: hotel ? 309 : 355,
    materials: 'Silver aluminium panels with silver/copper reflective glass; granite base',
    dimensionalSource:
      'Architect-contributed plans, sections and commentary in The Architecture of the United Arab Emirates, printed64–78; contractor Multiplex whole-metre height309 for hotel and354 for office; book355 office.',
  },
  reconstruction: {
    base: 'Three full-depth triangular piers flank an independently enclosed eight-floor circular drum. Tower-specific canopy, revolving-door volumes and a small arrival apron are modeled; the shared shopping/parking podium is excluded to avoid overlapping assets.',
    facade:
      'Two horizontal ribbon facades have separate recessed glazing, silver spandrels and outward projecting sills. The broad outer facade bows as a physical cylinder segment, rather than a flat texture. Upper narrow windows and copper-glass cylindrical beacon are separate geometry.',
    roof: 'Two metal-clad gables enclose a diagonal-framed triangular glass roof. Rectangular two-stage mast and small maintenance arms retain a distinctive silhouette.',
  },
  refs,
  nativeAxes: {
    up: '+Y',
    front: '+X toward inward apex and mast',
    outerLobby: '-X opposite the mast',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes: `Operator coordinates and labeled primary plan override swapped OSM QIDs: this ${hotel ? 'western hotel way393391114' : 'eastern office way393391115'} is anchored at its independent triangle centroid. Native+X follows the inward apex, corroborated by primary plan and roof photographs. The55.5m published triangle governs model size; raw map tags are preserved. GroundY0 is the tower entrance datum; shared podium and changing landscape are excluded.`,
  }),
  limitations: [
    commonLimit,
    'Roof-stage and upper mechanical datums, fine curtain-wall pitch, facade panel joints, cylindrical bow, mast section and small entry hardware are reconstructed from primary sections and completed photographs. Contractor and architect sources round heights differently; selected overall heights are355m office and309m hotel. Interior fit-out, full common retail/parking complex, changing signs and neighboring Museum of the Future are excluded.',
  ],
  camera: { position: [240, hotel ? 194 : 220, 260], lookAt: [0, hotel ? 147 : 172, 0], fov: 41 },
  qaCameras: [
    {
      name: 'triangular-ribbon-shaft',
      position: [100, hotel ? 129 : 149, 105],
      lookAt: [0, hotel ? 117 : 139, 0],
    },
    {
      name: 'outer-curved-curtain-wall',
      position: [-145, hotel ? 134 : 160, 35],
      lookAt: [-17, hotel ? 105 : 130, 0],
    },
    {
      name: 'recessed-ribbon-detail',
      position: [57, hotel ? 95 : 110, 48],
      lookAt: [8, hotel ? 85 : 100, 14],
    },
    { name: 'open-three-legged-base', position: [75, 24, 69], lookAt: [0, 20, 0] },
    { name: 'eight-storey-glass-drum', position: [-63, 25, 34], lookAt: [-5, 18, 0] },
    {
      name: 'copper-beacon-and-slits',
      position: [92, hotel ? 205 : 245, 52],
      lookAt: [13, hotel ? 194 : 238, 0],
    },
    {
      name: 'sloping-glazed-roof',
      position: [-91, hotel ? 290 : 331, 71],
      lookAt: [0, hotel ? 238 : 276, 0],
    },
    {
      name: 'gable-panel-and-louvers',
      position: [68, hotel ? 250 : 290, 45],
      lookAt: [20, hotel ? 247 : 283, 0],
    },
    {
      name: 'rectangular-pinnacle',
      position: [70, hotel ? 301 : 344, 36],
      lookAt: [32, hotel ? 286 : 328, 0],
    },
    { name: 'outer-arrival-canopy', position: [-69, 16, 34], lookAt: [-25, 4, 0] },
    {
      name: 'far-triangular-profile',
      position: [440, hotel ? 144 : 169, -310],
      lookAt: [0, hotel ? 148 : 174, 0],
    },
  ],
}));
