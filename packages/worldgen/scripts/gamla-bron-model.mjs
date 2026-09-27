/** Original detailed exterior of Gamla bron, Umeå (Q3603782), based on cited evidence. */
import { beam, cross, loft, normalize, sphere } from './authored-structure-mesh.mjs';
import { box, colors, quad, tube } from './structure-mesh.mjs';

export const gamlaBronStudy = {
  id: 'N0003',
  key: 'gamla_bron',
  title: 'Gamla bron, Umeå',
  assetId: 'molen.worldgen.structure.n0003_gamla_bron',
  size: [309, 14.2, 8.45],
  visualBrief:
    'Ten shallow polygonal bowstring steel-truss spans above a narrow pedestrian deck, carried on open X-braced steel trestles and coursed masonry piers; riveted structural flanges, deck joists, three-bar parapets, the visible utility main, pole line and low lighting fittings.',
  referencePages: [
    'https://lm.umea.se/namnkarta/poi/169FBA25/GamlaBron',
    'https://cust.kulturhotell.se/c57/files/original/d159921d56a1108490233d10d341a16a.pdf',
    'https://www.designatljus.eu/projekt/gamla-bron-umea',
    'https://via.tt.se/pressmeddelande/3317479/gamla-bron-i-umea-tands-upp-i-ukrainas-farger?publisherId=1422393',
    'https://commons.wikimedia.org/wiki/File:Gamla_bron,_Ume%C3%A5,_2023-10-16,_fr%C3%A5n_sidan.jpg',
    'https://commons.wikimedia.org/wiki/File:Gamla_bron_Ume%C3%A5_2007-06-24.jpg',
    'https://www.openstreetmap.org/way/454463632',
  ],
  sourceFacts: {
    identity: 'Wikidata Q3603782, Umeå, Sweden; not another similarly named old bridge.',
    nominalLengthMeters: {
      value: 301,
      basis:
        'Broar i Västerbottens län, page 33; also the lighting contractor project description.',
    },
    spanCount: {
      value: 10,
      basis:
        'Broar i Västerbottens län, page 33; the municipality also describes ten illuminated arch pairs in its 2022 release.',
    },
    openingYear: { value: 1863, basis: 'Umeå municipal place-name register.' },
    currentSteelSuperstructureDate: {
      value: '1894–1895',
      basis: 'Lighting contractor account and heritage bridge inventory.',
    },
    mappedEnvelope: {
      length: 309.007,
      width: 6.695,
      basis:
        'OSM way/454463632, exact wikidata tag; map-derived envelope includes end treatment and is not a surveyed engineering width.',
    },
    observedConstruction:
      '2023 original photograph by Axel Pettersson and 2022 municipality photograph show bowed upper truss chords, steel trestles above masonry, riveted/bolted gussets, large pipe below the deck, utility poles and a wire.',
  },
  reconstructedDimensions: {
    clearDeckWidthMeters: 5.5,
    overallDeckWidthMeters: 6.7,
    superstructureSpanMeters: 30.1,
    deckHeightAboveModelDatumMeters: 5.8,
    trussRiseMeters: 3.5,
    exposedMasonryHeightMeters: 2.35,
    pierWidthAlongBridgeMeters: 3.7,
    pierLengthAcrossBridgeMeters: 8.4,
    utilityMainDiameterMeters: 0.82,
    basis:
      'Photo-proportioned visual reconstruction, not measured sections. Equal 30.1 m span division follows the published 301 m total; individual pier stations, vertical grade and member sizes need drawings or survey.',
  },
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X',
    transverse: '+Z',
    origin:
      'Center of the published 301 m superstructure horizontally; Y=0 is an arbitrary exposed-pier/water reference, not a known geodetic datum.',
  },
  limitations: [
    'The 301 m nominal structural length and 309.007 m mapped envelope are retained separately. Four-meter approach/abutment extensions at each end are a visual reconstruction, not proof of the exact endpoint relationship.',
    'Width, height, individual span/pier stationing, stone courses, steel member sections, rivet pattern, pipe fittings and pole spacing are proportioned from photographs and remain unverified.',
    'No historic timber reconstruction, proposed 2026 architectural intervention, colored temporary festival lighting, embedded reference photos, submerged foundations or engineering collision model is included.',
    'Detailed original exterior geometry is a production study. Maximum-fidelity weathering/material review, image review, measured vertical placement and actual terrain fit remain pending.',
  ],
};

