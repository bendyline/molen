/** Researched, individually authored lighthouse exteriors. Each study records its dimensional basis. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  lantern,
  lathe,
  panel,
  piercedFacade,
  railRing,
  transformed,
} from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const pale = [0.76, 0.74, 0.66],
  cream = [0.83, 0.81, 0.72],
  dark = [0.11, 0.135, 0.14],
  red = [0.43, 0.15, 0.1];
const rect = (y, rx, rz) => [
  [-rx, y, -rz],
  [-rx, y, rz],
  [rx, y, rz],
  [rx, y, -rz],
];
export function ring(out, slot, y, inner, outer, thickness, color, segments = 80) {
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments,
      b = ((i + 1) * Math.PI * 2) / segments;
    const p = (r, h, t) => [Math.sin(t) * r, h, Math.cos(t) * r];
    const faces = [
      [p(outer, y, a), p(outer, y, b), p(outer, y + thickness, b), p(outer, y + thickness, a)],
      [p(inner, y, b), p(inner, y, a), p(inner, y + thickness, a), p(inner, y + thickness, b)],
      [
        p(inner, y + thickness, a),
        p(outer, y + thickness, a),
        p(outer, y + thickness, b),
        p(inner, y + thickness, b),
      ],
      [p(inner, y, b), p(outer, y, b), p(outer, y, a), p(inner, y, a)],
    ];
    for (const f of faces) quad(out, slot, f, normalFor(...f.slice(0, 3)), color);
  }
}
/** Exterior taper with actual cut openings, outward radial normals and continuous metric wrap UVs. */
export function shell(
  out,
  { profile, holes = [], slot = 'limestone', color = pale, segments = 128 },
) {
  const radius = (y) => {
    let j = 1;
    while (j < profile.length - 1 && profile[j][0] < y) j++;
    const [a, r] = profile[j - 1],
      [b, s] = profile[j];
    return r + ((s - r) * (y - a)) / (b - a);
  };
  const hs = holes.map((h) => ({
    ...h,
    angle: h.angle ?? 0,
    w: h.w ?? 0.65,
    depth: h.depth ?? 0.28,
  }));
  const ys = [
    ...new Set([...profile.map((p) => p[0]), ...hs.flatMap((h) => [h.y, h.y + h.h])]),
  ].sort((a, b) => a - b);
  const angles = new Set(
    Array.from({ length: segments + 1 }, (_, i) => (i * Math.PI * 2) / segments),
  );
  for (const h of hs) {
    h.theta = Math.asin(Math.min(0.8, h.w / (2 * radius(h.y))));
    for (const a of [h.angle - h.theta, h.angle + h.theta])
      angles.add((a + Math.PI * 2) % (Math.PI * 2));
  }
  const as = [...angles].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < as.length; i++) {
      const y0 = ys[j - 1],
        y1 = ys[j],
        a = as[i - 1],
        b = as[i],
        ym = (y0 + y1) / 2,
        am = (a + b) / 2;
      if (
        hs.some(
          (h) =>
            ym > h.y &&
            ym < h.y + h.h &&
            Math.abs(Math.atan2(Math.sin(am - h.angle), Math.cos(am - h.angle))) < h.theta,
        )
      )
        continue;
      const p = (y, t) => [Math.sin(t) * radius(y), y, Math.cos(t) * radius(y)];
      const ps = [p(y0, a), p(y0, b), p(y1, b), p(y1, a)],
        n = normalFor(...ps.slice(0, 3));
      if (n[0] * Math.sin(am) + n[2] * Math.cos(am) <= 0)
        throw new Error('Cylindrical facade must face outward');
      const r = (radius(y0) + radius(y1)) / 2;
      out.addQuad(
        slot,
        'metric:uv',
        ps,
        n,
        [
          [a * r, y0],
          [b * r, y0],
          [b * r, y1],
          [a * r, y1],
        ],
        typeof color === 'function' ? color(ym, am) : color,
      );
    }
  for (const h of hs) {
    const o = transformed(out, h.angle),
      z = radius(h.y + h.h / 2) * Math.cos(h.theta),
      w = h.w / 2;
    panel(
      o,
      h.blind ? slot : 'glass',
      -w,
      w,
      h.y,
      h.y + h.h,
      z - h.depth,
      h.blind ? (typeof color === 'function' ? color(h.y, 0) : color) : dark,
    );
    const edgeColor = h.trimColor ?? cream;
    for (const x of [-w, w])
      box(
        o,
        h.trimSlot ?? 'granite',
        [x - 0.07, h.y - 0.08, z - h.depth],
        [x + 0.07, h.y + h.h + 0.08, z + 0.055],
        edgeColor,
      );
    for (const y of [h.y, h.y + h.h])
      box(
        o,
        h.trimSlot ?? 'granite',
        [-w - 0.07, y - 0.08, z - h.depth],
        [w + 0.07, y + 0.08, z + 0.065],
        edgeColor,
      );
    if (h.grid) {
      for (const y of [h.y + h.h / 3, h.y + (2 * h.h) / 3])
        beam(
          o,
          'wood',
          [-w, y, z - h.depth + 0.03],
          [w, y, z - h.depth + 0.03],
          0.045,
          0.06,
          cream,
        );
      beam(
        o,
        'wood',
        [0, h.y, z - h.depth + 0.04],
        [0, h.y + h.h, z - h.depth + 0.04],
        0.05,
        0.06,
        cream,
      );
    }
    if (h.pediment) {
      beam(
        o,
        'granite',
        [-w - 0.25, h.y + h.h + 0.2, z + 0.07],
        [0, h.y + h.h + 0.65, z + 0.07],
        0.16,
        0.2,
        cream,
      );
      beam(
        o,
        'granite',
        [0, h.y + h.h + 0.65, z + 0.07],
        [w + 0.25, h.y + h.h + 0.2, z + 0.07],
        0.16,
        0.2,
        cream,
      );
    }
  }
}
export function hipRoof(out, cx, cz, rx, rz, y, h, color = red, slot = 'tiles') {
  loft(
    transformed(out, 0, [cx, 0, cz]),
    slot,
    [rect(y, rx, rz), rect(y + h, Math.max(0.06, rx - rz), 0.06)],
    color,
  );
}
export function squareRails(out, y, rx, rz, color = dark, decorative = false) {
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2),
      half = f % 2 ? rz : rx,
      z = f % 2 ? rx : rz;
    for (const h of [0.06, 0.95])
      beam(o, 'metal', [-half, y + h, z], [half, y + h, z], 0.055, 0.055, color);
    const count = Math.ceil((half * 2) / 0.5);
    for (let i = 0; i <= count; i++) {
      const x = -half + (2 * half * i) / count;
      tube(o, 'metal', [x, y, z], [x, y + 0.95, z], 0.023, color, 8);
      if (decorative && i < count) {
        const d = (2 * half) / count;
        for (const sign of [-1, 1])
          beam(
            o,
            'metal',
            [x, y + (sign > 0 ? 0.18 : 0.8), z],
            [x + d, y + (sign > 0 ? 0.8 : 0.18), z],
            0.035,
            0.035,
            color,
          );
      }
    }
  }
}
export function facadeBlock(
  out,
  { cx = 0, cz = 0, rx, rz, y0, y1, slot = 'rubble', color = pale, windows = [] },
) {
  const o = transformed(out, 0, [cx, 0, cz]);
  for (let f = 0; f < 4; f++)
    piercedFacade(transformed(o, (f * Math.PI) / 2), {
      half: f % 2 ? rz : rx,
      z: f % 2 ? rx : rz,
      y0,
      y1,
      slot,
      color,
      holes: windows.filter((h) => h.face === undefined || h.face === f),
    });
  box(o, slot, [-rx, y1 - 0.1, -rz], [rx, y1, rz], color);
}
function medallion(out, x, y, z, r, color) {
  sphere(out, 'granite', [x, y, z], [r, r, 0.1], color, 24, 12);
}

