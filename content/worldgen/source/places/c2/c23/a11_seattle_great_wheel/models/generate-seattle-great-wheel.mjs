/**
 * Seattle Great Wheel (2012): a white 175 ft observation wheel on the west end of Pier 57,
 * overhanging Elliott Bay: a twin-chord rim, crossed spokes from a long hub with round covers,
 * 42 enclosed gondolas with navy glass hanging outside the rim, two splayed A-frames carrying
 * the axle, a glass-roofed boarding canopy and the pier-end timber deck on piles. The wheel
 * stands in the X-Y plane (+X toward the water, about 245 deg azimuth; +Z north-northwest),
 * hub over the anchor, frame from the mapped glass-roofed base in footprint.json.
 */
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  abox,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  tube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const col = {
  steel: rgb('e3e5e2'),
  steelShade: rgb('d2d5d3'),
  gondolaGlass: rgb('2a4566'),
  canopyGlass: rgb('a7c0cb'),
  deck: rgb('857867'),
  pile: rgb('5e5244'),
  rail: rgb('3b4043'),
  plinth: rgb('a9a79f'),
};
const surfaces = {
  steel: { slot: 'wall', graph: 'metal_painted', roughness: 0.45, metallic: 0.35 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.15, metallic: 0.3 },
  deck: { slot: 'foundation', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0.3 },
  plinth: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
};

// Overall height 175 ft (53.3 m) above the deck: gondola pivots on a 25 m circle, hub 28.5 m.
const deckY = 0.25;
const hubY = 28.5;
const R = 22.5; // rim chords
const Rp = 25.0; // gondola pivots
const chordZ = 1.3;
const gondolas = 42;
const step = (Math.PI * 2) / gondolas;
const at = (r, a, z) => [r * Math.cos(a), hubY + r * Math.sin(a), z];
const angle = (k) => -Math.PI / 2 + k * step; // k = 0 is the boarding position

const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function triTo(out, slot, a, b, c, color, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) tri(out, slot, a, b, c, color);
  else tri(out, slot, a, c, b, color);
}

const spokeAngle = (j) => angle(2 * j) + step / 2;

/** Rim truss: two outer chords the gondolas pass between at the top, an inner chord, V struts. */
function rim(out) {
  for (const z of [-chordZ, chordZ]) {
    const ring = Array.from({ length: gondolas * 2 }, (_, i) => at(R, (i * step) / 2, z));
    tubePath(out, 'steel', ring, 0.42, col.steel, 6, true);
  }
  const inner = Array.from({ length: gondolas }, (_, i) => at(R - 1.3, i * step, 0));
  tubePath(out, 'steel', inner, 0.3, col.steel, 5, true);
  for (let j = 0; j < gondolas / 2; j++) {
    const a = spokeAngle(j);
    for (const s of [-1, 1])
      tube(out, 'steel', at(R - 1.3, a, 0), at(R, a, s * chordZ), 0.16, col.steelShade, 4);
  }
}

function spokesAndHub(out) {
  // Twenty-one ladder spokes: two tubes on each face, converging on the hub flanges.
  for (let j = 0; j < gondolas / 2; j++) {
    const a = spokeAngle(j);
    for (const s of [-1, 1])
      for (const t of [-1, 1]) {
        const hub = at(2.3, a + (t * 0.2) / 2.3, s * 3.0);
        const rimEnd = at(R - 0.3, a + (t * 0.45) / R, s * chordZ);
        tube(out, 'steel', hub, rimEnd, 0.15, col.steel, 4);
      }
  }
  // Hub barrel, round covers and the axle running out to the bearings.
  tube(out, 'steel', [0, hubY, -3.4], [0, hubY, 3.4], 2.4, col.steelShade, 16);
  for (const s of [-1, 1])
    tube(out, 'steel', [0, hubY, s * 3.4], [0, hubY, s * 3.75], 3.2, col.steel, 20);
  tube(out, 'steel', [0, hubY, -4.6], [0, hubY, 4.6], 0.65, col.steelShade, 8);
}