const steel = [0.6, 0.66, 0.63],
  darkSteel = [0.29, 0.35, 0.34],
  flange = [0.66, 0.7, 0.67];
const masonry = [0.34, 0.34, 0.3],
  mortar = [0.42, 0.42, 0.37],
  wood = [0.32, 0.3, 0.25];
const deck = 5.8,
  half = 150.5,
  span = 30.1,
  side = 2.83;

function iBeam(out, a, b, width, depth, color = steel) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const other = cross(axis, across);
  const thickness = Math.min(0.045, depth * 0.14);
  beam(out, 'trim', a, b, thickness, depth, color);
  for (const sign of [-1, 1]) {
    const aa = a.map((v, i) => v + other[i] * sign * (depth / 2 - thickness / 2));
    const bb = b.map((v, i) => v + other[i] * sign * (depth / 2 - thickness / 2));
    beam(out, 'trim', aa, bb, width, thickness, color);
  }
}

function capsule(y, width, length, cx = 0) {
  // Rounded riverward pier ends: two semicircles connected by long straight faces.
  const r = width / 2,
    straight = length / 2 - r,
    points = [];
  for (const sign of [1, -1])
    for (let i = 0; i <= 10; i++) {
      const a = (sign === 1 ? 0 : Math.PI) + (i / 10) * Math.PI;
      points.push([cx + Math.cos(a) * r, y, sign * straight + Math.sin(a) * r]);
    }
  return points.reverse();
}

function pier(out, x, index) {
  // Course seams are real geometric strips; block colors remain muted, without baked shadows.
  for (let course = 0; course < 7; course++) {
    const y0 = course * 0.335,
      y1 = y0 + 0.315;
    const width = 3.7 - course * 0.027,
      length = 8.4 - course * 0.04;
    loft(
      out,
      'foundation',
      [capsule(y0, width, length, x), capsule(y1, width - 0.017, length - 0.02, x)],
      course % 3 === 0 ? [0.38, 0.38, 0.33] : masonry,
    );
    const ring = capsule(y0, width + 0.009, length + 0.009, x);
    // Bed joint and offset vertical joints, conforming to the rounded ends.
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      tube(out, 'foundation', ring[i], ring[j], 0.012, mortar, 4);
    }
    for (const z of [-2.25, -1.05, 0.15, 1.35, 2.55])
      for (const face of [-1, 1]) {
        const offset = (course % 2) * 0.55;
        tube(
          out,
          'foundation',
          [x + face * (width / 2 + 0.008), y0, z - offset],
          [x + face * (width / 2 + 0.008), y1, z - offset],
          0.013,
          mortar,
          4,
        );
      }
    for (const sign of [-1, 1])
      for (const fraction of [0.15, 0.4, 0.65, 0.9]) {
        const angle = (sign === 1 ? 0 : Math.PI) + fraction * Math.PI;
        const z = sign * (length / 2 - width / 2) + (Math.sin(angle) * width) / 2;
        const xx = x + (Math.cos(angle) * width) / 2;
        tube(out, 'foundation', [xx, y0, z], [xx, y1, z], 0.014, mortar, 4);
      }
  }
  loft(out, 'foundation', [capsule(2.345, 3.8, 8.45, x), capsule(2.57, 3.8, 8.45, x)], masonry);
  // Four built-up trestle posts, gusseted X-bracing and top bearing plates.
  for (const dx of [-1.25, 1.25])
    for (const z of [-2.85, 2.85]) {
      box(out, 'trim', [x + dx - 0.28, 2.57, z - 0.28], [x + dx + 0.28, 2.73, z + 0.28], darkSteel);
      iBeam(out, [x + dx, 2.73, z], [x + dx, 4.94, z], 0.28, 0.31, steel);
      box(out, 'trim', [x + dx - 0.34, 4.93, z - 0.36], [x + dx + 0.34, 5.11, z + 0.36], darkSteel);
      for (const bx of [-0.2, 0.2])
        for (const bz of [-0.2, 0.2])
          tube(
            out,
            'trim',
            [x + dx + bx, 2.71, z + bz],
            [x + dx + bx, 2.78, z + bz],
            0.035,
            colors.steel,
            8,
          );
    }
  for (const dx of [-1.25, 1.25]) {
    for (const y of [2.85, 4.76]) iBeam(out, [x + dx, y, -2.85], [x + dx, y, 2.85], 0.16, 0.16);
    for (const direction of [-1, 1])
      iBeam(out, [x + dx, 2.83, direction * 2.85], [x + dx, 4.78, -direction * 2.85], 0.13, 0.12);
  }
  for (const z of [-2.85, 2.85]) {
    for (const direction of [-1, 1])
      iBeam(out, [x + direction * 1.25, 2.85, z], [x - direction * 1.25, 4.8, z], 0.11, 0.11);
    box(out, 'trim', [x - 0.18, 3.69, z - 0.08], [x + 0.18, 3.95, z + 0.08], flange);
  }
  // Utility pole line remains visible in the municipality 2022 and original 2023 photographs.
  const px = x + 1.8,
    pz = 3.61;
  tube(out, 'trim', [px, 2.7, pz], [px, 14.2, pz], 0.09, [0.39, 0.34, 0.25], 12);
  for (const y of [5.35, 13.6]) {
    tube(out, 'trim', [px, y, pz], [px, y, pz - 0.4], 0.028, darkSteel, 8);
    sphere(out, 'trim', [px, y, pz - 0.42], [0.065, 0.06, 0.065], [0.22, 0.25, 0.23], 10, 6);
  }
  if (index < 9)
    for (let j = 0; j < 12; j++) {
      const t0 = j / 12,
        t1 = (j + 1) / 12;
      const point = (t) => [px + span * t, 13.61 - 0.55 * 4 * t * (1 - t), pz - 0.42];
      tube(out, 'trim', point(t0), point(t1), 0.014, darkSteel, 5);
    }
}