export function buildMaiden(target) {
  const out = transformed(target, 0, [5, 0, -2.2]);
  // Restored 2023 ensemble: open castle courtyard, single western pavilion and bulbous upper room.
  loft(out, 'ashlar', [rect(0, 17, 11.5), rect(0.8, 17, 11.5)], pale);
  box(out, 'granite', [-17, 0.8, -11.5], [17, 0.95, 11.5], cream);
  const rawTower = transformed(out, 0, [-5, 0, 2.2]),
    factor = 6.4 / 7.6;
  const tower = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) => {
        const q = p.map(([x, y, z]) => [x * factor, y, z * factor]),
          normal = [n[0] / factor, n[1], n[2] / factor],
          len = Math.hypot(...normal);
        rawTower[method](
          slot,
          ref,
          q,
          normal.map((v) => v / len),
          uv,
          color,
        );
      },
    ]),
  );
  facadeBlock(tower, {
    rx: 3.8,
    rz: 3.8,
    y0: 0.95,
    y1: 15.6,
    slot: 'ashlar',
    color: [0.67, 0.65, 0.55],
    windows: [
      { x: 0, y: 3.1, w: 1.05, h: 2.4, depth: 0.4, trim: 0, face: 1 },
      { x: 0, y: 7.5, w: 0.25, h: 1.05, trim: 0 },
      { x: 0, y: 11.3, w: 0.25, h: 1.05, trim: 0 },
      { x: 0, y: 13.35, w: 0.75, h: 1.15, trim: 0 },
    ],
  });
  // Projecting octagonal platform and chamfered plaster bracket undersides.
  loft(
    tower,
    'plaster',
    [
      radialRing(14.4, 3.8, 3.8, 8, [0, 0], Math.PI / 8),
      radialRing(15.7, 5.02, 5.02, 8, [0, 0], Math.PI / 8),
      radialRing(16.04, 5.12, 5.12, 8, [0, 0], Math.PI / 8),
    ],
    cream,
  );
  const radius = 3.85,
    apothem = radius * Math.cos(Math.PI / 8),
    half = radius * Math.sin(Math.PI / 8);
  for (let f = 0; f < 8; f++) {
    const o = transformed(tower, (f * Math.PI) / 4);
    piercedFacade(o, {
      half,
      z: apothem,
      y0: 16.04,
      y1: 19.55,
      slot: 'plaster',
      color: [0.91, 0.87, 0.78],
      holes: [{ x: 0, y: 16.7, w: 0.96, h: 2.35, depth: 0.22, trim: 0.12 }],
    });
    for (const x of [-half + 0.1, half - 0.1])
      box(o, 'plaster', [x - 0.1, 16.05, apothem - 0.01], [x + 0.1, 19.5, apothem + 0.12], cream);
    for (const y of [17.37, 18.05, 18.75])
      beam(o, 'wood', [-0.48, y, apothem - 0.2], [0.48, y, apothem - 0.2], 0.055, 0.055, cream);
    beam(o, 'wood', [0, 16.7, apothem - 0.18], [0, 19.05, apothem - 0.18], 0.06, 0.06, cream);
  }
  railRing(tower, 16.07, 4.85, 0.92, [0.26, 0.24, 0.2], 48);
  for (let f = 0; f < 8; f++) {
    const o = transformed(tower, (f * Math.PI) / 4);
    for (let j = -2; j <= 2; j++) {
      const x = j * 0.48;
      beam(o, 'metal', [x - 0.23, 16.24, 4.49], [x + 0.23, 16.87, 4.49], 0.035, 0.035, dark);
      beam(o, 'metal', [x + 0.23, 16.24, 4.49], [x - 0.23, 16.87, 4.49], 0.035, 0.035, dark);
    }
  }
  const dome = [
    [19.55, 4.1],
    [19.75, 4.24],
    [20.05, 3.95],
    [20.7, 3.73],
    [21.6, 3.15],
    [22.5, 2.44],
    [23.35, 2.16],
    [23.7, 2.15],
    [23.9, 2.35],
  ];
  lathe(tower, 'metal', dome, [0.24, 0.245, 0.22], 96);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    for (let j = 1; j < dome.length; j++)
      tube(
        tower,
        'metal',
        [
          Math.sin(a) * (dome[j - 1][1] + 0.025),
          dome[j - 1][0],
          Math.cos(a) * (dome[j - 1][1] + 0.025),
        ],
        [Math.sin(a) * (dome[j][1] + 0.025), dome[j][0], Math.cos(a) * (dome[j][1] + 0.025)],
        0.022,
        [0.37, 0.36, 0.31],
        8,
      );
  }
  railRing(tower, 23.93, 2.18, 0.7, [0.32, 0.29, 0.23], 32);
  lathe(
    tower,
    'metal',
    [
      [23.9, 0.38],
      [25.0, 0.2],
      [31.2, 0.13],
      [31.5, 0.25],
      [31.8, 0.09],
      [32.5, 0.045],
    ],
    [0.81, 0.79, 0.68],
    32,
  );
  // Courtyard walls and tiled crenel coping are distinct from the post-2000 restaurant additions.
  for (const [cx, cz, rx, rz] of [
    [4.8, -7.5, 8.2, 0.55],
    [4.8, 7.5, 8.2, 0.55],
    [12.45, 0, 0.55, 7.5],
    [-11.8, 0, 0.55, 7.5],
  ]) {
    box(out, 'ashlar', [cx - rx, 0.95, cz - rz], [cx + rx, 5.35, cz + rz], [0.7, 0.68, 0.58]);
    const alongX = rx > rz,
      len = alongX ? rx : rz;
    for (let v = -len + 0.7; v < len; v += 2.25) {
      const x = alongX ? cx + v : cx,
        z = alongX ? cz : cz + v;
      box(out, 'ashlar', [x - 0.63, 5.35, z - 0.63], [x + 0.63, 6.13, z + 0.63], pale);
      hipRoof(out, x, z, 0.71, 0.71, 6.13, 0.3, red);
    }
  }
  // West pavilion retained by the official restoration, with repeated tall windows and central pediment.
  facadeBlock(out, {
    cx: 4.3,
    cz: -8.1,
    rx: 8.2,
    rz: 2.25,
    y0: 0.95,
    y1: 4.95,
    slot: 'plaster',
    color: [0.88, 0.87, 0.79],
    windows: [-6.6, -4.4, -2.2, 2.2, 4.4, 6.6]
      .map((x) => ({ x, y: 2, w: 1.2, h: 2.2, trim: 0.12, face: 2 }))
      .concat([{ x: 0, y: 1.15, w: 1.5, h: 3.3, trim: 0.15, face: 2 }]),
  });
  hipRoof(out, 4.3, -8.1, 8.55, 2.5, 4.95, 1.22, red);
  const o = transformed(out, Math.PI, [4.3, 0, -10.52]);
  beam(o, 'plaster', [-2.2, 4.8, 0], [0, 6.15, 0], 0.28, 0.34, cream);
  beam(o, 'plaster', [0, 6.15, 0], [2.2, 4.8, 0], 0.28, 0.34, cream);
  // The upper entry opens toward the north courtyard; its stair joins the court floor.
  for (let i = 0; i < 11; i++)
    box(out, 'granite', [-1.8 + i * 0.28, 0.95, 1.4], [-1.52 + i * 0.28, 3.15 - i * 0.2, 3], cream);
  for (const z of [1.35, 3.05])
    beam(out, 'metal', [-1.8, 4.05, z], [1.28, 1.85, z], 0.055, 0.055, [0.56, 0.51, 0.39]);
  for (let i = 0; i < 14; i++)
    box(out, 'metal', [-16.6 + i * 2.4, 0.95, 11.15], [-16.48 + i * 2.4, 1.22, 11.35], dark);
}

