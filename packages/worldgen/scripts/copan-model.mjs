/** Copan: mapped curved slab, distinct rear systems and reusable open stair/screen meshes. */
import { readFileSync } from 'node:fs';
import { beam, loft } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(structureSourcePath('n0223_edificio_copan', 'map-frame.json'));
const frame = JSON.parse(frameBytes),
  p = frame.geometry.outline;
const white = [0.85, 0.84, 0.8],
  gray = [0.62, 0.63, 0.6];
const iron = [0.34, 0.38, 0.37],
  silver = [0.62, 0.66, 0.66];
const dark = [0.12, 0.15, 0.16],
  glass = [0.38, 0.47, 0.5];
const interval = 2.95,
  base = 16.5,
  floors = 32,
  roofY = base + floors * interval;
const tau = 2 * Math.PI;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const area = (poly) =>
  poly.reduce((s, a, i) => {
    const b = poly[(i + 1) % poly.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const clockwise = (poly) => (area(poly) < 0 ? poly : poly.toReversed());

function cap(out, plan, y, slot, color, down = false) {
  const poly = clockwise(plan),
    ids = poly.map((_, i) => i),
    tris = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  while (ids.length > 3) {
    let found = false;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[(i + ids.length - 1) % ids.length],
        b = ids[i],
        c = ids[(i + 1) % ids.length];
      if (cross(poly[a], poly[b], poly[c]) >= -1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross(poly[a], poly[b], poly[k]) < 1e-8 &&
            cross(poly[b], poly[c], poly[k]) < 1e-8 &&
            cross(poly[c], poly[a], poly[k]) < 1e-8,
        )
      )
        continue;
      tris.push([a, b, c]);
      ids.splice(i, 1);
      found = true;
      break;
    }
    if (!found) throw new Error('Copan: invalid floor polygon');
  }
  tris.push(ids);
  for (const t of tris) {
    const q = t.map((i) => [poly[i][0], y, poly[i][1]]);
    triangle(out, slot, down ? q.toReversed() : q, color);
  }
}
function slab(out, plan, bottom, top, slot = 'concrete', color = white) {
  const poly = clockwise(plan);
  loft(
    out,
    slot,
    [poly.map(([x, z]) => [x, bottom, z]), poly.map(([x, z]) => [x, top, z])],
    color,
    { cap: false },
  );
  cap(out, poly, bottom, slot, color, true);
  cap(out, poly, top, slot, color);
}
function samples(line, step) {
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push(lengths.at(-1) + dist(line[i - 1], line[i]));
  const count = Math.ceil(lengths.at(-1) / step),
    result = [];
  let k = 1;
  for (let i = 0; i <= count; i++) {
    const s = (lengths.at(-1) * i) / count;
    while (k < line.length - 1 && lengths[k] < s) k++;
    result.push(mix(line[k - 1], line[k], (s - lengths[k - 1]) / (lengths[k] - lengths[k - 1])));
  }
  return result;
}
function inward(line, amount) {
  return line.map((v, i) => {
    const a = line[Math.max(0, i - 1)],
      b = line[Math.min(line.length - 1, i + 1)],
      l = dist(a, b);
    return [v[0] - ((b[1] - a[1]) * amount) / l, v[1] + ((b[0] - a[0]) * amount) / l];
  });
}
// Original outline is counterclockwise. Its left normal points into the building.
const front = samples(p.slice(0, 65), 0.72),
  frontGlass = inward(front, 1.28);
const rear = [
  ...p.slice(65, 67),
  ...p.slice(82, 109),
  ...p.slice(136, 163),
  ...p.slice(179, 181),
  ...p.slice(196, 198),
];
const plate = [...frontGlass, ...rear];
function placement(a, b, y = 0) {
  const mid = mix(a, b, 0.5);
  return { translation: [mid[0], y, mid[1]], angle: -Math.atan2(a[1] - b[1], a[0] - b[0]) };
}
function edge(out, a, b, y = 0) {
  return transform(out, placement(a, b).angle, placement(a, b, y).translation);
}
function ribbon(out, line, depth, y, h, slot = 'mosaic', color = white) {
  const inside = inward(line, depth);
  for (let i = 0; i < line.length - 1; i++)
    slab(out, [line[i], line[i + 1], inside[i + 1], inside[i]], y, y + h, slot, color);
}
const windowTint = (i, variant) => {
  const n = ((Math.imul(i + 19 + variant * 7, 48271) >>> 0) % 37) / 36;
  return glass.map((v) => v * (0.86 + n * 0.26));
};
function windowBay(out, width, height, variant, index) {
  box(
    out,
    'glass',
    [-width / 2 + 0.035, 0.13, -0.1],
    [width / 2 - 0.035, height - 0.15, -0.04],
    windowTint(index, variant),
  );
  for (const x of [-width / 2, 0, width / 2])
    box(out, 'metal', [x - 0.024, 0.1, -0.09], [x + 0.024, height - 0.1, 0.03], silver);
  for (const y of [0.1, 0.94, 1.93, height - 0.1])
    box(out, 'metal', [-width / 2, y, -0.09], [width / 2, y + 0.035, 0.03], silver);
}
const rearSamples = samples(rear, 2.65);
const rearBays = rearSamples.slice(0, -1).map((a, i) => {
  const b = rearSamples[i + 1];
  return { a, b, frame: placement(a, b), width: dist(a, b), screen: (a[0] + b[0]) / 2 < 5 };
});
function residentialFloor(out, variant = 0) {
  slab(out, plate, 0, 0.16, 'concrete', white);
  const panels = samples(frontGlass, 1.38);
  for (let i = 0; i < panels.length - 1; i++)
    windowBay(
      edge(out, panels[i], panels[i + 1]),
      dist(panels[i], panels[i + 1]),
      interval,
      variant,
      i,
    );
  for (const [i, bay] of rearBays.entries()) {
    const o = transform(out, bay.frame.angle, bay.frame.translation),
      w = bay.width;
    if (!bay.screen) windowBay(o, w, interval, variant, 100 + i);
    else {
      // The perforated panel is a separate reusable mesh, with a real recessed void behind it.
      box(o, 'shadow', [-w / 2 + 0.11, 0.16, -0.65], [w / 2 - 0.11, interval - 0.15, -0.61], dark);
      for (const s of [-1, 1])
        box(
          o,
          'mosaic',
          [(s * w) / 2 - 0.1, 0.16, -0.55],
          [(s * w) / 2 + 0.1, interval, 0.26],
          white,
        );
      box(o, 'glass', [-1.13, 2.08, -0.25], [1.13, 2.73, -0.2], windowTint(i, variant));
      for (const x of [-1.15, 0, 1.15])
        box(o, 'metal', [x - 0.02, 2.06, -0.25], [x + 0.02, 2.76, -0.15], silver);
    }
    box(o, 'mosaic', [-w / 2, interval - 0.13, -0.4], [w / 2, interval, 0.16], gray);
  }
  for (const [a, b] of [
    [p[64], p[65]],
    [p[197], p[0]],
  ]) {
    const o = edge(out, a, b),
      w = dist(a, b);
    // End walls retain two narrow slit windows, with solid piers and recessed reveals.
    for (const [lo, hi] of [
      [-w / 2, -3.6],
      [-0.65, 0.65],
      [3.6, w / 2],
    ])
      box(o, 'mosaic', [lo, 0, -0.5], [hi, interval, 0], white);
    for (const x of [-2.1, 2.1]) {
      box(o, 'mosaic', [x - 1.5, 0, -0.5], [x + 1.5, 1.8, 0], white);
      box(o, 'mosaic', [x - 1.5, 2.16, -0.5], [x + 1.5, interval, 0], white);
      box(o, 'glass', [x - 1.47, 1.82, -0.13], [x + 1.47, 2.14, -0.09], dark);
    }
  }
}
function briseFloor(out, openBand = false) {
  for (const y of openBand ? [0.03] : [0.03, 1.01, 1.99]) ribbon(out, front, 0.98, y, 0.115);
  // Brackets bridge the open air gap between the glazing and the inner edge of each blade.
  const supports = samples(front, 2.75),
    inner = inward(supports, 1.3);
  for (let i = 0; i < supports.length; i++)
    for (const y of openBand ? [0.04] : [0.04, 1.02, 2.0])
      beam(
        out,
        'metal',
        [supports[i][0], y, supports[i][1]],
        [inner[i][0], y, inner[i][1]],
        0.032,
        0.06,
        iron,
      );
}
function screenPanel(out) {
  const width = 2.3,
    height = 1.82,
    cols = 12,
    rows = 10,
    joint = 0.022;
  // Shared continuous rows and short vertical webs leave actual openings, including side reveals.
  for (let row = 0; row <= rows; row++) {
    const y = 0.19 + (row * height) / rows;
    box(out, 'mosaic', [-width / 2, y, -0.12], [width / 2, y + joint, 0.045], white);
  }
  for (let col = 0; col <= cols; col++)
    for (let row = 0; row < rows; row++) {
      const x = -width / 2 + (col * width) / cols,
        y = 0.19 + (row * height) / rows + joint;
      box(out, 'mosaic', [x, y, -0.12], [x + joint, y + height / rows - joint, 0.045], white);
    }
}
function stairFlight(out) {
  const radius = 1.79,
    core = 0.44,
    count = 20;
  const at = (r, a, y) => [r * Math.sin(a), y, r * Math.cos(a)];
  tube(out, 'concrete', [0, 0, 0], [0, interval, 0], core, white, 32);
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count,
      b = ((i + 1) * tau) / count,
      y = ((i + 1) * interval) / count;
    const plan = [];
    for (let j = 0; j <= 3; j++) {
      const q = at(radius, a + ((b - a) * j) / 3, 0);
      plan.push([q[0], q[2]]);
    }
    for (let j = 3; j >= 0; j--) {
      const q = at(core, a + ((b - a) * j) / 3, 0);
      plan.push([q[0], q[2]]);
    }
    slab(out, plan, y - 0.12, y, 'concrete', white);
    if (i > 0 && i < count - 1) {
      for (let j = 0; j < 3; j++) {
        const t = a + ((b - a) * j) / 3,
          yy = ((i + j / 3) * interval) / count;
        tube(
          out,
          'metal',
          at(radius - 0.035, t, yy),
          at(radius - 0.035, t, yy + 1.0),
          0.0125,
          iron,
          6,
        );
        tube(
          out,
          'metal',
          at(radius - 0.035, t, yy + 1.0),
          at(radius - 0.035, t + (b - a) / 3, yy + interval / count / 3 + 1),
          0.022,
          iron,
          8,
        );
      }
    }
  }
  box(out, 'concrete', [-0.62, -0.1, 0.35], [0.62, 0, 3.25], white);
  for (const x of [-0.61, 0.61]) {
    for (let z = 1.7; z <= 3.15; z += 0.24)
      tube(out, 'metal', [x, 0, z], [x, 1, z], 0.013, iron, 6);
    tube(out, 'metal', [x, 1, 1.7], [x, 1, 3.25], 0.022, iron, 8);
  }
}
const stairLocations = [
  { center: [61.858, 4.86], join: mix(p[66], p[82], 0.5) },
  { center: [-29.78, 1.97], join: mix(p[162], p[179], 0.5) },
  { center: [-46.35, 19.75], join: mix(p[180], p[196], 0.5) },
];
const liftPlan = p.slice(109, 136);
function liftTower(out) {
  slab(out, liftPlan, 0, roofY + 2.1, 'mosaic', white);
  for (let f = 0; f <= floors; f++) {
    const y = base + f * interval;
    const poly = [...liftPlan, liftPlan[0]];
    ribbon(out, poly, 0.12, y, 0.075, 'metal', iron);
  }
  // Individual windows face the service link; the capsule ends remain solid and curved.
  for (let f = 0; f < floors; f++) {
    const o = edge(out, p[109], p[135], base + f * interval);
    box(o, 'glass', [-1.05, 0.85, -0.14], [1.05, 1.8, 0.035], dark);
  }
}
function podium(out) {
  for (const y of [0.02, 4.65, 9.05, 13.45]) slab(out, plate, y, y + 0.24, 'concrete', gray);
  const bays = samples(frontGlass, 5.8);
  for (let i = 0; i < bays.length - 1; i++) {
    const o = edge(out, bays[i], bays[i + 1]),
      w = dist(bays[i], bays[i + 1]);
    for (const y of [0.25, 4.9, 9.3]) {
      const q = transform(o, 0, [0, y, 0]);
      windowBay(q, w - 0.25, 3.45, 2, i);
      box(q, 'wood', [-w / 2, 3.5, -0.65], [w / 2, 4.13, 0.04], [0.3, 0.23, 0.17]);
      if (y < 1) {
        for (const x of [-0.75, 0.75]) {
          box(q, 'metal', [x - 0.035, 0.06, 0.07], [x + 0.035, 2.9, 0.15], iron);
          tube(q, 'stainless', [x + 0.1, 1.02, 0.17], [x + 0.1, 1.53, 0.17], 0.018, silver, 8);
        }
      }
    }
    tube(o, 'concrete', [-w / 2, 0.25, -0.7], [-w / 2, base, -0.7], 0.27, white, 20);
  }
  slab(out, plate, 13.69, 14.12, 'concrete', white);
  ribbon(out, front, 1.28, base - 0.65, 0.65, 'concrete', white);
}
function roof(out) {
  slab(out, plate, roofY, roofY + 0.18, 'concrete', gray);
  ribbon(out, front, 0.28, roofY + 0.18, 0.95);
  ribbon(out, rear, 0.22, roofY + 0.18, 0.95);
  // Roof enclosures/platform position is an explicit reconstruction, not a map measurement.
  box(out, 'mosaic', [35, roofY + 0.18, -3.2], [49, 114.7, 6.8], white);
  box(out, 'concrete', [34.7, 114.7, -3.5], [49.3, 114.85, 7.1], gray);
  box(out, 'metal', [34.85, 114.85, -3.35], [49.15, 114.89, 6.95], [0.18, 0.39, 0.5]);
  for (const z of [-3.5, 6.95])
    box(out, 'metal', [34.7, 114.85, z], [49.3, 115, z + 0.15], [0.81, 0.65, 0.14]);
  for (const x of [34.7, 49.15])
    box(out, 'metal', [x, 114.85, -3.35], [x + 0.15, 115, 6.95], [0.81, 0.65, 0.14]);
  for (const [x, z] of [
    [-42, 0],
    [-23, -11],
    [5, 1],
  ]) {
    box(out, 'mosaic', [x - 2, roofY + 0.18, z - 3], [x + 2, roofY + 2.8, z + 3], gray);
    box(out, 'metal', [x - 2.2, roofY + 2.8, z - 3.2], [x + 2.2, roofY + 3.0, z + 3.2], silver);
  }
}
const floorInstances = Array.from({ length: floors }, (_, i) => ({
  translation: [0, base + i * interval, 0],
}));
const parts = [
  { name: 'podium-and-gallery', build: podium, instances: [{}] },
  { name: 'roof-and-decommissioned-platform', build: roof, instances: [{}] },
  { name: 'block-b-lift-tower', build: liftTower, instances: [{}] },
  ...[0, 1, 2, 3].map((v) => ({
    name: `residential-floor-${v}`,
    build: (o) => residentialFloor(o, v),
    instances: floorInstances.filter((_, i) => i % 4 === v),
    gpuInstances: true,
  })),
  {
    name: 'three-level-brise-unit',
    build: (o) => briseFloor(o),
    instances: floorInstances.filter((_, i) => i !== 15 && i !== 23),
    gpuInstances: true,
  },
  {
    name: 'open-transfer-brise-unit',
    build: (o) => briseFloor(o, true),
    instances: floorInstances.filter((_, i) => i === 15 || i === 23),
    gpuInstances: true,
  },
  {
    name: 'pierced-cobogo-panel',
    build: screenPanel,
    instances: floorInstances.flatMap((f) =>
      rearBays
        .filter((b) => b.screen)
        .map((b) => ({
          ...b.frame,
          translation: [b.frame.translation[0], f.translation[1], b.frame.translation[2]],
        })),
    ),
    gpuInstances: true,
  },
  {
    name: 'open-helical-stair-flight',
    build: stairFlight,
    instances: stairLocations.flatMap((s) =>
      floorInstances.map((f) => ({
        translation: [s.center[0], f.translation[1], s.center[1]],
        angle: Math.atan2(s.join[0] - s.center[0], s.join[1] - s.center[1]),
      })),
    ),
    gpuInstances: true,
  },
];

