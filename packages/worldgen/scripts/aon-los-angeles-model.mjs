/** Los Angeles Aon Center, reconstructed from owner aerials and its exact mapped perimeter. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { face, tau, transform } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const perimeter = [
  [-26.667, -13.499],
  [-25.071, -13.523],
  [-25.08, -14.83],
  [-24.346, -14.833],
  [-24.345, -15.643],
  [-23.064, -15.653],
  [-23.072, -17.032],
  [-13.82, -17.082],
  [17.088, -17.422],
  [22.952, -17.493],
  [22.947, -15.987],
  [24.138, -15.986],
  [24.135, -15.233],
  [24.985, -15.232],
  [24.982, -14.103],
  [26.667, -14.103],
  [26.539, 13.424],
  [25.033, 13.436],
  [25.026, 14.85],
  [24.248, 14.851],
  [24.237, 15.611],
  [23.104, 15.611],
  [23.098, 17.493],
  [-22.921, 17.493],
  [-22.908, 16.016],
  [-24.171, 16.012],
  [-24.166, 15.245],
  [-24.952, 15.254],
  [-24.948, 14.053],
  [-26.515, 14.077],
];

function buildAonLosAngeles(out) {
  const bronze = [0.31, 0.28, 0.23],
    rib = [0.5, 0.46, 0.37],
    glass = [0.21, 0.24, 0.25],
    white = [0.84, 0.83, 0.77],
    dark = [0.16, 0.18, 0.18],
    red = [0.75, 0.055, 0.19],
    roof = [0.67, 0.66, 0.59];
  const height = 261.5184,
    ring = (y) => perimeter.map(([x, z]) => [x, y, z]).reverse();
  loft(out, 'glass', [ring(0), ring(height)], glass, { cap: false });
  // Continuous narrow mullions and recessed bronze spandrels across the four principal faces.
  // The small stepped corner faces are deliberately stone, not treated as window bays.
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[(i + 1) % perimeter.length],
      b = perimeter[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    const nx = dz / len,
      nz = -dx / len,
      wall = transform(out, Math.atan2(-dz, dx), [a[0], 0, a[1]]);
    if (len < 4) {
      box(wall, 'limestone', [0, 0, -0.01], [len, height, 0.14], white);
      for (let y = 0; y < height; y += 1.42)
        box(wall, 'metal', [0, y, 0.135], [len, y + 0.017, 0.149], [0.58, 0.59, 0.56]);
      continue;
    }
    const bays = Math.round(len / 1.48),
      pitch = len / bays;
    for (let j = 0; j < bays; j++) {
      const x = j * pitch + 0.065,
        w = pitch - 0.13;
      // Ground-floor glazing and its tall, clearly separate lobby module.
      face(
        wall,
        'glass',
        [
          [x, 0.18, 0.018],
          [x + w, 0.18, 0.018],
          [x + w, 8.72, 0.018],
          [x, 8.72, 0.018],
        ],
        [0.24, 0.32, 0.34],
      );
      for (const y of [0.12, 3.05, 5.85, 8.78])
        box(wall, 'metal', [j * pitch, y, 0.032], [(j + 1) * pitch, y + 0.12, 0.15], dark);
      for (let floor = 0; floor < 60; floor++) {
        const y = 9.15 + floor * 4.065;
        box(wall, 'metal', [x, y, 0.026], [x + w, y + 1.1, 0.074], bronze);
        face(
          wall,
          'glass',
          [
            [x, y + 1.1, 0.021],
            [x + w, y + 1.1, 0.021],
            [x + w, y + 4.035, 0.021],
            [x, y + 4.035, 0.021],
          ],
          glass,
        );
        box(wall, 'metal', [x, y + 1.08, 0.082], [x + w, y + 1.145, 0.117], rib);
        box(wall, 'metal', [x, y + 4.01, 0.06], [x + w, y + 4.065, 0.105], rib);
      }
    }
    for (let j = 0; j <= bays; j++) {
      const x = j * pitch;
      box(wall, 'metal', [x - 0.067, 8.92, 0.019], [x + 0.067, 253.1, 0.26], rib);
      box(wall, 'metal', [x - 0.042, 0.12, 0.018], [x + 0.042, 8.91, 0.18], dark);
    }
    // Pale crown panels, with the continuous dark roof-level vent slit below.
    box(wall, 'limestone', [0, 254.52, 0.021], [len, height, 0.13], white);
    box(wall, 'metal', [0, 253.1, 0.024], [len, 254.51, 0.035], dark);
    for (let j = 0; j <= Math.ceil(len / 0.85); j++) {
      const x = Math.min(len, j * 0.85);
      box(wall, 'metal', [x - 0.011, 254.55, 0.132], [x + 0.011, height, 0.145], [0.69, 0.7, 0.66]);
    }
    for (let x = 0.5; x < len - 0.2; x += 4.0)
      sphere(wall, 'metal', [x, 253.76, 0.16], [0.17, 0.17, 0.11], white, 12, 8);
    // The photograph shows monumental slab corners rather than projecting pilasters.
    if (Math.abs(nx) + Math.abs(nz) < 0.1) throw Error('Invalid facade normal');
  }
  // The dominant long south-east entrance gets its photographed glass canopy and revolving doors.
  const entrance = transform(out, 0, [0, 0, 17.3]);
  box(entrance, 'metal', [-8.5, 4.15, -0.12], [8.5, 4.39, 2.55], white);
  for (let x = -8.4; x < 8.5; x += 1.4)
    box(entrance, 'glass', [x, 4.39, -0.05], [x + 1.32, 4.435, 2.5], [0.31, 0.42, 0.42]);
  for (const x of [-5.3, 0, 5.3]) {
    loft(
      entrance,
      'glass',
      [radialRing(0.06, 1.05, 1.05, 36, [x, 0.16]), radialRing(3.45, 1.05, 1.05, 36, [x, 0.16])],
      [0.27, 0.33, 0.33],
    );
    for (const y of [0.06, 3.44])
      loft(
        entrance,
        'metal',
        [radialRing(y, 1.1, 1.1, 36, [x, 0.16]), radialRing(y + 0.07, 1.1, 1.1, 36, [x, 0.16])],
        dark,
      );
    beam(entrance, 'metal', [x, 0.04, 0.16], [x, 3.5, 0.16], 0.08, 0.08, dark);
  }
  // Roof is flat, with its private helicopter pad on the southwest half and screened services northeast.
  loft(out, 'concrete', [ring(height - 0.24), ring(height - 0.15)], roof);
  box(
    out,
    'concrete',
    [-23.0, height - 0.13, -14.0],
    [2.0, height - 0.03, 11.0],
    [0.77, 0.76, 0.71],
  );
  for (const z of [-13.7, 10.7])
    box(out, 'metal', [-22.7, height - 0.022, z - 0.1], [1.7, height - 0.009, z + 0.1], red);
  for (const x of [-22.7, 1.7])
    box(out, 'metal', [x - 0.1, height - 0.022, -13.7], [x + 0.1, height - 0.009, 10.7], red);
  for (let i = 0; i < 96; i++) {
    const a = (i * tau) / 96,
      b = ((i + 1) * tau) / 96;
    beam(
      out,
      'metal',
      [-10.5 + Math.cos(a) * 7.3, height + 0.01, -1.5 + Math.sin(a) * 7.3],
      [-10.5 + Math.cos(b) * 7.3, height + 0.01, -1.5 + Math.sin(b) * 7.3],
      0.18,
      0.021,
      red,
    );
  }
  for (const x of [-12.6, -8.4])
    box(out, 'metal', [x - 0.17, height + 0.015, -4.9], [x + 0.17, height + 0.034, 1.9], red);
  box(out, 'metal', [-12.7, height + 0.015, -1.68], [-8.3, height + 0.034, -1.32], red);
  for (const [x, z, w, d, h] of [
    [11, -8, 10, 7, 1.8],
    [12, 7, 9, 6, 1.5],
    [21, 0, 3.0, 9, 2.0],
    [5, 0, 3, 6, 1.2],
  ]) {
    box(
      out,
      'metal',
      [x - w / 2, height - 0.1, z - d / 2],
      [x + w / 2, height + h, z + d / 2],
      [0.65, 0.66, 0.61],
    );
    for (let j = 0; j < Math.floor(w); j++)
      box(
        out,
        'metal',
        [x - w / 2 + j + 0.15, height + 0.4, z + d / 2 + 0.02],
        [x - w / 2 + j + 0.53, height + h - 0.12, z + d / 2 + 0.06],
        dark,
      );
  }
  for (const [x, z] of [
    [19, -10],
    [19, 10],
    [6, 12],
    [-24, -12],
  ]) {
    beam(out, 'metal', [x, height, z], [x, height + 3.2, z], 0.09, 0.11, dark);
    sphere(out, 'carvedstone', [x, height + 3.26, z], [0.14, 0.15, 0.14], red, 16, 8);
  }
  // Four red Aon signs, each offset to the right corner as in the current owner aerials.
  function sign(wall, x, z) {
    const yy = 256.0,
      at = (u, v) => [x + u, yy + v, z],
      th = 0.32;
    beam(wall, 'metal', at(-2.8, 0), at(-1.42, 4.0), th, 0.18, red);
    beam(wall, 'metal', at(-1.42, 4.0), at(-0.02, 0), th, 0.18, red);
    beam(wall, 'metal', at(-2.24, 1.4), at(-0.58, 1.4), th, 0.18, red);
    for (let i = 0; i < 36; i++) {
      const a = (i * tau) / 36,
        b = ((i + 1) * tau) / 36;
      beam(
        wall,
        'metal',
        at(1.53 + Math.cos(a) * 1.13, 1.48 + Math.sin(a) * 1.42),
        at(1.53 + Math.cos(b) * 1.13, 1.48 + Math.sin(b) * 1.42),
        th,
        0.18,
        red,
      );
    }
    beam(wall, 'metal', at(3.21, 0), at(3.21, 2.88), th, 0.18, red);
    beam(wall, 'metal', at(3.21, 2.88), at(5.05, 0), th, 0.18, red);
    beam(wall, 'metal', at(5.05, 0), at(5.05, 2.88), th, 0.18, red);
  }
  for (const [a, w, z] of [
    [0, 45.95, 17.51],
    [Math.PI, 45.95, 17.36],
    [Math.PI / 2, 27.15, 26.7],
    [-Math.PI / 2, 27.15, 26.7],
  ])
    sign(transform(out, a), w / 2 - 7.1, z + 0.18);
}

export const aonLosAngeles = {
  id: 'n0580_aon_center',
  planId: 'N0580',
  title: 'Aon Center (Los Angeles)',
  wikidata: 'Q607743',
  build: buildAonLosAngeles,
  authoringFile: 'aon-los-angeles-model.mjs',
  componentMap: { limestone: 'concrete' },
  brief:
    'Charles Luckman’s bronze Los Angeles tower with a deeply modeled curtain-wall grid, stepped pale corners, double-height glazed lobby and entrance canopy, white roof screen with red Aon signs, and the private rooftop helicopter pad.',
  size: [54, 265, 38],
  front: '+Z is the south-east Wilshire entrance facade; +X follows the north-east long axis',
  origin: 'Exact-QID mapped shaft center, ground contact Y=0',
  refs: [
    'https://707wilshire.com/',
    'https://images1.showcase.com/d2/M41o8nFrIRkn3FD0-djaLKnSrVQz4ZocUGsM2JRHuW4/document.pdf',
    'https://planning.lacity.gov/eir/WilshireGrandRedevProj/DEIR/DEIR%20Sections/IV.A.2.%20Land%20Use%20Physical.pdf',
    'https://www.laconservancy.org/learn/historic-places/aon-center/',
    'https://www.openstreetmap.org/way/428021714',
  ],
  facts: {
    roofHeightFeet: 858,
    roofHeightMeters: 261.5184,
    ownerPublishedStories: 62,
    typicalFloorSquareFeet: 19500,
    architect: 'Charles Luckman',
    privateRooftopHelipad: true,
  },
  scaleBasis:
    'The City of Los Angeles environmental study identifies this exact address as 858 feet high; the owner’s 2025 brochure confirms 62 stories, correcting the conflicting 67-floor map tag. Exact mapped stepped perimeter sets plan dimensions. Current owner aerials establish the bronze windows, pale corner cladding, crown sign position and southwest roof helipad.',
  geographicProposal: {
    anchor: [-118.256990902, 34.049232293],
    heading: 0.904196755804,
    source: 'https://www.openstreetmap.org/way/428021714',
    evidence:
      'Exact-QID stepped footprint supplies the long axis; the owner’s aerial context places the entrance on the south-east Wilshire facade and helicopter pad on the southwest half of the roof.',
    orientationConfidence: 'exact-mapped-perimeter-and-owner-aerial-context',
    limitations:
      'The separate adjoining parking structure is not duplicated. Small roof-service dimensions are reconstructed from aerial photographs; the 261.5184 m published roof datum excludes rooftop aerials.',
  },
  limits: [
    'Individual office blind states and reflections are dynamic and not baked into the asset. Rooftop service equipment and aerials use visible owner photographs rather than an as-built mechanical schedule.',
    'The 62-story owner description takes precedence over the conflicting 67-floor map tag. The adjacent garage and other independently mapped buildings are outside this tower asset.',
  ],
  cameras: [
    { name: 'wilshire-entrance', position: [35, 14, 43], lookAt: [0, 7, 16] },
    { name: 'curtain-wall', position: [48, 140, 54], lookAt: [0, 133, 0] },
    { name: 'crown-signs', position: [57, 258, 62], lookAt: [0, 250, 0] },
    { name: 'helipad-and-services', position: [-61, 305, 62], lookAt: [0, 259, 0] },
    { name: 'far-silhouette', position: [305, 154, 397], lookAt: [0, 132, 0] },
  ],
};
