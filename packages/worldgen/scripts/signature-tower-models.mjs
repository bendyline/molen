/** Three individually researched tower reconstructions. All dimensions are meters. */
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { montevideoStudy } from './montevideo-tower-model.mjs';
import { oneCanadaSquareStudy } from './one-canada-square-model.mjs';
import { rembrandtStudy } from './rembrandt-tower-model.mjs';
import { buildMappedShard, shardReconstruction } from './shard-tower-model.mjs';
import { bitexcoStudy } from './signature-tower-bitexco-model.mjs';
import { skylineExpansion } from './signature-tower-expansion-models.mjs';
import { skylineGlobal } from './signature-tower-global-models.mjs';
import { skylineNext } from './signature-tower-next-models.mjs';
import { skylineWorld } from './signature-tower-world-models.mjs';
import { quad, tube } from './structure-mesh.mjs';

const ref = 'palette:#ffffff';
const aluminum = [0.69, 0.73, 0.75];
const concrete = [0.76, 0.75, 0.71];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const move = (p, n, d) => p.map((v, i) => v + n[i] * d);

function polygon(out, slot, p, color) {
  out.addConvexPolygon(slot, ref, p, normalFor(p[0], p[1], p[2]), (p) => [p[0], p[1]], color);
}

/** Panel geometry follows the actual facade plane; no window atlas or baked lighting. */
function facade(out, a, b, c, d, color, { module = 1.5, band = 0.14, frame = 0.075 } = {}) {
  const normal = normalFor(a, b, c);
  const count = Math.max(
    1,
    Math.ceil(
      Math.max(Math.hypot(...b.map((v, i) => v - a[i])), Math.hypot(...c.map((v, i) => v - d[i]))) /
        module,
    ),
  );
  // Inset glass vertically under independent projecting transoms.
  const height = Math.max(0.1, Math.hypot(...d.map((v, i) => v - a[i])));
  const t = Math.min(0.22, band / height);
  const aa = mix(a, d, t),
    bb = mix(b, c, t),
    cc = mix(b, c, 1 - t),
    dd = mix(a, d, 1 - t);
  for (let i = 0; i < count; i++) {
    const u0 = i / count,
      u1 = (i + 1) / count;
    const p = [mix(aa, bb, u0), mix(aa, bb, u1), mix(dd, cc, u1), mix(dd, cc, u0)];
    const tint = 0.985 + (0.015 * ((i * 7 + Math.round(a[1])) % 5)) / 4;
    quad(
      out,
      'glass',
      p,
      normalFor(p[0], p[1], p[2]),
      color.map((v) => v * tint),
    );
    if (i > 0)
      beam(
        out,
        'metal',
        move(mix(a, b, u0), normal, 0.055),
        move(mix(d, c, u0), normal, 0.055),
        frame,
        0.085,
        aluminum,
      );
  }
  const faceBand = (u, v, w, x) =>
    quad(
      out,
      'metal',
      [u, v, w, x].map((p) => move(p, normal, 0.045)),
      normal,
      aluminum,
    );
  faceBand(a, b, bb, aa);
  faceBand(dd, cc, c, d);
}

// SWFC: a square prism clipped by two opposing curved planes parallel to a diagonal.
const swfcDiagonal = 58 / Math.sqrt(2);
function swfcRing(y) {
  const z = Math.max(0.32, swfcDiagonal * (1 - Math.pow(y / 492, 1.66)));
  const x = swfcDiagonal - z;
  return [
    [-x, y, -z],
    [-swfcDiagonal, y, 0],
    [-x, y, z],
    [x, y, z],
    [swfcDiagonal, y, 0],
    [x, y, -z],
  ];
}
const aperture = (y) => 20 + ((y - 439) * 5) / 35;

