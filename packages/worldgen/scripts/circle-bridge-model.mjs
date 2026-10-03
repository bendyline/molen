/** Cirkelbroen: original closed-state exterior from the designer's photos and engineer's plan. */
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const tau = Math.PI * 2;
const white = [0.9, 0.91, 0.87];
const red = [0.67, 0.18, 0.115];
const wood = [0.29, 0.13, 0.066];
const stainless = [0.64, 0.68, 0.68];
const deck = [0.77, 0.69, 0.52];
const deckY = 2.8;
// Names follow Ramboll's 2012 plan. Centers fit the exact-QID OSM outline;
// radii add the white outboard flange missing from that approximate mapped edge.
// Heights/count allocation are photographic reconstructions, not fabrication measurements.
export const circlePlatforms = [
  { name: 'P1', x: -14.348, z: 4.347, r: 4.7, mast: 17.2, stays: 22, end: -1 },
  { name: 'P2', x: -9.451, z: -2.345, r: 6.0, mast: 22.2, stays: 25 },
  { name: 'P3', x: 0.608, z: -2.476, r: 6.65, mast: 22, stays: 27 },
  { name: 'P4', x: 7.19, z: 4.26, r: 4.9, mast: 14.7, stays: 22 },
  { name: 'P5', x: 14.195, z: 0.425, r: 5.0, mast: 17.2, stays: 22, end: 1 },
];
const point = (c, radius, angle, y) => [
  c.x + radius * Math.cos(angle),
  y,
  c.z + radius * Math.sin(angle),
];
const arcRing = (c, radius, y, sides = 192) => radialRing(y, radius, radius, sides, [c.x, c.z]);
const rod = (out, a, b, radius, color = stainless, slot = 'steel', sides = 8) =>
  tube(out, slot, a, b, radius, color, sides);

/** Clip one convex platform to its radical half-planes: no overlapping coplanar decks. */
function clippedDisc(c) {
  let points = arcRing(c, c.r, deckY).map(([x, , z]) => [x, z]);
  for (const other of circlePlatforms) {
    if (other === c || Math.hypot(c.x - other.x, c.z - other.z) >= c.r + other.r) continue;
    const dx = other.x - c.x,
      dz = other.z - c.z,
      limit = (other.x ** 2 + other.z ** 2 - c.x ** 2 - c.z ** 2 + c.r ** 2 - other.r ** 2) / 2;
    const next = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const da = a[0] * dx + a[1] * dz - limit,
        db = b[0] * dx + b[1] * dz - limit;
      if (da <= 0) next.push(a);
      if (da < 0 !== db < 0) {
        const t = da / (da - db);
        next.push(a.map((v, k) => v + t * (b[k] - v)));
      }
    }
    points = next;
  }
  return points;
}

/** Analytic exposed arcs, with real gaps at platform junctions and the two shore entrances. */
function exposedArcs(c, inset = 0) {
  const r = c.r - inset,
    cuts = [0, tau];
  for (const other of circlePlatforms) {
    if (other === c) continue;
    const dx = other.x - c.x,
      dz = other.z - c.z,
      d = Math.hypot(dx, dz),
      r2 = other.r - inset;
    if (d >= r + r2 || d <= Math.abs(r - r2)) continue;
    const direction = Math.atan2(dz, dx),
      half = Math.acos((d * d + r * r - r2 * r2) / (2 * d * r));
    for (const a of [direction - half, direction + half]) cuts.push((a + tau) % tau);
  }
  if (c.end) {
    const half = Math.asin(1.5 / r),
      angle = c.end < 0 ? Math.PI : 0;
    for (const a of [angle - half, angle + half]) cuts.push((a + tau) % tau);
  }
  cuts.sort((a, b) => a - b);
  return cuts.slice(1).flatMap((b, i) => {
    const a = cuts[i],
      mid = (a + b) / 2,
      p = point(c, r, mid, 0);
    if (
      circlePlatforms.some(
        (o) => o !== c && Math.hypot(p[0] - o.x, p[2] - o.z) < o.r - inset - 1e-6,
      )
    )
      return [];
    if (c.end && c.end * Math.cos(mid) > 0 && Math.abs(r * Math.sin(mid)) < 1.5) return [];
    return [[a, b]];
  });
}

function handrail(out, a, b, color = wood) {
  beam(out, 'timber', a, b, 0.135, 0.07, color);
}

