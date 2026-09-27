/** Detailed reusable class assets. These are not replicas of named landmarks. */

import { beam, loft, radialRing, sphere, torus } from './authored-structure-mesh.mjs';
import { box, colors, profile, quad, tube } from './structure-mesh.mjs';

const wood = [0.26, 0.19, 0.115],
  paleWood = [0.69, 0.6, 0.42],
  painted = [0.8, 0.81, 0.73];
const roof = [0.2, 0.24, 0.22],
  brick = [0.47, 0.24, 0.16];
const rotateY = (p, a) => [
  p[0] * Math.cos(a) + p[2] * Math.sin(a),
  p[1],
  -p[0] * Math.sin(a) + p[2] * Math.cos(a),
];

function facadePanel(out, angle, radius, y, width, height, slot, color, inset = 0) {
  const points = [
    [-width / 2, y, radius + inset],
    [width / 2, y, radius + inset],
    [width / 2, y + height, radius + inset],
    [-width / 2, y + height, radius + inset],
  ].map((p) => rotateY(p, angle));
  quad(out, slot, points, [Math.sin(angle), 0, Math.cos(angle)], color);
}

export function buildSmockWindmill(out) {
  const sides = 8,
    offset = Math.PI / 8;
  loft(
    out,
    'foundation',
    [
      radialRing(0, 5.1, 5.1, sides, [0, 0], offset),
      radialRing(0.32, 5.1, 5.1, sides, [0, 0], offset),
    ],
    colors.stone,
  );
  loft(
    out,
    'brick',
    [
      radialRing(0.32, 4.85, 4.85, sides, [0, 0], offset),
      radialRing(6, 4.85, 4.85, sides, [0, 0], offset),
    ],
    brick,
  );
  const bodyRadius = (y) => 4.8 - (y - 6) * (1.6 / 13);
  loft(
    out,
    'smock',
    [
      radialRing(6, 4.8, 4.8, sides, [0, 0], offset),
      radialRing(19, 3.2, 3.2, sides, [0, 0], offset),
    ],
    roof,
  );
  // Real weatherboard laps follow the shared surface's 200 mm exposure. Brick courses
  // use the library's metric pattern rather than a conflicting coarse geometry grid.
  for (let face = 0; face < sides; face++) {
    const angle = (face * Math.PI) / 4;
    for (let row = 0; row < 65; row++) {
      const y = 6 + row * 0.2,
        r0 = bodyRadius(y),
        r1 = bodyRadius(y + 0.195);
      const width0 = r0 * 2 * Math.sin(Math.PI / 8),
        width1 = r1 * 2 * Math.sin(Math.PI / 8);
      const z0 = r0 * Math.cos(Math.PI / 8) + 0.037,
        z1 = r1 * Math.cos(Math.PI / 8) + 0.008;
      const color = row % 5 === 0 ? [0.225, 0.263, 0.238] : roof;
      const p = [
        [-width0 / 2, y, z0],
        [width0 / 2, y, z0],
        [width1 / 2, y + 0.195, z1],
        [-width1 / 2, y + 0.195, z1],
      ].map((p) => rotateY(p, angle));
      quad(out, 'smock', p, [Math.sin(angle), 0.04, Math.cos(angle)], color);
      beam(
        out,
        'timber',
        rotateY([-width0 / 2, y, z0], angle),
        rotateY([width0 / 2, y, z0], angle),
        0.024,
        0.025,
        [0.14, 0.18, 0.16],
      );
    }
    // A framed window on alternating elevations, with sill, glazing and mullions.
    if (face % 2 === 0)
      for (const y of [2.1, 8.7, 13.6]) {
        const radius = (y < 6 ? 4.85 : bodyRadius(y + 0.65)) * Math.cos(Math.PI / 8) + 0.09;
        facadePanel(out, angle, radius, y, 1.1, 1.4, 'timber', painted);
        facadePanel(out, angle, radius + 0.02, y + 0.09, 0.92, 1.19, 'window', colors.glass);
        for (const dx of [-0.51, 0, 0.51])
          beam(
            out,
            'timber',
            rotateY([dx, y, radius + 0.06], angle),
            rotateY([dx, y + 1.4, radius + 0.06], angle),
            0.065,
            0.07,
            painted,
          );
        beam(
          out,
          'timber',
          rotateY([-0.55, y + 0.67, radius + 0.06], angle),
          rotateY([0.55, y + 0.67, radius + 0.06], angle),
          0.065,
          0.07,
          painted,
        );
        beam(
          out,
          'timber',
          rotateY([-0.68, y - 0.04, radius + 0.16], angle),
          rotateY([0.68, y - 0.04, radius + 0.16], angle),
          0.13,
          0.24,
          painted,
        );
      }
  }
  // Wagon/person entrance has an actual inset dark surface with plank door and frame.
  facadePanel(out, 0, 4.5, 0.32, 1.8, 2.6, 'timber', painted, 0.04);
  for (let i = 0; i < 9; i++)
    box(out, 'timber', [-0.8 + i * 0.18, 0.42, 4.56], [-0.64 + i * 0.18, 2.8, 4.61], wood);
  for (const y of [0.9, 2.3])
    box(out, 'trim', [-0.8, y, 4.65], [0.8, y + 0.08, 4.71], colors.steel);
  tube(out, 'trim', [0.55, 1.5, 4.7], [0.55, 1.5, 4.78], 0.065, colors.dark, 12);
  // Gallery: radially laid planks, deep cross beams, posts and diagonal braces.
  for (let face = 0; face < 8; face++) {
    const a = (face * Math.PI) / 4;
    for (let k = 0; k < 13; k++) {
      const t0 = a + ((k / 13 - 0.5) * Math.PI) / 4,
        t1 = a + (((k + 0.94) / 13 - 0.5) * Math.PI) / 4;
      const p = (r, t, y) => [Math.sin(t) * r, y, Math.cos(t) * r];
      loft(
        out,
        'timber',
        [
          [p(4.55, t0, 5.93), p(7.4, t0, 5.93), p(7.4, t1, 5.93), p(4.55, t1, 5.93)],
          [p(4.55, t0, 6.07), p(7.4, t0, 6.07), p(7.4, t1, 6.07), p(4.55, t1, 6.07)],
        ],
        k % 3 === 0 ? paleWood : wood,
      );
    }
    const edge = rotateY([0, 5.8, 7.3], a),
      wall = rotateY([0, 2.5, 4.6], a);
    beam(out, 'timber', wall, edge, 0.22, 0.28, wood);
    beam(out, 'timber', rotateY([0, 5.78, 4.5], a), edge, 0.25, 0.32, wood);
    for (const offset of [-0.36, -0.18, 0, 0.18, 0.36]) {
      const t = a + offset;
      if (Math.abs(t - (3 * Math.PI) / 4) < 0.12) continue;
      beam(
        out,
        'timber',
        [Math.sin(t) * 7.25, 6.05, Math.cos(t) * 7.25],
        [Math.sin(t) * 7.25, 7.12, Math.cos(t) * 7.25],
        0.09,
        0.09,
        painted,
      );
    }
    const b = a + Math.PI / 4;
    const railStart = face === 3 ? a + 0.12 : a;
    const railEnd = face === 2 ? b - 0.12 : b;
    for (const y of [6.55, 7.16])
      beam(
        out,
        'timber',
        [Math.sin(railStart) * 7.25, y, Math.cos(railStart) * 7.25],
        [Math.sin(railEnd) * 7.25, y, Math.cos(railEnd) * 7.25],
        0.1,
        0.12,
        painted,
      );
  }
  // Rotatable ogee cap and visible curb ring. Rings follow a designed ogee profile.
  torus(out, 'trim', [0, 19.1, 0], 3.13, 0.13, colors.steel, 64, 8);
  profile(
    out,
    [
      [19.08, 3.5, 3.5],
      [19.7, 3.65, 3.6, 'roof', roof],
      [20.6, 3.25, 3.35, 'roof', roof],
      [21.5, 2.4, 2.8, 'roof', roof],
      [22.3, 1.1, 1.65, 'roof', roof],
      [22.65, 0.08, 0.15, 'roof', roof],
    ],
    48,
  );
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    beam(
      out,
      'timber',
      [Math.cos(a) * 3.6, 19.7, Math.sin(a) * 3.55],
      [Math.cos(a) * 2.37, 21.5, Math.sin(a) * 2.77],
      0.045,
      0.06,
      [0.3, 0.33, 0.3],
    );
  }
  // Four lattice-and-cloth common sails on a windshaft tilted slightly above horizontal.
  const hub = [0, 19.2, 4.6],
    tilt = (10 * Math.PI) / 180;
  const transform = ([x, y, z]) => [
    hub[0] + x,
    hub[1] + y * Math.cos(tilt) + z * Math.sin(tilt),
    hub[2] - y * Math.sin(tilt) + z * Math.cos(tilt),
  ];
  tube(out, 'trim', [0, 18.7, 1.4], transform([0, 0, 0.7]), 0.23, colors.steel, 24);
  sphere(out, 'trim', transform([0, 0, 0.3]), [0.56, 0.56, 0.45], colors.dark, 24, 12);
  for (let blade = 0; blade < 4; blade++) {
    const a = (blade * Math.PI) / 2;
    const sail = (u, r, z) =>
      transform([u * Math.cos(a) + r * Math.sin(a), -u * Math.sin(a) + r * Math.cos(a), z]);
    beam(out, 'timber', sail(0, 0.25, 0), sail(0, 11.5, 0), 0.18, 0.22, painted);
    for (const u of [-0.25, 1.1, 1.8])
      beam(out, 'timber', sail(u, 2.0, 0.03), sail(u, 11.45, 0.03), 0.08, 0.075, painted);
    for (let r = 2; r <= 11.4; r += 0.39)
      beam(out, 'timber', sail(-0.38, r, 0.04), sail(1.86, r, 0.04), 0.06, 0.07, painted);
    // Rolled/partially unfurled cloth occupies the same side of each sail, preserving handedness.
    for (let j = 0; j < 18; j++) {
      const r0 = 3.2 + j * 0.43,
        r1 = r0 + 0.415;
      const points = [
        sail(0.11, r0, 0.12),
        sail(1.07, r0, 0.1),
        sail(1.07, r1, 0.1),
        sail(0.11, r1, 0.12),
      ];
      loft(
        out,
        'canvas',
        [points, points.map((p) => [p[0], p[1], p[2] + 0.018])],
        j % 4 === 0 ? [0.81, 0.79, 0.67] : [0.9, 0.87, 0.75],
      );
    }
  }
  // Manual winding tailpole and bracing to the rear of the gallery, rather than an arbitrary extra rotor.
  beam(out, 'timber', [0, 20.4, -3], [0, 6.55, -8.9], 0.22, 0.28, wood);
  for (const x of [-2.5, 2.5])
    beam(out, 'timber', [x, 19.6, -1.9], [0, 9.4, -7.5], 0.16, 0.18, wood);
  for (const x of [-0.75, 0.75])
    beam(out, 'timber', [x, 6.15, -7.1], [x, 7.15, -7.1], 0.12, 0.12, painted);
  tube(out, 'trim', [-0.85, 6.9, -7.1], [0.85, 6.9, -7.1], 0.12, colors.steel, 12);
  // Exposed access stair on one side of the gallery.
  for (let i = 0; i < 26; i++)
    box(
      out,
      'timber',
      [4.63, 0.32 + i * 0.22, -2 - i * 0.12],
      [5.63, 0.44 + i * 0.22, -1.62 - i * 0.12],
      wood,
    );
  for (const x of [4.63, 5.63]) {
    beam(out, 'timber', [x, 0.24, -1.81], [x, 5.94, -4.81], 0.16, 0.24, wood);
    beam(out, 'timber', [x, 1.45, -1.81], [x, 7.17, -4.81], 0.09, 0.09, painted);
    for (const i of [0, 8, 16, 25])
      beam(
        out,
        'timber',
        [x, 0.4 + i * 0.22, -1.81 - i * 0.12],
        [x, 1.45 + i * 0.22, -1.81 - i * 0.12],
        0.07,
        0.07,
        painted,
      );
  }
}