function buildSWFC(out) {
  const base = swfcRing(0.35);
  loft(out, 'foundation', [base.map(([x, _y, z]) => [x, 0, z]), base], concrete);
  const yLevels = [
    ...new Set([
      0.35,
      8,
      ...Array.from({ length: 102 }, (_, i) => 8 + i * 4.17).filter((y) => y < 423),
      423,
      427,
      431,
      435,
      439,
      443,
      447,
      451,
      455,
      459,
      463,
      467,
      471,
      474,
      478,
      482,
      486,
      490,
      492,
    ]),
  ].sort((a, b) => a - b);
  // The physical 58 m square has a diagonal aligned with native X; tiny clipping at ground
  // prevents coincident hexagon corners at the mathematical square-to-hexagon transition.
  for (let j = 1; j < yLevels.length; j++) {
    const y0 = yLevels[j - 1],
      y1 = yLevels[j];
    const lower = swfcRing(y0),
      upper = swfcRing(y1);
    for (let f = 0; f < 6; f++) {
      const k = (f + 1) % 6;
      if ((f === 2 || f === 5) && y0 >= 439 && y1 <= 474) {
        // Both broad faces are actually open; side reveals connect them through the tower.
        const direction = f === 2 ? 1 : -1;
        const inner0 = [direction * -aperture(y0), y0, lower[f][2]];
        const inner1 = [direction * -aperture(y1), y1, upper[f][2]];
        const other0 = [-inner0[0], y0, lower[f][2]];
        const other1 = [-inner1[0], y1, upper[f][2]];
        facade(out, lower[f], inner0, inner1, upper[f], [0.21, 0.34, 0.43]);
        facade(out, other0, lower[k], upper[k], other1, [0.21, 0.34, 0.43]);
      } else if (Math.hypot(...lower[f].map((n, i) => n - lower[k][i])) > 0.07) {
        facade(out, lower[f], lower[k], upper[k], upper[f], [0.22, 0.355, 0.455]);
      }
    }
    for (const f of [1, 4]) beam(out, 'metal', lower[f], upper[f], 0.22, 0.24, [0.56, 0.62, 0.65]);
  }
  polygon(out, 'metal', swfcRing(492), aluminum);
  polygon(out, 'foundation', swfcRing(0.35).toReversed(), concrete);
  // The two vertical reveals lean apart toward the upper bridge.
  for (const sign of [-1, 1]) {
    for (let y = 439; y < 474; y += 5) {
      const y1 = Math.min(y + 5, 474),
        z0 = swfcRing(y)[2][2],
        z1 = swfcRing(y1)[2][2];
      let p = [
        [sign * aperture(y), y, -z0],
        [sign * aperture(y), y, z0],
        [sign * aperture(y1), y1, z1],
        [sign * aperture(y1), y1, -z1],
      ];
      if (sign < 0) p = p.toReversed();
      facade(out, ...p, [0.25, 0.31, 0.34], { module: 1.6 });
    }
  }
  for (const y of [439, 474]) {
    const z = swfcRing(y)[2][2],
      x = aperture(y);
    const p = [
      [-x, y, -z],
      [-x, y, z],
      [x, y, z],
      [x, y, -z],
    ];
    polygon(
      out,
      y === 439 ? 'glass' : 'metal',
      y === 439 ? p : p.toReversed(),
      y === 439 ? [0.31, 0.43, 0.46] : aluminum,
    );
    // Roof/floor support members and the narrow glass walkway panels remain inside the opening.
    for (let u = -x; u <= x; u += 1.8)
      beam(
        out,
        'metal',
        [u, y + (y === 439 ? 0.055 : -0.055), -z],
        [u, y + (y === 439 ? 0.055 : -0.055), z],
        0.09,
        0.13,
        aluminum,
      );
  }
  // Transparent lobby bays and canopy are within the tower plan, not a guessed whole block.
  for (const s of [-1, 1]) {
    const a = [s * 6, 0.4, s * 34.8],
      b = [s * 15, 0.4, s * 25.8];
    beam(out, 'metal', [a[0], 5.8, a[2]], [b[0], 5.8, b[2]], 3.0, 0.18, aluminum);
    for (let i = 0; i <= 6; i++) {
      const p = mix(a, b, i / 6);
      beam(out, 'metal', p, [p[0], 5.7, p[2]], 0.13, 0.13, aluminum);
    }
  }
}