function platform(out, c) {
  const poly = clippedDisc(c);
  out.addConvexPolygon(
    'concrete',
    'palette:#ffffff',
    poly.map(([x, z]) => [x, deckY, z]),
    [0, 1, 0],
    (p) => [p[0], p[2]],
    deck,
  );
  // Watertight white underside; its shallow trumpet shell is visible from canal level.
  const bottom = poly.map(([x, z]) => {
    const t = Math.min(1, Math.hypot(x - c.x, z - c.z) / c.r);
    return [x, 2.0 + 0.52 * t, z];
  });
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const tri = [[c.x, 2.0, c.z], bottom[j], bottom[i]];
    out.addTriangle(
      'iron',
      'palette:#ffffff',
      tri,
      normalFor(...tri),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      white,
    );
    const side = [
      bottom[i],
      bottom[j],
      [poly[j][0], deckY, poly[j][1]],
      [poly[i][0], deckY, poly[i][1]],
    ];
    quad(out, 'iron', side, normalFor(...side), white);
  }
  // Stem and smoothly flared transition to the deck; the fixed shore platforms have seabed piles.
  const levels = [
    [-2.6, 0.44],
    [0.15, 0.44],
    [0.9, 0.48],
    [1.38, 0.58],
    [1.65, 0.8],
    [1.83, 1.12],
    [1.99, 1.72],
  ];
  loft(
    out,
    'iron',
    levels.map(([y, r]) => arcRing(c, r, y, 64)),
    white,
  );
  torus(out, 'iron', [c.x, 0.15, c.z], 0.465, 0.025, white, 64, 10);
  const endpoints = [];
  for (const [a, b] of exposedArcs(c, 0.26)) {
    const n = Math.max(2, Math.ceil(((b - a) * c.r) / 0.14));
    const base = (t) => point(c, c.r - 0.26, a + (b - a) * t, deckY + 0.07);
    const top = (t) => point(c, c.r - 0.68, a + (b - a) * t, deckY + 1.17);
    for (let i = 0; i < n; i++) {
      const t0 = i / n,
        t1 = (i + 1) / n;
      handrail(out, top(t0), top(t1));
      rod(out, base(t0), base(t1), 0.02, red, 'iron');
      // Two interlaced diagonal sets; neighboring stations form the narrow diamond mesh.
      for (const shift of [-2, 2]) {
        const end = Math.max(0, Math.min(n, i + shift));
        rod(out, base(t0), top(end / n), 0.012, red, 'iron');
      }
      if (i % 9 === 0) {
        const foot = base(t0);
        rod(out, foot, [foot[0], foot[1] - 0.06, foot[2]], 0.025, stainless);
      }
      // Recessed linear light channel directly below the timber cap (unlit daytime state).
      const l0 = top(t0),
        l1 = top(t1);
      rod(
        out,
        [l0[0], l0[1] - 0.048, l0[2]],
        [l1[0], l1[1] - 0.048, l1[2]],
        0.011,
        [0.86, 0.82, 0.67],
      );
    }
    for (const t of [0, 1]) {
      rod(out, base(t), top(t), 0.016, red, 'iron');
      endpoints.push({ base: base(t), top: top(t), platform: c });
    }
  }
  // Curved outboard flange follows only the exterior, with paired fasteners at stay stations.
  for (const [a, b] of exposedArcs(c)) {
    const n = Math.ceil(((b - a) * c.r) / 0.1);
    for (let i = 0; i < n; i++) {
      const t0 = a + ((b - a) * i) / n,
        t1 = a + ((b - a) * (i + 1)) / n;
      quad(
        out,
        'iron',
        [
          point(c, c.r, t0, deckY + 0.006),
          point(c, c.r - 0.22, t0, deckY + 0.006),
          point(c, c.r - 0.22, t1, deckY + 0.006),
          point(c, c.r, t1, deckY + 0.006),
        ],
        [0, 1, 0],
        white,
      );
    }
  }
  return endpoints;
}