export function buildCordouan(out) {
  // Circular tidal fort platform, open terrace and Renaissance base, then Teulere's taper.
  shell(out, {
    profile: [
      [0, 20.825],
      [0.9, 20.825],
      [6.05, 19.6],
      [6.3, 19.65],
    ],
    holes: [{ angle: 0, y: 1.1, w: 2.5, h: 3.7, depth: 1.3 }],
    color: pale,
    segments: 160,
  });
  lathe(
    out,
    'limestone',
    [
      [3.03, 19.65],
      [3.1, 19.65],
    ],
    cream,
    160,
  );
  // The crown is a real annular keeper building around a sunken open court, not a solid terrace.
  // The mapped inner radius is12m; roof and court levels are photo-proportioned from the operator.
  ring(out, 'limestone', 6.23, 12, 19.65, 0.07, cream, 160);
  ring(out, 'limestone', 6.3, 12, 12.3, 0.37, cream, 160);
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12,
      r = 12;
    const wall = transformed(out, angle + Math.PI, [Math.sin(angle) * r, 0, Math.cos(angle) * r]);
    piercedFacade(wall, {
      half: r * Math.tan(Math.PI / 24),
      z: 0,
      y0: 3.1,
      y1: 6.3,
      slot: 'limestone',
      color: cream,
      holes: [
        {
          x: 0,
          y: i % 4 === 0 ? 3.12 : 4.04,
          w: i % 4 === 0 ? 0.88 : 0.74,
          h: i % 4 === 0 ? 2.17 : 1.2,
          depth: 0.2,
          trim: 0.06,
        },
      ],
    });
  }
  ring(out, 'limestone', 6.3, 18.7, 19.7, 1.02, cream, 160);
  ring(out, 'granite', 7.3, 18.57, 19.82, 0.18, cream, 160);
  const baseHoles = [];
  for (let f = 0; f < 12; f++)
    baseHoles.push({
      angle: (f * Math.PI) / 6,
      y: 4.0,
      w: f === 0 ? 1.5 : 0.95,
      h: 2.3,
      grid: f !== 0,
      pediment: true,
    });
  shell(out, {
    profile: [
      [3.1, 8.12],
      [11.1, 8.12],
    ],
    holes: baseHoles,
    slot: 'limestone',
    color: cream,
  });
  for (let f = 0; f < 24; f++) {
    const a = ((f + 0.5) * Math.PI) / 12,
      x = Math.sin(a) * 8.26,
      z = Math.cos(a) * 8.26;
    lathe(
      transformed(out, 0, [x, 0, z]),
      'limestone',
      [
        [3.35, 0.29],
        [3.58, 0.35],
        [3.8, 0.22],
        [10.35, 0.22],
        [10.55, 0.37],
        [10.78, 0.37],
      ],
      cream,
      20,
    );
  }
  for (const [y, r, h] of [
    [10.9, 8.6, 0.32],
    [11.22, 8.78, 0.24],
    [11.46, 8.55, 0.3],
    [22.0, 7.45, 0.3],
    [22.3, 7.7, 0.22],
    [26.7, 6.65, 0.24],
    [27.0, 6.9, 0.25],
  ])
    lathe(
      out,
      'granite',
      [
        [y, r],
        [y + h, r],
      ],
      cream,
      128,
    );
  const holes = [];
  for (let f = 0; f < 8; f++) {
    holes.push({ angle: (f * Math.PI) / 4, y: 13.05, w: 1.2, h: 2.7, grid: true, pediment: true });
    holes.push({ angle: (f * Math.PI) / 4, y: 18.0, w: 0.85, h: 1.75, grid: true, pediment: true });
  }
  shell(out, {
    profile: [
      [11.7, 7.05],
      [22.1, 7.05],
    ],
    holes,
    slot: 'limestone',
    color: cream,
  });
  for (let f = 0; f < 16; f++) {
    const a = ((f + 0.5) * Math.PI) / 8,
      o = transformed(out, a);
    box(o, 'granite', [-0.16, 12, 7], [0.16, 21.65, 7.22], cream);
    box(o, 'granite', [-0.28, 21.1, 6.98], [0.28, 21.6, 7.3], cream);
    if (f % 2) medallion(o, 0, 16.55, 7.12, 0.42, pale);
  }
  shell(out, {
    profile: [
      [22.6, 6.45],
      [26.9, 6.35],
    ],
    color: cream,
  });
  const upper = [];
  for (let f = 0; f < 4; f++)
    for (const [y, w, h] of [
      [30.0, 1.45, 3.05],
      [40.2, 1.15, 2.65],
      [49.5, 0.95, 2.05],
    ])
      upper.push({ angle: (f * Math.PI) / 2, y, w, h, grid: true, pediment: true, depth: 0.35 });
  shell(out, {
    profile: [
      [27.25, 6.3],
      [29, 5.95],
      [40, 5.1],
      [51.5, 4.35],
      [58.8, 4.1],
    ],
    holes: upper,
    color: [0.85, 0.84, 0.77],
    segments: 160,
  });
  for (const [y, r] of [
    [58.6, 4.35],
    [59, 4.6],
    [59.45, 4.65],
  ])
    lathe(
      out,
      'granite',
      [
        [y, r],
        [y + 0.24, r],
      ],
      cream,
      128,
    );
  for (let f = 0; f < 24; f++) {
    const a = (f * Math.PI) / 12,
      o = transformed(out, a);
    beam(o, 'granite', [0, 57.8, 4.1], [0, 59.4, 4.65], 0.22, 0.28, pale);
  }
  shell(out, {
    profile: [
      [59.7, 4.4],
      [61.3, 4.4],
    ],
    color: cream,
  });
  railRing(out, 61.3, 4.42, 0.98, dark, 48);
  lantern(out, {
    bottom: 61.45,
    radius: 2.82,
    height: 4.0,
    color: dark,
    segments: 16,
    roofHeight: 1.1,
  });
  tube(out, 'metal', [0, 66.6, 0], [0, 67.5, 0], 0.055, dark, 10);
  // Entrance causeway and stair pocket are part of the platform envelope, not a fake solid door.
  box(out, 'limestone', [-1.55, 0, 18.7], [1.55, 1.4, 23.4], pale);
  for (let i = 0; i < 6; i++)
    box(
      out,
      'granite',
      [-1.3, 0, 23.4 - i * 0.48],
      [1.3, 0.18 + i * 0.18, 23.88 - i * 0.48],
      cream,
    );
  const crane = transformed(out, 0.5, [11.6, 0, 10]);
  tube(crane, 'metal', [0, 6.4, 0], [0, 11.7, 0], 0.085, [0.3, 0.31, 0.25], 12);
  tube(crane, 'metal', [0, 11.3, 0], [3.8, 12.8, 0], 0.055, dark, 10);
  tube(crane, 'metal', [3.8, 12.8, 0], [3.8, 7, 0], 0.015, dark, 8);
}

