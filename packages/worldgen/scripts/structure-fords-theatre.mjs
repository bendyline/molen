/** Original medium-fi exterior recipe for fords_theatre.
 * Theatre and lower south wing are separated inside the generalized map polygon.
 * Public-domain archival and NPS photographs control the facade and ridge ventilators.
 */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { arched, B, c, roof, window } from './landmark-model-helpers.mjs';

export function fords(o, frame) {
  const { theatre, southWing } = frame.buildingParts;
  const [cx, cz] = theatre.center;
  const { width: w, depth: d } = theatre;
  const front = cz + d / 2,
    back = cz - d / 2;
  B(o, 'brick', cx, -1.25, cz, w, 17.65, d, 'redbrick');
  roof(o, cx, cz, w, d, 16.4, 4.1);
  // White arcade is a shallow facade; inset arched shadows and paneled doors make its depth legible.
  B(o, 'stone', cx, -0.15, front + 0.04, w, 4.65, 0.32, 'cream');
  for (const [y, h, depth] of [
    [4.4, 0.28, 0.48],
    [15.25, 0.18, 0.42],
    [15.7, 0.2, 0.55],
    [16.2, 0.32, 0.85],
  ])
    B(o, 'stone', cx, y, front + 0.15, w + 0.5, h, depth, 'white');
  const pitch = w / 5;
  for (let i = 0; i < 5; i++) {
    const x = cx + (i - 2) * pitch;
    arched(o, x, 0.55, front + 0.23, 2.35, 3.55, 'dark', 'cream');
    B(o, 'stone', x, 0.55, front + 0.25, 1.92, 2.65, 0.06, 'cream');
    for (const dx of [-0.48, 0.48]) {
      for (const y of [0.78, 1.43, 2.08, 2.68]) {
        B(o, 'metal', x + dx, y, front + 0.29, 0.74, 0.44, 0.04, 'curtain');
        B(o, 'stone', x + dx, y + 0.045, front + 0.315, 0.63, 0.34, 0.035, 'white');
      }
      B(o, 'metal', x + Math.sign(dx) * 0.12, 1.35, front + 0.36, 0.045, 0.3, 0.06, 'dark');
    }
    B(o, 'metal', x, 0.55, front + 0.33, 0.035, 2.65, 0.025, 'dark');
    for (let n = 0; n < 3; n++)
      B(o, 'stone', x, n * 0.18, front + 0.95 - n * 0.23, 2.5, 0.18, 1.4 - n * 0.46, 'cream');
    for (const sign of [-1, 1]) {
      const xx = x + sign * 1.12;
      for (const z of [front + 0.5, front + 1.5])
        B(o, 'metal', xx, 0.2, z, 0.055, 0.95, 0.055, 'dark');
      beam(o, 'metal', [xx, 1.3, front + 0.45], [xx, 0.95, front + 1.6], 0.055, 0.055, c.dark);
    }
    for (const y of [5.05, 10.1]) {
      arched(o, x, y, front + 0.14, 1.52, 3.35, 'glass', 'cream', 0.3);
      B(o, 'metal', x, y + 0.04, front + 0.2, 0.065, 3.18, 0.07, 'white');
      for (const dy of [1.1, 2.2]) B(o, 'metal', x, y + dy, front + 0.2, 1.48, 0.06, 0.07, 'white');
      // Low-frequency hood molding, corbels and a faceted center flourish.
      for (const sign of [-1, 1]) {
        B(o, 'stone', x + sign * 0.88, y + 2.7, front + 0.21, 0.22, 0.42, 0.25, 'cream');
        B(o, 'stone', x + sign * 0.55, y - 0.22, front + 0.15, 0.16, 0.2, 0.24, 'cream');
      }
      loft(
        o,
        'stone',
        [
          radialRing(y + 3.37, 0.15, 0.1, 6, [x, front + 0.23]),
          radialRing(y + 3.6, 0.06, 0.05, 6, [x, front + 0.23]),
        ],
        c.cream,
      );
    }
  }
  for (let i = 0; i <= 5; i++) {
    const x = cx - w / 2 + i * pitch;
    B(o, 'brick', x, 4.6, front + 0.08, 0.4, 10.65, 0.24, 'redbrick');
    B(o, 'stone', x, 14.8, front + 0.16, 0.66, 0.25, 0.45, 'cream');
    B(o, 'stone', x, 4.6, front + 0.16, 0.66, 0.25, 0.45, 'cream');
  }
  const ped = [
    [cx - w * 0.36, 16.5, front + 0.34],
    [cx + w * 0.36, 16.5, front + 0.34],
    [cx, 20.5, front + 0.34],
  ];
  o.addConvexPolygon('brick', 'palette:#ffffff', ped, [0, 0, 1], (p) => [p[0], p[1]], c.redbrick);
  for (const [a, b] of [
    [ped[0], ped[2]],
    [ped[2], ped[1]],
  ])
    beam(o, 'stone', a, b, 0.34, 0.65, c.white);
  B(o, 'stone', cx, 16.45, front + 0.35, w * 0.76, 0.24, 0.75, 'white');
  for (let i = 0; i < 30; i++)
    B(
      o,
      'stone',
      cx - w / 2 + 0.25 + (i * (w - 0.5)) / 29,
      15.96,
      front + 0.49,
      0.2,
      0.23,
      0.42,
      'white',
    );
  // All three ridge ventilators are visible in the public-domain 1865 exterior photograph.
  for (const z of [front - 3.0, cz - 0.5, back + 4.2]) {
    B(o, 'stone', cx, 19.95, z, 2.4, 0.75, 2.8, 'cream');
    B(o, 'metal', cx, 20.7, z, 2.5, 1.35, 2.9, 'dark');
    for (let n = 0; n < 5; n++) {
      for (const sign of [-1, 1]) {
        B(o, 'metal', cx, 20.76 + n * 0.25, z + sign * 1.48, 2.48, 0.085, 0.11, 'cream');
        B(o, 'metal', cx + sign * 1.28, 20.76 + n * 0.25, z, 0.11, 0.085, 2.85, 'cream');
      }
    }
    loft(
      o,
      'roof',
      [
        [
          [cx - 1.65, 22.05, z - 1.85],
          [cx - 1.65, 22.05, z + 1.85],
          [cx + 1.65, 22.05, z + 1.85],
          [cx + 1.65, 22.05, z - 1.85],
        ],
        [
          [cx - 0.01, 22.85, z - 0.25],
          [cx - 0.01, 22.85, z + 0.25],
          [cx + 0.01, 22.85, z + 0.25],
          [cx + 0.01, 22.85, z - 0.25],
        ],
      ],
      c.roof,
    );
    B(o, 'stone', cx, 21.95, z, 3.35, 0.16, 3.75, 'white');
  }
  // Sparse service facade, not invented repeated front windows on the rear.
  for (const dx of [-w * 0.36, w * 0.36])
    window(o, cx + dx, 6.2, back - 0.1, 1.25, 2.6, 'cream', 'glass', true, -1);
  window(o, cx + w * 0.36, 0.7, back - 0.1, 1.3, 2.3, 'cream', 'dark', false, -1);
  B(o, 'metal', cx, 0.0, back - 0.12, 3.4, 3.2, 0.1, 'dark');
  for (let k = 0; k < 10; k++)
    B(o, 'metal', cx - 1.5 + k / 3, 0.1, back - 0.2, 0.1, 2.95, 0.1, 'cream');
  for (const x of [cx - w / 2 + 0.4, cx + w / 2 - 0.4]) {
    B(o, 'brick', x, 15.7, back + 2.5, 0.6, 2.1, 0.7, 'redbrick');
    B(o, 'stone', x, 17.7, back + 2.5, 0.8, 0.16, 0.9, 'cream');
  }
  // Current lower south/Star Saloon frontage: three rectangular bays, flat parapet and recessed entrance.
  const [sx, sz] = southWing.center,
    sw = southWing.width,
    sd = southWing.depth;
  B(o, 'brick', sx, -1.25, sz, sw, 13.65, sd, 'brick');
  B(o, 'concrete', sx, 12.35, sz, sw, 0.15, sd, 'cream');
  for (const y of [3.7, 11.9, 12.35])
    B(o, 'brick', sx, y, front + 0.07, sw + 0.2, 0.22, 0.4, 'brick');
  for (const x of [sx - sw / 3, sx, sx + sw / 3]) {
    for (const y of [4.1, 8.3]) window(o, x, y, front + 0.14, 1.5, 2.65, 'cream', 'glass');
    window(o, x, 0.4, front + 0.16, 2.1, 2.9, 'cream', 'glass');
  }
  B(o, 'stone', sx, 3.2, front + 0.2, sw, 0.4, 0.3, 'cream');
}

