/** 432 Park Avenue: exposed concrete basket, punched window units and five real open drums. */
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  commonLimit,
  face,
  grid,
  guardrail,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  rotatedBuilder,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const pale = [0.79, 0.785, 0.755],
  metal = [0.2, 0.23, 0.235],
  blue = [0.14, 0.24, 0.265];
const half = 14.25,
  top = 425.5,
  pitch = 4.7244,
  base = top - 90 * pitch;
const openRows = new Set([20, 21, 34, 35, 48, 49, 62, 63, 76, 77]);
const faces = [
  { n: [1, 0, 0], r: [0, 0, -1] },
  { n: [0, 0, 1], r: [1, 0, 0] },
  { n: [-1, 0, 0], r: [0, 0, 1] },
  { n: [0, 0, -1], r: [-1, 0, 0] },
];
const rect = (a, b, c, d) => [
  [a, b],
  [a, d],
  [c, d],
  [c, b],
];
const at = (f, u, y, d = 0) => [
  f.n[0] * (half + d) + f.r[0] * u,
  y,
  f.n[2] * (half + d) + f.r[2] * u,
];
function panel(out, f, u0, u1, y0, y1, color = pale, d = 0, slot = 'concrete') {
  if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
  face(out, slot, [at(f, u0, y0, d), at(f, u1, y0, d), at(f, u1, y1, d), at(f, u0, y1, d)], color);
}
function bay(out, f, column, row) {
  const cell = (half * 2) / 6,
    u0 = -half + column * cell,
    u1 = u0 + cell,
    y0 = base + row * pitch,
    y1 = y0 + pitch;
  const open = openRows.has(row),
    width = open ? 3.58 : 3.048,
    height = open ? 3.58 : 3.048;
  const left = (u0 + u1 - width) / 2,
    right = left + width,
    low = (y0 + y1 - height) / 2,
    high = low + height;
  const reveal = open ? 1.35 : 0.1016;
  panel(out, f, u0, u1, y0, low);
  panel(out, f, u0, u1, high, y1);
  panel(out, f, u0, left, low, high);
  panel(out, f, right, u1, low, high);
  const p = [at(f, left, low), at(f, right, low), at(f, right, high), at(f, left, high)];
  const q = [
    at(f, left, low, -reveal),
    at(f, right, low, -reveal),
    at(f, right, high, -reveal),
    at(f, left, high, -reveal),
  ];
  for (let j = 0; j < 4; j++)
    face(out, 'concrete', [p[j], p[(j + 1) % 4], q[(j + 1) % 4], q[j]], pale);
  if (open) {
    // Visible backs of the outside moment frame surround genuine through-openings.
    for (const [a, b, c, d] of [
      [u0, u1, y0, low],
      [u0, u1, high, y1],
      [u0, left, low, high],
      [right, u1, low, high],
    ]) {
      face(
        out,
        'concrete',
        [at(f, a, c, -reveal), at(f, a, d, -reveal), at(f, b, d, -reveal), at(f, b, c, -reveal)],
        pale,
      );
    }
    return;
  }
  const shade = 0.88 + ((row * 13 + column * 7 + faces.indexOf(f) * 3) % 11) * 0.012;
  face(
    out,
    'glass',
    q,
    blue.map((c) => c * shade),
  );
  for (let j = 0; j < 4; j++) beam(out, 'metal', q[j], q[(j + 1) % 4], 0.048, 0.055, metal);
  // An inset hopper sash is separate from the 10ft insulated picture-window perimeter.
  const a = left + 0.22,
    b = right - 0.22,
    c = low + 0.18,
    d = low + 1.07;
  for (const [u, v] of [
    [
      [a, c],
      [b, c],
    ],
    [
      [b, c],
      [b, d],
    ],
    [
      [b, d],
      [a, d],
    ],
    [
      [a, d],
      [a, c],
    ],
  ])
    beam(out, 'metal', at(f, u[0], u[1], -0.07), at(f, v[0], v[1], -0.07), 0.028, 0.03, metal);
  if (column === 2 || column === 3)
    boxOnFace(out, f, (a + b) / 2, d - 0.04, -0.045, 0.11, 0.025, 0.028, [0.35, 0.36, 0.35]);
}
function boxOnFace(out, f, u, y, d, w, h, t, color, slot = 'metal') {
  const ring = (v) => [
    at(f, u - w / 2, v, d - t / 2),
    at(f, u - w / 2, v, d + t / 2),
    at(f, u + w / 2, v, d + t / 2),
    at(f, u + w / 2, v, d - t / 2),
  ];
  loft(out, slot, [ring(y - h / 2), ring(y + h / 2)], color);
}
function drums(out) {
  for (const row of [20, 34, 48, 62, 76]) {
    const lo = base + row * pitch,
      hi = lo + 2 * pitch;
    mappedSolid(
      out,
      'concrete',
      rect(-half + 0.15, -half + 0.15, half - 0.15, half - 0.15),
      lo - 0.3,
      lo,
      pale,
    );
    mappedSolid(
      out,
      'concrete',
      rect(-half + 0.15, -half + 0.15, half - 0.15, half - 0.15),
      hi,
      hi + 0.3,
      pale,
    );
    loft(
      out,
      'metal',
      [radialRing(lo, 7.25, 7.25, 128), radialRing(hi, 7.25, 7.25, 128)],
      [0.62, 0.63, 0.61],
    );
    for (let i = 0; i < 64; i++) {
      const a = (i * Math.PI) / 32,
        x = 7.27 * Math.cos(a),
        z = 7.27 * Math.sin(a);
      tube(out, 'metal', [x, lo, z], [x, hi, z], 0.018, [0.38, 0.4, 0.39], 6);
    }
    for (const y of [lo + 2.35, lo + 4.7, lo + 7.05])
      for (let i = 0; i < 128; i++) {
        const a = (i * Math.PI) / 64,
          b = ((i + 1) * Math.PI) / 64;
        tube(
          out,
          'metal',
          [7.27 * Math.cos(a), y, 7.27 * Math.sin(a)],
          [7.27 * Math.cos(b), y, 7.27 * Math.sin(b)],
          0.018,
          [0.38, 0.4, 0.39],
          5,
        );
      }
  }
}
function door(out, x, z) {
  const radius = 1.1,
    n = 48;
  for (let i = 0; i < n; i++) {
    const a = (-i * 2 * Math.PI) / n,
      b = (-(i + 1) * 2 * Math.PI) / n;
    face(
      out,
      'clear_glass',
      [
        [x + radius * Math.cos(a), 0, z + radius * Math.sin(a)],
        [x + radius * Math.cos(b), 0, z + radius * Math.sin(b)],
        [x + radius * Math.cos(b), 3.3, z + radius * Math.sin(b)],
        [x + radius * Math.cos(a), 3.3, z + radius * Math.sin(a)],
      ],
      [0.7, 0.77, 0.77],
    );
  }
  loft(
    out,
    'metal',
    [
      radialRing(3.3, 1.2, 1.2, n).map((p) => [p[0] + x, p[1], p[2] + z]),
      radialRing(3.48, 1.2, 1.2, n).map((p) => [p[0] + x, p[1], p[2] + z]),
    ],
    [0.43, 0.43, 0.4],
  );
  tube(out, 'metal', [x, 0, z], [x, 3.3, z], 0.045, metal, 10);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3,
      p = [x + radius * Math.cos(a), 0, z + radius * Math.sin(a)],
      q = [p[0], 3.3, p[2]];
    face(out, 'clear_glass', [[x, 0, z], p, q, [x, 3.3, z]], [0.6, 0.73, 0.73]);
    tube(out, 'metal', p, q, 0.023, metal, 8);
  }
}
function shaft(out) {
  // Repeating top-down module fixes the completed roof without stretching the 15ft6in pitch.
  for (const f of faces) {
    for (let row = 1; row < 90; row++)
      for (let column = 0; column < 6; column++) bay(out, f, column, row);
    // Double-height-looking glazed arrival cells remain behind the concrete outer basket.
    for (let i = 0; i < 7; i++)
      boxOnFace(
        out,
        f,
        -half + (i * half) / 3,
        (base + pitch) / 2,
        -0.45,
        i === 0 || i === 6 ? 0.56 : 1.12,
        base + pitch,
        0.9,
        pale,
        'concrete',
      );
    grid(
      out,
      [
        at(f, -half, 0.05, -0.7),
        at(f, half, 0.05, -0.7),
        at(f, half, base + pitch, -0.7),
        at(f, -half, base + pitch, -0.7),
      ],
      blue,
      2.375,
      base + pitch,
      0.055,
      metal,
      'metal',
    );
    panel(out, f, -half, half, 0, 0.28);
    // Subtle floor pour seam, with no decorative texture grid superimposed on the concrete.
    for (let j = 1; j < 90; j++)
      beam(
        out,
        'metal',
        at(f, -half, base + j * pitch, 0.006),
        at(f, half, base + j * pitch, 0.006),
        0.008,
        0.012,
        [0.67, 0.67, 0.64],
      );
  }
  drums(out);
  mappedCap(out, 'concrete', rect(-half, -half, half, half), 0, pale, [], true);
  mappedSolid(out, 'concrete', rect(-half, -half, half, half), top - 0.24, top, pale);
  // Roof service equipment remains recessed below the surrounding parapet rather than protruding.
  box(out, 'concrete', [-half - 3.6, 4.14, -6.4], [-half + 0.1, 4.46, 6.4], pale);
  for (const z of [-5.9, 5.9])
    box(out, 'concrete', [-half - 3.45, 0, z - 0.18], [-half - 3.05, 4.14, z + 0.18], pale);
  for (const z of [-2.2, 2.2]) door(out, -half - 0.2, z);
  for (const z of [-4.8, 0, 4.8])
    box(
      out,
      'metal',
      [-half - 2.9, 4.08, z - 0.035],
      [-half - 0.1, 4.13, z + 0.035],
      [0.85, 0.82, 0.66],
    );
  // Shallow matched stone landing lies at the same entry datum as the mapped southwest door.
  mappedCap(out, 'stone', rect(-half - 3.5, -6.3, -half, 6.3), 0.012, [0.52, 0.51, 0.47]);
}
function podium(out, m, cx, cz) {
  const original = partPlan(
    m,
    partsEvidence('n0197_432_park_avenue').find((p) => p.id === 463386820),
  );
  const minX = Math.min(...original.map((p) => p[0])),
    maxX = Math.max(...original.map((p) => p[0])),
    minZ = Math.min(...original.map((p) => p[1])),
    maxZ = Math.max(...original.map((p) => p[1]));
  const plans = [rect(cx + half, minZ, maxX, maxZ), rect(minX, minZ, cx + half, cz - half)];
  for (const plan of plans) {
    const x0 = Math.min(...plan.map((p) => p[0])),
      x1 = Math.max(...plan.map((p) => p[0])),
      z0 = Math.min(...plan.map((p) => p[1])),
      z1 = Math.max(...plan.map((p) => p[1]));
    if (x1 - x0 < 0.1 || z1 - z0 < 0.1) continue;
    for (let k = 0; k < 4; k++) {
      const a = plan[k],
        b = plan[(k + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // Edges adjoining the shaft are hidden; the isolated L wing keeps its own exterior.
      if (
        Math.abs(a[0] - cx - half) < 0.02 &&
        Math.abs(b[0] - cx - half) < 0.02 &&
        Math.min(a[1], b[1]) >= cz - half - 0.02
      )
        continue;
      const count = Math.max(1, Math.round(len / 4.75)),
        ny = 6;
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < count; i++) {
          const u = i / count,
            v = (i + 1) / count,
            l = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
            r = [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v],
            y = j * 4.9;
          grid(
            out,
            [
              [l[0], y + (j === 0 ? 0.05 : 0), l[1]],
              [r[0], y + (j === 0 ? 0.05 : 0), r[1]],
              [r[0], y + 4.9, r[1]],
              [l[0], y + 4.9, l[1]],
            ],
            blue,
            4.75,
            4.9,
            0.3,
            pale,
            'concrete',
          );
        }
    }
    mappedSolid(out, 'concrete', plan, 29.4, 30, pale);
    // Accessible terrace paving, simple guards and planters from the architect's podium programme.
    guardrail(
      out,
      plan.map(([x, z]) => [x, 30.02, z]),
      0.9,
      [0.45, 0.47, 0.45],
    );
    for (let x = x0 + 2.1; x < x1 - 1.3; x += 4.8) {
      box(out, 'concrete', [x - 0.7, 30, z0 + 1.1], [x + 0.7, 30.5, z0 + 2.2], [0.5, 0.51, 0.48]);
      box(
        out,
        'foliage',
        [x - 0.6, 30.5, z0 + 1.2],
        [x + 0.6, 31.05, z0 + 2.1],
        [0.18, 0.26, 0.13],
      );
    }
  }
}
export function build432(out, m) {
  const shaftPlan = partPlan(
    m,
    partsEvidence('n0197_432_park_avenue').find((p) => p.id === 463593207),
  );
  const cx =
      (Math.min(...shaftPlan.map((p) => p[0])) + Math.max(...shaftPlan.map((p) => p[0]))) / 2,
    cz = (Math.min(...shaftPlan.map((p) => p[1])) + Math.max(...shaftPlan.map((p) => p[1]))) / 2;
  shaft(rotatedBuilder(out, 0, [cx, 0, cz]));
  podium(out, m, cx, cz);
}
export const park432Study = {
  id: 'N0197',
  key: '432_park_avenue',
  wikidataId: 'Q233940',
  title: '432 Park Avenue',
  height: top,
  build: build432,
  brief:
    'Detailed exposed-concrete Manhattan tower with physically punched10ft windows, recessed aluminum hopper units, five genuine open double-storey drum levels and the separately mapped lower L-shaped podium.',
  sourceFacts: {
    architect: 'Rafael Viñoly Architects',
    completed: 2015,
    heightMeters: 425.5,
    shaftSizeMeters: [28.5, 28.5],
    windowGlassMeters: [3.048, 3.048],
    glassRecessMeters: 0.1016,
    typicalFloorPitchMeters: 4.7244,
    windowsPerFacade: 6,
    openDrumLevels: 5,
    roof: 'Flat completed roof; no mast',
  },
  reconstruction: {
    frame:
      'White concrete exterior with90 geometrical grid rows; five open pairs at rows20/21,34/35,48/49,62/63 and76/77 are reconstructed from the architect elevation and completed facade photographs. Marketing floor numbers are not physical row indices.',
    windows:
      'Individual10ft panes recessed4in, physical concrete intrados, aluminum perimeter frames and reconstructed inset hopper sash. Exposed drum floors include continuous cylindrical mechanical enclosures and full-height open exterior grid.',
    base: 'Independent offset tower way463593207 retained inside mapped30m podium463386820. Southwest arrival matches mapped main entrance and architect56th Street description. Separate distant retail cube excluded.',
  },
  refs: [
    'https://www.rvapc.com/works/432-park-avenue/',
    'https://www.rvapc.com/wp-content/uploads/2016/04/2016_0601_RVA_432_FINAL_UPDATED.pdf',
    'https://enclos.com/project/432-park-avenue/',
    'https://www.sbp.de/en/project/432-park-avenue/',
    'https://mackloweproperties.com/news/pdfs/432-PA-Abitare-June-2013.pdf',
    'https://www.432parkavenue.com/assets/data/brochures/432Park_DigitalBrochure.pdf',
    'https://www.openstreetmap.org/way/261499924',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X toward57th Street/northeast',
    shortAxis: '+Z towardPark Avenue/southeast',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact-QID main outline261499924 retains the ground podium; independent tower463593207 is offset toward56th Street, with28.5m engineer shaft dimensions rather than an enlarged whole-site box. Mapped main entrance5995346749 lies native-X/southwest and agrees with the architect56th Street arrival. Y0 is entry ground, while actual street slope remains host-dependent.',
  }),
  limitations: [
    commonLimit,
    'Five drum-pair elevations, thin pour joints, hopper dimensions, core drum radius, terrace furnishings and porte-cochere details are reconstructed from primary elevation and facade photographs. The90 facade rows are not a claim of90 occupied floors. Separate Park Avenue retail cube, changing tenant signs, repairs/scaffolding and interior fit-out are excluded.',
  ],
  camera: { position: [355, 237, 320], lookAt: [-7, 213, 5], fov: 42 },
  qaCameras: [
    { name: 'white-concrete-basket', position: [48, 211, 47], lookAt: [-7, 206, 5] },
    { name: 'punched-window-reveals', position: [25, 242, 9], lookAt: [7, 240, 5] },
    { name: 'hopper-sash-detail', position: [14, 239, 2.4], lookAt: [6.6, 238.7, 2.4] },
    { name: 'open-upper-drum', position: [39, 365, 25], lookAt: [-7, 364, 5] },
    { name: 'through-wind-openings', position: [26, 230, 9], lookAt: [-7, 231, 5] },
    { name: 'cylindrical-core-close', position: [13, 231, 12], lookAt: [-1, 232, 5] },
    { name: 'closed-roof-parapet', position: [46, 451, 38], lookAt: [-7, 414, 5] },
    { name: 'offset-podium-terrace', position: [64, 53, 48], lookAt: [1, 25, 0] },
    { name: 'southwest-porte-cochere', position: [-54, 12, 33], lookAt: [-21, 4, 5] },
    { name: 'entry-revolving-doors', position: [-36, 5, 13], lookAt: [-22, 2, 5] },
    { name: 'north-retail-wing', position: [54, 14, -30], lookAt: [19, 13, 0] },
    { name: 'far-midtown-profile', position: [355, 118, 215], lookAt: [-7, 210, 5] },
  ],
};
