/** The documented pre-November-2025 Torre dei Conti; never a present-day intact replacement. */
import { beam, loft } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const brick = [0.57, 0.43, 0.31],
  plaster = [0.69, 0.61, 0.47],
  stone = [0.8, 0.76, 0.64],
  iron = [0.18, 0.19, 0.17],
  dark = [0.075, 0.075, 0.06];
const ring = (x0, x1, z0, z1, y) => [
  [x0, y, z0],
  [x0, y, z1],
  [x1, y, z1],
  [x1, y, z0],
];

function window(out, x, y, w, h, z, { grille = false } = {}) {
  const t = 0.13;
  box(out, 'shadow', [x - w / 2, y, z - 0.2], [x + w / 2, y + h, z - 0.17], dark);
  for (const side of [-1, 1])
    box(
      out,
      'limestone',
      [x + (side * w) / 2 - t / 2, y - t / 2, z - 0.08],
      [x + (side * w) / 2 + t / 2, y + h + t / 2, z + 0.07],
      stone,
    );
  for (const a of [y, y + h])
    box(
      out,
      'limestone',
      [x - w / 2 - t / 2, a - t / 2, z - 0.08],
      [x + w / 2 + t / 2, a + t / 2, z + 0.07],
      stone,
    );
  if (grille) {
    for (let u = x - w / 2 + 0.07; u < x + w / 2; u += 0.12)
      box(out, 'metal', [u - 0.012, y, z - 0.05], [u + 0.012, y + h, z - 0.02], iron);
    for (let v = y + 0.08; v < y + h; v += 0.13)
      box(out, 'metal', [x - w / 2, v - 0.012, z - 0.05], [x + w / 2, v + 0.012, z - 0.02], iron);
  } else {
    box(out, 'wood', [x - 0.033, y, z - 0.12], [x + 0.033, y + h, z - 0.09], [0.28, 0.22, 0.16]);
    box(
      out,
      'wood',
      [x - w / 2, y + h * 0.55 - 0.025, z - 0.12],
      [x + w / 2, y + h * 0.55 + 0.025, z - 0.09],
      [0.28, 0.22, 0.16],
    );
  }
}

function facade(out, width, y0, y1, z, windows, { western = false, seed = 0 } = {}) {
  const xs = [-width / 2, width / 2],
    ys = [y0, y1];
  for (let x = -width / 2 + 0.6; x < width / 2; x += 0.65) xs.push(x);
  for (let y = y0 + 0.65; y < y1; y += 0.72) ys.push(y);
  for (const [x, y, w, h] of windows) {
    xs.push(x - w / 2, x + w / 2);
    ys.push(y, y + h);
  }
  const uniq = (values) =>
    [...new Set(values.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b);
  const xx = uniq(xs),
    yy = uniq(ys);
  for (let i = 1; i < xx.length; i++)
    for (let j = 1; j < yy.length; j++) {
      const a = xx[i - 1],
        b = xx[i],
        c = yy[j - 1],
        d = yy[j],
        x = (a + b) / 2,
        y = (c + d) / 2;
      if (
        y < y0 ||
        y > y1 ||
        x < -width / 2 ||
        x > width / 2 ||
        windows.some(([u, v, w, h]) => x > u - w / 2 && x < u + w / 2 && y > v && y < v + h)
      )
        continue;
      const wav = 0.35 * Math.sin(y * 0.73) + 0.2 * Math.sin(y * 2.9 + seed),
        exposed = western
          ? (y < 11.25 + wav && Math.abs(x + 0.7) > 1.4) || Math.abs(x + 3.3) < 0.3 + wav * 0.2
          : y < 10.3 || Math.abs(x - width * 0.34) < 0.18;
      const color = (exposed ? brick : plaster).map(
        (v) => v * (0.97 + 0.04 * (0.5 + 0.5 * Math.sin(i * 1.71 + j * 2.19 + seed))),
      );
      face(
        out,
        exposed ? 'brick' : 'plaster',
        [
          [a, c, z],
          [b, c, z],
          [b, d, z],
          [a, d, z],
        ],
        color,
      );
    }
  for (const [x, y, w, h, grille] of windows) window(out, x, y, w, h, z, { grille });
  // Putlog sockets are independent inset dark openings, not a baked wall image.
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 5; i++) {
      const x = -width * 0.43 + i * width * 0.215 + 0.19 * Math.sin(i * 7 + j),
        y = y0 + 1.2 + (j * (y1 - y0 - 2.3)) / 7 + 0.22 * Math.sin(i + j * 3);
      if (
        windows.some(
          ([u, v, w, h]) => Math.abs(x - u) < w / 2 + 0.26 && y > v - 0.26 && y < v + h + 0.26,
        )
      )
        continue;
      box(
        out,
        'shadow',
        [x - 0.062, y - 0.055, z + 0.004],
        [x + 0.063, y + 0.055, z + 0.008],
        [0.18, 0.15, 0.115],
      );
    }
}