function spherePanel(out, p, color, slot) {
  const normal = normalFor(p[0], p[1], p[2]);
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

/** Individual triangular shell plates with real gaps and inserted observation glazing belts. */
function pearl(
  out,
  center,
  radius,
  bands,
  { segments = 72, latitudes = 36, tint = [0.47, 0.225, 0.32] } = {},
) {
  const point = (j, i, r = radius) => {
    const t = -Math.PI / 2 + (Math.PI * j) / latitudes;
    const a = (-2 * Math.PI * (i + (j % 2) * 0.5)) / segments;
    return [
      center[0] + Math.cos(t) * Math.cos(a) * r,
      center[1] + Math.sin(t) * r,
      center[2] + Math.cos(t) * Math.sin(a) * r,
    ];
  };
  const triangle = (p, row, column) => {
    const y = p.reduce((s, p) => s + p[1], 0) / 3;
    const glazing = bands.some(([a, b]) => y >= a && y <= b);
    const n = normalFor(p[0], p[1], p[2]);
    const color = glazing
      ? [0.17, 0.23, 0.29]
      : tint.map((v) => v * (0.91 + ((row * 3 + column * 5) % 9) / 90));
    // Large pearls have pale metal polar caps surrounding their ruby faceted belts.
    if (radius >= 20) {
      const ruby = radius === 25 ? y >= 82.5 && y <= 103.5 : y >= 264 && y <= 287;
      if (!ruby && !glazing) color.splice(0, 3, 0.65, 0.66, 0.63);
    }
    const centroid = p[0].map((_, i) => p.reduce((s, p) => s + p[i], 0) / 3);
    const inset = p.map((p) => mix(p, centroid, 0.035));
    // Build joints around the plate instead of drawing a full metal triangle behind
    // a near-coplanar colored overlay. This remains stable at geographic far planes.
    for (let edge = 0; edge < 3; edge++) {
      const next = (edge + 1) % 3;
      quad(out, 'metal', [p[edge], p[next], inset[next], inset[edge]], n, [0.52, 0.56, 0.58]);
    }
    spherePanel(out, inset, color, glazing ? 'glass' : 'pink');
  };
  for (let j = 0; j < latitudes; j++) {
    for (let i = 0; i < segments; i++) {
      if (j === 0) triangle([point(0, 0), point(1, i + 1), point(1, i)], j, i);
      else if (j === latitudes - 1)
        triangle([point(j, i), point(j, i + 1), point(latitudes, 0)], j, i);
      else {
        const p = [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)];
        triangle([p[0], p[1], p[2]], j, i);
        triangle([p[0], p[2], p[3]], j, i);
      }
    }
  }
  for (const [a, b] of bands) {
    for (const y of [a, b]) {
      const d = y - center[1];
      if (Math.abs(d) < radius - 0.1)
        torus(
          out,
          'metal',
          [center[0], y, center[2]],
          Math.sqrt(radius * radius - d * d) + 0.035,
          0.075,
          aluminum,
          96,
          6,
        );
    }
  }
}

