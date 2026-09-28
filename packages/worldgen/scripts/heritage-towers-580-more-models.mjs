/** Researched current exteriors. Dimensions are metres; photographs are references only. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  annulus,
  archBay,
  face,
  frame,
  tau,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

function buildTughrul(out) {
  const brick = [0.68, 0.49, 0.32],
    repair = [0.79, 0.63, 0.43],
    shade = [0.46, 0.33, 0.22],
    rim = [0.73, 0.55, 0.35];
  const step = tau / 24,
    outer = 8.3,
    valley = 7.55,
    inner = 5.23;
  const p = (a, y, r) => [Math.sin(a) * r, y, Math.cos(a) * r];
  // Twenty-two solid flanges occupy the twenty-four-position rhythm; two opposing bays are portals.
  for (let i = 0; i < 24; i++) {
    const a = i * step,
      l = a - step / 2,
      r = a + step / 2;
    if (i !== 0 && i !== 12) {
      for (const [a0, r0, a1, r1] of [
        [l, valley, a, outer],
        [a, outer, r, valley],
      ])
        face(out, 'brick', [p(a0, 0, r0), p(a1, 0, r1), p(a1, 16.15, r1), p(a0, 16.15, r0)], brick);
    } else {
      const wall = transform(out, a),
        z = valley * Math.cos(step / 2),
        w = 2 * valley * Math.sin(step / 2);
      archBay(wall, 'brick', 0, w, 0, 2.7, 1.05, 7.55, z, z - inner, repair, {
        back: false,
        trim: 0.12,
      });
      for (const x of [-1.04, 1.04])
        box(wall, 'brick', [x - 0.11, 0.2, z + 0.04], [x + 0.11, 7.1, z + 0.21], repair);
      for (const y of [6.9, 7.25])
        box(wall, 'brick', [-1.17, y, z + 0.03], [1.17, y + 0.14, z + 0.2], repair);
      // Pointed shallow blind relieving arch, visible above the round entry passage.
      archBay(wall, 'brick', 0, 1.67, 3.85, 4.86, 1.03, 6.4, z + 0.12, 0.19, repair, {
        pointed: true,
        trim: 0.075,
      });
      if (i === 12) {
        archBay(wall, 'brick', 0, 0.66, 7.2, 8.15, 0.32, 8.65, z, 0.65, brick, { trim: 0.05 });
        face(
          wall,
          'brick',
          [
            [-w / 2, 8.65, z],
            [w / 2, 8.65, z],
            [w / 2, 16.15, z],
            [-w / 2, 16.15, z],
          ],
          brick,
        );
        for (const s of [-1, 1])
          box(
            wall,
            'brick',
            [s > 0 ? 0.38 : -w / 2, 7.55, z - 0.25],
            [s > 0 ? w / 2 : -0.38, 8.65, z],
            brick,
          );
      } else
        face(
          wall,
          'brick',
          [
            [-w / 2, 7.55, z],
            [w / 2, 7.55, z],
            [w / 2, 16.15, z],
            [-w / 2, 16.15, z],
          ],
          brick,
        );
    }
    // Three tiers of deeply recessed corbel cells fill the transitions to the circular cornice.
    for (let tier = 0; tier < 3; tier++) {
      const y = 16.08 + tier * 0.72,
        rr = 7.63 + tier * 0.21,
        ww = 1.74 - tier * 0.22;
      const wall = transform(out, a + (tier === 1 ? step / 2 : 0)),
        z = rr;
      const apex = [0, y, z - 0.32],
        left = [-ww / 2, y + 0.66, z + 0.22],
        right = [ww / 2, y + 0.66, z + 0.22],
        back = [0, y + 0.58, z - 0.42];
      triangle(wall, 'brick', [apex, right, back], shade);
      triangle(wall, 'brick', [apex, back, left], shade);
      triangle(wall, 'brick', [left, back, right], brick);
      beam(wall, 'brick', apex, left, 0.105, 0.12, rim);
      beam(wall, 'brick', apex, right, 0.105, 0.12, rim);
      beam(wall, 'brick', left, right, 0.105, 0.14, rim);
      for (const s of [-1, 1])
        triangle(wall, 'brick', [[(s * ww) / 2, y, z + 0.04], apex, s > 0 ? right : left], brick);
    }
  }
  // Recessed corbel cells sit in a continuous masonry drum, not an open lattice.
  // Its radius stays behind the deepest cell apex, retaining the visible recesses.
  for (let i = 0; i < 192; i++) {
    const a = (i * tau) / 192,
      b = ((i + 1) * tau) / 192;
    face(
      out,
      'brick',
      [p(a, 16.1, 7.1), p(b, 16.1, 7.1), p(b, 18.35, 7.1), p(a, 18.35, 7.1)],
      shade,
    );
  }
  // Close the real stone thickness over the stellar shaft beneath the first corbel rank.
  // Without this horizontal shoulder a grazing view can see through the flange-to-drum joint.
  for (let i = 0; i < 48; i++) {
    const a = (i * step) / 2,
      b = ((i + 1) * step) / 2;
    const radius = (angle) => {
      const t = (((angle / step) % 1) + 1) % 1;
      return outer - Math.min(t, 1 - t) * 2 * (outer - valley);
    };
    face(
      out,
      'brick',
      [p(a, 16.15, radius(a)), p(b, 16.15, radius(b)), p(b, 16.15, 7.1), p(a, 16.15, 7.1)],
      brick,
    );
  }
  // The exposed roofless interior remains a hollow brick cylinder.
  for (let i = 0; i < 192; i++) {
    const a = (i * tau) / 192,
      b = ((i + 1) * tau) / 192,
      mid = (a + b) / 2;
    const door = Math.abs(Math.sin(mid)) * inner < 1.0;
    const y = door ? 3.84 : 0;
    face(
      out,
      'tughrul_inner',
      [p(b, y, inner), p(a, y, inner), p(a, 18.29, inner), p(b, 18.29, inner)],
      shade,
    );
  }
  for (const a of [0, Math.PI]) {
    const wall = transform(out, a + Math.PI, [0, 0, Math.cos(a) * inner]);
    archBay(wall, 'brick', 0, 1.95, 0, 2.7, 1.05, 4.05, 0, 0.15, shade, {
      back: false,
      trim: 0.035,
    });
  }
  annulus(out, 'tughrul_upper', inner, 8.15, 18.29, 18.5, rim, 192);
  annulus(out, 'tughrul_upper', inner, 8.26, 18.5, 18.7, brick, 192);
  annulus(out, 'tughrul_upper', inner, 8.22, 18.7, 19.65, brick, 192);
  annulus(out, 'tughrul_upper', inner, 8.4, 19.65, 19.83, rim, 192);
  annulus(out, 'tughrul_upper', inner, 8.33, 19.83, 20, brick, 192);
  // Two photographed small-scale brick relief bands below the reconstructed upper rim.
  for (let i = 0; i < 192; i++) {
    const a = (i * tau) / 192,
      wall = transform(out, a);
    box(wall, 'brick', [-0.07, 18.8, 8.22], [0.07, 19.02, 8.255], shade);
    beam(wall, 'brick', [-0.12, 19.14, 8.24], [0.09, 19.43, 8.24], 0.085, 0.05, rim);
  }
  // Ground visible from above, with an unobstructed open-sky court.
  loft(
    out,
    'limestone',
    [radialRing(0, inner, inner, 96), radialRing(0.07, inner, inner, 96)],
    [0.59, 0.53, 0.43],
  );
}

function buildRiga(out) {
  const brick = [0.49, 0.24, 0.17],
    patch = [0.58, 0.31, 0.22],
    stone = [0.47, 0.44, 0.37],
    copper = [0.28, 0.43, 0.37],
    iron = [0.13, 0.16, 0.15];
  const radius = (y) => 7.15 - 0.005 * y,
    p = (a, y, r = radius(y)) => [Math.sin(a) * r, y, Math.cos(a) * r];
  const windows = [];
  for (let i = 0; i < 10; i++)
    windows.push({ a: (i * tau) / 10 + 0.16, y: 23.22, top: 24.62, w: 1.18 });
  for (let i = 0; i < 9; i++)
    windows.push({ a: (i * tau) / 9 + 0.34, y: 18.15, top: 19.58, w: 1.15 });
  for (const [a, y, w, h] of [
    [3.14, 14.5, 1.1, 1.34],
    [1.45, 14.4, 0.85, 1.15],
    [4.6, 14.3, 0.8, 1.04],
    [2.54, 10.7, 1.13, 1.61],
    [3.88, 10.1, 1.05, 1.43],
    [1.1, 10.5, 0.7, 1.2],
    [4.89, 6.9, 0.72, 1.3],
    [3.29, 6.85, 0.77, 1.31],
    [2.09, 6.2, 0.72, 1.16],
    [3.96, 3.7, 0.66, 1.16],
    [2.72, 3.9, 0.7, 1.1],
  ])
    windows.push({ a, y, w, top: y + h });
  const ys = [0, 2.8, 25.67, ...windows.flatMap((w) => [w.y, w.top])]
    .sort((a, b) => a - b)
    .filter((y, i, a) => i === 0 || y - a[i - 1] > 0.005);
  for (let i = 0; i < 256; i++) {
    const a = (i * tau) / 256,
      b = ((i + 1) * tau) / 256,
      mid = (a + b) / 2;
    for (let j = 0; j < ys.length - 1; j++) {
      const y = (ys[j] + ys[j + 1]) / 2;
      if (
        windows.some(
          (w) =>
            Math.abs(Math.atan2(Math.sin(mid - w.a), Math.cos(mid - w.a))) < w.w / 2 / radius(y) &&
            y > w.y &&
            y < w.top,
        )
      )
        continue;
      face(
        out,
        y < 2.8 ? 'riga_stone' : 'riga_brick',
        [p(a, ys[j]), p(b, ys[j]), p(b, ys[j + 1]), p(a, ys[j + 1])],
        y < 2.8 ? stone : brick,
      );
    }
  }
  for (const w of windows) {
    const wall = transform(out, w.a),
      z = radius((w.y + w.top) / 2);
    archBay(wall, 'brick', 0, w.w, w.y, w.top - 0.42, 0.4, w.top + 0.02, z, 0.65, patch, {
      trim: 0.1,
    });
    for (const x of [-0.21, 0.21])
      beam(wall, 'metal', [x, w.y + 0.13, z - 0.6], [x, w.top - 0.35, z - 0.6], 0.027, 0.03, iron);
  }
  // Exposed siege cannonballs are grouped on the northern face rather than scattered everywhere.
  for (const [a, y, r] of [
    [2.74, 11.1, 0.16],
    [2.87, 12.5, 0.13],
    [3.12, 13.1, 0.17],
    [3.28, 12.6, 0.14],
    [3.39, 11.9, 0.15],
    [3.51, 14.2, 0.13],
    [2.51, 14, 0.14],
    [3.71, 13.35, 0.12],
    [3.83, 11.8, 0.15],
  ])
    sphere(out, 'metal', p(a, y, radius(y) + 0.035), [r, r, r], iron, 16, 10);
  // Dark circumferential iron tie and the rolled cornice below the metal roof.
  annulus(out, 'metal', 6.93, 7.081, 22.77, 22.94, iron, 256);
  annulus(out, 'brick', 6.9, 7.13, 25.38, 25.57, patch, 256);
  annulus(out, 'brick', 6.9, 7.26, 25.57, 25.77, brick, 256);
  const profile = [
    [25.74, 7.54],
    [26.45, 6.47],
    [27.37, 5.48],
    [28.38, 4.54],
    [29.65, 3.57],
    [31.0, 2.64],
    [32.6, 1.72],
    [34.2, 0.9],
    [35.95, 0.22],
    [36.25, 0.1],
  ];
  loft(
    out,
    'copper',
    profile.map(([y, r]) => radialRing(y, r, r, 128)),
    copper,
  );
  // Continuous standing seams follow the concave profile without crossing the sky.
  for (let i = 0; i < 64; i++) {
    const a = (i * tau) / 64;
    for (let j = 0; j < profile.length - 1; j++) {
      const [y, r] = profile[j],
        [yy, rr] = profile[j + 1];
      beam(out, 'metal', p(a, y, r + 0.026), p(a, yy, rr + 0.026), 0.026, 0.04, [0.24, 0.36, 0.32]);
    }
  }
  beam(out, 'metal', [0, 36.14, 0], [0, 37, 0], 0.055, 0.055, iron);
  sphere(out, 'copper', [0, 36.51, 0], [0.18, 0.22, 0.18], copper, 24, 12);
}

export const heritageTowers580More = [
  {
    id: 'n0581_tughrul_tower',
    planId: 'N0581',
    title: 'Tughrul Tower',
    wikidata: 'Q3437688',
    build: buildTughrul,
    authoringFile: 'heritage-towers-580-more-models.mjs',
    brief:
      'The current roofless Seljuk mausoleum at Rey: a deep stellar brick shaft, opposed entry portals, three ranks of recessed muqarnas beneath the corbelled brick cornice, reconstructed upper band and a genuinely open cylindrical court.',
    size: [16.8, 20, 16.8],
    front:
      '+Z is the lighter southern entry portal; −Z is the northern portal with the elevated staircase opening',
    origin: 'Mapped current tower center at ground contact Y=0',
    refs: [
      'https://www.iranicaonline.org/articles/borj-e-togrol-tomb-tower-of-the-saljuq-period/',
      'https://commons.wikimedia.org/wiki/File:Burj_Tughrul_Ground.jpg',
      'https://commons.wikimedia.org/wiki/File:Burj_Tughrul_bala.jpg',
      'https://commons.wikimedia.org/wiki/File:Detail_of_brickwork_on_cornice_and_squinches.jpg',
      'https://www.openstreetmap.org/relation/8048810',
    ],
    facts: {
      currentHeightMeters: 20,
      outerDiameterMeters: 16.6,
      solidFlanges: 22,
      portalBays: 2,
      muqarnasTiers: 3,
      northStairOpeningMeters: 7,
      currentRoof: 'lost; open to sky',
    },
    scaleBasis:
      'Bernard O’Kane’s architectural study supplies the current 20 m height, 16.6 m diameter, twenty-two flanges, three corbel tiers and opposed north/south portals. Photographer-owned ground and upward views establish the round opening below a pointed blind relieving arch, three-dimensional recessed cells and brick relief courses. The mapped open courtyard supports an approximately 10.5 m inner diameter.',
    geographicProposal: {
      anchor: [51.445610934, 35.600652903],
      heading: 0,
      source: 'https://www.openstreetmap.org/relation/8048810',
      evidence:
        'The exact-identity mapped circular outside wall and inner courtyard establish the center and diameters. The architecture study explicitly places the lighter entry on the south and elevated stair opening over the north portal, fixing +Z south; the arbitrary polygon bounding-box axis is not used.',
      orientationConfidence: 'published-cardinal-portals-and-mapped-concentric-court',
      limitations:
        'The historic conical roof no longer exists and is deliberately absent. Garden paths and unrelated adjacent structures are not part of this tower asset.',
    },
    limits: [
      'The twenty-four-position exterior rhythm contains twenty-two projecting flanges and two opposed portal bays, reconciling the study’s flange count with common descriptions counting all rhythm positions.',
      'Eroded and reconstructed brickwork is represented by original geometric corbel cells and metric surfaces. No lost Kufic text or hypothetical medieval roof is invented.',
    ],
    cameras: [
      { name: 'south-portal', position: [12, 7, 20], lookAt: [0, 5, 0] },
      { name: 'muqarnas-cornice', position: [14, 21, 17], lookAt: [0, 17.8, 0] },
      { name: 'open-court', position: [20, 35, 23], lookAt: [0, 10, 0] },
      { name: 'north-stair', position: [-13, 10, -22], lookAt: [0, 8, 0] },
      { name: 'far-silhouette', position: [40, 20, 49], lookAt: [0, 10, 0] },
    ],
  },
  {
    id: 'n0586_powder_tower',
    planId: 'N0586',
    title: 'Powder Tower, Riga',
    wikidata: 'Q186097',
    build: buildRiga,
    authoringFile: 'heritage-towers-580-more-models.mjs',
    brief:
      'Riga’s surviving round defensive tower, with a fieldstone plinth, deeply recessed arched gun openings, nine exposed northern cannonballs, dark iron tie and the present concave green copper roof with standing seams and finial.',
    size: [15.1, 37, 15.1],
    front:
      '−Z north toward Bastejkalns and the visible siege cannonballs; +Z toward the city and adjoining museum',
    origin: 'Exact mapped cylindrical tower center, pavement Y=0',
    refs: [
      'https://www.latvia.travel/en/sight/latvian-war-museum',
      'https://www.liveriga.com/en/1594-the-powder-tower',
      'https://www.liveriga.com/userfiles/images/apmekle/ko-redzet/apskates-vietas/arhitektura/pulvertornis/48803267036_661e06a076_k.jpg',
      'https://www.liveriga.com/userfiles/images/apmekle/ko-redzet/apskates-vietas/arhitektura/pulvertornis/48803415137_f29c2f9ae1_k.jpg',
      'https://www.karamuzejs.lv/node/270',
      'https://www.openstreetmap.org/way/45018613',
    ],
    facts: {
      wallHeightMeters: 25.6,
      wallDiameterMeters: 14.3,
      wallThicknessMeters: 3,
      roofAndFinialHeightMeters: 11.33,
      overallHeightMeters: 37,
      cannonballs: 9,
      currentTowerYear: 1650,
    },
    scaleBasis:
      'Latvian official tourism publishes a 14.3 m diameter and 25.6 m tower wall height; current agency photographs show the masonry alone is roughly 1.8 diameters tall, with the roof above. The exact OSM feature explicitly gives total height 37 m and roof height 11.33 m, matching 25.67 m masonry plus roof. The photographed concave metal roof is reconstructed from those dimensions rather than treating 25.6 m as the whole silhouette.',
    geographicProposal: {
      anchor: [24.10867779, 56.951220574],
      heading: 0,
      source: 'https://www.openstreetmap.org/way/45018613',
      evidence:
        'The exact-identity cylindrical outline supplies the center. Published north-facing siege cannonballs and current agency views toward the park orient the authored northern window group; roof diameter covers the mapped eaves. Circular plan bounding axes are arbitrary and are not used to rotate the feature.',
      orientationConfidence: 'mapped-round-center-and-photographic-cardinal-face',
      limitations:
        'The adjoining War Museum wing and nearby city-wall buildings are separate footprints. The tower keeps its complete circular exterior, with shared walls naturally hidden by surrounding map buildings.',
    },
    limits: [
      'The often-quoted 25.6 m dimension is treated as masonry height, supported by photographed height/diameter proportion and explicit OSM roof-height metadata; the full roof-and-finial silhouette is 37 m.',
      'Seasonal ivy, individual weathered brick damage and hidden museum galleries are outside the fixed exterior reconstruction. Siege cannonballs and gun opening locations preserve the visible facade rhythm.',
    ],
    cameras: [
      { name: 'north-gun-openings', position: [-16, 17, -24], lookAt: [0, 14, 0] },
      { name: 'cannonballs', position: [-10, 13, -15], lookAt: [0, 12.8, -3] },
      { name: 'copper-roof', position: [18, 35, -24], lookAt: [0, 29, 0] },
      { name: 'masonry-base', position: [18, 7, 19], lookAt: [0, 5, 0] },
      { name: 'far-silhouette', position: [42, 26, -58], lookAt: [0, 18, 0] },
    ],
  },
];