/** Generic 5 MW turbine; macro dimensions follow NREL/TP-500-38060, original mesh. */
export function buildWindTurbine(out) {
  const white = [0.85, 0.865, 0.85],
    edge = [0.69, 0.73, 0.74],
    steel = [0.29, 0.33, 0.36];
  profile(
    out,
    [
      [0, 4.3, 4.3],
      [0.65, 4.3, 4.3, 'foundation', colors.concrete],
      [0.9, 3.15, 3.15, 'foundation', colors.concrete],
    ],
    64,
  );
  const towerRings = [];
  for (let i = 0; i <= 36; i++) {
    const y = 0.9 + i * (86.7 / 36),
      r = 3 - (y / 87.6) * (3 - 1.935);
    towerRings.push(radialRing(y, r, r, 64));
  }
  loft(out, 'wall', towerRings, white);
  for (const y of [1.15, 21.8, 43.6, 65.4, 86.6])
    torus(out, 'trim', [0, y, 0], 3 - (y / 87.6) * 1.065, 0.035, edge, 64, 6);
  // Entrance with frame, handle, threshold and three service steps.
  box(out, 'trim', [-0.52, 1.0, 2.94], [0.52, 3.4, 3.04], edge);
  box(out, 'wall', [-0.46, 1.08, 3.045], [0.46, 3.34, 3.075], white);
  box(out, 'trim', [0.28, 2, 3.08], [0.33, 2.2, 3.14], steel);
  for (let i = 0; i < 3; i++)
    box(
      out,
      'foundation',
      [-0.75, 0.22 * i, 3.1],
      [0.75, 0.22 * (i + 1), 4.2 - 0.3 * i],
      colors.concrete,
    );
  // Nacelle is a rounded loft rather than a featureless box. Front faces +Z.
  const nacelleRings = [];
  for (const [z, w, h, y] of [
    [-7.7, 1.65, 1.45, 90],
    [-7.2, 2.1, 1.95, 90],
    [-4.5, 2.45, 2.35, 90],
    [2.4, 2.2, 2.05, 90],
    [3.4, 1.6, 1.5, 90],
  ]) {
    nacelleRings.push(
      Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return [
          Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.55 * w,
          y + Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.55 * h,
          z,
        ];
      }),
    );
  }
  loft(out, 'wall', nacelleRings, white);
  box(out, 'trim', [-1.2, 92.35, -5.3], [1.2, 92.65, -2], edge);
  for (let i = 0; i < 16; i++)
    box(out, 'trim', [-1.12, 92.66, -5.15 + i * 0.19], [1.12, 92.69, -5.09 + i * 0.19], steel);
  for (const x of [-1.3, 1.3])
    for (let i = 0; i < 12; i++)
      box(out, 'trim', [x - 0.04, 88.7, -6.5 + i * 0.22], [x + 0.04, 89.6, -6.43 + i * 0.22], edge);
  // Service rail, anemometer and wind vane are modeled on the nacelle roof.
  for (const x of [-1.6, 1.6]) {
    for (const z of [-6.7, -4.2, -1.7])
      tube(out, 'trim', [x, 92.25, z], [x, 93.1, z], 0.035, steel, 8);
    tube(out, 'trim', [x, 93.1, -6.7], [x, 93.1, -1.7], 0.035, steel, 8);
  }
  tube(out, 'trim', [0, 92.45, -6.6], [0, 94, -6.6], 0.04, steel, 8);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    tube(
      out,
      'trim',
      [0, 93.95, -6.6],
      [Math.cos(a) * 0.35, 93.95, -6.6 + Math.sin(a) * 0.35],
      0.022,
      steel,
      6,
    );
    sphere(
      out,
      'trim',
      [Math.cos(a) * 0.35, 93.95, -6.6 + Math.sin(a) * 0.35],
      [0.095, 0.065, 0.095],
      steel,
      10,
      5,
    );
  }
  // NREL hub90m, overhang5m, tilt5degrees and precone2.5degrees.
  const tilt = (5 * Math.PI) / 180,
    cone = (2.5 * Math.PI) / 180;
  const rotor = ([x, y, z]) => [
    x,
    90 + y * Math.cos(tilt) + z * Math.sin(tilt),
    5 - y * Math.sin(tilt) + z * Math.cos(tilt),
  ];
  tube(out, 'trim', [0, 90, 2.9], rotor([0, 0, 1]), 0.75, edge, 32);
  sphere(out, 'wall', rotor([0, 0, 0.5]), [1.55, 1.55, 2.0], white, 48, 24);
  // Planform stations use the public reference rotor's broad chord/twist progression.
  // Symmetric sections approximate the exterior; this is not an aerodynamic simulation mesh.
  const stations = [
    [1.5, 3.54, 13.308, 0.5],
    [2.87, 3.54, 13.308, 0.5],
    [5.6, 3.854, 13.308, 0.4],
    [8.33, 4.167, 13.308, 0.35],
    [11.75, 4.557, 13.308, 0.3],
    [15.85, 4.652, 11.48, 0.3],
    [19.95, 4.458, 10.16, 0.25],
    [24.05, 4.249, 9.011, 0.21],
    [28.15, 4.007, 7.795, 0.18],
    [32.25, 3.748, 6.544, 0.18],
    [36.35, 3.502, 5.361, 0.18],
    [40.45, 3.256, 4.188, 0.18],
    [44.55, 3.01, 3.125, 0.18],
    [48.65, 2.764, 2.319, 0.18],
    [52.75, 2.518, 1.526, 0.18],
    [56.1667, 2.313, 0.863, 0.18],
    [58.9, 2.086, 0.37, 0.18],
    [61.6333, 1.419, 0.106, 0.18],
    [63, 0.18, 0, 0.12],
  ];
  for (let blade = 0; blade < 3; blade++) {
    const az = (blade * Math.PI * 2) / 3;
    const rings = stations.map(([radius, chord, twist, thickness], station) => {
      const t = (twist * Math.PI) / 180;
      return Array.from({ length: 40 }, (_, i) => {
        const a = (i * Math.PI * 2) / 40;
        const u = (1 - Math.cos(a)) / 2;
        const naca =
          5 *
          thickness *
          (0.2969 * Math.sqrt(u) -
            0.126 * u -
            0.3516 * u * u +
            0.2843 * u * u * u -
            0.1015 * u * u * u * u);
        const cx = (u - 0.3) * chord,
          cz = (i < 20 ? 1 : -1) * naca * chord;
        // Cylindrical root gradually transitions to an airfoil and tapers to a closed tip.
        const localX =
          station < 2 ? (-Math.cos(a) * chord) / 2 : cx * Math.cos(t) - cz * Math.sin(t);
        const localZ =
          station < 2 ? (Math.sin(a) * chord) / 2 : cx * Math.sin(t) + cz * Math.cos(t);
        const y = radius * Math.cos(cone),
          z = localZ - radius * Math.sin(cone);
        return rotor([
          localX * Math.cos(az) + y * Math.sin(az),
          -localX * Math.sin(az) + y * Math.cos(az),
          z,
        ]);
      });
    });
    loft(out, 'wall', rings, white);
    // Separate bolted blade bearing ring at each root.
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI) / 10,
        u = Math.cos(a) * 1.47,
        v = Math.sin(a) * 1.47;
      const p = rotor([
        u * Math.cos(az) + 1.7 * Math.sin(az),
        -u * Math.sin(az) + 1.7 * Math.cos(az),
        v,
      ]);
      sphere(out, 'trim', p, [0.04, 0.04, 0.04], steel, 6, 4);
    }
  }
}