function buildPearl(out) {
  const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  // Three stepped entry disks and inclined buttresses, aligned with the three mapped radial arms.
  for (const a of angles) {
    const foot = [57 * Math.cos(a), 0, 57 * Math.sin(a)];
    const shaft = [9.25 * Math.cos(a), 0, 9.25 * Math.sin(a)];
    loft(
      out,
      'stone',
      [
        radialRing(0, 9.4, 9.4, 48, [foot[0], foot[2]]),
        radialRing(0.45, 9.4, 9.4, 48, [foot[0], foot[2]]),
      ],
      [0.56, 0.57, 0.55],
    );
    tube(out, 'concrete', [foot[0], 3, foot[2]], [shaft[0], 86, shaft[2]], 3.5, concrete, 40);
    tube(out, 'concrete', [foot[0], 0.45, foot[2]], [foot[0], 4.2, foot[2]], 4.2, concrete, 40);
    const vertical = [-shaft[0], 0, -shaft[2]];
    tube(out, 'concrete', vertical, [vertical[0], 287, vertical[2]], 4.5, concrete, 48);
    for (let y = 16; y < 250; y += 4.5)
      torus(
        out,
        'concrete',
        [vertical[0], y, vertical[2]],
        4.507,
        0.025,
        [0.67, 0.68, 0.64],
        48,
        5,
      );
    pearl(out, [foot[0], 10.5, foot[2]], 8.8, [[9.4, 13.1]], {
      segments: 36,
      latitudes: 18,
      tint: [0.48, 0.255, 0.34],
    });
  }
  loft(
    out,
    'stone',
    [radialRing(0, 24.6, 24.6, 72), radialRing(1.2, 24.6, 24.6, 72), radialRing(1.8, 23, 23, 72)],
    [0.55, 0.56, 0.54],
  );
  // Circular glazed lift in the space between the columns, with its segmented steel enclosure.
  tube(out, 'glass', [0, 2, 0], [0, 90, 0], 2.45, [0.23, 0.34, 0.39], 48);
  for (let y = 3; y < 89; y += 4) torus(out, 'metal', [0, y, 0], 2.47, 0.055, aluminum, 48, 6);
  pearl(out, [0, 93, 0], 25, [[88.5, 98.5]]);
  pearl(out, [0, 272.5, 0], 22.5, [[258.5, 268.2]], { tint: [0.49, 0.22, 0.31] });
  // Seven groups of deep concrete cross-beams visibly join the three independent columns.
  const columns = angles.map((a) => [-9.25 * Math.cos(a), -9.25 * Math.sin(a)]);
  for (const y of [122.5, 145, 167.5, 190, 212.5, 235, 257.5]) {
    for (let i = 0; i < 3; i++) {
      const a = columns[i],
        b = columns[(i + 1) % 3];
      beam(out, 'concrete', [a[0], y, a[1]], [b[0], y, b[1]], 2.9, 6, concrete);
    }
  }
  // Five hotel pearls use the central shaft and leave the three concrete columns legible.
  for (const y of [128, 150, 172, 194, 216])
    pearl(out, [0, y, 0], 6.5, [[y - 1.2, y + 1.4]], {
      segments: 36,
      latitudes: 18,
      tint: [0.43, 0.235, 0.3],
    });
  tube(out, 'concrete', [0, 286, 0], [0, 350, 0], 3.0, concrete, 48);
  pearl(out, [0, 342, 0], 7, [[340.3, 344.5]], {
    segments: 48,
    latitudes: 24,
    tint: [0.44, 0.22, 0.3],
  });
  for (const [y0, y1, r0, r1] of [
    [350, 376, 2.8, 2.0],
    [376, 402, 2.0, 1.25],
    [402, 430, 1.25, 0.75],
    [430, 454, 0.75, 0.42],
    [454, 468, 0.42, 0.18],
  ]) {
    loft(out, 'metal', [radialRing(y0, r0, r0, 24), radialRing(y1, r1, r1, 24)], aluminum);
    for (let y = y0 + 2; y < y1; y += 4) {
      const r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      torus(out, 'metal', [0, y, 0], r + 0.04, 0.045, [0.51, 0.54, 0.55], 32, 6);
    }
  }
  for (const y of [350, 376, 402, 430]) {
    const radius = y === 350 ? 3.7 : y === 376 ? 2.7 : y === 402 ? 1.8 : 1.2;
    torus(out, 'metal', [0, y, 0], radius, 0.14, aluminum, 48, 8);
    torus(out, 'metal', [0, y + 1.1, 0], radius, 0.035, aluminum, 48, 6);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      tube(
        out,
        'metal',
        [radius * Math.cos(a), y, radius * Math.sin(a)],
        [radius * Math.cos(a), y + 1.1, radius * Math.sin(a)],
        0.032,
        aluminum,
        6,
      );
    }
  }
}

