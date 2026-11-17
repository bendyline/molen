/**
 * Smith Tower, Seattle (1914): a 21-storey white terra-cotta base block on Second Avenue and
 * Yesler Way with a two-storey granite plinth, a slender chamfered shaft rising flush with the
 * Second Avenue front, the 34th-floor cornice carrying the 35th-floor observation balcony and its
 * white steel cage, and a steep terra-cotta pyramid with three tiers of small arched dormers under
 * the glass globe. Plan from footprint.json: +Z faces Second Avenue (west-southwest), +X runs
 * south-southeast along it toward Yesler Way, and the origin is the shaft's centre.
 */

import { readFileSync } from 'node:fs';
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  spire,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  terracotta: rgb('e6e1d3'),
  terracottaShade: rgb('d6d0c0'),
  granite: rgb('a8a49b'),
  graniteDark: rgb('8f8b83'),
  glass: rgb('47535c'),
  glassWarm: rgb('54575a'),
  storefront: rgb('2f3a40'),
  roof: rgb('6e6b65'),
  bronze: rgb('6a5638'),
  door: rgb('3b3226'),
  steel: rgb('e8e8e2'),
  globe: rgb('9dbbd2'),
};
const surfaces = {
  terracotta: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.55, metallic: 0 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.75, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.22, metallic: 0.25 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.6, metallic: 0.1 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.2 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.45, metallic: 0.6 },
};

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));
const feature = (id) => frame.features.find((f) => f.id === id).pieces[0];

// Levels (model y, metres above the ground at the shaft centre). Second Avenue's sidewalk is
// the height datum; the site rises about 3.5 m toward the alley at the back.
const STREET = -0.75;
const LOW = frame.groundRelative.min - 1;
const PLINTH = 8.25; // top of the two granite storeys
const STOREY = 3.43;
const BASE_CORNICE = 72.6;
const BASE_TOP = STREET + 75; // mapped base height
const DECK = 118.0; // 35th floor: observation balcony
const EAVE = 122.4; // pyramid springing
const PYRAMID_TOP = STREET + 140.8; // 462 ft to the top of the pyramid
const TIP = STREET + 147.5; // 484 ft with the globe and finial

// Floor lines from the third floor up: 3..21 in the base, 22..33 in the shaft, 34 blank.
const baseFloors = Array.from({ length: 19 }, (_, k) => PLINTH + k * STOREY);
const shaftFloors = Array.from({ length: 12 }, (_, k) => PLINTH + (19 + k) * STOREY);
const FLOOR34 = PLINTH + 31 * STOREY;

// Shaft: the mapped tower part regularised to a chamfered rectangle about its centre.
const S = { cx: -0.07, cz: -0.07, hx: 9.98, hz: 7.86, chamfer: 0.75 };
function chamferedRing({ cx, cz, hx, hz, chamfer }, grow = 0) {
  const x = hx + grow,
    z = hz + grow,
    c = chamfer + grow * 0.414;
  return [
    [cx - x + c, cz + z],
    [cx + x - c, cz + z],
    [cx + x, cz + z - c],
    [cx + x, cz - z + c],
    [cx + x - c, cz - z],
    [cx - x + c, cz - z],
    [cx - x, cz - z + c],
    [cx - x, cz + z - c],
  ];
}

// Ground under the base as a plane fitted to the mapped vertex heights (for sill heights).
const groundFit = (() => {
  const p = feature('35184424870493');
  const pts = p.outline.map(([x, z], i) => [x, z, p.groundAtVertices[i]]);
  let n = 0,
    sx = 0,
    sz = 0,
    sy = 0,
    sxx = 0,
    szz = 0,
    sxz = 0,
    sxy = 0,
    szy = 0;
  for (const [x, z, y] of pts) {
    n++;
    sx += x;
    sz += z;
    sy += y;
    sxx += x * x;
    szz += z * z;
    sxz += x * z;
    sxy += x * y;
    szy += z * y;
  }
  // Solve the 3x3 normal equations for y = a + b x + c z by Cramer's rule.
  const m = [
    [n, sx, sz],
    [sx, sxx, sxz],
    [sz, sxz, szz],
  ];
  const r = [sy, sxy, szy];
  const det = (q) =>
    q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) -
    q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) +
    q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]);
  const d = det(m);
  const solve = (col) => det(m.map((row, i) => row.map((v, j) => (j === col ? r[i] : v)))) / d;
  const [a, b, c] = [solve(0), solve(1), solve(2)];
  return (x, z) => a + b * x + c * z;
})();

