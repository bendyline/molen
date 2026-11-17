/**
 * Suzzallo Library, University of Washington: the 1926 Collegiate Gothic west wing on Red
 * Square (eleven tall pointed reading-room windows between buttresses carrying terra-cotta
 * figures and pinnacles, three portals, slate gable with copper cresting, end oriels), the
 * angled 1935 south wing in the same dress and the 1963 concrete-and-glass east wing, all on the
 * mapped footprint in footprint.json (+Z faces Red Square, +X runs south along the west front).
 */

import { readFileSync } from 'node:fs';
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  rgb,
  ribbon,
  spire,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  brick: rgb('b08c6a'),
  brickDark: rgb('9c7656'),
  stone: rgb('d3c7a9'),
  stoneShade: rgb('bdb197'),
  slate: rgb('596265'),
  copper: rgb('6d9b86'),
  stained: rgb('4b505c'),
  stainedWarm: rgb('5d5662'),
  door: rgb('3d302a'),
  figure: rgb('dacdb2'),
  concrete: rgb('bcb7ac'),
  deck: rgb('9b988f'),
  glass: rgb('46555e'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.5, metallic: 0.35 },
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88, metallic: 0 },
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.25, metallic: 0.2 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.7, metallic: 0.05 },
};

// Mapped west wing (footprint.json, feature 35185476291734): front line z = 47.13 from
// x = -34.14 to 32.22, rear line z = 28.0. Heights: reading-room windows 36 ft, eaves behind
// the parapet at 25.2 m, slate ridge at 33.5 m.
const W = { x0: -34.14, x1: 32.22, zBack: 28.0, zFront: 47.13, eave: 25.2, ridge: 33.5 };
const base = -1.5;

function figure(out, F, u, y, d) {
  fbox(out, 'stone', F, u - 0.42, u + 0.42, y - 0.25, y, d - 0.35, d + 0.15, col.stoneShade);
  fbox(out, 'stone', F, u - 0.27, u + 0.27, y, y + 1.45, d - 0.25, d + 0.05, col.figure);
  fbox(out, 'stone', F, u - 0.14, u + 0.14, y + 1.45, y + 1.78, d - 0.2, d, col.figure);
}

function buttress(out, F, u, { statue = true, top = W.eave } = {}) {
  fbox(out, 'brick', F, u - 0.78, u + 0.78, base, 12, 0, 1.75, col.brickDark);
  fbox(out, 'stone', F, u - 0.86, u + 0.86, 12, 12.45, 0, 1.85, col.stone);
  fbox(out, 'brick', F, u - 0.62, u + 0.62, 12.45, top - 3.2, 0, 1.2, col.brickDark);
  // Niche with a terra-cotta figure, a canopy and a pinnacle.
  fbox(out, 'stone', F, u - 0.7, u + 0.7, top - 3.2, top + 0.6, 0, 0.75, col.stone);
  if (statue) figure(out, F, u, top - 2.75, 1.15);
  fbox(out, 'stone', F, u - 0.72, u + 0.72, top + 0.6, top + 1.15, 0, 1.35, col.stone);
  const [x, , z] = F.P(u, 0, 0.62);
  spire(out, 'stone', [x, z], 0.68, 4, top + 1.15, 4.2, col.stone, { rotation: Math.PI / 4 });
}

