/** Original exterior of Córdoba's Calahorra, reconstructed from the municipal 1:750 sheet. */
import earcut from 'earcut';
import { beam, loft } from './authored-structure-mesh.mjs';
import { deform, facade, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const stone = [0.76, 0.65, 0.43],
  pale = [0.83, 0.74, 0.55],
  old = [0.55, 0.48, 0.32];
const scale = 0.052530115464,
  entry = 3.3,
  roof = 19.3,
  parapet = 19.95,
  top = 21.45;
const p = ([x, y]) => [(x - 456) * scale, (650 - y) * scale];
const srcLine = (a, b, name) => ({ a: p(a), b: p(b), name });
const srcArc = (center, r, a, b, name) => ({
  center: p(center),
  r: r * scale,
  a: (-a * Math.PI) / 180,
  b: (-b * Math.PI) / 180,
  name,
});
const sections = [
  srcLine([228, 650], [228, 461], 'west'),
  srcLine([228, 461], [292, 461], 'west-return'),
  srcArc([351, 436], 64, 157, 296, 'west-round'),
  srcLine([379, 375], [379, 324], 'rear-return-west'),
  srcLine([379, 324], [536, 324], 'rear-stair'),
  srcLine([536, 324], [536, 375], 'rear-return-east'),
  srcArc([562, 436], 66, -113, 17, 'east-round'),
  srcLine([625, 455], [685, 455], 'east-return'),
  srcLine([685, 455], [685, 612], 'east'),
  srcLine([685, 612], [528, 639], 'front-east'),
  srcLine([528, 639], [496, 654], 'front-step'),
  srcLine([496, 654], [228, 650], 'front-west'),
];
const sample = (s, t) =>
  s.center
    ? [
        s.center[0] + s.r * Math.cos(s.a + (s.b - s.a) * t),
        s.center[1] + s.r * Math.sin(s.a + (s.b - s.a) * t),
      ]
    : s.a.map((v, i) => v + (s.b[i] - v) * t);
const tangent = (s, t) => {
  if (!s.center) {
    const d = s.b.map((v, i) => v - s.a[i]),
      l = Math.hypot(...d);
    return d.map((v) => v / l);
  }
  const a = s.a + (s.b - s.a) * t,
    q = Math.sign(s.b - s.a);
  return [-Math.sin(a) * q, Math.cos(a) * q];
};
for (let i = 0; i < sections.length; i++) {
  const s = sections[i],
    before = sections[(i + sections.length - 1) % sections.length],
    after = sections[(i + 1) % sections.length];
  if (!s.center) {
    if (before.center) s.a = sample(before, 1);
    if (after.center) s.b = sample(after, 0);
  }
}
const length = (s) =>
  s.center ? s.r * Math.abs(s.b - s.a) : Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
function part(out, s) {
  const l = length(s),
    core = deform(out, ([x, y, z]) => {
      const t = (x + l / 2) / l,
        a = sample(s, t),
        d = tangent(s, t);
      return [a[0] - d[1] * z, y, a[1] + d[0] * z];
    });
  if (!s.center) return core;
  return {
    ...core,
    addQuad(slot, _ref, ps, _normal, _uv, color) {
      const nu = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(ps[1][0] - ps[0][0]), Math.abs(ps[2][0] - ps[3][0])) / 0.15),
      );
      const nv = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(ps[3][0] - ps[0][0]), Math.abs(ps[2][0] - ps[1][0])) / 0.15),
      );
      const q = (u, v) =>
        ps[0].map(
          (_, k) =>
            (1 - v) * ((1 - u) * ps[0][k] + u * ps[1][k]) + v * ((1 - u) * ps[3][k] + u * ps[2][k]),
        );
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++)
          face(
            core,
            slot,
            [
              q(i / nu, j / nv),
              q((i + 1) / nu, j / nv),
              q((i + 1) / nu, (j + 1) / nv),
              q(i / nu, (j + 1) / nv),
            ],
            color,
          );
    },
  };
}
function outline() {
  const a = [];
  for (const s of sections) {
    const n = s.center ? 48 : 1;
    for (let i = 0; i < n; i++) a.push(sample(s, i / n));
  }
  return a;
}
function polygon(out, ring, y, slot, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const ps = indices.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]);
    const ux = ps[1][0] - ps[0][0],
      uz = ps[1][2] - ps[0][2],
      vx = ps[2][0] - ps[0][0],
      vz = ps[2][2] - ps[0][2];
    if (uz * vx - ux * vz < 0) ps.reverse();
    triangle(out, slot, ps, color);
  }
}
function merlon(out, x, y, z, w = 0.84, d = 0.67) {
  box(out, 'limestone', [x - w / 2, y, z - d / 2], [x + w / 2, y + 0.85, z + d / 2], pale);
  const ring = (h, ww, dd) => [
    [x - ww / 2, h, z - dd / 2],
    [x - ww / 2, h, z + dd / 2],
    [x + ww / 2, h, z + dd / 2],
    [x + ww / 2, h, z - dd / 2],
  ];
  loft(
    out,
    'limestone',
    [
      ring(y + 0.83, w + 0.09, d + 0.09),
      ring(y + 0.96, w + 0.09, d + 0.09),
      ring(y + 1.5, 0.035, 0.035),
    ],
    pale,
  );
}
function openings(name, l) {
  const holes = [];
  const rect = (x, y, w, h) => ({
    x,
    y,
    w,
    spring: y + h,
    rise: 0,
    top: y + h,
    depth: 0.4,
    trim: 0,
  });
  if (name === 'front-west') {
    holes.push({
      x: -l / 2 + 2.08,
      y: entry,
      w: 1.2,
      spring: entry + 2.2,
      rise: 0.58,
      top: entry + 2.78,
      depth: 0.62,
      trim: 0.05,
    });
    holes.push(rect(-l / 2 + 2.13, entry + 5.75, 0.68, 1.48));
    for (const x of [-l / 2 + 1.45, -l / 2 + 2.72])
      holes.push({
        x,
        y: entry + 11.3,
        w: 0.72,
        spring: entry + 12.45,
        rise: 0.36,
        top: entry + 12.81,
        depth: 0.55,
        trim: 0,
      });
    holes.push(
      rect(l / 2 - 2.7, entry + 11.9, 0.32, 0.4),
      rect(l / 2 - 2.1, entry + 6.2, 0.25, 0.52),
    );
  } else if (name === 'rear-stair') {
    holes.push(
      rect(-1.45, 7.2, 0.48, 0.7),
      rect(1.4, 8.35, 0.5, 0.77),
      rect(-1.4, 12.45, 0.54, 0.7),
      rect(1.43, 13.55, 0.57, 0.78),
    );
  } else if (name === 'west' || name === 'east') {
    for (const [y, x, w, h] of [
      [6.0, -0.3, 0.52, 0.68],
      [11.3, 0.3, 0.56, 0.67],
      [16.0, 0.1, 0.42, 0.55],
    ])
      holes.push(rect(x, y, w, h));
    if (name === 'east') holes.push(rect(2.0, 7.7, 0.15, 0.68));
  } else if (name.includes('round')) {
    holes.push(
      rect(0, 6.5, 0.51, 0.81),
      rect(name === 'west-round' ? -0.2 : 0.15, 13.1, 0.57, 0.78),
    );
  }
  // The small square sockets below the crown are genuine recesses.
  for (let x = -l / 2 + 0.72; x < l / 2 - 0.4; x += 1.75) holes.push(rect(x, 18.67, 0.23, 0.22));
  return holes;
}
function ashlarPatches(out, s, holes) {
  const f = part(out, s),
    l = length(s);
  for (let row = 0; row < 35; row++)
    for (let col = 0; col < Math.floor(l / 0.66); col++) {
      if ((row * 23 + col * 11 + s.name.length) % 19 > 2) continue;
      const x = -l / 2 + 0.29 + col * 0.66 + (row % 2) * 0.17,
        y = 0.23 + row * 0.53,
        w = 0.43,
        h = 0.29;
      if (
        x + w / 2 > l / 2 ||
        holes.some(
          (a) => x + w / 2 > a.x - a.w / 2 && x - w / 2 < a.x + a.w / 2 && y + h > a.y && y < a.top,
        )
      )
        continue;
      face(
        f,
        'limestone',
        [
          [x - w / 2, y, 0.008],
          [x + w / 2, y, 0.008],
          [x + w / 2, y + h, 0.008],
          [x - w / 2, y + h, 0.008],
        ],
        [row % 3 ? 0.7 : 0.83, row % 3 ? 0.59 : 0.71, row % 3 ? 0.38 : 0.5],
      );
    }
}
function mainCastle(out) {
  const ring = outline();
  polygon(out, ring, roof, 'limestone', [0.63, 0.56, 0.4]);
  for (const s of sections) {
    const f = part(out, s),
      l = length(s),
      holes = openings(s.name, l);
    facade(f, 'limestone', l, 0, parapet, 0, holes, stone);
    ashlarPatches(out, s, holes);
    // The inner parapet is explicitly closed, including at both curved elbows.
    face(
      f,
      'limestone',
      [
        [-l / 2, roof, -0.65],
        [-l / 2, parapet, -0.65],
        [l / 2, parapet, -0.65],
        [l / 2, roof, -0.65],
      ],
      pale,
    );
    face(
      f,
      'limestone',
      [
        [-l / 2, parapet, 0],
        [l / 2, parapet, 0],
        [l / 2, parapet, -0.65],
        [-l / 2, parapet, -0.65],
      ],
      pale,
    );
    const count = Math.max(1, Math.round(l / 1.68));
    for (let i = 0; i < count; i++)
      merlon(
        f,
        -l / 2 + ((i + 0.5) * l) / count,
        parapet,
        -0.33,
        Math.min(0.85, (l / count) * 0.62),
        0.7,
      );
    // Upper horizontal water table on straight side towers; not across the stair tower.
    if (['west', 'east', 'front-west', 'front-east'].includes(s.name))
      box(f, 'limestone', [-l / 2, 14.95, -0.02], [l / 2, 15.15, 0.095], pale);
  }
  // The north doorway retains the outline of the much larger blocked horseshoe portal.
  const f = part(out, sections.at(-1)),
    l = length(sections.at(-1)),
    cx = -l / 2 + 2.08;
  for (let i = 0; i < 52; i++) {
    const a = ((-30 + (i * 240) / 52) * Math.PI) / 180,
      b = ((-30 + ((i + 1) * 240) / 52) * Math.PI) / 180;
    const rr = 2.7,
      A = [cx + rr * Math.cos(a), entry + 5.2 + rr * Math.sin(a), 0.034],
      B = [cx + rr * Math.cos(b), entry + 5.2 + rr * Math.sin(b), 0.034];
    beam(f, 'limestone', A, B, 0.14, 0.055, old);
  }
  // Restored medieval masonry boundary around the narrow front access strip.
  for (const x of [cx - 2.8, cx + 2.8])
    for (let i = 0; i < 19; i++) {
      const y = entry + 0.28 + i * 0.58;
      box(f, 'limestone', [x - 0.06, y, 0.012], [x + 0.06, y + 0.34, 0.05], [0.54, 0.46, 0.3]);
    }
  for (const x of [cx - 0.56, cx + 0.56])
    box(f, 'wood', [x - 0.025, entry, 0.09], [x + 0.025, entry + 2.14, 0.12], [0.24, 0.2, 0.13]);
  // East facade heraldic panel; original low relief geometry, not a photographed bitmap.
  const e = part(out, sections[8]);
  box(e, 'limestone', [-0.48, 15.53, 0.03], [0.48, 16.67, 0.13], pale);
  for (const x of [-0.26, 0.15]) {
    box(e, 'carvedstone', [x, 15.82, 0.15], [x + 0.12, 16.11, 0.2], stone);
    for (const xx of [x - 0.015, x + 0.085])
      box(e, 'carvedstone', [xx, 16.11, 0.14], [xx + 0.055, 16.28, 0.21], stone);
  }
  // Roof access hatch and spiral stair guard shown in the municipal roof plan.
  const hatch = p([548, 481]);
  box(
    out,
    'metal',
    [hatch[0] - 0.66, roof + 0.02, hatch[1] - 0.83],
    [hatch[0] + 0.66, roof + 0.11, hatch[1] + 0.83],
    [0.36, 0.31, 0.22],
  );
  for (const dx of [-0.65, 0.65])
    for (const dz of [-0.8, 0.8])
      beam(
        out,
        'metal',
        [hatch[0] + dx, roof + 0.1, hatch[1] + dz],
        [hatch[0] + dx, roof + 1.04, hatch[1] + dz],
        0.035,
        0.035,
        [0.28, 0.26, 0.2],
      );
  for (const dx of [-0.65, 0.65])
    beam(
      out,
      'metal',
      [hatch[0] + dx, roof + 1.04, hatch[1] - 0.8],
      [hatch[0] + dx, roof + 1.04, hatch[1] + 0.8],
      0.04,
      0.04,
      [0.28, 0.26, 0.2],
    );
  const cap = p([600, 443]);
  box(
    out,
    'limestone',
    [cap[0] - 0.5, roof, cap[1] - 0.52],
    [cap[0] + 0.5, roof + 0.48, cap[1] + 0.52],
    pale,
  );
  for (let i = 0; i < 9; i++) {
    const y = roof + 0.03 + i * 0.04,
      z = cap[1] - 0.7 + i * 0.15;
    box(out, 'limestone', [cap[0] - 0.67, y - 0.02, z], [cap[0] + 0.67, y, z + 0.15], pale);
  }
}
function lowWalls(out) {
  // The lower enceinte follows the mapped barbican and municipal plan, leaving an open courtyard.
  const boundary = [
    srcLine([228, 501], [120, 405], 'west-low'),
    srcLine([120, 405], [244, 215], 'west-diagonal'),
    srcArc([294, 167], 69, 136, 365, 'southwest-cubete'),
    srcLine([363, 173], [529, 173], 'south-low'),
    srcArc([598, 167], 69, 175, 413, 'southeast-cubete'),
    srcLine([641, 223], [774, 355], 'east-diagonal'),
    srcLine([774, 355], [774, 586], 'east-low'),
    srcLine([774, 586], [685, 612], 'north-return'),
  ];
  for (let i = 0; i < boundary.length; i++) {
    const s = boundary[i],
      before = boundary[i - 1],
      after = boundary[i + 1];
    if (!s.center) {
      if (before?.center) s.a = sample(before, 1);
      if (after?.center) s.b = sample(after, 0);
    }
  }
  for (const s of boundary) {
    const f = part(out, s),
      l = length(s);
    const holes = [];
    if (s.name.includes('cubete'))
      holes.push({ x: 0, y: 1.5, w: 0.27, spring: 2.13, rise: 0, top: 2.13, depth: 0.5, trim: 0 });
    facade(f, 'limestone', l, 0, 3.05, 0, holes, stone);
    face(
      f,
      'limestone',
      [
        [-l / 2, 0, -0.75],
        [-l / 2, 3.05, -0.75],
        [l / 2, 3.05, -0.75],
        [l / 2, 0, -0.75],
      ],
      stone,
    );
    face(
      f,
      'limestone',
      [
        [-l / 2, 3.05, 0],
        [l / 2, 3.05, 0],
        [l / 2, 3.05, -0.75],
        [-l / 2, 3.05, -0.75],
      ],
      pale,
    );
    const count = Math.max(1, Math.round(l / 1.5));
    for (let i = 0; i < count; i++)
      merlon(f, -l / 2 + ((i + 0.5) * l) / count, 3.05, -0.36, 0.85, 0.75);
    if (s.center) {
      const ring = [];
      for (let i = 0; i < 64; i++) {
        const a = (-i / 64) * Math.PI * 2;
        ring.push([
          s.center[0] + (s.r - 0.76) * Math.cos(a),
          s.center[1] + (s.r - 0.76) * Math.sin(a),
        ]);
      }
      polygon(out, ring, 1.07, 'limestone', [0.58, 0.52, 0.39]);
    }
  }
  // Courtyard floor is an independent ring with the castle removed; no invented solid infill.
  const court = [];
  for (const s of boundary) {
    const n = s.center ? 32 : 1;
    for (let i = 0; i < n; i++) court.push(sample(s, i / n));
  }
  court.push(
    ...[
      p([685, 455]),
      p([625, 455]),
      p([536, 375]),
      p([536, 324]),
      p([379, 324]),
      p([379, 375]),
      p([292, 461]),
    ],
  );
  polygon(out, court, 0.025, 'limestone', [0.58, 0.53, 0.4]);
  // Northeast access flight at the bridge side and smaller courtyard steps.
  const stair = transform(out, Math.PI / 2, [...p([733, 568]).slice(0, 1), 0, p([733, 568])[1]]);
  for (let i = 0; i < 17; i++) {
    const z = -1.48 + i * 0.19,
      y = 0.035 + ((i + 1) * entry) / 17;
    box(stair, 'limestone', [-1.02, 0, z], [1.02, y, z + 0.205], pale);
  }
  for (const side of [-1, 1])
    beam(
      stair,
      'metal',
      [side * 1.03, 1.1, -1.45],
      [side * 1.03, entry + 1.1, 1.73],
      0.045,
      0.045,
      [0.26, 0.25, 0.2],
    );
  // Courtyard drain channels and the small barred historical basement doorway.
  const drain = [p([315, 223]), p([696, 402])];
  beam(
    out,
    'darkstone',
    [drain[0][0], 0.033, drain[0][1]],
    [drain[1][0], 0.033, drain[1][1]],
    0.1,
    0.025,
    [0.32, 0.31, 0.25],
  );
}
function buildCalahorra(out) {
  mainCastle(out);
  lowWalls(out);
}

