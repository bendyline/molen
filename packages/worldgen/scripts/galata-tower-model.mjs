/** Galata Tower: original exterior reconstruction from the museum and municipal references. */
import { beam, loft, normalFor, radialRing, sphere, torus } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const tau = Math.PI * 2;
const stone = [0.81, 0.77, 0.65],
  pale = [0.89, 0.85, 0.74];
const red = [0.6, 0.35, 0.25],
  iron = [0.19, 0.2, 0.19],
  lead = [0.49, 0.53, 0.55];
const point = (a, y, r) => [Math.sin(a) * r, y, Math.cos(a) * r];
const face = (out, slot, p, color) => quad(out, slot, p, normalFor(...p), color);
function turn(out, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const p = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  return {
    addQuad(slot, ref, ps, n, uv, color) {
      out.addQuad(slot, ref, ps.map(p), p(n), uv, color);
    },
    addTriangle(slot, ref, ps, n, uv, color) {
      out.addTriangle(slot, ref, ps.map(p), p(n), uv, color);
    },
    addConvexPolygon(slot, ref, ps, n, uv, color) {
      out.addConvexPolygon(slot, ref, ps.map(p), p(n), uv, color);
    },
  };
}
function lathe(out, slot, profile, color, sides = 192) {
  loft(
    out,
    slot === 'ashlar' ? 'ashlar_round' : slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides)),
    color,
  );
}
function delta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= tau;
  while (d < -Math.PI) d += tau;
  return d;
}