/**
 * Terra-cotta pier-and-spandrel grid on one facade: one glass face per bay, then full-height
 * piers and a mullion per bay and full-width spandrel bands at every floor line, all proud of it.
 */
function grid(out, F, bounds, floors, yTop, { pier = 0.9, endPier = 1.2, mullion = true } = {}) {
  const y0 = floors[0];
  const u0 = bounds[0],
    u1 = bounds.at(-1);
  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = bounds[i],
      b = bounds[i + 1];
    if (b - a < 1.8) continue;
    quad4(
      out,
      'glass',
      F.P(a, y0, 0.06),
      F.P(b, y0, 0.06),
      F.P(b, yTop, 0.06),
      F.P(a, yTop, 0.06),
      i % 2 ? col.glass : col.glassWarm,
    );
    if (mullion && b - a > 2.9) {
      const c = (a + b) / 2;
      fbox(out, 'terracotta', F, c - 0.2, c + 0.2, y0, yTop, 0, 0.12, col.terracottaShade);
    }
  }
  for (const y of floors)
    fbox(out, 'terracotta', F, u0, u1, y - 0.45, y + 1.05, 0, 0.16, col.terracottaShade, {
      bottom: true,
    });
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    const [a0, a1] =
      i === 0
        ? [b, b + endPier]
        : i === bounds.length - 1
          ? [b - endPier, b]
          : [b - pier / 2, b + pier / 2];
    fbox(out, 'terracotta', F, a0, a1, y0 - 0.4, yTop, 0, 0.32, col.terracotta);
  }
}

/** Evenly spaced bay lines over [0, L]. */
const evenBays = (L, module = 3.7) => {
  const n = Math.max(1, Math.round(L / module));
  return Array.from({ length: n + 1 }, (_, i) => (L * i) / n);
};

/** Bay lines on a module centred on `centre`, clipped to [0, L] (narrow end bays are piers). */
function centredBays(L, centre, module) {
  const lines = [];
  const start = centre - module / 2 - Math.ceil((centre - module / 2) / module) * module;
  for (let u = start; u <= L + 1e-6; u += module) if (u > 0.5 && u < L - 0.5) lines.push(u);
  return [0, ...lines, L];
}