export const calahorraTower = {
  id: 'n0603_torre_de_la_calahorra',
  planId: 'N0603',
  title: 'Torre de la Calahorra',
  wikidata: 'Q97625199',
  authoringFile: 'calahorra-tower-model.mjs',
  build: buildCalahorra,
  brief:
    'The complete Córdoba fortified gate and lower barbican: asymmetric three-arm castle, two rounded connecting walls, restored horseshoe portal trace, sparse gun loops, pointed merlons, roof terrace and two round lower bastions.',
  size: [38, top, 32],
  front:
    'Native -Z faces the Roman Bridge and the restored entry; +Z extends into the southern courtyard',
  origin:
    'Mapped museum entrance in XZ; Y=0 is the reconstructed lower courtyard floor, with the entrance at Y=3.3 m',
  refs: [
    'https://www.arquitecturacontemporanea.org/plataformaplan/download/6.pdf',
    'https://static.arteinformado.com/resources/app/docs/evento/23/127123/1_cat__logo_juan_cuenca_del_plano_al_espacio__baja_resoluci__n_.pdf',
    'https://www.torrecalahorra.es/',
    'https://institutoandaluzdeloscastillos.es/torre-de-la-calahorra',
    'https://www.gmucordoba.es/component/content/article?id=1595',
    'https://www.openstreetmap.org/way/94126687',
    'https://www.openstreetmap.org/node/5523459708',
  ],
  facts: {
    publishedPlanScale: '1:750',
    publishedRoofTerraceAreaSquareMeters: 288.56,
    mainFloorCount: 3,
    lowerRoundBastionCount: 2,
    relativeEntranceAboveLowerCourtyardMeters: entry,
    reconstructedTerraceMeters: roof,
    reconstructedMerlonTipMeters: top,
    planRegistrationResidualMeters: 1.5,
    restorationCompletionYear: 2008,
    bridgeRelationship: {
      candidateId: 'N0009',
      bridgeSouthDeckSeaLevelMeters: 97.15,
      courtyardOriginSeaLevelMeters: 93.85,
      entranceLocalY: 3.3,
      status: 'shared-provisional-reconstruction',
      notes:
        'Entrance height matches the provisional bridge south deck. The nearby IGN gate-column benchmark is not asserted to be a deck or entrance measurement.',
    },
  },
  scaleBasis:
    'Original geometry follows the municipal floor/roof plans and three sections, with primary restoration photographs establishing the surviving front portal, irregular openings, stone phases and pointed battlements. A similarity fit to the exact mapped entrance and two lower bastion centers supplies 0.05253 m per inspection-raster unit and heading 0.856639 radians; the approximate map/plan discrepancy is up to 1.5 m. Vertical dimensions are proportional readings of the municipal section, with a separate raised entry and lower courtyard datum, not a claimed surveyed absolute elevation.',
  geographicProposal: {
    status: 'preview-proposal',
    elevationMode: 'sea-level',
    elevationMeters: 93.85,
    anchor: [-4.7767058, 37.8757097],
    heading: 0.856639159084,
    source: 'https://www.openstreetmap.org/node/5523459708',
    evidence:
      'Exact mapped entrance fixes the model origin. Municipal plans and the primary restoration architect show that the broad exact-QID map ring includes the low barbican; the tall building follows the smaller asymmetric plan, with its entrance toward the Roman Bridge. The signed frame is fitted to entrance and paired southern bastions.',
    orientationConfidence: 'primary-plan-and-exact-mapped-entrance',
    limitations:
      'Horizontal map/plan fit is approximate, within about 1.5 m at the lower bastions. Entrance Y=3.3 m is above the model courtyard datum. The provisional shared datum places the courtyard origin at 93.85 m and the entrance at 97.15 m, matching N0009 Roman Bridge south deck. This is a coherent reconstructed connection, not a surveyed height; adjust both assets together when a reliable common datum is available.',
  },
  limits: [
    'The monumental castle and complete low barbican are included. The Roman Bridge, outer moat terrain and surrounding urban paving are separate assets.',
    'Small ashlar repair edges, individual shot holes and roof services are original photographic reconstructions. The coats of arms use simplified geometric relief; no photograph or third-party mesh is embedded.',
    'Municipal section readings provide relative elevations. Current absolute entrance elevation and the surrounding lower courtyard/bridge ground fit remain separate geographic review requirements.',
  ],
  cameras: [
    { name: 'bridge-front-portal', position: [10, 14, -35], lookAt: [0, 12, 3] },
    { name: 'southern-stair-and-round-walls', position: [-27, 13, 47], lookAt: [0, 12, 15] },
    { name: 'barbican-bastions', position: [27, 8, 41], lookAt: [0, 6, 17] },
    { name: 'roof-and-courtyard', position: [-30, 37, 30], lookAt: [0, 8, 13] },
    { name: 'far-silhouette', position: [45, 32, -55], lookAt: [0, 10, 10] },
  ],
};