/** Curved wall with actual openings, recessed panes, jambs, sills, and arched soffits. */
function piercedCylinder(out, { radius, y0, y1, holes, slot = 'stone', color = stone }) {
  const angles = Array.from({ length: 257 }, (_, i) => (i * tau) / 256);
  for (const h of holes) {
    h.halfAngle = h.width / (2 * radius);
    for (let i = 0; i <= 24; i++)
      angles.push((h.a - h.halfAngle + (2 * h.halfAngle * i) / 24 + tau) % tau);
  }
  angles.sort((a, b) => a - b);
  const cuts = angles.filter((a, i) => !i || a - angles[i - 1] > 0.0000001);
  const top = (h, a) => {
    const x = Math.max(-1, Math.min(1, delta(a, h.a) / h.halfAngle));
    return (
      h.y +
      h.height -
      h.rise +
      h.rise * (h.pointed ? 1 - Math.pow(Math.abs(x), 1.45) : Math.sqrt(Math.max(0, 1 - x * x)))
    );
  };
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i],
      mid = (a + b) / 2;
    const gaps = holes
      .filter((h) => Math.abs(delta(mid, h.a)) < h.halfAngle - 1e-8)
      .sort((a, b) => a.y - b.y);
    let lowA = y0,
      lowB = y0;
    const panel = (a0, b0, a1, b1, r, material, tint) => {
      if (Math.max(a1 - a0, b1 - b0) < 1e-7) return;
      face(
        out,
        material,
        [point(a, a0, r), point(b, b0, r), point(b, b1, r), point(a, a1, r)],
        tint,
      );
    };
    for (const h of gaps) {
      panel(lowA, lowB, h.y, h.y, radius, slot, color);
      const ta = top(h, a),
        tb = top(h, b),
        back = radius - (h.depth ?? 0.5);
      panel(h.y, h.y, ta, tb, back, h.backSlot ?? 'glass', h.backColor ?? [0.14, 0.19, 0.22]);
      face(
        out,
        slot,
        [
          point(a, h.y, radius),
          point(a, h.y, back),
          point(b, h.y, back),
          point(b, h.y, radius),
        ].reverse(),
        pale,
      );
      face(
        out,
        slot,
        [
          point(b, tb, radius),
          point(b, tb, back),
          point(a, ta, back),
          point(a, ta, radius),
        ].reverse(),
        color,
      );
      if (Math.abs(delta(a, h.a) + h.halfAngle) < 1e-6)
        face(
          out,
          slot,
          [
            point(a, h.y, back),
            point(a, h.y, radius),
            point(a, ta, radius),
            point(a, ta, back),
          ].reverse(),
          pale,
        );
      if (Math.abs(delta(b, h.a) - h.halfAngle) < 1e-6)
        face(
          out,
          slot,
          [
            point(b, h.y, radius),
            point(b, h.y, back),
            point(b, tb, back),
            point(b, tb, radius),
          ].reverse(),
          pale,
        );
      lowA = ta;
      lowB = tb;
    }
    panel(lowA, lowB, y1, y1, radius, slot, color);
  }
  // Caps at slab levels close the shell without filling any aperture.
  for (const [y, n, reverse] of [
    [y1, [0, 1, 0], false],
    [y0, [0, -1, 0], true],
  ]) {
    const ring = radialRing(y, radius, radius, 192);
    out.addConvexPolygon(
      slot,
      'palette:#ffffff',
      reverse ? ring.reverse() : ring,
      n,
      (p) => [p[0], p[2]],
      color,
    );
  }
  for (const h of holes) {
    const o = turn(out, h.a),
      z = radius + 0.02,
      w = h.width / 2;
    const trim = h.trim ?? 0.15,
      spring = h.y + h.height - h.rise;
    for (const side of [-1, 1]) {
      box(
        o,
        h.trimSlot ?? 'ashlar',
        [side * w - (side < 0 ? trim : 0), h.y - 0.08, z - 0.09],
        [side * w + (side > 0 ? trim : 0), spring, z + 0.07],
        pale,
      );
    }
    for (let j = 0; j < 18; j++) {
      const a = (Math.PI * j) / 18 + 0.004,
        b = (Math.PI * (j + 1)) / 18 - 0.004;
      const p = (t, extra, zz) => [
        Math.cos(t) * (w + extra),
        spring + Math.sin(t) * (h.rise + extra),
        zz,
      ];
      const front = [
        p(a, 0, z + 0.07),
        p(a, trim, z + 0.07),
        p(b, trim, z + 0.07),
        p(b, 0, z + 0.07),
      ];
      face(o, h.trimSlot ?? 'ashlar', front, j % 3 === 0 ? stone : pale);
      face(
        o,
        h.trimSlot ?? 'ashlar',
        [p(b, trim, z + 0.07), p(a, trim, z + 0.07), p(a, trim, z - 0.11), p(b, trim, z - 0.11)],
        pale,
      );
    }
    box(
      o,
      'ashlar',
      [-w - trim * 1.5, h.y - 0.13, z - 0.1],
      [w + trim * 1.5, h.y + 0.015, z + 0.2],
      pale,
    );
    if (h.mullions) {
      const depth = h.depth ?? 0.5;
      for (let x = -w + 0.24; x < w; x += 0.3)
        tube(
          o,
          'metal',
          [x, h.y + 0.04, z - depth + 0.06],
          [x, spring, z - depth + 0.06],
          0.017,
          iron,
          8,
        );
      for (let y = h.y + 0.35; y < spring; y += 0.55)
        tube(o, 'metal', [-w, y, z - depth + 0.06], [w, y, z - depth + 0.06], 0.017, iron, 8);
    }
  }
}

function galleryRail(out, y, r) {
  for (const dy of [0.09, 0.44, 0.96, 1.13])
    torus(out, 'metal', [0, y + dy, 0], r, dy === 1.13 ? 0.042 : 0.022, iron, 192, 8);
  for (let i = 0; i < 168; i++) {
    const a = (i * tau) / 168;
    tube(out, 'metal', point(a, y, r), point(a, y + 1.12, r), i % 6 === 0 ? 0.034 : 0.018, iron, 8);
    if (i % 6 === 0)
      sphere(out, 'metal', point(a, y + 1.18, r), [0.067, 0.073, 0.067], iron, 10, 6);
  }
}