function westWing(out) {
  const { x0, x1, zBack, zFront, eave, ridge } = W;
  const length = x1 - x0;
  // Body and plinth.
  fbox(
    out,
    'brick',
    facade([x0, zFront], [1, 0]),
    0,
    length,
    base,
    eave,
    -(zFront - zBack),
    0,
    col.brick,
  );
  fbox(
    out,
    'stone',
    facade([x0, zFront], [1, 0]),
    -0.1,
    length + 0.1,
    base,
    1.2,
    -(zFront - zBack) - 0.12,
    0.14,
    col.stoneShade,
  );
  const F = facade([x0, zFront], [1, 0]);
  const mid = length / 2;
  // Eleven reading-room bays between twelve buttresses.
  for (let k = 0; k < 12; k++) buttress(out, F, mid + (k - 5.5) * 5.5);
  for (let j = 0; j < 11; j++) {
    const u = mid + (j - 5) * 5.5;
    opening(out, F, u, 11.0, 3.9, 12.2, {
      head: 'pointed',
      rise: 3.1,
      glass: j % 2 ? col.stained : col.stainedWarm,
      frame: col.stone,
      frameSlot: 'stone',
      frameWidth: 0.32,
      frameDepth: 0.22,
      mullions: 2,
      transoms: 2,
      mullionColor: col.stone,
    });
    // University coats of arms under the sills.
    fbox(out, 'stone', F, u - 0.5, u + 0.5, 9.3, 10.4, 0, 0.16, col.stone);
    if (j >= 4 && j <= 6) {
      // Three west portals with Thought, Inspiration and Mastery above.
      opening(out, F, u, 0.0, 2.7, 6.0, {
        head: 'pointed',
        rise: 1.9,
        glass: col.door,
        glassSlot: 'door',
        frame: col.stone,
        frameSlot: 'stone',
        frameWidth: 0.55,
        frameDepth: 0.45,
        sill: false,
      });
      fbox(out, 'stone', F, u - 2.2, u + 2.2, 6.5, 7.0, 0, 0.5, col.stone);
      figure(out, F, u, 7.0, 0.42);
    } else {
      for (const du of [-1.05, 1.05]) {
        opening(out, F, u + du, 2.2, 1.25, 3.3, {
          head: 'tudor',
          glass: col.glass,
          frame: col.stone,
          frameSlot: 'stone',
          frameWidth: 0.16,
          mullions: 0,
        });
        opening(out, F, u + du, 6.4, 1.25, 1.9, {
          glass: col.glass,
          frame: col.stone,
          frameSlot: 'stone',
          frameWidth: 0.14,
        });
      }
    }
  }
  // String course and pierced parapet.
  fbox(out, 'stone', F, 0, length, 10.6, 11.0, 0, 0.22, col.stone);
  fbox(out, 'stone', F, -0.2, length + 0.2, eave - 0.55, eave, -0.25, 0.3, col.stone);
  for (let u = 0.6; u < length - 0.4; u += 1.25)
    fbox(out, 'stone', F, u - 0.3, u + 0.3, eave, eave + 0.95, -0.2, 0.18, col.stone);
  // Rear (courtyard) face: plain windows where the court leaves it open.
  const R = facade([x1, zBack], [-1, 0]);
  for (let u = 3; u < 26; u += 4.6) {
    opening(out, R, u, 3.0, 1.8, 3.2, {
      glass: col.glass,
      frame: col.stone,
      frameSlot: 'stone',
      frameWidth: 0.16,
    });
    opening(out, R, u, 13.0, 2.4, 8.5, {
      head: 'pointed',
      glass: col.stained,
      frame: col.stone,
      frameSlot: 'stone',
      frameWidth: 0.2,
      mullions: 1,
    });
  }
  // Slate gable with copper cresting along the ridge.
  const zMid = (zBack + zFront) / 2;
  gableRoof(out, 'slate', [x0, zMid], [x1, zMid], zFront - zBack - 0.6, eave, ridge, col.slate, {
    overhang: 0.2,
    endSlot: 'brick',
    endColor: col.brick,
  });
  fbox(
    out,
    'copper',
    facade([x0, zMid], [1, 0]),
    0.3,
    length - 0.3,
    ridge - 0.05,
    ridge + 0.75,
    -0.09,
    0.09,
    col.copper,
  );
  for (const x of [x0 + 0.3, x1 - 0.3]) {
    // Gable-end finials.
    spire(out, 'copper', [x, zMid], 0.35, 4, ridge + 0.6, 2.6, col.copper, {
      rotation: Math.PI / 4,
    });
  }
  // End pinnacles on the front corners.
  for (const u of [-0.2, length + 0.2]) {
    fbox(out, 'stone', F, u - 0.85, u + 0.85, base, eave + 1.2, -1.2, 0.7, col.stone);
    const [x, , z] = F.P(u, 0, -0.25);
    spire(out, 'stone', [x, z], 0.95, 4, eave + 1.2, 5.2, col.stone, { rotation: Math.PI / 4 });
  }
}