function base(out) {
  const ring = outwardRing(feature('35184424870493').outline);
  // Plinth (two granite storeys) and terra-cotta body; the light courts open from the third floor.
  extrude(out, 'granite', ring, LOW, PLINTH, col.granite, { top: false });
  extrude(out, 'terracotta', ring, PLINTH, BASE_TOP, col.terracotta, {
    topSlot: 'roof',
    topColor: col.roof,
  });
  for (const court of [
    [
      [-16.1, -5.25],
      [-13.9, -5.25],
      [-13.9, -11.2],
      [-16.1, -11.2],
    ],
    [
      [2.66, -27.6],
      [8.54, -27.6],
      [8.54, -25.4],
      [2.66, -25.4],
    ],
  ])
    extrude(out, 'granite', court, LOW, PLINTH + 0.4, col.granite, {
      topSlot: 'roof',
      topColor: col.roof,
    });

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const F = wallFace(a, b);
    if (F.length < 4) continue;
    const front = F.normal[1] > 0.95; // Second Avenue
    // Second Avenue, Yesler Way and the short southeast end carry storefronts.
    const street = front || F.normal[0] > 0.6;
    // Bays on the Second Avenue front follow the shaft's module above it.
    const bounds = front ? centredBays(F.length, S.cx - a[0], 3.69) : evenBays(F.length);
    grid(out, F, bounds, baseFloors, BASE_CORNICE);
    // Granite string course over the plinth and the heavy base cornice with its frieze.
    fbox(
      out,
      'granite',
      F,
      -0.3,
      F.length + 0.3,
      PLINTH - 0.2,
      PLINTH + 0.45,
      0,
      0.45,
      col.granite,
    );
    fbox(
      out,
      'terracotta',
      F,
      -0.2,
      F.length + 0.2,
      BASE_CORNICE,
      BASE_CORNICE + 0.7,
      0,
      0.5,
      col.terracottaShade,
      { bottom: true },
    );
    fbox(
      out,
      'terracotta',
      F,
      -0.6,
      F.length + 0.6,
      BASE_CORNICE + 0.7,
      BASE_CORNICE + 1.25,
      0,
      1.15,
      col.terracotta,
      { bottom: true },
    );
    fbox(
      out,
      'terracotta',
      F,
      -0.3,
      F.length + 0.3,
      BASE_CORNICE + 1.25,
      BASE_TOP + 0.35,
      0,
      0.3,
      col.terracotta,
    );
    if (!street) continue;
    for (let k = 0; k + 1 < bounds.length; k++) {
      const u0 = bounds[k],
        u1 = bounds[k + 1];
      if (u1 - u0 < 2.4) continue;
      const u = (u0 + u1) / 2;
      const [gx, , gz] = F.P(u, 0, 0);
      const ground = Math.max(groundFit(gx, gz), STREET);
      const centreX = F.P(u, 0, 0)[0];
      fbox(out, 'granite', F, u0 - 0.45, u0 + 0.45, LOW, PLINTH - 0.2, 0, 0.3, col.graniteDark);
      if (k + 2 === bounds.length)
        fbox(out, 'granite', F, u1 - 0.45, u1 + 0.45, LOW, PLINTH - 0.2, 0, 0.3, col.graniteDark);
      if (front && Math.abs(centreX - S.cx) < 1.9) {
        // Main entrance: a tall round-arched granite portal under the shaft.
        opening(out, F, u, STREET, 3.0, 6.6, {
          head: 'round',
          glass: col.door,
          glassSlot: 'door',
          frame: col.graniteDark,
          frameSlot: 'granite',
          frameWidth: 0.5,
          frameDepth: 0.55,
          sill: false,
          transoms: 1,
          mullionColor: col.bronze,
        });
        continue;
      }
      // Storefront with a bronze frame and transom, and a second-floor window pair above.
      const shopTop = Math.max(3.6, ground + 3.3);
      opening(out, F, u, ground + 0.45, u1 - u0 - 1.3, shopTop - ground - 0.45, {
        glass: col.storefront,
        frame: col.bronze,
        frameSlot: 'bronze',
        frameWidth: 0.16,
        frameDepth: 0.14,
        mullions: 1,
        transoms: 1,
      });
      for (const du of [-0.8, 0.8])
        opening(
          out,
          F,
          u + du,
          Math.max(5.0, shopTop + 1.0),
          1.25,
          7.3 - Math.max(5.0, shopTop + 1.0),
          {
            glass: col.glass,
            frame: col.graniteDark,
            frameSlot: 'granite',
            frameWidth: 0.18,
            frameDepth: 0.12,
          },
        );
    }
  }
}

