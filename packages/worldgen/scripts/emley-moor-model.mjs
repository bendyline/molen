/** Original Emley Moor exterior reconstruction, with a separately documented modern antenna. */
import { beam, loft, radialRing, smoothMeshNormals, torus } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { annulus, face, transform } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';

const tau = 2 * Math.PI;
const concrete = [0.64, 0.62, 0.56],
  metal = [0.71, 0.73, 0.72];
const dark = [0.16, 0.19, 0.19],
  glass = [0.24, 0.3, 0.31],
  white = [0.87, 0.88, 0.85];
const radius = (y) => 12.19 * Math.pow(3.2 / 12.19, y / 274.32);
const point = (a, y, d = 0) => [(radius(y) + d) * Math.sin(a), y, (radius(y) + d) * Math.cos(a)];
const at = (a, y, r) => [r * Math.sin(a), y, r * Math.cos(a)];
const cylinder = (out, slot, y0, y1, r, color, n = 96) =>
  loft(out, slot, [radialRing(y0, r, r, n), radialRing(y1, r, r, n)], color);

function shaft(out) {
  // The main entrance faces native +Z. Actual compass azimuth remains a site-review item.
  const holes = [{ a: 0, half: 0.13, y0: 0, y1: 3.6 }];
  for (const y of [27.4, 33.5, 39.6, 45.7])
    holes.push({ a: Math.PI / 2, half: 0.063, y0: y, y1: y + 2.1 });
  for (const y of [91.44, 137.16, 182.88, 228.6])
    for (const a of [0, Math.PI]) holes.push({ a, half: 0.095, y0: y, y1: y + 1.75 });
  const angles = Array.from({ length: 193 }, (_, i) => (tau * i) / 192);
  for (const h of holes) for (const a of [h.a - h.half, h.a + h.half]) angles.push((a + tau) % tau);
  const as = [...new Set(angles)].sort((a, b) => a - b);
  const cuts = [
    0,
    274.32,
    ...Array.from({ length: 180 }, (_, i) => 1.524 * (i + 1)).filter((y) => y < 274.32),
  ];
  // Flush construction-lift bands use vertex tone. Subpixel groove relief aliases in shadows.
  for (let k = 1; k * 1.524 < 268; k++)
    for (const delta of [-0.03, 0.03]) cuts.push(k * 1.524 + delta);
  for (const h of holes) cuts.push(h.y0, h.y1);
  const ys = [...new Set(cuts)].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < as.length; i++) {
      const a = as[i - 1],
        b = as[i],
        y0 = ys[j - 1],
        y1 = ys[j],
        mid = (a + b) / 2;
      if (
        holes.some(
          (h) =>
            y0 >= h.y0 - 1e-8 &&
            y1 <= h.y1 + 1e-8 &&
            Math.abs(Math.atan2(Math.sin(mid - h.a), Math.cos(mid - h.a))) < h.half,
        )
      )
        continue;
      const midY = (y0 + y1) / 2;
      const joint = midY < 268 && Math.abs(midY - Math.round(midY / 1.524) * 1.524) < 0.03;
      const tint = concrete.map(
        (c) => c * (0.975 + 0.025 * Math.cos(Math.floor(y0 / 1.524) * 1.71)) * (joint ? 0.96 : 1),
      );
      face(out, 'concrete', [point(a, y0), point(b, y0), point(b, y1), point(a, y1)], tint);
    }
  // Recessed doors close every opening, with four concrete reveals, frame and hinges.
  for (const h of holes) {
    const a = h.a - h.half,
      b = h.a + h.half,
      y0 = h.y0,
      y1 = h.y1;
    face(
      out,
      'metal',
      [point(a, y0, -0.34), point(b, y0, -0.34), point(b, y1, -0.34), point(a, y1, -0.34)],
      dark,
    );
    for (const p of [
      [point(a, y0), point(a, y1), point(a, y1, -0.34), point(a, y0, -0.34)],
      [point(b, y1), point(b, y0), point(b, y0, -0.34), point(b, y1, -0.34)],
      [point(a, y1), point(b, y1), point(b, y1, -0.34), point(a, y1, -0.34)],
      [point(b, y0), point(a, y0), point(a, y0, -0.34), point(b, y0, -0.34)],
    ])
      face(out, 'concrete', p, concrete);
    const g = transform(out, h.a),
      r = radius((y0 + y1) / 2) - 0.3,
      w = Math.sin(h.half) * r;
    for (const x of [-w, w])
      box(g, 'metal', [x - 0.035, y0, r - 0.035], [x + 0.035, y1, r + 0.035], metal);
    for (const y of [y0, y1])
      box(g, 'metal', [-w, Math.max(0, y - 0.035), r - 0.035], [w, y + 0.035, r + 0.035], metal);
    if (h.y0 === 0) {
      box(g, 'metal', [-0.018, 0, r - 0.03], [0.018, y1, r + 0.02], metal);
      for (const x of [-0.12, 0.12])
        tube(g, 'metal', [x, 1.05, r + 0.07], [x, 1.55, r + 0.07], 0.025, metal, 8);
    }
  }
  cylinder(out, 'concrete', 274.22, 274.32, 3.2, concrete, 192);
  cylinder(out, 'concrete', 0, 0.03, 12.19, concrete, 192);
  for (const y of [91, 182, 274])
    annulus(out, 'copper', radius(y), radius(y) + 0.012, y, y + 0.065, [0.34, 0.29, 0.2], 192);
}