/** Deliberate distant silhouette: retain closed massing and flat color boundaries. */
export function fordsSkyline(o) {
  const frame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dq/dqc/fords_theatre/map-frame.json',
        import.meta.url,
      ),
    ),
  );
  const t = frame.buildingParts.theatre,
    s = frame.buildingParts.southWing;
  const [x, z] = t.center,
    front = z + t.depth / 2;
  B(o, 'brick', x, -1.25, z, t.width, 17.65, t.depth, 'redbrick');
  roof(o, x, z, t.width, t.depth, 16.4, 4.1);
  B(o, 'stone', x, 0, front + 0.1, t.width, 4.5, 0.3, 'cream');
  for (const y of [15.7, 16.2]) B(o, 'stone', x, y, front + 0.2, t.width + 0.5, 0.25, 0.5, 'cream');
  const ped = [
    [x - t.width * 0.36, 16.5, front + 0.34],
    [x + t.width * 0.36, 16.5, front + 0.34],
    [x, 20.5, front + 0.34],
  ];
  o.addConvexPolygon('brick', 'palette:#ffffff', ped, [0, 0, 1], (p) => [p[0], p[1]], c.redbrick);
  for (const [a, b] of [
    [ped[0], ped[2]],
    [ped[2], ped[1]],
  ])
    beam(o, 'stone', a, b, 0.4, 0.5, c.white);
  for (let i = 0; i < 5; i++) {
    const xx = x + ((i - 2) * t.width) / 5;
    for (const yy of [5.05, 10.1]) B(o, 'glass', xx, yy, front + 0.3, 1.55, 3.35, 0.06, 'glass');
    B(o, 'metal', xx, 0.55, front + 0.3, 1.92, 2.65, 0.06, 'dark');
  }
  for (const zz of [front - 3, z - 0.5, z - t.depth / 2 + 4.2]) {
    B(o, 'stone', x, 20.0, zz, 2.5, 2.05, 2.9, 'cream');
    roof(o, x, zz, 3.35, 3.75, 22.05, 0.8);
  }
  B(o, 'brick', s.center[0], -1.25, s.center[1], s.width, 13.65, s.depth, 'brick');
  B(o, 'concrete', s.center[0], 12.35, s.center[1], s.width, 0.15, s.depth, 'cream');
  for (const xx of [s.center[0] - s.width / 3, s.center[0], s.center[0] + s.width / 3])
    for (const yy of [4.1, 8.3]) B(o, 'glass', xx, yy, front + 0.2, 1.5, 2.65, 0.08, 'glass');
}
export const fordsModel = {
  id: 'fords_theatre',
  recipe: 'structure-fords-theatre.mjs',
  key: 'fords_theatre',
  cell: 'dq/dqc',
  title: "Ford's Theatre",
  brief:
    'Red-brick theatre with five-bay white stone arcade, two tiers of tall arched windows, raised central pediment and slate gable.',
  camera: [35, 27, 48],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-fords-theatre.mjs',
    level: 'skyline',
    export: 'fordsSkyline',
    errorMeters: 0.5,
    caps: { district: { triangles: 4000, errorMeters: 0.3, prune: true } },
  },
  quality: 'medium-fi-exterior',
  reviewStatus: 'authored-exterior-see-current-qa',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Reviewed front terrain reference at model Y0 and foundation down to -1.25 m; preserved Terrarium footprint samples span -0.773 to 0.376 m relative to this reference. Current source-terrain captures show visible steps and no floating foundations.',
  limitations: [
    'Current five-bay theatre and lower south Star Saloon wing, original medium-fi exterior geometry. No interiors, neighboring taller buildings or borrowed meshes.',
    'Generalized Protomaps ensemble partition and facade proportions are estimates. The public-domain 1865 Qualla photograph confirms the facade and three ridge ventilators; the explicitly public-domain NPS 2007 exterior confirms surviving front details. Hidden rear service forms remain approximate.',
    'Terrarium host samples supply ground evidence, not a survey. The foundation extends 1.25 m below the street reference; terrain-contact placement samples the declared front reference point. Dataset resolution and vertical accuracy remain host-dependent.',
    'Fine carved window ornament, hardware, rear openings and roof dimensions are simplified estimates. Earlier attribution-licensed photographs and rights-unverified HABS illustrations are excluded from current imagery approval. Reference photographs stay in local caches and are not embedded or redistributed.',
  ],
  build: fords,
};