export function buildKeri(out) {
  // 2024 reconstructed, broad limestone drum supporting the narrow 1858 iron bottle tower.
  const holes = [
    { angle: 0, y: 0.3, w: 1.25, h: 2.6, trimSlot: 'metal', trimColor: red },
    { angle: 1.3, y: 3.7, w: 0.6, h: 1.25, trimSlot: 'metal', trimColor: red },
    { angle: 2.7, y: 7.1, w: 0.6, h: 1.25, trimSlot: 'metal', trimColor: red },
    { angle: 4.2, y: 10.3, w: 0.6, h: 1.25, trimSlot: 'metal', trimColor: red },
  ];
  shell(out, {
    profile: [
      [0, 7.1],
      [1, 7.05],
      [13.35, 6.32],
      [13.6, 6.32],
    ],
    holes,
    slot: 'limestone',
    color: [0.69, 0.69, 0.62],
    segments: 128,
  });
  lathe(
    out,
    'granite',
    [
      [13.6, 6.44],
      [13.78, 6.65],
      [14.02, 6.65],
    ],
    [0.44, 0.45, 0.38],
    128,
  );
  railRing(out, 14.04, 6.36, 0.94, [0.2, 0.21, 0.18], 72);
  shell(out, {
    profile: [
      [14.02, 2.45],
      [15.6, 2.07],
      [17, 1.75],
      [23.3, 1.75],
      [24.1, 2.18],
      [25.2, 2.18],
    ],
    holes: [
      { angle: 0, y: 14.35, w: 0.65, h: 1.75, trimSlot: 'metal', trimColor: red },
      { angle: 0.15, y: 18.4, w: 0.36, h: 0.85, trimSlot: 'metal', trimColor: red },
      { angle: 0.15, y: 21.1, w: 0.36, h: 0.85, trimSlot: 'metal', trimColor: red },
    ],
    slot: 'metal',
    color: [0.36, 0.13, 0.08],
    segments: 96,
  });
  // Riveted iron skin: horizontal laps, vertical joints and visible rivet rows.
  for (let y = 14.55; y < 25.1; y += 0.68) {
    if ((y > 14.3 && y < 16.1) || (y > 18.3 && y < 19.3) || (y > 21 && y < 22)) continue;
    const r =
      y < 17
        ? 2.45 - ((y - 14.02) * 0.7) / 2.98
        : y < 23.3
          ? 1.75
          : Math.min(2.18, 1.75 + ((y - 23.3) * 0.43) / 0.8);
    ring(out, 'metal', y, r - 0.01, r + 0.045, 0.035, [0.32, 0.11, 0.065], 96);
    for (let i = 0; i < 28; i++) {
      const a = (i * Math.PI * 2) / 28;
      sphere(
        out,
        'metal',
        [Math.sin(a) * (r + 0.052), y + 0.065, Math.cos(a) * (r + 0.052)],
        [0.028, 0.028, 0.028],
        [0.26, 0.095, 0.05],
        8,
        4,
      );
    }
  }
  ring(out, 'metal', 24.0, 1.8, 3.18, 0.2, [0.27, 0.11, 0.07], 96);
  railRing(out, 24.22, 3.07, 0.98, dark, 40);
  for (let f = 0; f < 16; f++) {
    const a = (f * Math.PI) / 8,
      o = transformed(out, a);
    beam(o, 'metal', [0, 21.75, 1.74], [0, 24.06, 3.08], 0.1, 0.15, [0.25, 0.11, 0.07]);
  }
  // Close the shell shoulder under the lantern foot; no daylight seam.
  lathe(
    out,
    'metal',
    [
      [25.15, 2.18],
      [25.32, 2.18],
    ],
    [0.36, 0.13, 0.08],
    96,
  );
  lantern(out, {
    bottom: 25.3,
    radius: 1.92,
    height: 3.12,
    color: [0.27, 0.17, 0.13],
    segments: 16,
    roofHeight: 1.65,
  });
  railRing(out, 25.45, 2.18, 2.6, dark, 40);
  tube(out, 'metal', [0, 30.2, 0], [0, 30.6, 0], 0.04, dark, 10);
  const ladder = transformed(out, 0.27);
  for (const x of [-0.28, 0.28])
    tube(ladder, 'metal', [x, 14.2, 2.46], [x, 23.9, 2.15], 0.03, dark, 8);
  for (let y = 14.3; y < 23.9; y += 0.3)
    tube(
      ladder,
      'metal',
      [-0.28, y, 2.46 - ((y - 14.2) * 0.31) / 9.7],
      [0.28, y, 2.46 - ((y - 14.2) * 0.31) / 9.7],
      0.026,
      dark,
      8,
    );
  // The authority photograph shows four openings on the long service face. Its plan is
  // measured from OSM244300628:16.58x10.10m, extending east-southeast of the tower.
  const wing = { cx: 13.93, cz: 0.46, rx: 8.29, rz: 5.05 };
  facadeBlock(out, {
    ...wing,
    y0: 0,
    y1: 3.5,
    slot: 'ashlar',
    color: [0.65, 0.65, 0.58],
    windows: [
      { x: -5.9, y: 0.95, w: 0.9, h: 1.75, trim: 0.06, face: 0 },
      { x: -2.4, y: 0.14, w: 1.1, h: 2.6, trim: 0.06, face: 0 },
      { x: 1.1, y: 0.95, w: 0.9, h: 1.75, trim: 0.06, face: 0 },
      { x: 4.8, y: 0.14, w: 1.1, h: 2.6, trim: 0.06, face: 0 },
      { x: -2.3, y: 1.05, w: 0.85, h: 1.65, trim: 0.06, face: 1 },
      { x: 2.3, y: 1.05, w: 0.85, h: 1.65, trim: 0.06, face: 1 },
    ],
  });
  hipRoof(out, wing.cx, wing.cz, 8.5, 5.28, 3.5, 1.6, [0.4, 0.44, 0.45], 'metal');
  // Standing seams and the chimney/low ventilation hood visible in the2024restoration view.
  for (let x = -3.1; x <= 3.1; x += 0.7)
    for (const sign of [-1, 1])
      beam(
        out,
        'metal',
        [wing.cx + x, 5.13, wing.cz],
        [wing.cx + x, 3.52, wing.cz + sign * 5.28],
        0.026,
        0.045,
        [0.34, 0.38, 0.39],
      );
  box(out, 'ashlar', [11.78, 4.1, -0.2], [12.42, 6.25, 0.48], [0.47, 0.48, 0.41]);
  box(out, 'metal', [11.65, 6.24, -0.32], [12.55, 6.34, 0.6], [0.24, 0.28, 0.29]);
  box(out, 'metal', [16.25, 4.42, 1.45], [17.15, 5.13, 2.35], [0.37, 0.41, 0.42]);
  hipRoof(out, 16.7, 1.9, 0.58, 0.58, 5.13, 0.22, [0.28, 0.32, 0.33], 'metal');
}