function mast(out, c) {
  const top = deckY + c.mast,
    ringY = deckY + c.mast * 0.72;
  loft(out, 'iron', [arcRing(c, 0.15, deckY, 48), arcRing(c, 0.1, top, 48)], white);
  loft(
    out,
    'iron',
    [arcRing(c, 0.25, deckY + 0.015, 48), arcRing(c, 0.25, deckY + 0.065, 48)],
    white,
  );
  for (let i = 0; i < 10; i++) {
    const p = point(c, 0.212, (i * tau) / 10, deckY + 0.071);
    rod(out, p, [p[0], p[1] + 0.025, p[2]], 0.014, stainless, 'steel', 6);
  }
  const hubY = top - 0.32,
    ringR = c.r * 0.315;
  torus(out, 'iron', [c.x, hubY, c.z], 0.34, 0.028, white, 64, 10);
  torus(out, 'iron', [c.x, ringY, c.z], ringR, 0.022, white, 128, 10);
  for (let j = 0; j < 6; j++) {
    const a = (j * tau) / 6;
    rod(out, point(c, 0.1, a, hubY), point(c, 0.34, a, hubY), 0.012, white, 'iron');
  }
  // Stay feet occupy only exposed edges, never a connecting pedestrian opening.
  const arcs = exposedArcs(c, 0.04),
    arcLength = arcs.reduce((sum, [a, b]) => sum + b - a, 0);
  for (let j = 0; j < c.stays; j++) {
    let target = ((j + 0.5) / c.stays) * arcLength,
      angle = arcs[0][0];
    for (const [a, b] of arcs) {
      if (target <= b - a) {
        angle = a + target;
        break;
      }
      target -= b - a;
    }
    const foot = point(c, c.r - 0.09, angle, deckY + 0.11);
    const middle = point(c, ringR, angle, ringY);
    const tip = point(c, 0.34, angle, hubY);
    rod(out, foot, middle, 0.005);
    rod(out, middle, tip, 0.005);
    const turnbuckleTop = foot.map((v, k) => v + (middle[k] - v) * 0.033);
    rod(out, foot, turnbuckleTop, 0.018, stainless, 'steel', 12);
    const plate = point(c, c.r - 0.09, angle, deckY + 0.025);
    box(
      out,
      'iron',
      [plate[0] - 0.045, deckY, plate[2] - 0.045],
      [plate[0] + 0.045, deckY + 0.04, plate[2] + 0.045],
      white,
    );
    for (const da of [-0.015, 0.015]) {
      const bolt = point(c, c.r - 0.09, angle + da, deckY + 0.04);
      rod(out, bolt, [bolt[0], bolt[1] + 0.024, bolt[2]], 0.012, stainless, 'steel', 6);
    }
  }
  // Mast lights and small access panel, visible in the designer's walkway photograph.
  for (const [a, y] of [
    [0.8, deckY + 4.15],
    [3.9, deckY + 3.6],
  ]) {
    const p = point(c, 0.24, a, y),
      end = point(c, 0.3, a, y - 0.16);
    rod(out, point(c, 0.12, a, y), p, 0.018);
    rod(out, p, end, 0.067, [0.31, 0.33, 0.33], 'iron', 16);
    rod(out, end, [end[0], end[1] - 0.007, end[2]], 0.051, [0.84, 0.85, 0.78], 'steel', 16);
  }
  box(
    out,
    'iron',
    [c.x - 0.047, deckY + 0.23, c.z + 0.142],
    [c.x + 0.047, deckY + 0.43, c.z + 0.149],
    [0.79, 0.8, 0.77],
  );
}

