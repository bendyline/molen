/** Original, source-reproducible Two Prudential Plaza reconstruction. All lengths are meters. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(
  structureSourcePath('n0228_two_prudential_plaza', 'map-frame.json'),
);
const frame = JSON.parse(frameBytes);
const X = 28.0845,
  Z = 20.4255,
  W = Z / 7;
const floorH = 3.875,
  baseY = 9.75,
  occupied = 250;
const tip = 303.3,
  spire = 24.384,
  apex = tip - spire;
const roofSlope = 1.4;
const roofHeight = (x, z) => apex - roofSlope * (Math.abs(x) + Math.abs(z));
const granite = [0.7, 0.68, 0.65],
  darkStone = [0.31, 0.32, 0.32];
const blue = [0.2, 0.36, 0.46],
  black = [0.075, 0.095, 0.105];
const silver = [0.61, 0.65, 0.67],
  metal = [0.25, 0.28, 0.29];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);

function transformed(out, translation, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const vector = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  const point = (p) => vector(p).map((v, i) => v + translation[i]);
  return {
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

/** Clip authoring polygons while retaining outward normals and metric material coordinates. */
function clipped(out, planes) {
  function polygon(slot, ref, points, normal, _uv, color) {
    for (const [nx, ny, nz, d] of planes) {
      const input = points;
      points = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i],
          b = input[(i + 1) % input.length];
        const da = nx * a[0] + ny * a[1] + nz * a[2] - d,
          db = nx * b[0] + ny * b[1] + nz * b[2] - d;
        if (da <= 0) points.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0))
          points.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
      }
      if (points.length < 3) return;
    }
    for (let i = 1; i + 1 < points.length; i++) {
      const p = [points[0], points[i], points[i + 1]],
        a = p[1].map((v, k) => v - p[0][k]),
        b = p[2].map((v, k) => v - p[0][k]);
      const area = Math.hypot(
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      );
      if (area < 0.000001) continue;
      out.addTriangle(
        slot,
        ref,
        p,
        normal,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  }
  return { addQuad: polygon, addTriangle: polygon, addConvexPolygon: polygon };
}
const pyramidPlanes = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
].map(([x, z]) => [x * roofSlope, 1, z * roofSlope, apex]);
const crownPlanes = [
  [1, 0, 0, 18.8],
  [-1, 0, 0, 18.8],
  [0, 0, 1, Z],
  [0, 0, -1, Z],
];

/**
 * A granite panel face. The 2 cm arrises, 2.4 cm joints and 13 cm returns of the real panels are
 * below the closeup's error on a 300 m tower, so a panel is its face.
 */
function stone(o, x0, x1, y0, y1, depth = 0, color = granite) {
  face(
    o,
    'cladding',
    [
      [x0, y0, depth],
      [x1, y0, depth],
      [x1, y1, depth],
      [x0, y1, depth],
    ],
    color,
  );
}

/** Opaque PBR glazing (clear at the lobby); its 2.5 cm frames are sub-pixel at every level. */
function glass(o, x0, x1, y0, y1, clear = false) {
  const d = -0.13;
  face(
    o,
    clear ? 'clear_glass' : 'glass',
    [
      [x0, y0, d],
      [x1, y0, d],
      [x1, y1, d],
      [x0, y1, d],
    ],
    blue,
  );
}

const strip = (o, slot, x0, x1, y0, y1, z, color) =>
  face(
    o,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );

function bay(o, w, h, kind) {
  if (kind === 'glazed' || kind === 'lobby') {
    glass(o, 0, w, 0, h, kind === 'lobby');
    strip(o, 'stainless', 0, 0.045, 0, h, -0.08, silver);
    strip(o, 'stainless', w - 0.045, w, 0, h, -0.08, silver);
    strip(o, 'metal', 0, w, h - 0.1, h, -0.06, metal);
    return;
  }
  // Granite piers either side of a recessed window with granite sill and head panels; the
  // dark recess behind reads as the real joints' shadow from the street.
  const p = Math.min(0.4, w * 0.18),
    sill = 0.78,
    head = h - 0.47;
  strip(o, 'recess', 0, w, 0, h, -0.15, black);
  stone(o, 0, p, 0, h);
  stone(o, w - p, w, 0, h);
  stone(o, p, w - p, 0, sill, -0.025, [0.57, 0.57, 0.56]);
  stone(o, p, w - p, head, h, -0.025, [0.57, 0.57, 0.56]);
  glass(o, p, w - p, sill, head);
}

// Each recess removes a strip of the north/south ends. Heights are explicitly photographic
// working values; a single map rectangle cannot establish them. The first terrace reaches the
// four corners around the owner's level-28/30 plans. The three central chevrons remain visible.
function endDepth(row, j) {
  const distance = Math.abs(j + 0.5 - 7),
    band = Math.floor(distance);
  const thresholds = [24 + 2 * (6 - band), 40 + 2 * (6 - band)];
  if (row < thresholds[0]) return X;
  if (row < thresholds[1]) return 23.15;
  return 18.8;
}

function planAt(row) {
  const plus = [];
  for (let j = 0; j < 14; j++) {
    const x = endDepth(row, j),
      z = -Z + j * W;
    plus.push([x, z], [x, z + W]);
  }
  // Clockwise X/Z boundary: west edge of each end bay faces outward without reflected meshes.
  const raw = [...plus, ...plus.toReversed().map(([x, z]) => [-x, z])].reverse();
  return raw.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]) > 0.001,
  );
}

function floorPlate(o, plan, y, slot = 'concrete') {
  // This orthogonal profile is star-shaped around the origin, including all its end recesses.
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    o.addTriangle(
      slot,
      'palette:#ffffff',
      [
        [0, y, 0],
        [a[0], y, a[1]],
        [b[0], y, b[1]],
      ],
      [0, 1, 0],
      [[0, 0], a, b],
      [0.43, 0.44, 0.43],
    );
  }
}

const units = new Map();
const clippedBays = [];
function placeBay(a, b, y, h, kind) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.002) return;
  const n = Math.max(1, Math.round(len / W)),
    w = len / n;
  const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const key = `${kind}-${w.toFixed(6)}-${h.toFixed(6)}`;
  if (!units.has(key))
    units.set(key, {
      name: key,
      build: (o) => bay(o, w, h, kind),
      instances: [],
      gpuInstances: true,
    });
  for (let j = 0; j < n; j++) {
    const instance = {
      translation: [a[0] + ((b[0] - a[0]) * j) / n, y, a[1] + ((b[1] - a[1]) * j) / n],
      angle,
    };
    const start = instance.translation;
    const end = [a[0] + ((b[0] - a[0]) * (j + 1)) / n, y, a[1] + ((b[1] - a[1]) * (j + 1)) / n];
    const ceiling = Math.min(roofHeight(start[0], start[2]), roofHeight(end[0], end[2]));
    if (y + h <= ceiling - 0.25) units.get(key).instances.push(instance);
    else if (y <= Math.max(roofHeight(start[0], start[2]), roofHeight(end[0], end[2])) + 0.25)
      clippedBays.push({ build: units.get(key).build, instance });
  }
}

function registerFacades() {
  for (let row = 0; row < 63; row++) {
    const p = planAt(row);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      const end = Math.abs(a[0] - b[0]) < 0.001;
      const midZ = (a[1] + b[1]) / 2;
      const kind =
        end && Math.abs(midZ) < W * 2
          ? 'glazed'
          : !end && Math.abs(a[1]) < Z - 0.01
            ? 'glazed'
            : 'stone';
      placeBay(a, b, baseY + row * floorH, floorH, kind);
    }
  }
  const p = planAt(0);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    placeBay(a, b, 0.28, 4.5, 'lobby');
    placeBay(a, b, 4.78, 4.6, 'lobby');
  }
}
registerFacades();