function gusset(out, x, y, z) {
  box(out, 'trim', [x - 0.2, y - 0.2, z - 0.032], [x + 0.2, y + 0.2, z + 0.032], flange);
  for (const dx of [-0.13, 0.13])
    for (const dy of [-0.13, 0.13]) {
      tube(
        out,
        'trim',
        [x + dx, y + dy, z - 0.058],
        [x + dx, y + dy, z + 0.058],
        0.026,
        darkSteel,
        8,
      );
    }
}

export function buildGamlaBron(out) {
  // Tightly laid transverse deck boards and exposed joists beneath the walkway.
  for (let x = -half; x < half; x += 0.28) {
    const end = Math.min(half, x + 0.271);
    box(
      out,
      'roof',
      [x, deck - 0.14, -3.15],
      [end, deck, 3.15],
      Math.round((x + half) / 0.28) % 7 === 0 ? [0.37, 0.35, 0.3] : wood,
    );
  }
  for (const z of [-3.05, -1.5, 0, 1.5, 3.05])
    iBeam(out, [-half, deck - 0.47, z], [half, deck - 0.47, z], 0.22, 0.52, darkSteel);
  for (let x = -half; x <= half; x += span / 10) {
    iBeam(out, [x, deck - 0.7, -3.25], [x, deck - 0.7, 3.25], 0.16, 0.32, darkSteel);
    for (const z of [-3.18, 3.18]) {
      const target = z < 0 ? -2.7 : 2.7;
      iBeam(out, [x, deck - 0.18, z], [x, deck - 0.8, target], 0.09, 0.1, steel);
    }
  }
  // The single large river-side pipe and narrow return pipe are directly visible in the 2023 reference.
  for (const [z, r] of [
    [3.03, 0.41],
    [-2.95, 0.12],
  ]) {
    tube(out, 'trim', [-half, 4.45, z], [half, 4.45, z], r, [0.36, 0.42, 0.4], 32);
    for (let x = -half + 2; x < half; x += span / 5) {
      tube(out, 'trim', [x - 0.05, 4.45, z], [x + 0.05, 4.45, z], r + 0.035, darkSteel, 24);
      iBeam(out, [x, 5.05, z], [x, 4.03, z], 0.07, 0.07);
    }
  }
  const rise = [0.12, 1.36, 2.28, 2.96, 3.36, 3.5, 3.36, 2.96, 2.28, 1.36, 0.12];
  for (let bay = 0; bay < 10; bay++) {
    const start = -half + bay * span;
    for (const sign of [-1, 1]) {
      const z = sign * side;
      for (let i = 0; i < 10; i++) {
        const x0 = start + (i * span) / 10,
          x1 = start + ((i + 1) * span) / 10;
        iBeam(out, [x0, deck + rise[i], z], [x1, deck + rise[i + 1], z], 0.24, 0.29);
        if (i > 0) iBeam(out, [x0, deck + 0.06, z], [x0, deck + rise[i], z], 0.1, 0.14);
        // Diagonal lattice webs match the open triangular rhythm of the shallow bowstrings.
        if (i < 5) iBeam(out, [x0, deck + 0.04, z], [x1, deck + rise[i + 1], z], 0.07, 0.095);
        else iBeam(out, [x0, deck + rise[i], z], [x1, deck + 0.04, z], 0.07, 0.095);
        gusset(out, x0, deck + rise[i], z + sign * 0.16);
        if (i > 0) gusset(out, x0, deck + 0.13, z + sign * 0.16);
      }
      gusset(out, start + span, deck + rise[10], z + sign * 0.16);
    }
  }
  // Three horizontal safety rails stay outside the bowstring structure.
  for (const sign of [-1, 1]) {
    const z = sign * 3.23;
    for (const h of [0.34, 0.75, 1.17])
      beam(out, 'trim', [-half, deck + h, z], [half, deck + h, z], 0.047, 0.055, steel);
    for (let x = -half; x <= half; x += 1.505)
      beam(out, 'trim', [x, deck, z], [x, deck + 1.2, z], 0.053, 0.055, steel);
    // Low downward-facing fittings, leaving the old overhead street lamps off the contemporary model.
    for (let x = -half + 1.5; x < half; x += span / 4) {
      box(
        out,
        'trim',
        [x - 0.16, deck + 0.65, z - 0.075],
        [x + 0.16, deck + 0.75, z + 0.075],
        darkSteel,
      );
      quad(
        out,
        'window',
        [
          [x - 0.125, deck + 0.648, z - 0.05],
          [x + 0.125, deck + 0.648, z - 0.05],
          [x + 0.125, deck + 0.648, z + 0.05],
          [x - 0.125, deck + 0.648, z + 0.05],
        ],
        [0, -1, 0],
        [0.72, 0.65, 0.44],
      );
    }
  }
  for (let i = 1; i < 10; i++) pier(out, -half + i * span, i);
  // Stone abutments and compact end ramps fill the nominal-vs-mapped length difference.
  for (const sign of [-1, 1]) {
    const center = sign * (half + 1.9);
    box(out, 'foundation', [center - 2.1, 0, -4.2], [center + 2.1, deck - 0.2, 4.2], masonry);
    box(out, 'roof', [center - 2.1, deck - 0.2, -3.35], [center + 2.1, deck, 3.35], colors.road);
    for (const z of [-3.23, 3.23]) {
      for (const y of [deck + 0.34, deck + 0.75, deck + 1.17])
        beam(out, 'trim', [center - 2.1, y, z], [center + 2.1, y, z], 0.047, 0.055, steel);
      for (const x of [center - 2, center, center + 2])
        beam(out, 'trim', [x, deck, z], [x, deck + 1.2, z], 0.055, 0.055, steel);
    }
    for (let y = 0.35; y < deck - 0.3; y += 0.45)
      for (const z of [-4.205, 4.205])
        beam(out, 'foundation', [center - 2.1, y, z], [center + 2.1, y, z], 0.018, 0.019, mortar);
  }
}