function shaft(out) {
  const ring = chamferedRing(S);
  extrude(out, 'terracotta', ring, BASE_TOP - 2, EAVE, col.terracotta, { top: false });
  const top = shaftFloors.at(-1) + STOREY;
  const faces = [
    // [corner a, corner b, bays]
    [ring[0], ring[1], 5], // +Z, Second Avenue
    [ring[2], ring[3], 4], // +X, toward Yesler Way
    [ring[4], ring[5], 5], // -Z, east
    [ring[6], ring[7], 4], // -X, north
  ];
  for (const [a, b, bays] of faces) {
    const F = wallFace(a, b);
    const bounds = Array.from({ length: bays + 1 }, (_, i) => (F.length * i) / bays);
    grid(out, F, bounds, shaftFloors, top, { endPier: 0.7 });
    // Floor 34: a blank band under the cornice that carries the balcony.
    fbox(
      out,
      'terracotta',
      F,
      -0.2,
      F.length + 0.2,
      top,
      top + 0.55,
      0,
      0.35,
      col.terracottaShade,
      { bottom: true },
    );
    fbox(
      out,
      'terracotta',
      F,
      -0.1,
      F.length + 0.1,
      FLOOR34 + 1.0,
      FLOOR34 + 2.4,
      0,
      0.18,
      col.terracottaShade,
    );
    // 35th floor: tall round-arched windows onto the balcony.
    for (let k = 0; k < bays; k++)
      opening(out, F, (F.length * (k + 0.5)) / bays, DECK + 0.35, 1.9, 3.4, {
        head: 'round',
        glass: col.glass,
        frame: col.terracottaShade,
        frameSlot: 'terracotta',
        frameWidth: 0.24,
        frameDepth: 0.2,
        sill: false,
        transoms: 1,
      });
    // Pyramid eave cornice.
    fbox(
      out,
      'terracotta',
      F,
      -0.3,
      F.length + 0.3,
      EAVE - 0.5,
      EAVE + 0.25,
      0,
      0.55,
      col.terracottaShade,
      { bottom: true },
    );
  }
  // Chamfer faces carry the cornices too.
  for (const [a, b] of [
    [ring[1], ring[2]],
    [ring[3], ring[4]],
    [ring[5], ring[6]],
    [ring[7], ring[0]],
  ]) {
    const F = wallFace(a, b);
    fbox(
      out,
      'terracotta',
      F,
      -0.15,
      F.length + 0.15,
      top,
      top + 0.55,
      0,
      0.35,
      col.terracottaShade,
      { bottom: true },
    );
    fbox(
      out,
      'terracotta',
      F,
      -0.15,
      F.length + 0.15,
      EAVE - 0.5,
      EAVE + 0.25,
      0,
      0.55,
      col.terracottaShade,
      { bottom: true },
    );
  }
  balcony(out);
}

/** The 35th-floor balcony: a cantilevered terra-cotta deck and Ivar Haglund's white steel cage. */
function balcony(out) {
  const outer = chamferedRing(S, 1.35);
  const deckRing = outwardRing(outer);
  extrude(out, 'terracotta', deckRing, DECK - 0.75, DECK, col.terracottaShade, { bottom: true });
  // Corbels under the deck.
  for (let i = 0; i < deckRing.length; i++) {
    const F = wallFace(deckRing[i], deckRing[(i + 1) % deckRing.length]);
    if (F.length < 4) continue;
    const n = Math.round(F.length / 2.4);
    for (let k = 0; k <= n; k++) {
      const u = 0.6 + ((F.length - 1.2) * k) / n;
      fbox(
        out,
        'terracotta',
        F,
        u - 0.22,
        u + 0.22,
        DECK - 1.6,
        DECK - 0.75,
        -1.35,
        -0.1,
        col.terracotta,
        { bottom: true },
      );
    }
    // Cage: posts, a top and a mid rail, all white-painted steel.
    const posts = Math.max(2, Math.round(F.length / 1.6));
    for (let k = 0; k <= posts; k++) {
      const u = 0.12 + ((F.length - 0.24) * k) / posts;
      fbox(out, 'steel', F, u - 0.08, u + 0.08, DECK, DECK + 2.1, -0.28, -0.12, col.steel);
    }
    for (const [y0, y1] of [
      [DECK + 1.0, DECK + 1.12],
      [DECK + 2.1, DECK + 2.24],
    ])
      fbox(out, 'steel', F, 0, F.length, y0, y1, -0.3, -0.1, col.steel, { bottom: true });
  }
}