export function buildGalata(out) {
  lathe(
    out,
    'ashlar',
    [
      [0, 8.225],
      [0.42, 8.225],
      [0.65, 8.1],
    ],
    stone,
  );
  const holes = [
    {
      a: 0,
      y: 2.5,
      height: 3.8,
      rise: 0.15,
      width: 2.3,
      depth: 0.7,
      trim: 0.32,
      backSlot: 'wood',
      backColor: [0.23, 0.19, 0.14],
    },
  ];
  for (const [row, y, width, height] of [
    [0, 8.4, 0.64, 1.28],
    [1, 14.3, 0.7, 1.34],
    [2, 20.4, 0.85, 1.68],
    [3, 27.2, 1.15, 2.2],
    [4, 34.4, 1.35, 2.7],
    [5, 40.8, 0.62, 1.38],
  ])
    for (let k = 0; k < (row === 5 ? 12 : 6); k++)
      holes.push({
        a: ((k + (row % 2) * 0.5) * tau) / (row === 5 ? 12 : 6),
        y,
        width,
        height,
        rise: width * 0.53,
        trim: row < 2 ? 0.1 : 0.17,
        trimSlot: row === 3 || row === 4 ? 'brick' : 'ashlar',
        depth: 0.62,
        mullions: true,
      });
  piercedCylinder(out, { radius: 8.1, y0: 0.65, y1: 43.7, holes });
  // Documented brick repair bands at 13.20 m and 17.17 m, plus geometric chain ornament.
  for (const y of [13.2, 17.17]) {
    lathe(
      out,
      'brick',
      [
        [y, 8.12],
        [y + 0.25, 8.12],
      ],
      red,
    );
    for (let i = 0; i < 176; i++) {
      const a = (i * tau) / 176,
        b = ((i + 0.5) * tau) / 176,
        c = ((i + 1) * tau) / 176;
      beam(out, 'brick', point(a, y + 0.27, 8.14), point(b, y + 0.54, 8.14), 0.11, 0.045, red);
      beam(out, 'brick', point(b, y + 0.54, 8.14), point(c, y + 0.27, 8.14), 0.11, 0.045, red);
    }
  }
  // Lower corbel table, continuous drip edge, and deeply recessed arcade.
  lathe(
    out,
    'ashlar',
    [
      [43.65, 8.08],
      [43.87, 8.4],
      [44.2, 8.73],
      [44.55, 8.78],
      [44.72, 8.35],
    ],
    pale,
  );
  for (let i = 0; i < 112; i++) {
    const o = turn(out, (i * tau) / 112);
    loft(
      o,
      'ashlar',
      [
        [
          [-0.12, 43.65, 8.0],
          [-0.12, 43.65, 8.18],
          [0.12, 43.65, 8.18],
          [0.12, 43.65, 8.0],
        ],
        [
          [-0.18, 44.22, 8.0],
          [-0.18, 44.22, 8.65],
          [0.18, 44.22, 8.65],
          [0.18, 44.22, 8.0],
        ],
      ],
      pale,
    );
  }
  const arcade = Array.from({ length: 14 }, (_, k) => ({
    a: (k * tau) / 14,
    y: 44.95,
    width: 2.96,
    height: 5.15,
    rise: 1.48,
    depth: 0.57,
    trim: 0.19,
    backSlot: 'ashlar_round',
    backColor: stone,
  }));
  piercedCylinder(out, {
    radius: 8.3,
    y0: 44.72,
    y1: 50.55,
    holes: arcade,
    slot: 'ashlar_round',
    color: pale,
  });
  for (const h of arcade) {
    const o = turn(out, h.a),
      z = 7.77;
    const outline = [
      [-0.61, 45.03, z],
      [0.61, 45.03, z],
      [0.61, 47.33, z],
    ];
    for (let i = 1; i <= 24; i++)
      outline.push([
        0.61 * Math.cos((i * Math.PI) / 24),
        47.33 + 0.61 * Math.sin((i * Math.PI) / 24),
        z,
      ]);
    o.addConvexPolygon(
      'glass',
      'palette:#ffffff',
      outline,
      [0, 0, 1],
      (p) => [p[0], p[1]],
      [0.18, 0.24, 0.29],
    );
    for (const x of [-0.59, 0, 0.59])
      tube(o, 'metal', [x, 45.02, z + 0.02], [x, 47.33, z + 0.02], 0.032, iron, 8);
    tube(o, 'metal', [-0.6, 46.14, z + 0.02], [0.6, 46.14, z + 0.02], 0.032, iron, 8);
    box(o, 'ashlar', [-0.84, 44.87, z - 0.04], [0.84, 45.04, 8.25], pale);
  }
  lathe(
    out,
    'ashlar',
    [
      [50.5, 8.28],
      [50.85, 8.51],
      [51.12, 8.93],
      [51.45, 8.96],
      [51.65, 9.08],
    ],
    pale,
  );
  galleryRail(out, 51.65, 8.89);
  const upper = Array.from({ length: 14 }, (_, k) => ({
    a: (k * tau) / 14,
    y: 51.66,
    width: 1.78,
    height: 2.72,
    rise: 0.89,
    depth: 0.2,
    trim: 0.12,
    mullions: true,
  }));
  piercedCylinder(out, {
    radius: 7.09,
    y0: 51.65,
    y1: 54.83,
    holes: upper,
    slot: 'ashlar_round',
    color: pale,
  });
  lathe(
    out,
    'ashlar',
    [
      [54.8, 7.12],
      [54.92, 7.42],
      [55.08, 7.9],
      [55.18, 7.96],
    ],
    pale,
  );
  lathe(
    out,
    'lead',
    [
      [55.16, 7.97],
      [55.29, 7.97],
      [62.5, 0.12],
      [62.59, 0.05],
    ],
    lead,
    224,
  );
  for (let i = 0; i < 112; i++) {
    const a = (i * tau) / 112;
    tube(out, 'metal', point(a, 55.31, 7.94), point(a, 62.47, 0.16), 0.013, [0.37, 0.4, 0.41], 6);
  }
  for (let j = 1; j <= 13; j++) {
    const y = 55.3 + j * 0.5,
      r = (7.95 * (62.59 - y)) / (62.59 - 55.29);
    torus(out, 'metal', [0, y, 0], r + 0.024, 0.014, [0.4, 0.43, 0.44], 144, 6);
  }
  // Four roof dormers. A closed triangular shell intersects the cone without sky gaps.
  for (let k = 0; k < 4; k++) {
    const o = turn(out, (k * Math.PI) / 2 + Math.PI / 4),
      z = 6.42;
    box(o, 'lead', [-0.48, 56.18, z - 1.1], [0.48, 57.76, z], lead);
    box(o, 'glass', [-0.32, 56.4, z + 0.012], [0.32, 57.47, z + 0.033], [0.15, 0.19, 0.23]);
    for (const side of [-1, 1])
      face(
        o,
        'lead',
        [
          [0, 58.0, z + 0.16],
          [side * 0.58, 57.67, z + 0.16],
          [side * 0.58, 57.67, z - 1.2],
          [0, 58.0, z - 1.2],
        ],
        lead,
      );
    o.addTriangle(
      'lead',
      'palette:#ffffff',
      [
        [-0.58, 57.67, z + 0.16],
        [0.58, 57.67, z + 0.16],
        [0, 58, z + 0.16],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      lead,
    );
  }
  const gold = [0.77, 0.59, 0.23];
  lathe(
    out,
    'gold',
    [
      [62.5, 0.065],
      [62.9, 0.14],
      [63.35, 0.14],
      [63.62, 0.09],
      [64.2, 0.08],
      [65.0, 0.07],
      [66.9, 0.012],
    ],
    gold,
    48,
  );
  for (const [y, r] of [
    [62.92, 0.33],
    [63.67, 0.22],
    [64.38, 0.15],
  ])
    sphere(out, 'gold', [0, y, 0], [r, r * 1.22, r], gold, 32, 18);
  // Empire-style south entry, bifurcated marble stair and forged handrails.
  box(out, 'ashlar', [-1.75, 2.28, 7.98], [1.75, 2.5, 10.12], pale);
  for (const side of [-1, 1]) {
    for (let j = 0; j < 14; j++) {
      const x = 1.75 + j * 0.29,
        y = (2.5 * (14 - j)) / 14;
      box(
        out,
        'ashlar',
        [side > 0 ? x : -x - 0.29, 0, 8.4],
        [side > 0 ? x + 0.29 : -x, y, 10.1],
        pale,
      );
      if (j % 2 === 0)
        for (const z of [8.43, 10.02])
          tube(
            out,
            'metal',
            [side * (x + 0.1), y, z],
            [side * (x + 0.1), y + 0.93, z],
            0.027,
            iron,
            8,
          );
    }
    for (const z of [8.43, 10.02])
      tube(out, 'metal', [side * 1.85, 3.43, z], [side * 5.62, 1.11, z], 0.038, iron, 10);
  }
  for (const x of [-1.55, 1.55]) {
    box(out, 'ashlar', [x - 0.21, 2.5, 8.11], [x + 0.21, 6.9, 8.53], pale);
    box(out, 'ashlar', [x - 0.3, 2.5, 8.05], [x + 0.3, 2.92, 8.61], pale);
    box(out, 'ashlar', [x - 0.29, 6.5, 8.06], [x + 0.29, 6.93, 8.61], pale);
  }
  box(out, 'ashlar', [-1.93, 6.84, 8.01], [1.93, 7.13, 8.68], pale);
  box(out, 'ashlar', [-1.63, 7.13, 8.05], [1.63, 8.5, 8.27], pale);
  box(out, 'ashlar', [-1.89, 8.47, 8.03], [1.89, 8.74, 8.48], pale);
  // Four panel fields record the inscription's layout without fabricated calligraphy.
  for (const x of [-0.76, 0.76])
    for (const y of [7.41, 8.03])
      box(
        out,
        'plaster',
        [x - 0.66, y - 0.22, 8.274],
        [x + 0.66, y + 0.22, 8.284],
        [0.67, 0.65, 0.57],
      );
}

export const galataStudies = [
  {
    id: 'N0561',
    key: 'galata_tower',
    wikidataId: 'Q91274',
    title: 'Galata Tower',
    build: buildGalata,
    visualBrief:
      'Detailed present-day exterior: cylindrical stone body with recessed arched openings, brick repair bands and chain courses, fourteen-bay upper arcade, cantilevered iron-railed gallery, smaller observation storey, lead roof seams and four dormers, gold finial, and south-facing marble double stair.',
    sourceFacts: {
      baseDiameterMeters: 16.45,
      roofTipMeters: 62.59,
      finialTipMeters: 66.9,
      observationDeckMeters: 51.65,
      brickBandsMeters: [13.2, 17.17],
      upperBays: 14,
      entrance: 'south',
      measurementSources:
        'Turkish Museums / Galata Tower Museum brochure; Istanbul Fire Department; Semavi Eyice architectural account.',
    },
    nativeAxes: {
      up: '+Y',
      front: '+Z south entrance',
      origin: 'center of circular masonry footprint at outside paving grade',
    },
    referencePages: [
      'https://muze.gov.tr/s3/MysFileLibrary/566f7fe8-c812-421d-9baa-86e7bb228337.pdf',
      'https://itfaiye.ibb.gov.tr/en/fire-towers.html',
      'https://islamansiklopedisi.org.tr/galata-kulesi',
      'https://turkishmuseums.kprod.kultur.gov.tr/museum/detail/22341-istanbul-galata-tower-museum/22341/4',
      'https://www.openstreetmap.org/way/23236783',
    ],
    referenceRights:
      'Operator and municipal photographs/plans were inspected as references. No third-party image, plan pixels or mesh is included. Original geometry uses the repository license; OSM geographic evidence is © OpenStreetMap contributors, ODbL.',
    geographicProposal: {
      anchor: [28.974214291, 41.025634117],
      heading: 0,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://muze.gov.tr/s3/MysFileLibrary/566f7fe8-c812-421d-9baa-86e7bb228337.pdf',
      notes:
        'Circular exact-QID OSM footprint center supplies the anchor; museum brochure explicitly locates the entrance on the south axis. Native +Z is south, so heading 0. Ground contact uses the host terrain at the masonry base; the stairs are part of the model.',
    },
    limitations: [
      'Exterior architectural reconstruction; individual repaired stones, fine calligraphy, and changing temporary signs are not facsimiles. Window row heights, roof seams and rail divisions are proportioned from operator imagery rather than a measured facade survey.',
      'The museum gives 62.59 m to the roof tip; the municipal fire department separately gives 66.90 m including the ornament. Those distinct levels are retained.',
    ],
    qaCameras: [
      { name: 'near-entrance', position: [13, 9, 24], lookAt: [0, 5, 8.2] },
      { name: 'near-gallery', position: [18, 53, 22], lookAt: [0, 49.5, 0] },
      { name: 'near-roof', position: [-18, 64, 24], lookAt: [0, 58.5, 0] },
      { name: 'near-masonry', position: [14, 20, 18], lookAt: [0, 17, 0] },
      { name: 'far-silhouette', position: [92, 47, 132], lookAt: [0, 32, 0] },
    ],
  },
];