function railing(out, y, r, count = 40) {
  torus(out, 'metal', [0, y + 1.03, 0], r, 0.032, metal, count * 3, 6);
  torus(out, 'metal', [0, y + 0.53, 0], r, 0.024, metal, count * 3, 6);
  for (let i = 0; i < count; i++)
    tube(
      out,
      'metal',
      at((tau * i) / count, y, r),
      at((tau * i) / count, y + 1.07, r),
      0.027,
      metal,
      6,
    );
}

function turret(out) {
  // Twenty radial bays, with true square glazing recesses and individual panel joints.
  const r = 7.05,
    n = 20,
    half = r * Math.sin(Math.PI / n),
    depth = r * Math.cos(Math.PI / n);
  annulus(out, 'metal', radius(262.4), r, 262.4, 263.6, [0.32, 0.35, 0.35], n);
  annulus(out, 'metal', radius(263.6), r, 263.6, 263.77, metal, n);
  annulus(out, 'metal', radius(268), r + 0.08, 267.88, 268.12, metal, n);
  for (let i = 0; i < n; i++) {
    const g = transform(out, (tau * (i + 0.5)) / n),
      w = half;
    for (const [y0, y1] of [
      [263.77, 264.7],
      [266.5, 267.88],
    ]) {
      box(g, 'metal', [-w + 0.025, y0, depth - 0.11], [w - 0.025, y1, depth + 0.01], metal);
      box(g, 'metal', [-0.012, y0, depth + 0.01], [0.012, y1, depth + 0.025], [0.57, 0.6, 0.59]);
    }
    for (const [x0, x1] of [
      [-w, -0.9],
      [0.9, w],
    ])
      box(g, 'metal', [x0, 264.7, depth - 0.11], [x1, 266.5, depth + 0.01], metal);
    box(
      g,
      'glass',
      [-0.9, 264.7, depth - 0.08],
      [0.9, 266.5, depth - 0.07],
      i === 7 || i === 8 ? [0.36, 0.23, 0.16] : glass,
    );
    for (const x of [-0.9, 0.9])
      box(g, 'metal', [x - 0.038, 264.67, depth - 0.09], [x + 0.038, 266.53, depth + 0.055], metal);
    for (const y of [264.7, 266.5])
      box(g, 'metal', [-0.94, y - 0.038, depth - 0.09], [0.94, y + 0.038, depth + 0.055], metal);
    box(
      g,
      'metal',
      [-w - 0.025, 263.6, depth - 0.13],
      [-w + 0.025, 268.12, depth + 0.065],
      [0.77, 0.78, 0.76],
    );
    for (const y of [263.86, 267.67])
      for (const x of [-w + 0.13, w - 0.13])
        box(
          g,
          'metal',
          [x - 0.015, y - 0.015, depth + 0.02],
          [x + 0.015, y + 0.015, depth + 0.042],
          dark,
        );
    beam(g, 'metal', [0, 262.5, radius(262.5)], [0, 263.6, depth], 0.15, 0.2, dark);
  }
  railing(out, 268.12, 6.95, 20);
  annulus(out, 'metal', radius(251.8), 4.9, 251.8, 252.0, [0.39, 0.42, 0.42], 20);
  railing(out, 252, 4.8, 30);
  // Permanent antenna mounting rings and vertical tracks below the cabin.
  for (const y of [253.3, 255.2, 257.1, 259, 260.9])
    annulus(out, 'metal', radius(y) + 0.1, radius(y) + 0.25, y, y + 0.13, metal, 80);
  for (let i = 0; i < 12; i++) {
    const a = (tau * i) / 12;
    tube(
      out,
      'metal',
      at(a, 252, radius(252) + 0.33),
      at(a, 262.4, radius(262.4) + 0.33),
      0.047,
      metal,
      8,
    );
    beam(out, 'metal', at(a, 249.8, radius(249.8)), at(a, 251.85, 4.75), 0.13, 0.13, metal);
  }
}