/** Steep pyramid over the chamfered plan, with three tiers of small arched dormers. */
function pyramid(out) {
  const baseRing = chamferedRing(S, 0.3);
  const y0 = EAVE + 0.25;
  const H = PYRAMID_TOP - y0;
  // Truncate just under the globe's collar so the apex stays a clean point inside it.
  const tTop = (PYRAMID_TOP - 0.9 - y0) / H;
  const at = ([x, z], t) => [x + (S.cx - x) * t, y0 + H * t, z + (S.cz - z) * t];
  // The ring is counterclockwise seen from above (+X right, +Z down), as outwardRing orders it.
  for (let i = 0; i < baseRing.length; i++) {
    const a = baseRing[i],
      b = baseRing[(i + 1) % baseRing.length];
    quad4(out, 'terracotta', at(a, 0), at(b, 0), at(b, tTop), at(a, tTop), col.terracotta);
  }
  fan(
    out,
    'terracotta',
    baseRing.map((p) => at(p, tTop)),
    col.terracotta,
  );
  // Dormer tiers: [sill height, count on the long ±Z faces, count on the short ±X faces].
  const tiers = [
    [y0 + 1.9, 4, 3],
    [y0 + 6.1, 3, 2],
    [y0 + 10.2, 2, 1],
  ];
  const sides = [
    { along: [1, 0], half: S.hz + 0.3, width: S.hx + 0.3, normal: [0, 1] },
    { along: [0, -1], half: S.hx + 0.3, width: S.hz + 0.3, normal: [1, 0] },
    { along: [-1, 0], half: S.hz + 0.3, width: S.hx + 0.3, normal: [0, -1] },
    { along: [0, 1], half: S.hx + 0.3, width: S.hz + 0.3, normal: [-1, 0] },
  ];
  for (const side of sides) {
    const F = facade([S.cx, S.cz], side.along);
    for (const [ys, longCount, shortCount] of tiers) {
      const count = side.normal[1] !== 0 ? longCount : shortCount;
      const t = (ys - y0) / H;
      const dFace = side.half * (1 - t);
      const span = side.width * (1 - t) * 1.25;
      for (let k = 0; k < count; k++) {
        const u = count === 1 ? 0 : -span / 2 + (span * k) / (count - 1);
        dormer(out, F, u, ys, dFace);
      }
    }
  }
}

function dormer(out, F, u, ys, dFace) {
  const front = dFace + 0.32;
  fbox(
    out,
    'terracotta',
    F,
    u - 0.62,
    u + 0.62,
    ys - 0.25,
    ys + 2.0,
    front - 1.9,
    front,
    col.terracotta,
  );
  const G = facade(
    F.P(0, 0, front).filter((_, i) => i !== 1),
    F.along,
  );
  opening(out, G, u, ys, 0.72, 1.62, {
    head: 'round',
    glass: col.glass,
    frameWidth: 0,
    sill: false,
  });
  const a = F.P(u, 0, front - 1.9),
    b = F.P(u, 0, front + 0.08);
  gableRoof(
    out,
    'terracotta',
    [a[0], a[2]],
    [b[0], b[2]],
    1.24,
    ys + 2.0,
    ys + 2.6,
    col.terracottaShade,
    {
      overhang: 0.06,
      endSlot: 'terracotta',
      endColor: col.terracotta,
      ends: [false, true],
    },
  );
}