function structural(out) {
  const o = clipped(out, pyramidPlanes);
  const p = planAt(0);
  floorPlate(o, p, 0);
  floorPlate(o, p, 0.28);
  floorPlate(o, p, 9.4);
  // Lift core and lobby ceiling give transparent entrance glass an actual interior boundary.
  box(o, 'stone', [-8, 0.28, -6], [8, 9.4, 6], darkStone);
  for (let row = 0; row <= 63; row++)
    floorPlate(o, planAt(Math.min(row, 62)), baseY + row * floorH - 0.15);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.01) continue;
    const side = transformed(o, [a[0], 0, a[1]], -Math.atan2(b[1] - a[1], b[0] - a[0]));
    box(side, 'stone', [0, 0, -0.2], [len, 0.28, 0.15], darkStone);
    box(side, 'cladding', [0, 9.38, -0.22], [len, baseY, 0.08], granite);
    const count = Math.max(1, Math.round(len / (2 * W)));
    for (let j = 0; j <= count; j++) {
      const x = Math.max(0.18, Math.min(len - 0.18, (j * len) / count));
      for (let k = 0; k < 5; k++)
        stone(side, x - 0.17, x + 0.17, 0.3 + k * 1.8, 2.08 + k * 1.8, 0.045);
    }
  }
  // Metal-capped, jointed narrow terraces on each setback, without invented rooftop furniture.
  for (let row = 1; row < 63; row++)
    for (let j = 0; j < 14; j++) {
      const before = endDepth(row - 1, j),
        after = endDepth(row, j);
      if (before === after) continue;
      const y = baseY + row * floorH,
        z = -Z + j * W;
      for (const sign of [-1, 1]) {
        const a = Math.min(sign * before, sign * after),
          b = Math.max(sign * before, sign * after);
        box(o, 'stone', [a, y - 0.16, z], [b, y - 0.02, z + W], darkStone);
        const x = sign * before;
        box(o, 'stainless', [x - 0.1, y - 0.01, z], [x + 0.1, y + 0.2, z + W], silver);
      }
    }
  // East entry doors (native -Z); provisional signed location within the mapped tower envelope.
  const side = transformed(o, [-2.6, 0, -Z - 0.035], Math.PI);
  for (let j = 0; j < 4; j++) {
    const x = j * 1.3;
    glass(side, x, x + 1.3, 0.3, 3.1, true);
    for (const xx of [x, x + 1.25])
      box(side, 'stainless', [xx, 0.3, -0.14], [xx + 0.05, 3.1, -0.04], silver);
    box(side, 'stainless', [x, 3.05, -0.14], [x + 1.3, 3.12, -0.04], silver);
    tube(side, 'stainless', [x + 1.1, 1.0, 0.025], [x + 1.1, 1.9, 0.025], 0.018, silver, 12);
    for (const yy of [1.05, 1.85])
      tube(side, 'stainless', [x + 1.1, yy, -0.08], [x + 1.1, yy, 0.025], 0.015, silver, 10);
  }
}