function lowerPlatforms(out) {
  for (const y of [27.4, 33.5, 39.6, 45.7]) {
    const r = radius(y),
      width = 5.0;
    const g = transform(out, Math.PI / 2);
    const polygon = [
      [-width / 2, y, r - 0.8],
      [width / 2, y, r - 0.8],
      [width / 2 + 0.7, y, r + 3.1],
      [-width / 2 - 0.7, y, r + 3.1],
    ];
    loft(
      g,
      'concrete',
      [polygon.map((p) => [p[0], p[1] - 0.22, p[2]]).reverse(), [...polygon].reverse()],
      concrete,
    );
    for (const x of [-2, 2])
      beam(g, 'metal', [x, y - 0.4, r - 0.45], [x, y - 0.4, r + 2.95], 0.15, 0.2, metal);
    const path = [polygon[0], polygon[3], polygon[2], polygon[1]];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      for (const rise of [0.53, 1.06])
        tube(g, 'metal', [a[0], y + rise, a[2]], [b[0], y + rise, b[2]], 0.029, metal, 8);
      for (let t = 0; t <= 1; t += 0.25) {
        const x = a[0] + t * (b[0] - a[0]),
          z = a[2] + t * (b[2] - a[2]);
        tube(g, 'metal', [x, y, z], [x, y + 1.08, z], 0.03, metal, 8);
      }
    }
  }
}

function dish(out, angle, y, r, size) {
  const g = transform(out, angle, [0, y, 0]);
  beam(g, 'metal', [0, -0.7, radius(y)], [0, -0.7, r], 0.12, 0.18, metal);
  tube(g, 'metal', [0, -0.7, r], [0, 0, r], 0.09, metal, 12);
  // Covered microwave radome with modeled rim and rear conical housing.
  for (let i = 0; i < 64; i++) {
    const a = (tau * i) / 64,
      b = (tau * (i + 1)) / 64;
    const p = (t, z, rr = size / 2) => [rr * Math.cos(t), rr * Math.sin(t), z];
    face(g, 'metal', [p(a, r), p(b, r), p(b, r + 0.28), p(a, r + 0.28)], white);
    face(
      g,
      'metal',
      [p(a, r + 0.28), p(b, r + 0.28), p(b, r + 0.29, size * 0.49), p(a, r + 0.29, size * 0.49)],
      metal,
    );
  }
  const ring = Array.from({ length: 64 }, (_, i) => [
    size * 0.49 * Math.cos((tau * i) / 64),
    size * 0.49 * Math.sin((tau * i) / 64),
    r + 0.29,
  ]);
  g.addConvexPolygon('metal', 'palette:#ffffff', ring, [0, 0, 1], (p) => [p[0], p[1]], white);
}