function buttress(out, x0, x1, z0, z1, height, { base = 4, topInset = 0.18 } = {}) {
  loft(
    out,
    'brick',
    [
      ring(x0 - 0.32, x1 + 0.32, z0 - 0.36, z1 + 0.36, 0),
      ring(x0, x1, z0, z1, base),
      ring(x0 + topInset, x1 - topInset, z0 + topInset, z1 - topInset, height),
    ],
    brick,
  );
  box(
    out,
    'brick',
    [x0 + topInset - 0.05, height, z0 + topInset - 0.05],
    [x1 - topInset + 0.05, height + 0.17, z1 - topInset + 0.05],
    [0.55, 0.43, 0.32],
  );
}

function buildConti(out) {
  // The long SW elevation faces Via dei Fori Imperiali. The three other sides
  // retain projecting medieval buttresses; Muñoz's SW face is largely flush.
  const base = [
    [-11.764, 0, 8.648],
    [-11.764, 0, -7.25],
    [11.6, 0, -8.648],
    [11.764, 0, 8.648],
  ];
  if (
    base.reduce(
      (s, p, i) =>
        s + p[0] * base[(i + 1) % base.length][2] - base[(i + 1) % base.length][0] * p[2],
      0,
    ) > 0
  )
    base.reverse();
  const upper = [
    [-10.6, 3.2, 7.65],
    [-10.6, 3.2, -6.6],
    [10.5, 3.2, -7.5],
    [10.65, 3.2, 7.65],
  ];
  if (
    upper.reduce(
      (s, p, i) =>
        s + p[0] * upper[(i + 1) % upper.length][2] - upper[(i + 1) % upper.length][0] * p[2],
      0,
    ) > 0
  )
    upper.reverse();
  loft(out, 'darkstone', [base, upper], [0.48, 0.45, 0.38]);
  // Alternating pale stone bands of the documented bicrome scarpa face.
  for (let y = 0.25; y < 3.0; y += 0.62) {
    const f = y / 3.2;
    const lower = base.map((p, i) => p.map((v, k) => (k === 1 ? y : v + (upper[i][k] - v) * f))),
      higher = base.map((p, i) =>
        p.map((v, k) => (k === 1 ? y + 0.22 : v + (upper[i][k] - v) * (f + 0.22 / 3.2))),
      );
    loft(out, 'limestone', [lower, higher], [0.67, 0.64, 0.55], { cap: false });
  }
  const west = [
    [-5.5, 10.6, 0.85, 1.45],
    [-2.85, 10.8, 0.75, 1.35],
    [3.0, 11.0, 0.82, 1.2],
    [-5.4, 14.5, 0.82, 1.25],
    [0.35, 14.7, 0.72, 1.3],
    [-2.6, 18.0, 0.46, 1.9],
    [3.15, 18.5, 0.82, 1.3],
    [-5.2, 21.2, 0.48, 2.1],
    [0.45, 21.5, 0.82, 1.3],
    [-2.6, 24.4, 0.48, 2.1],
    [3.25, 25.0, 0.84, 1.2],
    [6.45, 23.9, 0.9, 1.25],
    [6.4, 17.0, 0.85, 1.3],
    [6.4, 9.1, 0.85, 1.3],
    [6.45, 4.8, 0.85, 1.45],
    [-3.15, 5.7, 2.0, 1.05, true],
    [2.7, 5.7, 2.0, 1.05, true],
  ];
  facade(out, 16.2, 3.2, 28.15, 7.05, west, { western: true });
  // Back NE elevation and the two shorter sides follow the supplied floor plans.
  const eastWindows = [];
  for (const x of [-4.55, 4.5])
    for (const y of [11.2, 15.0, 18.8, 22.6, 25.6]) eastWindows.push([x, y, 0.9, 1.35]);
  facade(transform(out, Math.PI, [0, 0, 1.95]), 16.2, 3.2, 28.15, 7.05, eastWindows, { seed: 4 });
  const sideWindows = [];
  for (const x of [-3.4, 3.2])
    for (const y of [10.8, 14.5, 18.2, 22.0, 25.4]) sideWindows.push([x, y, 0.86, 1.45]);
  facade(transform(out, Math.PI / 2, [0, 0, 0.975]), 12.15, 3.2, 28.15, 8.1, sideWindows, {
    seed: 2,
  });
  facade(transform(out, -Math.PI / 2, [0, 0, 0.975]), 12.15, 3.2, 28.15, 8.1, sideWindows, {
    seed: 7,
  });
  // Tall narrow central ribs and lower, massive corner spurs; the SE central
  // rib below is specifically the intact feature lost in November 2025.
  buttress(out, -11.1, -8.0, -0.2, 1.5, 26.4);
  buttress(out, 8.0, 11.2, -0.3, 1.45, 26.7);
  buttress(out, -1.0, 1.05, -8.15, -5.0, 26.1);
  buttress(out, -11.05, -7.7, -7.65, -3.6, 21.4);
  buttress(out, 7.6, 11.05, -7.75, -3.6, 20.2);
  // The NW low annex survives beside the otherwise flush western frontage.
  buttress(out, -10.95, -8.0, 4.1, 7.0, 10.4, { base: 3.4 });
  facade(
    transform(out, -Math.PI / 2, [-10.82, 0, 5.5]),
    2.8,
    3.3,
    10.55,
    0,
    [[-0.05, 5.0, 0.7, 2.0]],
    { seed: 11 },
  );
  // Triangular repaired spur on the SW front, visible in both 2013 and 2024 photographs.
  loft(
    out,
    'plaster',
    [
      ring(-0.4, 1.65, 7.02, 8.45, 0),
      ring(-0.25, 1.3, 7.04, 7.95, 3.2),
      ring(0.1, 1.02, 7.04, 7.14, 11.5),
    ],
    [0.61, 0.53, 0.4],
  );
  // Small exposed-brick edge strips and roof parapet merlons remain separate masses.
  for (const x of [-8.1, 8.1])
    box(out, 'brick', [x - 0.08, 3.2, 6.8], [x + 0.1, 28.2, 7.16], [0.58, 0.45, 0.33]);
  box(out, 'concrete', [-8.12, 27.0, -5.15], [8.12, 27.15, 7.06], [0.48, 0.45, 0.38]);
  for (const [rotation, width, z] of [
    [0, 16.2, 7.05],
    [Math.PI, 16.2, 5.1],
    [Math.PI / 2, 12.15, 8.1],
    [-Math.PI / 2, 12.15, 8.1],
  ]) {
    const f = transform(
      out,
      rotation,
      Math.abs(rotation) === Math.PI / 2 ? [0, 0, 0.975] : [0, 0, 0],
    );
    box(f, 'plaster', [-width / 2, 27.0, z - 0.48], [width / 2, 28.17, z], [0.62, 0.56, 0.45]);
    const count = width > 14 ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + 0.28 + (i * (width - 0.56)) / (count - 1);
      box(f, 'brick', [x - 0.28, 28.15, z - 0.51], [x + 0.28, 28.9, z + 0.06], brick);
      box(f, 'limestone', [x - 0.32, 28.9, z - 0.55], [x + 0.32, 29, z + 0.1], [0.69, 0.65, 0.53]);
    }
    for (const y of [28.42, 28.64])
      beam(
        f,
        'metal',
        [-width / 2 + 0.35, y, z - 0.2],
        [width / 2 - 0.35, y, z - 0.2],
        0.035,
        0.035,
        iron,
      );
  }
  // Access opening, grating and the visible reversible metal bridge at the SE side.
  const entry = transform(out, Math.PI / 2, [0, 0, 4.65]);
  window(entry, 0, 3.45, 1.1, 2.3, 8.14, { grille: true });
  box(entry, 'metal', [-0.72, 3.2, 8.1], [0.72, 3.3, 10.9], iron);
  for (const x of [-0.7, 0.7]) {
    for (const y of [3.86, 4.28])
      beam(entry, 'metal', [x, y, 8.12], [x, y, 10.9], 0.045, 0.045, iron);
    for (const z of [8.25, 9.6, 10.85])
      beam(entry, 'metal', [x, 3.3, z], [x, 4.32, z], 0.045, 0.045, iron);
  }
  // The open treads need continuous stringers, with a return handrail along
  // both edges; the lower flight is a reversible steel access structure.
  for (let i = 0; i < 16; i++) {
    const z = 10.8 + i * 0.14,
      y = 3.2 - i * 0.2;
    box(entry, 'metal', [-0.72, Math.max(0, y - 0.055), z], [0.72, y, z + 0.16], iron);
  }
  for (const x of [-0.69, 0.69]) {
    beam(entry, 'metal', [x, 0.08, 13.04], [x, 3.14, 10.85], 0.075, 0.14, iron);
    beam(entry, 'metal', [x, 1.08, 13.04], [x, 4.3, 10.8], 0.045, 0.045, iron);
    beam(entry, 'metal', [x, 0.57, 13.04], [x, 3.79, 10.8], 0.035, 0.035, iron);
    for (const i of [0, 4, 8, 12, 16]) {
      const z = 10.8 + i * 0.14,
        y = Math.max(0.03, 3.2 - i * 0.2);
      beam(entry, 'metal', [x, y, z], [x, y + 1.1, z], 0.045, 0.045, iron);
    }
  }
}