function crown(o) {
  const y0 = 221,
    tiers = 15;
  const ring = (r, y) => [
    [0, y, -r],
    [-r, y, 0],
    [0, y, r],
    [r, y, 0],
  ];
  const roof = clipped(o, crownPlanes);
  for (let row = 0; row < tiers; row++) {
    const y = y0 + ((apex - y0) * row) / tiers;
    const yn = y0 + ((apex - y0) * (row + 1)) / tiers;
    const r = (apex - y) / roofSlope,
      rn = Math.max(0.025, (apex - yn) / roofSlope);
    const p = ring(r, y),
      q = ring(rn, yn);
    for (let i = 0; i < 4; i++) {
      const a = p[i],
        b = p[(i + 1) % 4],
        c = q[(i + 1) % 4],
        d = q[i];
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.15));
      const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
      for (let j = 0; j < n; j++) {
        const aa = mix(a, b, j / n),
          bb = mix(a, b, (j + 1) / n),
          cc = mix(d, c, (j + 1) / n),
          dd = mix(d, c, j / n);
        face(roof, 'glass', [aa, bb, cc, dd], blue);
      }
      const capA = a.map((v, k) => v + (k === 1 ? 0.11 : 0)),
        capB = b.map((v, k) => v + (k === 1 ? 0.11 : 0));
      beam(roof, 'stainless', capA, capB, 0.7, 0.32, silver);
      beam(roof, 'stainless', a, d, 0.15, 0.18, silver);
    }
  }
  // Tapered four-sided 80-foot spire, segmented cladding seams, collar and final needle.
  for (let row = 0; row < 16; row++) {
    const y = apex + (spire * row) / 16,
      yn = apex + (spire * (row + 1)) / 16;
    const r = 0.79 * (1 - row / 16) + 0.017,
      rn = 0.79 * (1 - (row + 1) / 16) + 0.017;
    const p = ring(r, y),
      q = ring(rn, yn);
    for (let j = 0; j < 4; j++)
      face(o, 'stainless', [p[j], p[(j + 1) % 4], q[(j + 1) % 4], q[j]], silver);
  }
  tube(o, 'stainless', [0, apex - 0.15, 0], [0, apex + 0.2, 0], 0.9, silver, 32);
}

const parts = [
  { name: 'floor-plates-lobby-and-setback-caps', build: structural, instances: [{}] },
  { name: 'diamond-crown-and-spire', build: crown, instances: [{}] },
  {
    name: 'facade-roof-intersections',
    build(o) {
      for (const { build, instance } of clippedBays)
        build(transformed(clipped(o, pyramidPlanes), instance.translation, instance.angle));
    },
    instances: [{}],
  },
  ...[...units.values()].filter((p) => p.instances.length),
];