export const signatureTowers = [
  oneCanadaSquareStudy,
  montevideoStudy,
  rembrandtStudy,
  bitexcoStudy,
  ...skylineExpansion,
  ...skylineNext,
  ...skylineGlobal,
  ...skylineWorld,
  {
    id: 'N0140',
    key: 'shanghai_world_financial_center',
    wikidataId: 'Q80852',
    build: buildSWFC,
    geographic: () => ({
      reviewStatus: 'mapped-roof-axis; visual site fit review',
      notes:
        'Exact-QID tower outline supplies the ground center. Detailed upper part way279942892 and side piers way279942900/279942901 establish the crown ridge along native X, resolving the former square-footprint diagonal ambiguity. The 58 m published structural side is retained within the roughly 60 m mapped envelope.',
      mapPartsDocument: 'map-evidence.json',
    }),
    title: 'Shanghai World Financial Center',
    height: 492,
    brief:
      'The 492 m SWFC with its six-sided curved cutbacks, real trapezoidal crown opening, glazed observation bridge, split side piers, curtain-wall panels, transoms, edge ribs and lobby canopies.',
    sourceFacts: {
      heightMeters: 492,
      floorsAboveGround: 101,
      standardSquareSideMeters: 58,
      observationLevels: [94, 97, 100],
      highestObservationFloorMeters: 474,
    },
    reconstruction: {
      diagonalMeters: 58 * Math.sqrt(2),
      apertureFloorY: 439,
      apertureUpperFloorY: 474,
      apertureWidthsMeters: [40, 50],
      curvedClipExponent: 1.66,
      facadeModuleMeters: 1.5,
      note: 'Opening clear dimensions, exact cutback radius, floor/module schedule and local lobby details are reconstructed. Observation-floor elevations do not establish beam underside elevations.',
    },
    refs: [
      'https://www.kpf.com/project/shanghai-world-financial-center',
      'https://www.swfc-shanghai.com/about_intro.php?l=en',
      'https://www.mori.co.jp/en/img/article/090828e.pdf',
      'https://old.skyscraper.org/EXHIBITIONS/SUPERTALL/wfc.php',
    ],
    limitations: [
      'Exterior only. No as-built curtain-wall schedule, survey-calibrated arc radii, interiors, retail block, underground works or animated observation roof.',
      'The 58 m structural square differs from the roughly 60 m mapped envelope. Detailed upper map parts resolve the crown ridge orientation; no 90-degree ambiguity remains.',
      'Glass uses opaque metallic-roughness glazing with local vertex tints; it does not transmit interior rooms or a copied photographic environment.',
    ],
    nativeAxes: {
      up: '+Y',
      longitudinal: '+X along the crown edge/58 m square diagonal',
      front: '+Z through the aperture',
      origin: 'Ground-level center of the tower square; excludes wider retail podium',
    },
    camera: { position: [155, 325, 660], lookAt: [0, 245, 0], fov: 44 },
    qaCameras: [
      { name: 'crown-front', position: [0, 463, 115], lookAt: [0, 463, 0] },
      { name: 'crown-side', position: [92, 473, 74], lookAt: [0, 459, 0] },
      { name: 'near-facade', position: [29, 190, 65], lookAt: [5, 177, 30] },
      { name: 'lobby', position: [55, 14, 73], lookAt: [13, 5, 28] },
      { name: 'far-silhouette', position: [430, 340, 820], lookAt: [0, 247, 0] },
    ],
  },
  {
    id: 'N0141',
    key: 'the_shard',
    wikidataId: 'Q18536',
    build: buildMappedShard,
    geographic: () => ({
      reviewStatus: 'mapped-independent-facade-planes; visual site fit review',
      notes:
        'Way31110737 fixes the anchor and signed frame; ways666124825–666124832 provide the eight individual facade polygons, declining directions and roof heights. Ways665171689/665171690 provide the eastern podium wings. Mapped 310 m top planes are calibrated to the operator 309.6 m height. Native base Y0 uses host terrain contact.',
      mapPartsDocument: 'map-evidence.json',
    }),
    title: 'The Shard',
    height: 309.6,
    brief:
      'Eight independently mapped sloped glass facades, open corner gaps, differentiated 235–309.6 m tips, exposed steel crown, detailed panel grids and the separate 70/74 m eastern podium wings.',
    sourceFacts: {
      heightMeters: 309.6,
      independentFacades: 8,
      facadeUnitsApproximately: 11000,
      facadeAreaSquareMeters: 55700,
      highestHabitableFloor: 72,
      viewingPlatformMeters: 244,
      steelSpireHeightApproxMeters: 66,
    },
    reconstruction: shardReconstruction,
    refs: [
      'https://www.the-shard.com/about/',
      'https://www.the-shard.com/about/level-guide',
      'https://www.permasteelisagroup.com/historic-project/the-shard/',
      'https://www.macegroup.com/projects/the-shard/',
      'https://www.arup.com/projects/the-shard/',
    ],
    limitations: [
      'Facade lean directions, eight tips and podium dimensions follow attributed detailed map parts; panel sizes, steel member sections and seals are reconstructed within those envelopes.',
      'Occupied-floor glass uses opaque PBR glazing; the open crown uses double-sided alpha glazing so its internal frame remains visible. Offices, winter gardens, hotel interiors, signage and building services are outside this exterior asset.',
      'The mapped building outline includes the eastern podium. The native origin retains its map frame; the occupied center and individual shard peaks are independently offset.',
    ],
    nativeAxes: {
      up: '+Y',
      longitudinal: '+X along the cached mapped building frame',
      front: '+Z toward the long southern edge in that frame',
      origin:
        'Exact-QID outer-envelope rectangle center at ground level; eight independently mapped facade planes retain their individual peaks',
    },
    camera: { position: [250, 205, 410], lookAt: [-7, 150, 0], fov: 44 },
    qaCameras: [
      { name: 'spire', position: [48, 282, 90], lookAt: [-8, 276, 0] },
      { name: 'spire-reverse', position: [-69, 292, -76], lookAt: [-8, 274, 0] },
      { name: 'near-facade', position: [34, 97, 62], lookAt: [5, 94, 17] },
      { name: 'podium', position: [95, 105, 98], lookAt: [24, 35, 11] },
      { name: 'far-silhouette', position: [-420, 230, 540], lookAt: [-7, 150, 0] },
    ],
  },
  {
    id: 'N0144',
    key: 'oriental_pearl_tower',
    wikidataId: 'Q223207',
    build: buildPearl,
    geographic: () => ({
      reviewStatus: 'mapped-alternating-shafts-and-braces; visual site fit review',
      notes:
        'The exact-QID circular plan provides the tower center and the single opposite brace supplies native -Z. Three vertical columns (ways520990194–520990196) alternate between the inclined brace rays (ways524195833–524195878); this resolves the former 180-degree vertical-column rotation. The explicit ground-contact base follows host terrain.',
      mapPartsDocument: 'map-evidence.json',
    }),
    title: 'Oriental Pearl Tower',
    height: 468,
    brief:
      'Three concrete shafts and inclined buttresses support eleven red/pink triangulated pearl shells, inserted observation glazing bands, a central glazed lift, five smaller hotel pearls and a segmented communications mast with maintenance platforms.',
    sourceFacts: {
      totalHeightMeters: 468,
      spheres: 11,
      supportingColumns: 3,
      inclinedButtresses: 3,
      smallHotelSpheres: 5,
      publicLowObservationMeters: 90,
      publicUpperObservationMeters: [259, 263],
      principalSphereSupportLevelsReportedByDesigner: [112, 295, 350],
    },
    reconstruction: {
      principalSphereCentersY: [93, 272.5, 342],
      principalSphereDiameters: [50, 45, 14],
      hotelSphereCentersY: [128, 150, 172, 194, 216],
      verticalColumnDiameter: 9,
      buttressDiameter: 7,
      buttressRadialFeetMeters: 57,
      note: 'Detailed radii, small-sphere locations, support connections, shell panel grids and mast equipment are reconstructed rather than certified as-built values. Published upper-sphere descriptions differ between 14 and 16 m and between observation/sphere-top elevations; the modeled 14 m sphere ends at 349 m under the 350 m mast.',
    },
    refs: [
      'https://www.otis.com/en/us/our-company/global-projects/project-showcase/oriental-pearl-tower',
      'https://www.cnssce.org/52/201102/1152.html',
      'https://www.cnssce.org/50/201308/1220.html',
      'https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html',
      'https://www.shda.gov.cn/dawh/csjy/202509/t20250919_75918.html',
      'https://www.icppcc.cn/newsDetail_1000332',
    ],
    limitations: [
      'The archive article describes 9 m inclined columns, while technical descriptions distinguish 9 m vertical shafts and 7 m inclined buttresses. The latter is the reconstruction choice and needs as-built drawing confirmation.',
      'Hotel pearl positions/diameters, shell seams, mast taper, entrance spheres, foundations and local equipment are reconstructed. No observation interiors, multimedia displays, lifts in motion or engineering/collision certification.',
      'The circular center of the mapped tower projection differs from the outline bounding-box center. Geographic proposal accounts for that offset; the detailed map parts resolve the alternating vertical-column and inclined-brace orientations.',
    ],
    nativeAxes: {
      up: '+Y',
      longitudinal: '+X between the two southern buttress feet',
      front: '-Z toward the single opposite radial buttress',
      origin:
        'Ground level below the circular middle of the mapped tower, not the outer-envelope rectangle center',
    },
    camera: { position: [340, 286, 630], lookAt: [0, 230, 0], fov: 44 },
    qaCameras: [
      { name: 'lower-pearl', position: [68, 108, 98], lookAt: [0, 93, 0] },
      { name: 'upper-pearl', position: [63, 282, 86], lookAt: [0, 272, 0] },
      { name: 'tripod-base', position: [106, 38, 104], lookAt: [0, 26, 0] },
      { name: 'spire-capsule', position: [35, 364, 62], lookAt: [0, 346, 0] },
      { name: 'far-silhouette', position: [-420, 310, 840], lookAt: [0, 234, 0] },
    ],
  },
];