export const torreDeiConti = {
  id: 'n0584_torre_dei_conti',
  planId: 'N0584',
  title: 'Torre dei Conti',
  wikidata: 'Q605721',
  build: buildConti,
  authoringFile: 'torre-dei-conti-model.mjs',
  brief:
    'Dated pre-collapse exterior: restored irregular west windows, exposed Roman brick patches, three buttressed elevations, bichrome stone scarpa, putlog sockets, roof merlons and access bridge.',
  size: [27, 29, 18],
  front: '+Z is the restored southwest/west facade toward Via dei Fori Imperiali',
  origin: 'Mapped overall base envelope center; Y=0 at the exposed lower foundation contact',
  appearance: {
    mode: 'historical',
    observedYear: 2012,
    corroboratingPhotoYears: [2013, 2024],
    validUntil: '2025-11-02',
    currentWorldEligible: false,
    notes:
      'The November 2025 collapse removed the southern central buttress and affected the base, stair and roof. The intact source intentionally reconstructs the documented pre-collapse appearance; it is excluded from current-world landmark placement.',
  },
  refs: [
    'https://muripertutti.com/wp-content/uploads/2026/01/rsa108_porretta_torre_dei_conti_low.pdf',
    'https://sovraintendenzaroma.it/content/torre-dei-conti',
    'https://commons.wikimedia.org/wiki/File:Tor_dei_Conti_2013-2.jpg',
    'https://commons.wikimedia.org/wiki/File:Roma_-_Torre_dei_Conti_-_2024-09-18_15-32-43_001.JPG',
    'https://www.comune.roma.it/web/it/notizia/crollo-parte-torre-dei-conti.page',
    'https://www.vigilfuoco.it/media/notizie/torre-dei-conti-concluso-lintervento-dei-vigili-del-fuoco-il-monumento-torna-sicurezza',
    'https://www.openstreetmap.org/relation/1899644',
  ],
  facts: {
    survivingHistoricHeightMeters: 29,
    mapEnvelopeMeters: [23.528, 17.295],
    historicalMaximumHeightNotReconstructedMeters: 60,
    appearanceCutoff: '2025-11-02',
  },
  scaleBasis:
    'The exact-identity mapped envelope supplies the base footprint; the heritage study reproduces measured plans and identifies the asymmetric restored western face and three buttressed sides. Their relative wall/rib positions are registered to that envelope. Elevations and individual window positions are photographic reconstructions within the documented 29 m surviving height, not a reconstruction of the lost 60 m medieval tower.',
  geographicProposal: {
    status: 'historical-proposal',
    anchor: [12.487946867, 41.893582146],
    heading: -0.840086736674,
    source: 'https://www.openstreetmap.org/relation/1899644',
    evidence:
      'The long southwest facade faces Via dei Fori Imperiali; native +X points southeast and +Z southwest. This resolves the mapped long-axis sign using the published west-facade identity and street context.',
    orientationConfidence: 'mapped-envelope-and-published-facade-context',
    limitations:
      'Historical appearance only. Current-world placement is excluded after the 2025 collapse. Foundation excavation depth and exact patched plaster edges are represented from photographs; the archaeological surroundings are separate terrain.',
  },
  limits: [
    'This is the pre-collapse exterior documented in the 2012 study and 2013/2024 photographs, not the damaged and stabilized 2026 state. Its explicit historical appearance policy must be honored.',
    'Measured plans determine wall and buttress arrangement; unmeasured vertical offsets, fine plaster-loss boundaries and putlog positions are photographic reconstructions. Unbuilt 1930s restoration proposals and lost medieval upper stories are excluded.',
    'Adjacent houses, trees and the wider archaeological excavation are separate features. No interior is included.',
  ],
  cameras: [
    { name: 'restored-west-windows', position: [15, 17, 35], lookAt: [0, 15, 6] },
    { name: 'southern-buttresses', position: [34, 19, -13], lookAt: [5, 15, 0] },
    { name: 'northern-ribs', position: [-32, 20, -17], lookAt: [-5, 15, 0] },
    { name: 'stone-base-and-bridge', position: [24, 7, 22], lookAt: [3, 5, 4] },
    { name: 'far-silhouette', position: [52, 30, 66], lookAt: [0, 14, 0] },
  ],
};