const rights =
  'Original geometry and shared procedural materials. Official photographs are research references only; no reference imagery or third-party mesh is embedded or redistributed.';
const limits = [
  'The modeled exterior follows the cited published facts and inspected photographs. Unpublished dimensions and local fittings are explicitly photo-proportioned; no claim of engineering survey accuracy is made.',
  'Portable PBR and shared metric surfaces are provided. Surface weathering, material color under local lighting and fine facade relief require close render review before maximum-detail acceptance.',
];
export const lighthouseStudy = (data) => ({
  ...data,
  referenceRights: rights,
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Authored main tower center at local base level; attached ensembles are offset from this origin.',
  },
  limitations: [...limits, ...(data.limitations ?? [])],
});
export const lighthouseExpansionStudies = [
  lighthouseStudy({
    id: 'N0638',
    key: 'maiden_s_tower',
    title: "Maiden's Tower",
    wikidataId: 'Q848397',
    build: buildMaiden,
    size: [34, 32.5, 23],
    visualBrief:
      'Restored Bosphorus castle-tower ensemble: stone square shaft, projecting octagonal plaster room, curved lead-colored cap, ornamental balconies, tall mast, crenellated courtyard and one-storey pavilion.',
    sourceFacts: {
      restoration:
        '2023 restoration follows the Mahmut II period arrangement with timber upper structure and a one-storey western building.',
      modeledHeightMeters: 32.5,
      heightBasis: 'Photo-proportioned full mast envelope; not a published measured height.',
    },
    referencePages: [
      'https://kizkulesi.gov.tr/en/restoration-diary',
      'https://www.openstreetmap.org/way/398210643',
      'https://www.openstreetmap.org/way/103821245',
      'https://kizkulesi.gov.tr/images/kiz-kulesi-banner1.png',
      'https://kizkulesi.gov.tr/images/kiz-kulesi-komepage-lastImage.png',
    ],
    geographicProposal: {
      anchor: [29.004093, 41.02106],
      heading: 1.721295251,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/398210643',
      notes:
        'Mapped main shaft way398210643 fixes6.4m plan and tower center. Heading1.721295251 sends authored+X north-northwest along the court; the restored pavilion is west, court east/north and tower entry faces the court. Terrain contact uses the mapped inhabited island surface at the tower center; no artificial water-level offset is applied.',
    },
    limitations: [
      'Main shaft width/center, fort axis and pavilion side are mapped. Total mast height32.5m, restored pavilion roof/window proportions and seawall boundary follow official restoration images; these are photographic reconstructions, not measured survey elevations. Decorative railing motifs are geometric reconstructions and moving flag cloth is excluded from the architectural source.',
    ],
    qaCameras: [
      { name: 'near-upper-room', position: [13, 21, 16.2], lookAt: [0, 20, 0.2] },
      { name: 'near-courtyard', position: [25, 13, 13], lookAt: [7, 4, 0] },
      { name: 'near-pavilion', position: [23, 7, -30.2], lookAt: [8, 4, -10.2] },
      { name: 'far-ensemble', position: [48, 27, -55.2], lookAt: [5, 12, -2.2] },
    ],
  }),
  lighthouseStudy({
    id: 'N0639',
    key: 'cordouan_lighthouse',
    title: 'Cordouan Lighthouse',
    wikidataId: 'Q199234',
    build: buildCordouan,
    size: [41.65, 67.5, 44.225],
    visualBrief:
      'Tidal limestone lighthouse with circular seawall terrace, articulated Renaissance lower stages, columns, pilasters and pedimented windows beneath the long tapered upper tower and lantern.',
    sourceFacts: {
      heightMeters: 67.5,
      platformDiameterMeters: 41.65,
      basis: 'French lighthouse operator nomination to IALA and current official visitor page.',
    },
    referencePages: [
      'https://heritage.iala.int/lighthouses/cordouan-lighthouse/',
      'https://www.phare-de-cordouan.fr/decouvrir/visite-virtuelle/',
      'https://heritage.iala.int/content/uploads/2021/05/Cordouan-south-facade-2.jpg',
      'https://www.openstreetmap.org/way/100219438',
      'https://www.openstreetmap.org/way/961700310',
      'https://www.openstreetmap.org/way/759047106',
    ],
    geographicProposal: {
      anchor: [-1.173325364, 45.586319808],
      heading: 1.428030571,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/100219438',
      notes:
        'Exact mapped core identifies the center. Entry path961700310 meets the tower8.00m east and1.15m south of center, fixing authored+Z entrance at heading1.428030571rad. Outer entrance steps961700309 confirm the east quadrant. Terrain contact places the tidal fort base on its mapped reef; the host supplies tide and terrain behavior.',
    },
    limitations: [
      'Main height and platform diameter are published; intermediate stage radii, sculpture relief, window locations and stair geometry are photo-proportioned. The crown keeper building surrounds a mapped12m-radius courtyard; its3.1m court and6.3m roof levels are photo-proportioned. The optical red/green sectors and tidal rocks/causeway beyond the immediate stairs are not modeled.',
    ],
    qaCameras: [
      { name: 'near-renaissance', position: [19, 16, 28], lookAt: [0, 16, 0] },
      { name: 'near-courtyard', position: [20, 15, 24], lookAt: [0, 5, 0] },
      { name: 'near-lantern', position: [10, 64, 15], lookAt: [0, 62, 0] },
      { name: 'far-platform', position: [72, 43, 90], lookAt: [0, 30, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0640',
    key: 'keri_lighthouse',
    title: 'Keri Lighthouse',
    wikidataId: 'Q2984041',
    build: buildKeri,
    size: [29.53, 30.6, 14.2],
    visualBrief:
      'Broad reconstructed limestone drum supporting the narrow riveted red iron bottle tower, two galleries, braced upper balcony, glazed lantern, copper-brown dome and attached low service wing.',
    sourceFacts: {
      heightMeters: 30.6,
      operatorCoordinate: [25.02274216, 59.69871433],
      masonryRestoration:
        'First-stage reconstruction completed by early 2024; upper iron tower and wing restoration remained future stages in the May 2024 operator report.',
      basis:
        'Estonian navigation-aid155 record and2024authority restoration photograph;30.6m supersedes unreferenced28m. Tower base14.2m and attached16.58x10.10m wing use mapped nationalETAK outline way244300628.',
    },
    referencePages: [
      'https://nma.transpordiamet.ee/aton/2738/',
      'https://www.openstreetmap.org/way/244300628',
      'https://www.transpordiamet.ee/uudised/keri-tuletorni-esimene-renoveerimisetapp-edukalt-loppenud',
      'https://www.transpordiamet.ee/sites/default/files/styles/crop_rotate_full/public/2024-05/Keri%20TT.jpg?itok=UkZPDB9-',
    ],
    geographicProposal: {
      anchor: [25.02274216, 59.69871433],
      heading: -0.212064481,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/244300628',
      notes:
        'Official aid coordinate locates the tower base. Authored +X wing follows the measured east-southeast wing axis of nationalETAK-derived OSMway244300628. Tower foundation and wing plan agree at this ground bearing; main service facade faces south-southwest.',
    },
    limitations: [
      'The restored 2024 masonry silhouette is used; pre-restoration missing wall sectors and temporary external steel bands are excluded. Wing plan and bearing are mapped; gallery sections, window heights, roof pitch and rivet spacing are photo-proportioned. Adjacent detached keeper houses are outside this tower asset.',
    ],
    qaCameras: [
      { name: 'near-ironwork', position: [8, 23, 11], lookAt: [0, 22, 0] },
      { name: 'near-lantern', position: [7, 29, 9], lookAt: [0, 27.5, 0] },
      { name: 'near-masonry', position: [29, 10, 22], lookAt: [10, 5, 0] },
      { name: 'far-ensemble', position: [39, 22, 47], lookAt: [5, 14, 0] },
    ],
  }),
];