function gondola(out, k) {
  const [px, py] = at(Rp, angle(k), 0);
  // Pivot axle and the two brackets out from the rim chords.
  tube(out, 'steel', [px, py, -1.15], [px, py, 1.15], 0.12, col.steelShade, 4);
  for (const s of [-1, 1])
    tube(out, 'steel', at(R + 0.2, angle(k), s * chordZ), [px, py, s * 1.1], 0.15, col.steel, 4);
  // Yoke straps, white roof and floor, dark blue glass cabin; it passes between the outer
  // rim chords at the top of the wheel.
  for (const s of [-1, 1])
    abox(
      out,
      'steel',
      [px - 0.08, py - 0.5, s * 0.8 - 0.06],
      [px + 0.08, py + 0.05, s * 0.8 + 0.06],
      col.steel,
    );
  abox(out, 'steel', [px - 1.2, py - 0.85, -0.86], [px + 1.2, py - 0.5, 0.86], col.steel);
  abox(out, 'glass', [px - 1.14, py - 2.65, -0.8], [px + 1.14, py - 0.85, 0.8], col.gondolaGlass);
  abox(out, 'steel', [px - 1.2, py - 3.0, -0.86], [px + 1.2, py - 2.65, 0.86], col.steel);
}

function legs(out) {
  for (const s of [-1, 1]) {
    const bearing = [0, hubY, s * 4.1];
    abox(
      out,
      'steel',
      [-0.9, hubY - 1.0, s * 4.1 - 0.7],
      [0.9, hubY + 0.9, s * 4.1 + 0.7],
      col.steelShade,
    );
    for (const x of [-11, 11]) {
      const foot = [x, deckY, s * 7.6];
      tube(out, 'steel', foot, bearing, 0.75, col.steel, 10);
      abox(
        out,
        'plinth',
        [foot[0] - 1.1, deckY - 0.1, foot[2] - 1.1],
        [foot[0] + 1.1, deckY + 0.6, foot[2] + 1.1],
        col.plinth,
      );
    }
  }
}

/** Glass-roofed boarding canopy beside the wheel and the two boarding platforms. */
function boarding(out) {
  const z0 = 1.6,
    z1 = 6.4,
    zc = (z0 + z1) / 2,
    half = (z1 - z0) / 2;
  const spring = 2.7,
    crown = 4.7;
  const arc = (x) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = Math.PI - (i / 8) * Math.PI;
      return [x, spring + (crown - spring) * Math.sin(t), zc + half * Math.cos(t)];
    });
  const xs = [-7.5, -3.75, 0, 3.75, 7.5];
  for (const x of xs) {
    tubePath(out, 'steel', arc(x), 0.14, col.steel, 5, false);
    for (const z of [z0, z1]) tube(out, 'steel', [x, deckY, z], [x, spring, z], 0.14, col.steel, 5);
  }
  // Glass vault over the ribs.
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = arc(xs[i]),
      b = arc(xs[i + 1]);
    for (let j = 0; j + 1 < a.length; j++) {
      const mid = [
        (a[j][0] + b[j][0]) / 2,
        (a[j][1] + a[j + 1][1]) / 2,
        (a[j][2] + a[j + 1][2]) / 2,
      ];
      const want = [0, mid[1] - (spring - 1.5), mid[2] - zc];
      triTo(out, 'glass', a[j], b[j], b[j + 1], col.canopyGlass, want);
      triTo(out, 'glass', a[j], b[j + 1], a[j + 1], col.canopyGlass, want);
    }
  }
  // Boarding platforms either side of the bottom gondola.
  abox(out, 'deck', [-4.5, deckY, 1.0], [4.5, 0.95, z1], col.deck);
  abox(out, 'deck', [-4.5, deckY, -3.6], [4.5, 0.95, -1.0], col.deck);
}