function aerials(out) {
  // Current envelope estimated from the 2023 dated survey; 1971 dimensions remain separate facts.
  cylinder(out, 'metal', 296.5, 300.45, 1.87, [0.53, 0.55, 0.54], 128);
  for (const [y0, y1, r, step] of [
    [274.32, 296.5, 1.83, 3.16],
    [300.45, 317.7, 0.76, 2.875],
  ]) {
    let previous = y0;
    for (let y = y0 + step; y < y1; y += step) {
      cylinder(out, 'metal', previous, y - 0.027, r, white, 128);
      cylinder(
        out,
        'metal',
        y - 0.027,
        y + 0.027,
        r,
        white.map((c) => c * 0.88),
        128,
      );
      previous = y + 0.027;
    }
    cylinder(out, 'metal', previous, y1, r, white, 128);
  }
  annulus(out, 'metal', 0.75, 1.91, 300.4, 300.51, metal, 96);
  for (let i = 0; i < 4; i++) {
    const a = (tau * i) / 4;
    tube(out, 'metal', at(a, 317.7, 0.53), at(a, 319, 0.53), 0.025, metal, 8);
    tube(out, 'metal', at(a, 318.8, 0.53), at(a + tau / 4, 318.8, 0.53), 0.026, metal, 8);
  }
  // Caged inspection ladder on the dark changeover collar.
  const g = transform(out, 0.72);
  for (const x of [-0.29, 0.29])
    tube(g, 'metal', [x, 296.5, 2.05], [x, 300.4, 2.05], 0.027, metal, 8);
  for (let y = 296.6; y < 300.4; y += 0.3)
    tube(g, 'metal', [-0.29, y, 2.05], [0.29, y, 2.05], 0.022, metal, 8);
  for (let y = 296.8; y < 300.4; y += 0.7) {
    const rail = Array.from({ length: 13 }, (_, i) => [
      0.43 * Math.cos((tau * i) / 12),
      y,
      2.26 + 0.43 * Math.sin((tau * i) / 12),
    ]);
    for (let j = 1; j < rail.length; j++) tube(g, 'metal', rail[j - 1], rail[j], 0.022, metal, 6);
  }
  for (const [a, y, r, s] of [
    [0.4, 270.7, 3.55, 0.45],
    [2.5, 268.9, 3.6, 0.5],
    [1.8, 258.4, 4, 1.0],
    [4.2, 257.8, 4, 0.75],
    [5.2, 254.4, 5.3, 0.9],
    [0.8, 268.8, 7.5, 0.9],
  ])
    dish(out, a, y, r, s);
  // Crossed shrouded log-periodic rack, dimensioned from the modern turret close-up.
  const rack = transform(out, Math.PI);
  for (const x of [-0.85, 0.85])
    tube(rack, 'metal', [x, 256, 5.8], [x, 261.7, 5.8], 0.035, metal, 8);
  for (let row = 0; row < 8; row++)
    for (const side of [-1, 1]) {
      const y = 256.4 + row * 0.68;
      beam(rack, 'metal', [0, y, 4.1], [side * 1.3, y, 6.15], 0.11, 0.11, metal);
      beam(rack, 'metal', [side * 1.3, y, 6.15], [side * 1.68, y + 0.35, 6.85], 0.16, 0.13, white);
      beam(rack, 'metal', [side * 1.3, y, 6.15], [side * 0.92, y - 0.35, 6.85], 0.16, 0.13, white);
    }
  for (const y of [45.72, 91.44, 137.16, 182.88, 228.6, 272])
    for (const a of [0, Math.PI]) {
      const g = transform(out, a),
        r = radius(y);
      box(g, 'metal', [-0.22, y, r - 0.04], [0.22, y + 0.15, r + 0.4], metal);
      box(g, 'metal', [-0.12, y + 0.15, r + 0.08], [0.12, y + 0.37, r + 0.31], [0.63, 0.12, 0.08]);
    }
}