export const mapStructures = [
  {
    id: 'map_smock_windmill',
    title: 'Traditional gallery smock windmill',
    build: buildSmockWindmill,
    size: [23.3, 30.6, 16.5],
    frontAxis: '+Z',
    class: 'windmill',
    brief:
      'Octagonal brick base, tapered timber smock with individually lapped boards, framed windows, supported timber gallery, ogee cap, four lattice-and-cloth sails, windshaft, manual winding tailpole and access stair.',
    refs: [
      'https://collection.sciencemuseumgroup.org.uk/objects/co50772/sectioned-model-scale-1-24-of-smock-windmill-from-cranbrook-kent-c-1840-windmills',
      'https://millsarchive.org/2019/09/13/technical-descriptions-of-english-windmills/20/',
    ],
    scaleBasis:
      'Original generic gallery-mill design, not a measured replica. Construction vocabulary is based on museum/archival descriptions; dimensions are authored art values.',
    limits:
      'Exterior only; no milling machinery, working yaw/sail animation, collision refinement or site-specific mill identity. Do not replace a uniquely identified mill with this class fallback when a dedicated model is available.',
  },
  {
    id: 'map_wind_turbine',
    title: 'Three-blade utility wind turbine',
    build: buildWindTurbine,
    size: [126, 153, 24],
    frontAxis: '+Z',
    class: 'wind_turbine',
    brief:
      'Tapered steel tower, rounded nacelle with cooling louvers and service fittings, spinner, shaft, bolted roots and three twisted lofted airfoil blades.',
    refs: [
      'https://www.nrel.gov/docs/fy09osti/38060.pdf',
      'https://www.nrel.gov/docs/fy10osti/45891.pdf',
    ],
    scaleBasis:
      'Macro dimensions follow the public NREL 5 MW reference turbine: 126 m rotor, 90 m hub, 3 m hub diameter, 61.5 m blades, 6 m tower base, 3.87 m tower top, 5 degree shaft tilt and 2.5 degree precone. Nacelle shell and minor fittings are original visual design.',
    limits:
      'The blade exterior uses an approximate symmetric airfoil section and reference planform, not the full aerodynamic airfoil data. Static rotor pose; no operating animation, drivetrain internals or structural/collision certification. Declared size is swept envelope; the source AABB is smaller for this three-blade pose.',
  },
];