/** Bronze collar, the 8 ft glass globe and the finial. */
function crown(out) {
  const c = [S.cx, S.cz];
  lathe(
    out,
    'bronze',
    c,
    [
      [PYRAMID_TOP - 1.4, 0.95, 0.95],
      [PYRAMID_TOP - 0.2, 0.95, 0.95],
      [PYRAMID_TOP - 0.2, 1.12, 1.12],
      [PYRAMID_TOP + 0.15, 1.12, 1.12],
      [PYRAMID_TOP + 0.15, 0.7, 0.7],
    ],
    8,
    col.bronze,
    { rotation: Math.PI / 8 },
  );
  const r = 1.22,
    yc = PYRAMID_TOP + 0.15 + r * 0.92;
  const rings = [];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    rings.push([yc + r * Math.sin(a), r * Math.cos(a), r * Math.cos(a)]);
  }
  rings[0] = [rings[0][0], 0, 0];
  rings[8] = [rings[8][0], 0, 0];
  lathe(out, 'glass', c, rings, 12, col.globe, { capTop: false });
  // Equator band and meridian ribs of the globe's frame.
  lathe(
    out,
    'bronze',
    c,
    [
      [yc - 0.08, r + 0.04, r + 0.04],
      [yc + 0.08, r + 0.04, r + 0.04],
    ],
    12,
    col.bronze,
    { capTop: false },
  );
  spire(out, 'bronze', c, 0.16, 6, yc + r - 0.1, TIP - (yc + r - 0.1), col.bronze);
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A02',
  title: 'Smith Tower, Seattle',
  wikidataId: 'Q1196348',
  brief:
    "Seattle's 1914 white terra-cotta skyscraper at Second Avenue and Yesler Way: a 21-storey base block over a two-storey granite plinth with storefronts and a round-arched entrance, heavy cornices, and a slender chamfered shaft rising flush with the Second Avenue front in a pier-and-spandrel grid to the 35th-floor observation balcony with its white steel cage, crowned by a steep terra-cotta pyramid with three tiers of small arched dormers, a bronze collar, the glass globe and a finial.",
  surfaces,
  build(out) {
    base(out);
    shaft(out);
    pyramid(out);
    crown(out);
  },
  dimensions: [
    {
      fact: 'Plan: mapped OSM base 35184424870493 (75 m) and tower part 35184790229218 (141 m), with the crown parts 35184790229216 and 35184790229217 at its centre; the shaft is 20.0 m along Second Avenue by 15.7 m with chamfered corners',
      source: 'footprint.json',
    },
    {
      fact: '38 floors; 140.8 m (462 ft) architectural height to the top of the pyramid, 147.5 m (484 ft) to the tip; observatory at 119.5 m (392 ft)',
      source: 'https://www.skyscrapercenter.com/building/wd/9676',
    },
    {
      fact: '462 ft to the top of the pyramid per the permit plans; a mounted tower with a broad base and a slender shaft; heavy cornices; pyramid with three tiers of small arched windows and a hollow glass globe on top; observation deck and function room on the 35th story with a balcony whose masonry balusters were replaced by a cage of white-painted steel bars',
      source: 'https://www.historylink.org/File/4310',
    },
    {
      fact: 'Lower part 236 ft (22 stories, including the attic), tower an additional 20 stories; Washington granite on the first two floors and terra cotta above; light courts begin at the third floor; bronze window sash',
      source: 'https://pcad.lib.washington.edu/building/4149',
    },
    {
      fact: 'Granite skin on the first and second floors, terra cotta on the rest; crowned by an 8-foot (2.4 m) glass globe',
      source: 'https://en.wikipedia.org/wiki/Smith_Tower',
    },
  ],
  limitations: [
    'Floor heights are a uniform 3.43 m above the two-storey plinth, fitted so the 35th floor lands near the published observatory height; the base cornice and attic are estimated from photographs.',
    'Terra-cotta ornament (capitals, lion and Indian heads, cartouches) is reduced to piers, spandrel bands, mullions and stepped cornices; window sash is not modelled.',
    'Bay counts (five on the long shaft faces, four on the short) and the dormer counts per tier are estimated; the pyramid is a straight-sided pyramid over the chamfered shaft plan.',
    'The base follows the mapped outline, including its two shallow light-court notches; the alley and party walls carry the same grid above the plinth and no ground-floor openings.',
  ],
});