export const twoPrudentialPlazaStudy = {
  id: 'N0228',
  key: 'two_prudential_plaza',
  title: 'Two Prudential Plaza',
  wikidataId: 'Q1121971',
  mapFrame: 'map-frame.json',
  build(out) {
    for (const p of parts)
      for (const i of p.instances)
        p.build(transformed(out, i.translation ?? [0, 0, 0], i.angle ?? 0));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((p) => ({ ...p, glb: encode(p.build, p.name) })),
      'Molen original Two Prudential Plaza reusable facade assembly',
    );
  },
  brief:
    'Individually jointed pale granite facade, recessed blue windows, glazed end strips, three series of north/south chevron setbacks, diamond crown, 80-foot spire and transparent double-height lobby. Repeated facade modules are GPU instances with shared canonical materials.',
  sourceFacts: {
    architecturalHeightMeters: tip,
    highestOccupiedMeters: occupied,
    aboveGroundFloors: 64,
    completionYear: 1990,
    contractorSpireLengthFeet: 80,
  },
  reconstruction: {
    groundEnvelopeMeters: [2 * X, 2 * Z],
    officeBaseMeters: baseY,
    workingFloorIntervalMeters: floorH,
    officeFacadeRows: 63,
    crownLowestShoulderMeters: roofHeight(18.8, Z),
    reconstructedRoofSlope: roofSlope,
    spireBaseMeters: apex,
    planBasis:
      'Cached exact-QID ground envelope supplies scale and long-axis registration. The owner floor-28/30 plans establish north/south projections and re-entrant corners. A fourteen-bay end grid and stepped upper profiles are photographic reconstructions, not dimensioned floor polygons.',
    materialBasis:
      'Canonical granite, stainless steel, painted metal and concrete graphs, plus reusable blue and clear PBR glazing. Every masonry joint, reveal, sill, frame, crown rib and door handle is geometry; no photographic textures or per-model image copies.',
    assembly: {
      uniqueParts: parts.length,
      instances: parts.reduce((n, p) => n + p.instances.length, 0),
    },
  },
  refs: [
    'https://www.theprulife.com/wp-content/uploads/2021/06/OTP_Large-Block-Plans_All-28-30.pdf',
    'https://www.theprulife.com/wp-content/uploads/2024/04/Pru_FilmingScoutBrochure_April2024.pdf',
    'https://www.skyscrapercenter.com/chicago/two-prudential-plaza/489',
    'https://mchughconcrete.com/projects/two-prudential-plaza/',
    'https://www.linkedin.com/posts/turner-construction-company_builtbyturner-turnerchicago-onetwopru-activity-7333884834496356371-FkpT',
    'https://commons.wikimedia.org/wiki/File:Two_Prudential_Plaza_Chicago_in_May_2016.jpg',
    'https://commons.wikimedia.org/wiki/File:Two_Prudential_Plaza_-_Exterior_1_(7883111728).jpg',
    'https://www.openstreetmap.org/way/64388666',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X south along the long mapped axis',
    front: '-Z east toward Stetson',
    origin: 'Cached tower envelope center at provisional local pavement contact',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    mapGeometryHash: hashEvidenceText(frameBytes),
    notes:
      'Exact-QID footprint and owner north arrow establish the long axis. Cached yaw maps +X roughly south and -Z roughly east; signed entrance and actual shared-site elevation still require review.',
  }),
  appearance: {
    period: 'Original exterior with 2012/2016 photography and owner 2021 plans',
    excluded: 'Unbuilt marketing proposals and neighboring One Prudential tower.',
  },
  sourceDocuments: ['reference-metadata.json'],
  limitations: [
    'Maximum exterior fidelity remains pending. Chevron heights, bay count, floor allocation, crown-to-shoulder transition and granite joint sections are photographic working reconstructions; source plans have no printed scale.',
    'The crown now intersects the facade along four gables; roof slope, exact stepped profile and glazing-band heights require dimensioned upper-floor plans before completion approval.',
    'The shared One/Two Prudential plaza, sculpture, planting, stairs, lobby connection and wider podium are outside the cached tower footprint and remain to be registered and authored.',
    'Owner lobby photographs establish a tall glazed entrance, but signed door positions, exact pier spacing and ground levels remain provisional. Geographic and terrain-contact approval are pending.',
    'The contractor website has conflicting storey counts. The registry count of 64 and 250 m highest occupied datum are recorded separately from the reconstructed facade grid.',
  ],
  camera: { position: [-230, 195, 315], lookAt: [0, 150, 0], fov: 36 },
  qaCameras: [
    { name: 'granite-window-reveals', position: [33, 74, 14], lookAt: [X, 74, 14] },
    { name: 'panel-joints', position: [30, 75.4, 15.5], lookAt: [X, 75.4, 15.5] },
    { name: 'central-glazing', position: [39, 86, 0], lookAt: [X, 85, 0] },
    { name: 'first-chevron', position: [52, 148, 46], lookAt: [24, 131, 8] },
    { name: 'second-chevron', position: [49, 209, -46], lookAt: [21, 188, -7] },
    { name: 'upper-shoulders', position: [57, 268, 56], lookAt: [0, 245, 0] },
    { name: 'crown-bands', position: [32, 277, 37], lookAt: [0, 267, 0] },
    { name: 'spire-collar', position: [8, 286, 8], lookAt: [0, 279.5, 0] },
    { name: 'entrance-hardware', position: [-5.2, 2.6, -25], lookAt: [-5.2, 1.6, -Z] },
    { name: 'lobby', position: [-12, 5, -36], lookAt: [0, 4, -Z] },
    { name: 'plan', position: [0, 354, 1], lookAt: [0, 200, 0] },
    { name: 'far-silhouette', position: [-770, 370, 830], lookAt: [0, 150, 0] },
  ],
};