export const copan = {
  id: 'n0223_edificio_copan',
  planId: 'N0223',
  category: 'skyscraper',
  title: 'Edifício Copan',
  wikidata: 'Q632566',
  authoringFile: 'copan-model.mjs',
  build(out) {
    for (const part of parts)
      for (const instance of part.instances)
        part.build(transform(out, instance.angle ?? 0, instance.translation ?? [0, 0, 0]));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((part) => ({ ...part, glb: encode(part.build, part.name) })),
      'Molen original Copan component assembly',
    );
  },
  decorateMesh: compactAuthoredMesh,
  componentMap: { glass: 'copan_glass' },
  size: [133.3, 115, 43.5],
  previewCamera: { position: [-120, 90, -170], lookAt: [0, 55, 0], fov: 36 },
  front: 'Principal brise face follows the signed native map outline indices 0–64; +Y is up',
  origin: 'Centre of mapped exact-QID ground envelope; ground contact is provisional',
  brief:
    'Individually mapped S-shaped Copan with three brise blades per floor, separate glazed and perforated rear facades, real cobogo openings, open helical stair flights, a rounded lift tower, framed retail glazing, shared mosaic and separately assembled roof platform. Repeated details share GPU-instanced geometry.',
  facts: {
    residentialFloors: 32,
    heightMetersIBGE: 115,
    apartments: 1160,
    commercialUnits: 72,
    blocks: 6,
    helipadStatus: 'Decommissioned according to IBGE 2022 field report',
    mappedHeightMeters: 118.44,
    mappedLevels: 37,
    planEnvelopeMeters: [133.295, 43.44],
    reconstructedFloorBaseMeters: base,
    reconstructedFloorIntervalMeters: interval,
    roofDatumMeters: roofY,
    briseProjectionMeters: 0.98,
    glassSetbackMeters: 1.28,
    screenModuleMeters: [2.3 / 12, 1.82 / 10],
    sourceDimensionsCaution:
      'Floor datums, brise section, screen module and roof positions are explicit working reconstructions; the published plan scale conflict is unresolved.',
  },
  appearance: {
    state: 'Architectural facade reconstruction without temporary restoration netting',
    basis:
      'Primary conservation study and contractor photographs; not a claim that restoration has finished or that all tenant alterations have been surveyed.',
  },
  refs: [
    'https://www.oscarniemeyer.org.br/obra/pro042',
    'https://revistas.usp.br/posfau/article/download/162808/160906',
    'https://concrejato.com.br/portfolio/copan/',
    'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/35605-copan-recenseamento-no-maior-edificio-residencial-da-america-latina',
    'https://gestaourbana.prefeitura.sp.gov.br/noticias/prefeitura-de-sao-paulo-avanca-em-revitalizacao-do-centro-com-investimento-historico-para-requalificacao-do-edificio-copan/',
    'https://www.openstreetmap.org/way/8100248',
  ],
  scaleBasis:
    'Exact-QID map footprint for horizontal envelope; IBGE 115 m and 32 residential storeys for overall stack. Detailed floor/roof datums, brises, openings and podium are reconstructed and require dimensioned as-built evidence.',
  geographicProposal: {
    anchor: frame.anchor,
    heading: frame.heading,
    source: frame.sourceUrl,
    featureIds: ['way/8100248'],
    wikidataId: 'Q632566',
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: hashEvidenceText(frameBytes),
    orientationConfidence: 'map-derived; signed site review pending',
    evidence: 'Main slab and distinct rear projections retain the exact mapped local frame.',
    limitations:
      'Actual street slope, complete commercial podium boundary and signed facade registration have not been approved.',
  },
  limits: [
    'Maximum-fidelity approval remains pending: source height datums conflict, and floor intervals, transfer levels, brise sections, cobogo modules and roof equipment need dimensioned as-built evidence.',
    'Rear facade split, glazing subdivisions and tenant variation follow primary photos but are not a complete measured window inventory.',
    'The podium currently follows the residential envelope; the broader executed commercial/cinema envelope, curved corner terraces and real terrain slope require separate mapping.',
    'Spiral stairs have real treads, cores, landings and balustrades; precise riser counts, handedness and landings need further reference registration.',
    'Roof platform position and dimensions are reconstructed; no operational helipad claim is made. Temporary restoration netting, signs and advertisements are not included.',
    'Far-distance detail and GPU instancing must be checked in both portable and world-viewer captures before visual approval.',
  ],
  cameras: [
    { name: 'principal-brises', position: [0, 66, -73], lookAt: [0, 61, -9] },
    { name: 'brise-section', position: [-21, 43, -33], lookAt: [-21, 42, -20] },
    { name: 'rear-glazing', position: [40, 65, 52], lookAt: [36, 59, 10] },
    { name: 'rear-cobogos', position: [-36, 47, 29], lookAt: [-34, 43, 1] },
    { name: 'screen-reveals', position: [-22, 25, 5], lookAt: [-22, 24, -3.4] },
    { name: 'stair-treads', position: [-24, 39, 7], lookAt: [-29.8, 37, 2] },
    { name: 'stair-and-landings', position: [-45, 51, 40], lookAt: [-46.3, 43, 19.7] },
    { name: 'lift-tower', position: [17, 75, 52], lookAt: [4, 55, 15] },
    { name: 'gallery-entrances', position: [-20, 5, -40], lookAt: [-20, 3, -20] },
    { name: 'roof-platform', position: [60, 145, -32], lookAt: [40, 111, -5] },
    { name: 'roof-plan', position: [0, 310, 1], lookAt: [0, 0, 0] },
    { name: 'far-silhouette', position: [-440, 235, -570], lookAt: [0, 50, 0] },
  ],
};