/** Half-octagon reading-room oriel on the wing end at x = wallX, bulging toward `sign`. */
function oriel(out, wallX, sign) {
  const ring = [
    [wallX, 32.25],
    [wallX + sign * 1.19, 32.23],
    [wallX + sign * 5.16, 35.17],
    [wallX + sign * 5.29, 40.3],
    [wallX + sign * 1.09, 43.24],
    [wallX, 43.26],
  ];
  const r = sign < 0 ? ring : ring.slice().reverse();
  extrude(out, 'brick', r, base, W.eave - 0.4, col.brick, {
    topSlot: 'stone',
    topColor: col.stone,
  });
  const apex = [wallX + sign * 1.6, W.eave + 5.2, 37.75];
  for (let i = 0; i + 1 < r.length; i++) {
    const a = r[i],
      b = r[i + 1];
    const edge = facade(a, [b[0] - a[0], b[1] - a[1]]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Skip the wall-side edge; the outward test keeps the roof facets facing out.
    if (Math.abs(a[0] - wallX) < 0.01 && Math.abs(b[0] - wallX) < 0.01) continue;
    const outward = edge.P(len / 2, 0, 1);
    const mid = edge.P(len / 2, 0, 0);
    const facesOut = (outward[0] - mid[0]) * sign > -0.5;
    if (!facesOut) continue;
    if (len > 3)
      opening(out, edge, len / 2, 11.0, Math.min(2.6, len - 1.2), 11.5, {
        head: 'pointed',
        rise: 2.1,
        glass: col.stained,
        frame: col.stone,
        frameSlot: 'stone',
        frameWidth: 0.26,
        mullions: 1,
        transoms: 2,
      });
    tri(out, 'slate', [a[0], W.eave - 0.4, a[1]], [b[0], W.eave - 0.4, b[1]], apex, col.slate);
  }
  spire(out, 'copper', [apex[0], apex[2]], 0.3, 4, apex[1] - 0.2, 2.4, col.copper);
}

function southWing(out) {
  // Mapped diagonal 1935 wing: centreline from the east entrance to Red Square's south end.
  const A = [14.1, -11.25],
    B = [47.3, 38.2],
    width = 13.5,
    eave = 21.5,
    ridge = 28.6;
  const S = facade(A, [B[0] - A[0], B[1] - A[1]]);
  const length = Math.hypot(B[0] - A[0], B[1] - A[1]);
  fbox(out, 'brick', S, 0, length, base, eave, -width / 2, width / 2, col.brick);
  fbox(
    out,
    'stone',
    S,
    -0.12,
    length + 0.12,
    base,
    1.1,
    -width / 2 - 0.12,
    width / 2 + 0.12,
    col.stoneShade,
  );
  fbox(
    out,
    'stone',
    S,
    -0.2,
    length + 0.2,
    eave - 0.5,
    eave,
    -width / 2 - 0.25,
    width / 2 + 0.25,
    col.stone,
  );
  const along = [(B[0] - A[0]) / length, (B[1] - A[1]) / length];
  const inner = facade(
    S.P(0, 0, width / 2).filter((_, i) => i !== 1),
    along,
  );
  const outer = facade(
    S.P(length, 0, -width / 2).filter((_, i) => i !== 1),
    [-along[0], -along[1]],
  );
  for (const [F, buttressed] of [
    [inner, false],
    [outer, true],
  ]) {
    for (let k = 0; k < 9; k++) {
      const u = 5.2 + k * 6.15;
      if (u > length - 4) break;
      opening(out, F, u, 9.6, 3.0, 9.4, {
        head: 'pointed',
        rise: 2.3,
        glass: col.stained,
        frame: col.stone,
        frameSlot: 'stone',
        frameWidth: 0.26,
        mullions: 1,
        transoms: 1,
      });
      for (const du of [-0.8, 0.8])
        opening(out, F, u + du, 2.4, 1.1, 3.6, {
          head: 'tudor',
          glass: col.glass,
          frame: col.stone,
          frameSlot: 'stone',
          frameWidth: 0.14,
        });
      if (buttressed && k < 8) {
        const b = u + 3.07;
        fbox(out, 'brick', F, b - 0.6, b + 0.6, base, 17.5, 0, 1.3, col.brickDark);
        fbox(out, 'stone', F, b - 0.68, b + 0.68, 17.5, 18.0, 0, 1.4, col.stone);
        const [x, , z] = F.P(b, 0, 0.55);
        spire(out, 'stone', [x, z], 0.55, 4, 18.0, 3.4, col.stone, { rotation: Math.PI / 4 });
      }
    }
  }
  gableRoof(out, 'slate', A, B, width - 0.4, eave, ridge, col.slate, {
    overhang: 0.2,
    endSlot: 'brick',
    endColor: col.brick,
  });
  fbox(
    out,
    'copper',
    facade(A, along),
    0.4,
    length - 0.4,
    ridge - 0.05,
    ridge + 0.6,
    -0.08,
    0.08,
    col.copper,
  );
  // Gabled end toward Red Square's south end, with one tall window. Walking from the +d side
  // to the -d side keeps the facade normal pointing along the wing (outward).
  const end = facade(
    S.P(length, 0, width / 2).filter((_, i) => i !== 1),
    [along[1], -along[0]],
  );
  opening(out, end, width / 2, 9.0, 3.4, 10.5, {
    head: 'pointed',
    rise: 2.6,
    glass: col.stained,
    frame: col.stone,
    frameSlot: 'stone',
    frameWidth: 0.3,
    mullions: 2,
    transoms: 2,
  });
}

/** The 1963 east wing: concrete with ribbon glazing; flat roof and a mechanical penthouse. */
function eastWing(out, frame) {
  const ring = frame.features.find((f) => f.id === '35185476291733').pieces[0].outline;
  extrude(out, 'concrete', ring, base, 17.6, col.concrete, { topSlot: 'deck', topColor: col.deck });
  for (const [y0, y1] of [
    [3.6, 6.4],
    [7.8, 10.6],
    [12.0, 14.8],
  ])
    ribbon(out, 'glass', ring, y0, y1, col.glass, { offset: 0.05, inset: 0.6 });
  extrude(
    out,
    'concrete',
    [
      [-22, -38],
      [4, -38],
      [4, -24],
      [-22, -24],
    ],
    17.6,
    21.4,
    col.concrete,
    { topSlot: 'deck', topColor: col.deck },
  );
  const lobby = frame.features.find((f) => f.id === '35185476291732').pieces[0].outline;
  extrude(out, 'glass', lobby, base, 4.6, col.glass, { topSlot: 'deck', topColor: col.deck });
}

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A12',
  title: 'Suzzallo Library, Seattle',
  wikidataId: 'Q7651462',
  brief:
    'Collegiate Gothic library on Red Square: the 1926 west wing with eleven tall pointed stained-glass windows between brick buttresses topped by terra-cotta figures and stone pinnacles, three west portals, a pierced cast-stone parapet, end oriels and a slate gable with copper cresting; the angled 1935 south wing in the same dress; and the 1963 concrete-and-glass east wing.',
  surfaces,
  build(out) {
    westWing(out);
    oriel(out, W.x0, -1);
    oriel(out, W.x1, 1);
    southWing(out);
    eastWing(out, frame);
  },
  dimensions: [
    {
      fact: 'Plan: the mapped OSM building 52776561088698 and its parts 35185476291734 (west wing), 35185476291733 (east wing) and 35185476291732 (lobby)',
      source: 'footprint.json',
    },
    {
      fact: 'Graduate Reading Room on the west front is 250 ft long, 52 ft wide and 65 ft high; its tall leaded windows hold 35 ft stained-glass panels',
      source: 'https://en.wikipedia.org/wiki/Suzzallo_Library',
    },
    {
      fact: 'Eleven 36 ft pointed-arch windows separated by brick and terra-cotta buttresses; 18 terra-cotta figures in niches atop buttresses capped with pinnacles; three cast-stone figures over the three west portals',
      source: 'https://lib.uw.edu/suzzallo/visit/tour',
    },
    {
      fact: 'Sandstone, precast stone, terra cotta and brick walls under a slate roof with copper decorative grillwork',
      source: 'https://sah-archipedia.org/node/79313',
    },
    {
      fact: 'West wing 1926, south wing 1935, modernist concrete-and-glass east wing 1963',
      source: 'https://en.wikipedia.org/wiki/Suzzallo_Library',
    },
  ],
  limitations: [
    'Eave, ridge and floor heights are estimated from the reading-room height and photographs; the mapped height (20 m) is a roof-line approximation.',
    'Window tracery is reduced to mullions and transoms; figures are blocky stand-ins at medium-fi scale; coats of arms are plain shields.',
    'The south wing is a straight 13.5 m wing on the mapped centreline; its end bays and the 1963 wing elevations are simplified.',
    'The separate Allen Library (1990) to the north is not part of this model.',
  ],
});