function baseDetails(out) {
  const y = 45.7,
    r = radius(y) + 0.95;
  annulus(out, 'metal', radius(y), r, y - 0.16, y, metal, 96);
  railing(out, y, r - 0.08, 48);
  for (let i = 0; i < 16; i++) {
    const a = (tau * i) / 16;
    beam(
      out,
      'metal',
      at(a, y - 1.6, radius(y - 1.6)),
      at(a, y - 0.15, r - 0.15),
      0.1,
      0.12,
      metal,
    );
    const diameter = [0.42, 0.58, 0.9, 0.65, 1.1, 0.38, 0.55, 0.48][i % 8];
    dish(out, a, y + 0.9, r + 0.05, diameter);
  }
  dish(out, Math.PI / 2, 36, radius(36) + 3, 1.2);
  // Small steel entrance cage visible in the dated ground-level photograph.
  for (const x of [-1.8, 1.8])
    for (const z of [11.7, 13.6]) beam(out, 'metal', [x, 0, z], [x, 4.4, z], 0.1, 0.1, metal);
  for (const z of [11.7, 13.6])
    beam(out, 'metal', [-1.85, 4.4, z], [1.85, 4.4, z], 0.15, 0.15, metal);
  for (const x of [-1.8, 1.8])
    beam(out, 'metal', [x, 4.4, 11.7], [x, 4.4, 13.6], 0.15, 0.15, metal);
  for (let x = -1.7; x <= 1.7; x += 0.14)
    beam(out, 'metal', [x, 4.4, 11.7], [x, 4.4, 13.6], 0.032, 0.045, metal);
  for (const side of [-1, 1])
    for (let z = 11.8; z < 13.6; z += 0.18)
      tube(out, 'metal', [side * 1.8, 0.1, z], [side * 1.8, 4.4, z], 0.014, metal, 6);
  for (let y = 0.25; y < 4.4; y += 0.25)
    for (const x of [-1.8, 1.8]) tube(out, 'metal', [x, y, 11.7], [x, y, 13.6], 0.014, metal, 6);
  // Two trough panels above the cabin; these are antennas, not shaft windows.
  const west = transform(out, -Math.PI / 2);
  for (const y of [269.5, 272]) {
    box(west, 'metal', [-0.9, y, 3.3], [0.9, y + 0.65, 3.48], white);
    for (const x of [-0.74, 0.74])
      beam(west, 'metal', [x, y + 0.3, 3], [x, y + 0.3, 3.4], 0.05, 0.06, metal);
  }
}
function build(out) {
  shaft(out);
  turret(out);
  lowerPlatforms(out);
  aerials(out);
  baseDetails(out);
}
export const emleyMoor = {
  id: 'n1006_emley_moor_transmitting_station',
  planId: 'N1006',
  title: 'Emley Moor transmitting station',
  wikidata: 'Q638586',
  build,
  authoringFile: 'emley-moor-model.mjs',
  size: [28, 319, 28],
  previewCamera: { position: [260, 165, 430], lookAt: [0, 157, 0], fov: 42 },
  decorateMesh(mesh) {
    smoothMeshNormals(mesh, ['wall'], 5);
    compactAuthoredMesh(mesh);
  },
  brief:
    'Individual tapered concrete broadcasting tower, 20-bay glazed turret, four lower cantilever platforms, antenna mounting rings and modern shortened two-stage radome. True shaft-door recesses, cabin windows, panel frames, safety rails, ladders and obstruction lights use shared procedural surfaces.',
  front:
    '+Z is the provisional main entrance, with the lower GPO platform stack on +X; compass orientation awaits site review',
  origin: 'Center of the mapped tower footprint, Y=0 at ground contact',
  refs: [
    'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-1972-issue-1.pdf',
    'https://historicengland.org.uk/listing/the-list/list-entry/1350339',
    'https://www.arqiva.com/news/end-of-an-era-emley-moor',
    'https://tx.mb21.co.uk/gallery/gallerypage.php?txid=336&pageid=4299',
    'https://tx.mb21.co.uk/gallery/gallerypage.php?txid=336&pageid=4370',
    'https://tx.mb21.co.uk/gallery/gallerypage.php?txid=336&pageid=32',
    'https://tx.mb21.co.uk/gallery/gallerypage.php?txid=336&pageid=1851',
    'https://www.openstreetmap.org/way/476925020',
  ],
  facts: {
    concreteHeightMeters: 274.32,
    originalOverallHeightMeters: 330.4,
    baseDiameterMeters: 24.38,
    topDiameterMeters: 6.4,
    originalTurretFloorMeters: 263.6,
    turretRadialBays: 20,
    windowSizeMeters: [1.8, 1.8],
    reportedPost2021HeightMeters: 319,
    originalLowerRadomeDiameterMeters: 3.66,
    originalUpperRadomeDiameterMeters: 1.52,
    originalMastHeightsMeters: [30.48, 25.6],
    originalWallThicknessMeters: [0.533, 0.35],
    heightConflict:
      'Arqiva 2023 and Historic England retain about 330.4 m; the dated photographic survey reports 319 m after the 2021 antenna rebuild. Current model follows its visibly shortened top, with approximate segment heights.',
  },
  scaleBasis:
    'Arup original sections set concrete dimensions and cabin rhythm; dated February/September 2023 photographs set the current antenna envelope and mounting details. The mapped circular footprint supplies a center but its 17.6 m diameter conflicts with the published 24.38 m base; it is not a sizing source.',
  geographicProposal: {
    anchor: [-1.664470242105263, 53.61206580526316],
    heading: 0,
    elevationMode: 'terrain-contact',
    status: 'preview-proposal',
    source: 'https://www.openstreetmap.org/way/476925020',
    evidence:
      'Named communication tower inside the exact-QID Emley Moor station parcel. Mean ring center; the circular outline cannot supply entrance azimuth.',
    limitations:
      'Named tower identity must be bound separately from the QID site polygon. Site entrance and platform azimuth, dated antenna dimensions and terrain fit remain pending.',
  },
  limits: [
    'The modern radome transition heights are scaled estimates from dated 2023 photographs, not fabrication dimensions. Both historical and current-height claims remain explicit.',
    'Turret external radius/height, equipment positions, lift-joint rhythm, doors and platforms are detailed reconstructions. Exact current antenna inventory and compass phases remain pending.',
    'The lower antenna gallery and small entrance cage follow 2011 photos; the upper array follows 2023 photos. Current ground equipment, independent station buildings, fences and cable ducts need coordinated site review.',
    'Map ring is smaller than the engineering base. Geographic approval requires resolving its envelope and validating site azimuth and ground datum.',
  ],
  cameras: [
    { name: 'complete-tower', position: [340, 168, 440], lookAt: [0, 157, 0] },
    { name: 'entrance-and-base', position: [26, 12, 42], lookAt: [0, 7, 0] },
    { name: 'lower-platforms', position: [40, 41, 25], lookAt: [0, 36, 0] },
    { name: 'turret-front', position: [24, 268, 36], lookAt: [0, 262, 0] },
    { name: 'turret-rear', position: [-24, 270, -36], lookAt: [0, 263, 0] },
    { name: 'antenna-mounts', position: [16, 257, -22], lookAt: [0, 257, 0] },
    { name: 'modern-radome', position: [26, 297, 37], lookAt: [0, 297, 0] },
    { name: 'upper-collar', position: [8, 300, 10], lookAt: [0, 299, 0] },
    { name: 'far-silhouette', position: [-620, 160, 820], lookAt: [0, 158, 0] },
  ],
};