function buildCircleBridge(out) {
  const ends = [];
  for (const c of circlePlatforms) {
    ends.push(...platform(out, c));
    mast(out, c);
  }
  // Close the inset rail miters between neighboring circles, without crossing the walking route.
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i],
        b = ends[j];
      if (a.platform === b.platform || Math.hypot(...a.base.map((v, k) => v - b.base[k])) > 0.001)
        continue;
      handrail(out, a.top, b.top);
      rod(out, a.base, b.top, 0.012, red, 'iron');
    }
  // The three NE platforms float as one closed-state assembly. Only P3 is the pivot.
  const float = [
    [-1.0, -4.4],
    [8.5, 2.3],
    [14.8, -0.9],
    [14.4, 1.6],
    [7.2, 6.0],
    [-1.0, -0.5],
  ];
  // Keep clockwise rings for +Y caps; fully submerged, with no invented visible deck boxes.
  loft(
    out,
    'iron',
    [-2.7, -1.15].map((y) => [...float].reverse().map(([x, z]) => [x, y, z])),
    [0.23, 0.27, 0.27],
  );
  const pivot = circlePlatforms[2];
  loft(
    out,
    'iron',
    [
      [-2.72, 1.1],
      [-1.1, 1.1],
      [-0.12, 0.47],
    ].map(([y, r]) => arcRing(pivot, r, y, 64)),
    white,
  );
  for (const y of [-2.74, -1.12])
    torus(out, 'iron', [pivot.x, y, pivot.z], 1.13, 0.045, white, 64, 10);
  // Shore interface stubs. Long quay ramps remain separate site geometry, avoiding guessed terrain.
  for (const c of circlePlatforms.filter((p) => p.end)) {
    const x0 = c.x + c.end * Math.sqrt(c.r ** 2 - 1.5 ** 2),
      x1 = x0 + c.end * 1.4;
    const lo = Math.min(x0, x1),
      hi = Math.max(x0, x1);
    box(out, 'iron', [lo, deckY - 0.17, c.z - 1.5], [hi, deckY - 0.006, c.z + 1.5], white);
    box(out, 'concrete', [lo, deckY - 0.004, c.z - 1.47], [hi, deckY + 0.003, c.z + 1.47], deck);
    for (const side of [-1, 1]) {
      const z = c.z + side * 1.5;
      rod(out, [x1, deckY, z], [x1, deckY + 1.15, z], 0.033);
      rod(out, [x0, deckY + 1.15, z], [x1, deckY + 1.15, z], 0.033);
      rod(out, [x0, deckY + 0.62, z], [x1, deckY + 0.62, z], 0.02);
      const railAngle =
        c.end > 0
          ? side * Math.asin(1.5 / (c.r - 0.26))
          : Math.PI - side * Math.asin(1.5 / (c.r - 0.26));
      const curvedEnd = point(c, c.r - 0.68, railAngle, deckY + 1.17);
      rod(out, curvedEnd, [x0, deckY + 1.15, z], 0.033);
      rod(out, [curvedEnd[0], deckY + 0.62, curvedEnd[2]], [x0, deckY + 0.62, z], 0.02);
    }
    // Movement joints are visible flush seams, not barriers laid across the path.
    box(
      out,
      'iron',
      [x1 - 0.012, deckY + 0.004, c.z - 1.5],
      [x1 + 0.012, deckY + 0.008, c.z + 1.5],
      [0.21, 0.23, 0.23],
    );
    if (c.end === 1) {
      box(
        out,
        'iron',
        [x1 - 0.2, deckY, c.z + 1.65],
        [x1 + 0.12, deckY + 1.15, c.z + 1.92],
        [0.5, 0.53, 0.51],
      );
      box(
        out,
        'iron',
        [x1 - 0.155, deckY + 0.85, c.z + 1.635],
        [x1 + 0.075, deckY + 1.07, c.z + 1.65],
        [0.13, 0.16, 0.15],
      );
    }
  }
}

