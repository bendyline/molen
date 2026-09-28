/** Saint Petersburg's Blue Bridge: distinct cast and concrete vaults under a broad square. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { box, prism, tube } from './structure-mesh.mjs';

const blue = [0.065, 0.31, 0.48],
  lightBlue = [0.085, 0.36, 0.54],
  granite = [0.57, 0.445, 0.385],
  dark = [0.16, 0.18, 0.175],
  white = [0.82, 0.83, 0.77];
const a = 7.85,
  w = 47.7,
  split = 7.6;
const road = (x) => 3.25 + 0.2 * (1 - (x / 14.7) ** 2);
const intrados = (x) => 0.62 + 2.25 * (1 - (x / a) ** 2);
function curve(out, slot, points, radius, color, sides = 10) {
  for (let i = 1; i < points.length; i++)
    tube(out, slot, points[i - 1], points[i], radius, color, sides);
}
function sample(n, fn) {
  return Array.from({ length: n + 1 }, (_, i) => fn(i / n));
}
function archBand(out, z0, z1, lower, upper, slot, color, n = 120) {
  loft(
    out,
    slot,
    sample(n, (t) => {
      const x = -a + 2 * a * t;
      return [
        [x, upper(x), z0],
        [x, upper(x), z1],
        [x, lower(x), z1],
        [x, lower(x), z0],
      ];
    }),
    color,
  );
}
function vault(out) {
  archBand(out, -w, split, intrados, (x) => intrados(x) + 0.25, 'iron', blue);
  archBand(out, split, w, intrados, (x) => intrados(x) + 0.32, 'concrete', [0.46, 0.45, 0.405]);
  archBand(
    out,
    -w,
    w,
    (x) => intrados(x) + 0.25,
    (x) => road(x) - 0.15,
    'concrete',
    [0.59, 0.57, 0.52],
  );
  for (const z of [-w, w]) {
    archBand(out, z - 0.1, z + 0.1, intrados, (x) => road(x) - 0.14, 'iron', blue);
    for (const offset of [0.04, 0.14])
      curve(
        out,
        'iron',
        sample(120, (t) => {
          const x = -a + 2 * a * t;
          return [x, intrados(x) + offset, z + Math.sign(z) * 0.12];
        }),
        0.025,
        lightBlue,
      );
    curve(
      out,
      'iron',
      sample(120, (t) => {
        const x = -a + 2 * a * t;
        return [x, road(x) - 0.1, z];
      }),
      0.07,
      lightBlue,
    );
  }
  // Exposed cast tubbing ribs and bolted flange joints remain visible from the water.
  for (let z = -w + 0.55; z < split; z += 1.1) {
    curve(
      out,
      'iron',
      sample(72, (t) => {
        const x = -a + 2 * a * t;
        return [x, intrados(x) - 0.055, z];
      }),
      0.045,
      blue,
      8,
    );
    for (let x = -7.1; x < 7.3; x += 1.18) {
      beam(
        out,
        'iron',
        [x, intrados(x) - 0.055, z - 0.49],
        [x, intrados(x) - 0.055, z + 0.49],
        0.075,
        0.09,
        blue,
      );
      for (const dz of [-0.37, 0.37])
        sphere(out, 'iron', [x, intrados(x) - 0.12, z + dz], [0.034, 0.022, 0.034], dark, 10, 6);
    }
  }
  for (let x = -7.65; x < 7.8; x += 0.39) {
    beam(
      out,
      'iron',
      [x, intrados(x) + 0.14, -w - 0.13],
      [x, road(x) - 0.14, -w - 0.13],
      0.055,
      0.08,
      lightBlue,
    );
    for (const h of [intrados(x) + 0.23, road(x) - 0.24])
      sphere(out, 'iron', [x, h, -w - 0.18], [0.025, 0.025, 0.018], blue, 12, 8);
  }
  // Concrete downstream soffit retains a smooth barrel and transverse pour joints.
  for (let z = split + 3; z < w; z += 4.2)
    curve(
      out,
      'concrete',
      sample(90, (t) => {
        const x = -a + 2 * a * t;
        return [x, intrados(x) - 0.006, z];
      }),
      0.009,
      [0.37, 0.37, 0.34],
      8,
    );
}
function abutments(out) {
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -14.7 : a,
      x1 = side < 0 ? -a : 14.7;
    box(out, 'stone', [x0, 0, -w], [x1, 3.1, w], granite);
    for (let z = -w; z < w; z += 1.72)
      for (let row = 0; row < 5; row++) {
        const lo = Math.max(-w, z + (row % 2) * 0.86),
          hi = Math.min(w, lo + 1.71);
        if (hi <= lo) continue;
        const col = granite.map((c, i) => c + 0.018 * Math.sin(z * 2.5 + row * 4 + i));
        box(
          out,
          'stone',
          [side < 0 ? -a - 0.07 : a - 0.02, row * 0.61 + 0.008, lo],
          [side < 0 ? -a + 0.02 : a + 0.07, row * 0.61 + 0.606, hi],
          col,
        );
      }
    for (const end of [-1, 1]) {
      // Splayed quay connections: outer wing dimension differs from the cornice width.
      const p = (t) => [side * (a + 6.85 * t * t), end * (w + 9.225 * t)];
      for (let i = 0; i < 36; i++) {
        const [x, z] = p(i / 36),
          [xx, zz] = p((i + 1) / 36);
        for (let row = 0; row < 6; row++) {
          const t0 = row * 0.61 + 0.008,
            t1 = (row + 1) * 0.61 - 0.007;
          const shape = [
            [x, z],
            [xx, zz],
            [xx + side * 1.05, zz],
            [x + side * 1.05, z],
          ];
          prism(
            out,
            'stone',
            shape,
            t0,
            t1,
            granite.map((c) => c + 0.012 * Math.sin(i * 8 + row)),
          );
        }
        beam(
          out,
          'stone',
          [x + side * 0.24, 3.74, z],
          [xx + side * 0.24, 3.74, zz],
          0.78,
          0.2,
          [0.66, 0.55, 0.48],
        );
      }
      const z = end * (w + 0.18);
      box(
        out,
        'stone',
        [side * a - 0.48, 3.07, z - 0.48],
        [side * a + 0.48, 4.1, z + 0.48],
        [0.63, 0.51, 0.44],
      );
    }
  }
}
function ornament(out, cx, y, z, width) {
  // Moika railing: circle frieze, concave diamond frames and four-lobed central flowers.
  const point = (x, dy) => [cx + x, y + dy, z];
  for (let j = 0; j < 4; j++) {
    const x = -width / 2 + (width * (j + 0.5)) / 4;
    curve(
      out,
      'iron',
      sample(32, (t) =>
        point(x + 0.078 * Math.cos(2 * Math.PI * t), 0.865 + 0.104 * Math.sin(2 * Math.PI * t)),
      ),
      0.015,
      lightBlue,
      8,
    );
  }
  for (const sign of [-1, 1]) {
    curve(
      out,
      'iron',
      sample(30, (t) =>
        point(
          -width / 2 + width * t,
          0.12 + 0.58 * (sign > 0 ? 1 : 0) - sign * 0.15 * Math.sin(Math.PI * t),
        ),
      ),
      0.015,
      lightBlue,
      8,
    );
    curve(
      out,
      'iron',
      sample(30, (t) => point(sign * (width / 2 - 0.14 * Math.sin(Math.PI * t)), 0.12 + 0.58 * t)),
      0.015,
      lightBlue,
      8,
    );
  }
  curve(
    out,
    'iron',
    sample(72, (t) => {
      const ang = t * 2 * Math.PI,
        r = 0.13 + 0.046 * Math.cos(4 * ang);
      return point(r * Math.cos(ang), 0.41 + r * Math.sin(ang));
    }),
    0.014,
    lightBlue,
    8,
  );
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      curve(
        out,
        'iron',
        sample(20, (t) =>
          point(sx * (0.14 + (width / 2 - 0.14) * t), 0.41 + sy * (0.04 + 0.25 * t * t)),
        ),
        0.012,
        lightBlue,
        8,
      );
  // Leaf-spindle at each narrow panel joint.
  for (const x of [-width / 2, width / 2]) {
    sphere(out, 'iron', point(x, 0.42), [0.04, 0.24, 0.029], blue, 14, 12);
    for (const h of [0.28, 0.54])
      sphere(out, 'iron', point(x, h), [0.047, 0.022, 0.032], lightBlue, 12, 8);
  }
}
function railing(out) {
  for (const sign of [-1, 1]) {
    const z = sign * (w + 0.015),
      base = (x) => road(x) + 0.2;
    for (const y of [0.03, 0.11, 0.74, 1.01])
      curve(
        out,
        'iron',
        sample(120, (t) => {
          const x = -a + 2 * a * t;
          return [x, base(x) + y, z];
        }),
        y === 1.01 ? 0.035 : 0.021,
        lightBlue,
        12,
      );
    const bays = 10,
      bw = (2 * a) / bays;
    for (let i = 0; i <= bays; i++) {
      const x = -a + bw * i,
        y = base(x);
      box(out, 'iron', [x - 0.1, y, z - 0.09], [x + 0.1, y + 1.045, z + 0.09], blue);
      for (const dy of [0.05, 0.93, 1.04])
        box(
          out,
          'iron',
          [x - 0.12, y + dy, z - 0.11],
          [x + 0.12, y + dy + 0.035, z + 0.11],
          lightBlue,
        );
    }
    for (let i = 0; i < bays; i++)
      for (const f of [-0.25, 0.25]) {
        const x = -a + bw * (i + 0.5 + f);
        ornament(out, x, base(x), z, bw / 2 - 0.045);
      }
    // Plain inner safety railing with round capped pedestals.
    const inner = sign * (w - 2.7);
    for (let x = -a; x <= a; x += a / 4) {
      const y = road(x) + 0.17;
      tube(out, 'iron', [x, y, inner], [x, y + 0.82, inner], 0.065, blue, 20);
      sphere(out, 'iron', [x, y + 0.86, inner], [0.08, 0.06, 0.08], lightBlue, 20, 12);
    }
    for (const h of [0.33, 0.7])
      curve(
        out,
        'iron',
        sample(100, (t) => {
          const x = -a + 2 * a * t;
          return [x, road(x) + 0.17 + h, inner];
        }),
        0.025,
        blue,
        12,
      );
  }
}
function lamp(out, x, z) {
  const b = 3.86;
  const layers = [
    [0, 0.22],
    [0.12, 0.22],
    [0.16, 0.16],
    [0.4, 0.15],
    [0.48, 0.12],
    [0.58, 0.09],
    [2.7, 0.068],
    [2.75, 0.11],
    [2.86, 0.11],
    [2.97, 0.095],
  ];
  loft(
    out,
    'iron',
    layers.map(([dy, r]) => radialRing(b + dy, r, r, 32, [x, z])),
    dark,
  );
  for (let i = 0; i < 12; i++) {
    const t = (i * Math.PI) / 6;
    beam(
      out,
      'iron',
      [x + 0.135 * Math.cos(t), b + 0.2, z + 0.135 * Math.sin(t)],
      [x + 0.092 * Math.cos(t), b + 0.56, z + 0.092 * Math.sin(t)],
      0.021,
      0.025,
      dark,
    );
  }
  const rings = [
    [2.99, 0.13],
    [3.12, 0.19],
    [3.72, 0.27],
    [3.77, 0.3],
    [3.9, 0.18],
    [3.99, 0.055],
  ];
  loft(
    out,
    'iron',
    rings.slice(0, 2).map(([h, r]) => radialRing(b + h, r, r, 6, [x, z])),
    dark,
  );
  loft(
    out,
    'glass',
    [
      [3.12, 0.18],
      [3.72, 0.26],
    ].map(([h, r]) => radialRing(b + h, r, r, 6, [x, z])),
    [0.9, 0.9, 0.78],
  );
  for (let i = 0; i < 6; i++) {
    const a = (-i * Math.PI) / 3;
    beam(
      out,
      'iron',
      [x + 0.18 * Math.cos(a), b + 3.12, z + 0.18 * Math.sin(a)],
      [x + 0.26 * Math.cos(a), b + 3.72, z + 0.26 * Math.sin(a)],
      0.024,
      0.025,
      dark,
    );
  }
  loft(
    out,
    'iron',
    rings.slice(2).map(([h, r]) => radialRing(b + h, r, r, 6, [x, z])),
    dark,
  );
  sphere(out, 'iron', [x, b + 4.04, z], [0.055, 0.09, 0.055], dark, 20, 12);
  tube(out, 'iron', [x, b + 4.03, z], [x, b + 4.28, z], 0.016, dark, 12);
}
function mark(out, x0, z0, x1, z1, width = 0.1) {
  beam(out, 'marking', [x0, road(x0) + 0.012, z0], [x1, road(x1) + 0.012, z1], width, 0.008, white);
}
function pavement(out) {
  loft(
    out,
    'road',
    sample(80, (t) => {
      const x = -14.7 + 29.4 * t;
      return [
        [x, road(x), -w],
        [x, road(x), w],
        [x, road(x) - 0.15, w],
        [x, road(x) - 0.15, -w],
      ];
    }),
    [0.26, 0.27, 0.265],
  );
  for (const sign of [-1, 1]) {
    const z0 = sign < 0 ? -w : w - 2.75,
      z1 = sign < 0 ? -w + 2.75 : w;
    loft(
      out,
      'road',
      sample(80, (t) => {
        const x = -a + 2 * a * t;
        return [
          [x, road(x) + 0.17, z0],
          [x, road(x) + 0.17, z1],
          [x, road(x), z1],
          [x, road(x), z0],
        ];
      }),
      [0.33, 0.34, 0.32],
    );
    curve(
      out,
      'stone',
      sample(80, (t) => {
        const x = -a + 2 * a * t;
        return [x, road(x) + 0.085, sign * (w - 2.76)];
      }),
      0.08,
      [0.65, 0.58, 0.49],
      8,
    );
    // End roads cross the short span; parking rows continue along the hidden river axis.
    for (let x = -14.2; x < 14.5; x += 4.3)
      mark(out, x, sign * 39.1, Math.min(x + 2.3, 14.6), sign * 39.1);
    mark(out, -14.6, sign * 34.5, 14.6, sign * 34.5);
    mark(out, -14.6, sign * 43.8, 14.6, sign * 43.8);
    for (let z = -30; z <= 30; z += 2.7) {
      mark(out, sign * 3.1, z, sign * 8.2, z);
      mark(out, sign * 9.1, z, sign * 14.55, z);
    }
    mark(out, sign * 8.2, -30, sign * 8.2, 30);
    mark(out, sign * 9.1, -30, sign * 9.1, 30);
    for (const z of [-33, 33])
      for (let x = 3.2; x < 14; x += 1.3)
        mark(out, sign * x, z - 0.8, sign * (x + 0.8), z + 0.8, 0.13);
  }
  for (let z = -29; z < 29; z += 5.3) mark(out, 0, z, 0, z + 2.7, 0.1);
  // Two small refuge strips separating the back-to-back parking rows.
  for (const x of [-8.65, 8.65]) {
    box(
      out,
      'stone',
      [x - 0.19, road(x), -30.3],
      [x + 0.19, road(x) + 0.14, 30.3],
      [0.64, 0.58, 0.52],
    );
    for (const z of [-30.3, 30.3])
      sphere(out, 'stone', [x, road(x) + 0.07, z], [0.19, 0.07, 0.19], [0.64, 0.58, 0.52], 24, 12);
  }
}
function nameSign(out, x, z) {
  const y = 3.9;
  tube(out, 'iron', [x, y, z], [x, y + 3.12, z], 0.047, dark, 20);
  for (const side of [-1, 1]) {
    curve(
      out,
      'iron',
      sample(40, (t) => [
        x + side * (0.38 * (1 - t) + 0.12 * Math.sin(t * 5 * Math.PI) * (1 - t)),
        y + 1.65 * t,
        z,
      ]),
      0.017,
      dark,
      10,
    );
    curve(
      out,
      'iron',
      sample(48, (t) => [
        x + side * (0.34 * t + 0.13 * Math.sin(t * 3 * Math.PI)),
        y + 3.21 + 0.14 * Math.sin(t * Math.PI),
        z,
      ]),
      0.015,
      dark,
      10,
    );
  }
  box(out, 'iron', [x - 0.64, y + 2.64, z - 0.05], [x + 0.64, y + 3.22, z + 0.05], dark);
  box(out, 'marking', [x - 0.6, y + 2.68, z - 0.055], [x + 0.6, y + 3.18, z + 0.055], white);
  box(out, 'iron', [x - 0.575, y + 2.705, z - 0.062], [x + 0.575, y + 3.155, z + 0.062], blue);
  const glyph = {
    С: [
      [
        [1, 1],
        [0, 1],
        [0, 0],
        [1, 0],
      ],
    ],
    И: [
      [
        [0, 1],
        [0, 0],
        [1, 1],
        [1, 0],
      ],
    ],
    Н: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
    Й: [
      [
        [0, 1],
        [0, 0],
        [1, 1],
        [1, 0],
      ],
      [
        [0.2, 1.18],
        [0.5, 1.1],
        [0.8, 1.18],
      ],
    ],
    М: [
      [
        [0, 0],
        [0, 1],
        [0.5, 0.5],
        [1, 1],
        [1, 0],
      ],
    ],
    О: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ],
    Т: [
      [
        [0, 1],
        [1, 1],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
    ],
  };
  for (const [text, dy, scale] of [
    ['СИНИЙ', 2.96, 0.115],
    ['МОСТ', 2.77, 0.09],
  ])
    for (let i = 0; i < text.length; i++)
      for (const line of glyph[text[i]])
        for (const face of [-1, 1])
          curve(
            out,
            'marking',
            line.map(([u, v]) => [
              x + face * ((i - (text.length - 1) / 2) * scale * 1.35 + (u - 0.5) * scale),
              y + dy + v * scale,
              z + face * 0.064,
            ]),
            0.007,
            white,
            8,
          );
}
export function buildBlueBridge(out) {
  vault(out);
  abutments(out);
  pavement(out);
  railing(out);
  for (const x of [-8.75, 8.75]) for (const z of [-48.4, 48.4]) lamp(out, x, z);
  for (const x of [-9.2, 9.2]) nameSign(out, x, -51.2);
}
export const blueBridgeStudy = {
  id: 'N0027',
  key: 'blue_bridge',
  title: 'Blue Bridge',
  wikidataId: 'Q2618925',
  mapFrameDocument: 'map-frame.json',
  build: buildBlueBridge,
  brief:
    'The unusually broad Blue Bridge over the Moika: surviving ribbed cast-iron upstream vault, smoother concrete downstream face, granite splayed quays, ornate blue Moika railings and the parking square above.',
  refs: [
    'https://mostotrest-spb.ru/bridges/sinij',
    'https://mostotrest-spb.ru/bridege/photoalbum/sinij-most',
    'https://www.pylon.ru/printed-materials/object2016.pdf',
    'https://stpr.ru/upload/encyclopedia.pdf',
    'https://www.openstreetmap.org/relation/3299061',
  ],
  sourceFacts: {
    lengthMeters: 29.4,
    corniceWidthMeters: 95.4,
    wingWidthMeters: 113.85,
    publishedNominalWidthMeters: 97.3,
    clearSpanMeters: 15.7,
    originalCastWidthMeters: 57,
    downstreamConcreteWidthMeters: 41,
    restorationYears: [2013, 2015],
  },
  reconstruction: {
    intradosSpringAboveWaterMeters: 0.62,
    intradosRiseMeters: 2.25,
    roadAboveWaterMeters: [3.25, 3.45],
    notes:
      'Arch heights, local rib and bolt spacing, ornament and lantern dimensions reconstructed from owner photographs. Published57+41m structural widths are nominal and overlap the95.4m cornice definition; model dividing seam is proportionally placed. Parking layout is clipped to the bridge footprint; surrounding square and monuments remain separate.',
  },
  nativeAxes: {
    x: 'southeast across the short span toward Mariinsky Palace',
    y: 'up from provisional normal-water reference',
    z: 'southwest along river toward the downstream concrete face',
  },
  geographic: (map) => ({
    anchor: map.anchor,
    heading: map.heading - Math.PI / 2,
    elevationMode: 'sea-level',
    elevationMeters: 0,
    notes:
      'Mapped longest axis follows the Moika; model +X is the short crossing axis, rotated90degrees toward the southeast. Upstream ribbed cast face is negativeZ. Provisional water datum and quay contacts require terrain review.',
  }),
  limitations: [
    'Absolute road and water levels need site-elevation verification.',
    'The bridge parking geometry requires a current aerial registration; adjacent square pavement and the Neptune gauge outside the bridge are separate site structures.',
    'Arch rib pitch, casting ornament profiles and lantern dimensions are photograph-based reconstructions, without fabrication drawings.',
  ],
  camera: { position: [79, 52, 95], lookAt: [0, 2, 0], fov: 45 },
  qaCameras: [
    { name: 'upstream-cast-face', position: [0, 5, -77], lookAt: [0, 2, -47.7] },
    { name: 'downstream-concrete-face', position: [0, 5, 77], lookAt: [0, 2, 47.7] },
    { name: 'upstream-cast-ribs', position: [3, 1.5, -60], lookAt: [0, 2, -47.7] },
    { name: 'cast-vault-soffit', position: [0, 1, -42], lookAt: [0, 2, 5] },
    { name: 'concrete-vault-soffit', position: [0, 1, 41], lookAt: [0, 2, 12] },
    { name: 'moika-cast-railing', position: [1, 5, -52.5], lookAt: [0, 4.2, -47.7] },
    { name: 'granite-wingwalls', position: [21, 7, -67], lookAt: [10, 2, -52] },
    { name: 'restored-lantern', position: [12, 9, -54], lookAt: [8.75, 7, -48.4] },
    { name: 'cyrillic-name-sign', position: [11, 7, -56], lookAt: [9.2, 6.6, -51.2] },
    { name: 'parking-square', position: [33, 27, 0], lookAt: [0, 3, 0] },
    { name: 'deck-plan', position: [0, 160, 0.01], lookAt: [0, 0, 0] },
  ],
};