/** The pier-end deck the wheel stands on, its piles and railings. */
function deck(out) {
  const x0 = -12.3,
    x1 = 12.6,
    z0 = -9.2,
    z1 = 10.7;
  abox(out, 'deck', [x0, -0.45, z0], [x1, deckY, z1], col.deck);
  for (let x = x0 + 1.6; x < x1; x += 4.0)
    for (const z of [z0 + 0.5, z0 + 4.4, z0 + 8.3, z1 - 7.7, z1 - 3.8, z1 - 0.5])
      abox(out, 'deck', [x - 0.22, -4.6, z - 0.22], [x + 0.22, -0.45, z + 0.22], col.pile, {
        bottom: false,
      });
  // Railing along the water end and both sides.
  const runs = [
    [
      [x1 - 0.1, z0 + 0.1],
      [x1 - 0.1, z1 - 0.1],
    ],
    [
      [x0 + 2.0, z0 + 0.1],
      [x1 - 0.1, z0 + 0.1],
    ],
    [
      [x0 + 2.0, z1 - 0.1],
      [x1 - 0.1, z1 - 0.1],
    ],
  ];
  for (const [a, b] of runs) {
    for (const y of [0.6, 1.1])
      tube(out, 'rail', [a[0], deckY + y, a[1]], [b[0], deckY + y, b[1]], 0.05, col.rail, 4);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.round(len / 2.4);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      abox(out, 'rail', [x - 0.05, deckY, z - 0.05], [x + 0.05, deckY + 1.15, z + 0.05], col.rail, {
        bottom: false,
      });
    }
  }
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A11',
  title: 'Seattle Great Wheel',
  wikidataId: 'Q7442108',
  brief:
    'The white 175 ft (53 m) observation wheel at the end of Pier 57, standing perpendicular to the waterfront and overhanging Elliott Bay: a twin-chord rim with 42 enclosed navy-glass gondolas hanging outside it, crossed spokes from a long hub with round white covers, two splayed A-frames carrying the axle, a white-ribbed glass boarding canopy, and the timber pier-end deck on piles.',
  surfaces,
  build(out) {
    deck(out);
    legs(out);
    spokesAndHub(out);
    rim(out);
    for (let k = 0; k < gondolas; k++) gondola(out, k);
    boarding(out);
  },
  dimensions: [
    {
      fact: 'Frame: the mapped glass-roofed base 35184768695710 (OSM way 396606878, building=roof) under the OSM attraction=big_wheel node 1809238334 (height 53); wheel plane along the base outline, about 245/65 deg azimuth; Pier 57 shed 35184538999531 for context',
      source: 'footprint.json',
    },
    {
      fact: 'Overall height 175 feet (53.3 m); 42 climate-controlled enclosed gondolas of up to eight passengers; extends 40 feet (12.2 m) out over Elliott Bay; opened June 29, 2012 at Pier 57, 1301 Alaskan Way',
      source: 'https://en.wikipedia.org/wiki/Seattle_Great_Wheel',
    },
    {
      fact: 'Wheel plane faces Colman Dock and the Space Needle line (seen face-on from the ferry approach and from the Pier 58/59 overlook, edge-on along the pier)',
      source: 'https://commons.wikimedia.org/wiki/Category:Seattle_Great_Wheel',
    },
  ],
  limitations: [
    'Rim, pivot-circle and hub dimensions (45 m rim, 50 m gondola circle, hub 28.5 m above the deck) are estimated from the published overall height and photographs; the lattice spokes are single tubes and the rim truss is two chords with ties.',
    'Gondolas are drawn hanging plumb at every station; the glass-floored VIP gondola, LED lighting and the maintenance stair on one leg are omitted.',
    'The boarding canopy and platforms are simplified; the pier-end deck, piles and railings stand in for the platform the wheel occupies beyond the mapped Pier 57 shed. Deck top is 0.25 m above the anchor ground, which is the pier deck level in the explorer elevation.',
  ],
});