export const circleBridgeStudy = {
  id: 'N0033',
  key: 'circle_bridge',
  title: 'Circle Bridge (Cirkelbroen)',
  wikidataId: 'Q11963844',
  build: buildCircleBridge,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Five staggered cream decks, white trumpet-shaped supports and tapered masts, ring-supported stainless stays, tomato-red diamond rails and Guariuba handrails; original closed-state Copenhagen exterior.',
  nativeAxes: {
    x: 'Northeast, from P1/Applebys Plads to P5/Christiansbro',
    y: 'Up; Y0 is provisional local sea level',
    z: 'Southeast toward Christianshavns Kanal; the main harbor lies northwest, native -Z',
  },
  refs: [
    'https://olafureliasson.net/artwork/cirkelbroen-2015/',
    'https://olafureliasson.net/press/cirkelbroen',
    'https://steelinfo.dk/files/pdf/dsi/steelday_2012/11.%20Cirkelbroen.pdf',
    'https://cdn.archilovers.com/projects/ebb80424-9531-4fd0-811e-656a4b4de7a1.pdf',
  ],
  sourceFacts: {
    designer: 'Olafur Eliasson',
    completed: 2015,
    circularPlatforms: 5,
    cables: 118,
    reportedOverallMeters: [39.3, 25, 19.6],
    closedClearanceMeters: 2.25,
    rotatingPlatforms: ['P3', 'P4', 'P5'],
    pivotPlatform: 'P3',
    materials: {
      deck: 'Matacryl waterproof coating',
      rail: 'RAL3016 gloss60',
      handrail: 'Guariuba',
    },
    engineerDesign2012: {
      platformDiametersMeters: [9.4, 13.3],
      maxMastAboveDeckMeters: 22.2,
      mastDiameterMeters: [0.3, 0.2],
      stayDiameterMeters: 0.01,
      rampWidthMeters: 3,
    },
    evidence:
      '2012 Ramboll/Pihl/VSB presentation plan, pontoon, pivot section and production views inspected. The 2015 fact sheet supersedes its teak material note and earlier navigation-clearance proposal.',
  },
  reconstruction: {
    platforms: circlePlatforms,
    deckAboveProvisionalWaterMeters: deckY,
    mastTopsAboveWaterMeters: circlePlatforms.map((p) => deckY + p.mast),
    handrailHeightMeters: 1.17,
    railRodDiameterMeters: 0.024,
    mastSpreaderFraction: 0.72,
    modeledStayCount: circlePlatforms.reduce((n, p) => n + p.stays, 0),
    state: 'Closed, static exterior; no opening animation',
    note: 'Circle centers fit OSM arc groups. Deck radii include an estimated outboard flange; the mapped edge is approximate. Stay allocation, intermediate heights, fittings and submerged tank are photo/drawing proportions. Deck2.8m plus22.2m maximum mast gives the designer25m overall envelope; a surveyed vertical datum is not claimed.',
  },
  geographic: (m) => ({
    anchor: m.anchor,
    heading: m.heading,
    elevationMode: 'sea-level',
    elevationMeters: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Native Y0 intentionally represents the water contact plane, not the minimum mesh bound. Engineer2012 slide8 shows the pontoon below water and the deck above it. Submerged geometry must remain below0. Absolute local water-level calibration and quay fit remain pending; this reviews the model datum convention only.',
    notes:
      'Exact-QID way419513906 fixes the plan. Engineer north arrow resolves P1 southwest and P5 northeast. Native Y0 provisionally uses local sea level; do not drape the bridge midpoint to canal-bed terrain. Shore ramps and measured water datum remain a separate site-fit task.',
  }),
  limitations: [
    'The2012 engineering presentation is a design-stage reference.2015 photos/material fact sheet control visible appearance; as-built shop drawings were not available.',
    'Individual mast heights, circle-edge offsets,118-stay distribution and small hardware are proportional reconstructions. Maximum fidelity remains pending measured as-built confirmation.',
    'Sea-level Y0 and2.8m deck datum are provisional. The2.25m published navigation clearance is not a uniform underside height; real quay and water-level fit require site validation.',
    'The bridge is closed and static. Internal hydraulics, concealed ribs and buried piles are outside this exterior asset; submerged pontoon dimensions are approximate.',
    'Only short shore connection stubs are included. The20–23m granite-clad quay ramps, adjacent buildings and harbor furniture belong to site context.',
    'Shared concrete grain approximates the non-slip Matacryl coating; no proprietary product texture or photograph is embedded. Lights are modeled in unlit daytime state.',
  ],
  camera: { position: [42, 29, 48], lookAt: [0, 9, 0], fov: 42 },
  qaCameras: [
    { name: 'deck-plan', position: [0, 62, 0.01], lookAt: [0, 0, 0], fov: 45 },
    { name: 'harbor-elevation', position: [0, 15, -62], lookAt: [0, 12, 0], fov: 42 },
    { name: 'canal-elevation', position: [0, 15, 62], lookAt: [0, 12, 0], fov: 42 },
    { name: 'diamond-rail', position: [-15, 5.9, 13], lookAt: [-14.35, 3.4, 8], fov: 45 },
    { name: 'walk-through', position: [-17, 4.45, 4.4], lookAt: [-3, 4.0, -1], fov: 66 },
    { name: 'trumpet-support', position: [-8, 0.5, 12], lookAt: [-9.45, 1.3, -2.35], fov: 50 },
    { name: 'mast-ring', position: [-3, 21, 8], lookAt: [-9.45, 19, -2.35], fov: 50 },
    { name: 'stay-anchors', position: [-7.5, 4.7, -11.5], lookAt: [-9.3, 3.0, -8.2], fov: 48 },
    { name: 'north-entrance', position: [26, 7, 4], lookAt: [17, 3.2, 0.4], fov: 50 },
  ],
};
