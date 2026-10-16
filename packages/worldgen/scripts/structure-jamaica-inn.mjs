/** Jamaica Inn: slate-hung bar, granite museum wing and historic lower ranges. */
import './install-deterministic-math.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('aaa18a'),
  slate = rgb('858981'),
  roof = rgb('69716e'),
  wood = rgb('283b35'),
  glass = rgb('5b6867'),
  pale = rgb('c4c8b9');
function facing(o, a, x = 0, z = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    v = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, c) => o.addTriangle(s, r, p.map(q), v(n), uv, c),
    addQuad: (s, r, p, n, uv, c) => o.addQuad(s, r, p.map(q), v(n), uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => {
      const pp = p.map(q),
        u = p.map(uv);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => u[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function upNormal(p) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  return n;
}
function hip(o, x, z, w, l, y, rise) {
  const a = [x - w / 2, y, z - l / 2],
    b = [x + w / 2, y, z - l / 2],
    c = [x + w / 2, y, z + l / 2],
    d = [x - w / 2, y, z + l / 2];
  const along = l > w,
    ridge = along
      ? [
          [x, y + rise, z - l / 2 + w * 0.42],
          [x, y + rise, z + l / 2 - w * 0.42],
        ]
      : [
          [x - w / 2 + l * 0.42, y + rise, z],
          [x + w / 2 - l * 0.42, y + rise, z],
        ];
  const faces = along
    ? [
        [a, b, ridge[0]],
        [b, c, ridge[1], ridge[0]],
        [c, d, ridge[1]],
        [d, a, ridge[0], ridge[1]],
      ]
    : [
        [a, b, ridge[1], ridge[0]],
        [b, c, ridge[1]],
        [c, d, ridge[0], ridge[1]],
        [d, a, ridge[0]],
      ];
  for (const p of faces)
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      o.addTriangle(
        'roof',
        ref,
        t,
        upNormal(t),
        t.map((v) => [v[0], v[2]]),
        roof,
      );
    }
  beam(o, 'roof', ridge[0], ridge[1], 0.18, 0.17, roof);
}
function win(o, x, y, z, w, h, d, { door = false, curtain = true } = {}) {
  if (!d) return;
  face(o, 'glass', x, y, z, w, h, door ? wood : glass);
  if (d < 2) return;
  for (const u of [-w / 2 - 0.07, w / 2 + 0.07])
    B(o, 'wood', x + u, y - 0.06, z + 0.035, 0.12, h + 0.12, 0.14, wood);
  for (const yy of [y - 0.06, y + h]) B(o, 'wood', x, yy, z + 0.035, w + 0.25, 0.12, 0.14, wood);
  if (!door && curtain) {
    for (const u of [-w * 0.32, w * 0.32])
      face(o, 'glass', x + u, y + 0.1, z + 0.012, w * 0.22, h - 0.16, pale);
  }
  face(o, 'wood', x, y, z + 0.12, 0.07, h, wood);
  if (d > 2) {
    for (let u = -w / 2 + 0.23; u < w / 2; u += 0.23)
      face(o, 'wood', x + u, y, z + 0.09, 0.022, h, wood);
    for (let v = 0.24; v < h; v += 0.24) face(o, 'wood', x, y + v, z + 0.1, w, 0.022, wood);
  }
  B(o, 'stone', x, y - 0.15, z + 0.08, w + 0.27, 0.12, 0.24, stone);
}
function cladding(o, w, h, z, holes, d) {
  if (d < 2) return;
  const colors = ['92988e', '7c857d', '899087', 'a0a294', '7a817c'].map(rgb),
    step = d === 2 ? 0.65 : 0.36;
  for (let row = 0, y = 0.1; y < h - 0.1; row++, y += step) {
    const width = d === 2 ? 1.35 : 0.76;
    for (let col = 0, x = -w / 2 + (row % 2) * width * 0.5; x < w / 2; col++, x += width) {
      const a = Math.max(-w / 2, x),
        b = Math.min(w / 2, x + width - 0.025);
      if (b - a < 0.08) continue;
      const xx = (a + b) / 2,
        yy = y + step / 2;
      if (
        holes.some(
          (q) =>
            xx > q.x - q.w / 2 - 0.2 &&
            xx < q.x + q.w / 2 + 0.2 &&
            yy > q.y - 0.2 &&
            yy < q.y + q.h + 0.2,
        )
      )
        continue;
      face(
        o,
        'cladding',
        xx,
        y,
        z,
        b - a,
        Math.min(step - 0.025, h - y),
        colors[(row * 7 + col * 3) % colors.length],
      );
    }
  }
}
function rubble(o, w, h, z, holes, d) {
  if (d < 2) return;
  const cols = ['a49d89', 'b2a991', '999783', 'b8ad96', 'a8a28d'].map(rgb),
    step = d > 2 ? 0.34 : 0.68;
  for (let row = 0, y = 0.06; y < h; row++, y += step) {
    let x = -w / 2 - (row % 2) * 0.3,
      col = 0;
    while (x < w / 2) {
      const width = (d > 2 ? 0.48 : 1.05) + ((row * 17 + col * 13) % 7) * 0.055,
        a = Math.max(x, -w / 2),
        b = Math.min(x + width - 0.025, w / 2),
        yy = Math.min(step - 0.024, h - y);
      col++;
      x += width;
      if (b - a < 0.06 || yy < 0.04) continue;
      const xx = (a + b) / 2;
      if (
        holes.some(
          (q) =>
            xx > q.x - q.w / 2 - 0.18 &&
            xx < q.x + q.w / 2 + 0.18 &&
            y + yy / 2 > q.y - 0.13 &&
            y + yy / 2 < q.y + q.h + 0.13,
        )
      )
        continue;
      const p = [
        [a + 0.03, y, z],
        [b - 0.025, y + 0.01, z],
        [b, y + yy * 0.52, z],
        [b - 0.02, y + yy, z],
        [a + 0.01, y + yy - 0.01, z],
        [a, y + yy * 0.48, z],
      ];
      o.addConvexPolygon(
        'stone',
        ref,
        p,
        [0, 0, 1],
        (p) => [p[0], p[1]],
        cols[(row * 3 + col * 7) % cols.length],
      );
    }
  }
}
function porch(o, x, z, d) {
  for (const u of [-0.82, 0.82]) B(o, 'stone', x + u, -3, z, 0.3, 5.15, 0.85, stone);
  const tri = [
    [x - 1.25, 2.15, z + 0.5],
    [x + 1.25, 2.15, z + 0.5],
    [x, 3.58, z + 0.5],
  ];
  o.addTriangle(
    'wood',
    ref,
    tri,
    [0, 0, 1],
    tri.map((v) => [v[0], v[1]]),
    wood,
  );
  for (const sign of [-1, 1]) {
    const p = [
      [x + sign * 1.4, 2.05, z + 0.65],
      [x, 3.72, z + 0.65],
      [x, 3.72, z - 1.1],
      [x + sign * 1.4, 2.05, z - 1.1],
    ];
    quad(o, 'roof', p, upNormal(p), roof);
  }
  win(o, x, 0.12, z + 0.44, 1.25, 2.05, d, { door: true, curtain: false });
  if (d > 1) face(o, 'wood', x, 2.5, z + 0.55, 1.25, 0.36, wood);
}
function dormer(o, x, y, z, w, d) {
  B(o, 'stone', x, y, z - 0.35, w, 0.8, 0.8, stone);
  const p = [
    [x - w / 2 - 0.15, y + 1.0, z + 0.2],
    [x + w / 2 + 0.15, y + 1.0, z + 0.2],
    [x + w / 2 + 0.15, y + 2.0, z - 3.0],
    [x - w / 2 - 0.15, y + 2.0, z - 3.0],
  ];
  quad(o, 'roof', p, upNormal(p), roof);
  for (const sign of [-1, 1])
    quad(
      o,
      'roof',
      [
        [x + (sign * w) / 2, y, z],
        [x + (sign * w) / 2, y + 1.0, z],
        [x + (sign * w) / 2, y + 2.0, z - 3.0],
        [x + (sign * w) / 2, y, z - 3.0],
      ],
      [sign, 0, 0],
      roof,
    );
  if (d) win(o, x, y - 0.72, z + 0.06, w - 0.16, 1.4, d);
}
function gable(o, x, z, w, l, y, rise) {
  for (const sign of [-1, 1]) {
    const p = [
      [x + (sign * w) / 2, y, z - l / 2],
      [x, y + rise, z - l / 2],
      [x, y + rise, z + l / 2],
      [x + (sign * w) / 2, y, z + l / 2],
    ];
    quad(o, 'roof', p, upNormal(p), roof);
  }
  for (const sign of [-1, 1]) {
    const p = [
      [x - w / 2, y, z + (sign * l) / 2],
      [x + w / 2, y, z + (sign * l) / 2],
      [x, y + rise, z + (sign * l) / 2],
    ];
    o.addTriangle(
      'stone',
      ref,
      p,
      [0, 0, sign],
      p.map((v) => [v[0], v[1]]),
      stone,
    );
  }
}
export function jamaica(o, _frame, d = 3) {
  // Front and rear bar ranges, museum/stables wing and the low historic east connector.
  B(o, 'cladding', 4.1, -3, 0, 18.4, 8.6, 12, slate);
  hip(o, 4.1, 0, 19.1, 12.6, 5.6, 3.0);
  B(o, 'stone', 5.8, -3, -15, 28.4, 8.15, 18, stone);
  hip(o, 5.8, -15, 29, 18.6, 5.15, 3.2);
  B(o, 'stone', -12, -3, 9, 13.5, 7.9, 26, stone);
  hip(o, -12, 9, 14.1, 26.7, 4.9, 3.15);
  B(o, 'stone', -16, -3, -10, 17, 7.4, 12, stone);
  hip(o, -16, -10, 17.6, 12.6, 4.4, 2.4);
  B(o, 'stone', 19.6, -3, 2.5, 12.8, 5.8, 13.3, stone);
  const lower = facing(o, -Math.PI / 2, 19.6, 2.5);
  gable(lower, 0, 0, 13.9, 13.5, 2.8, 2.0);
  // Main five-window bar front and two slate-clad axial stacks.
  const f = facing(o, 0, 4.1, 6.04),
    xs = [-7.1, -3.2, 0, 3.2, 7.1],
    holes = [];
  for (const x of xs) {
    holes.push({ x, y: 3.82, w: 1.15, h: 1.55 });
    win(f, x, 3.82, 0.03, 1.15, 1.55, d);
  }
  for (const x of [-7.1, -3.2, 3.2, 7.1]) {
    const door = x === -7.1;
    holes.push({ x, y: door ? 0.15 : 0.65, w: 1.25, h: door ? 2.25 : 1.65 });
    win(f, x, door ? 0.15 : 0.65, 0.03, 1.25, door ? 2.25 : 1.65, d, { door });
  }
  holes.push({ x: 0, y: 0, w: 2.7, h: 3.6 });
  cladding(f, 18.4, 5.6, 0.015, holes, d);
  porch(f, 0, 0.65, d);
  for (const x of [-2.7, 10.5]) {
    B(o, 'cladding', x, 7.65, 0, 1.15, 3.0, 1.6, slate);
    B(o, 'cladding', x, 9.3, 0, 1.35, 0.15, 1.8, slate);
    B(o, 'stone', x, 10.65, 0, 1.22, 0.15, 1.67, stone);
    if (d > 1)
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const q = facing(o, a, x, 0);
        for (let y = 8.1; y < 10.65; y += 0.42)
          face(
            q,
            'cladding',
            0,
            y,
            a % Math.PI === 0 ? 0.81 : 0.59,
            a % Math.PI === 0 ? 1.15 : 1.6,
            0.018,
            wood,
          );
      }
  }
  // Museum frontage faces the cobbled forecourt, perpendicular to the bar front.
  const museum = facing(o, Math.PI / 2, -5.22, 14),
    mx = [-5.9, -1.7, 2.5, 6.7];
  for (const [i, x] of mx.entries()) dormer(museum, x, 4.75, 0.0, i === 0 ? 2.7 : 1.4, d);
  win(museum, -7, 0.1, 0.03, 1.1, 2.55, d, { door: true });
  win(museum, -5.4, 0.5, 0.03, 1.6, 2.1, d);
  win(museum, -1.7, 0.7, 0.03, 1.1, 1.5, d);
  win(museum, 6.7, 0.7, 0.03, 1.1, 1.5, d);
  porch(museum, 2.5, 0.65, d);
  if (d > 0) {
    B(museum, 'wood', -5.7, 2.8, 0.14, 3.9, 0.2, 0.2, wood);
    face(museum, 'wood', -3, 3.05, 0.04, 1.1, 1.4, wood);
  }
  // Front end of former stables; restrained treatment where vegetation hides detail.
  rubble(
    museum,
    16,
    4.9,
    0.012,
    [
      ...mx.map((x, i) => ({ x, y: 4.03, w: i === 0 ? 2.7 : 1.4, h: 1.4 })),
      { x: -7, y: 0.1, w: 1.1, h: 2.55 },
      { x: -5.4, y: 0.5, w: 1.6, h: 2.1 },
      { x: -1.7, y: 0.7, w: 1.1, h: 1.5 },
      { x: 6.7, y: 0.7, w: 1.1, h: 1.5 },
      { x: 2.5, y: 0, w: 2.8, h: 3.7 },
    ],
    d,
  );
  const end = facing(o, 0, -12, 22.03);
  for (const x of [-3.5, 0, 3.5]) for (const y of [0.65, 3.25]) win(end, x, y, 0.04, 1.2, 1.45, d);
  const east = facing(o, 0, 19.6, 9.18);
  for (const x of [-3.7, 0, 3.7]) win(east, x, 0.5, 0.04, 1.2, 1.5, d);
  porch(east, -5.3, 0.65, d);
  rubble(
    east,
    12.8,
    2.8,
    0.012,
    [
      ...[-3.7, 0, 3.7].map((x) => ({ x, y: 0.5, w: 1.2, h: 1.5 })),
      { x: -5.3, y: 0, w: 2.8, h: 3.7 },
    ],
    d,
  );
  rubble(
    end,
    13.5,
    4.9,
    0.015,
    [-3.5, 0, 3.5].flatMap((x) => [0.65, 3.25].map((y) => ({ x, y, w: 1.2, h: 1.45 }))),
    d,
  );
  // Rear openings are conservative exterior estimates; no interiors or modern hotel wings.
  const rear = facing(o, Math.PI, 5.8, -24.04);
  for (const x of [-11, -6, -1, 4, 9])
    for (const y of [0.65, 3.25]) win(rear, x, y, 0.04, 1.15, 1.45, d);
  const west = facing(o, -Math.PI / 2, -24.54, -10);
  for (const x of [-3.5, 1, 4]) win(west, x, 0.7, 0.04, 1.2, 1.4, d);
  for (const [q, L] of [
    [facing(o, -Math.PI / 2, -18.78, 10), 24],
    [facing(o, Math.PI / 2, 20.04, -15), 16],
  ])
    for (let x = -L / 2 + 2; x < L / 2; x += 4.2)
      for (const y of [0.75, 3.3]) win(q, x, y, 0.04, 1.15, 1.4, d);
  if (d > 1) {
    // Leaded casements, gutters and downpipes stay architectural, without temporary pub furniture.
    B(f, 'wood', 0, 5.5, 0.04, 18.7, 0.11, 0.13, wood);
    for (const x of [-8.9, 5.4]) B(f, 'wood', x, 0.1, 0.08, 0.09, 5.5, 0.09, wood);
    B(museum, 'wood', 0, 4.82, 0.06, 16, 0.1, 0.13, wood);
    for (const x of [-8.9, 8.9]) B(f, 'wood', x, 2.5, 0.25, 0.2, 0.5, 0.25, wood);
  }
  if (d > 2) {
    // Irregular stone blocks around the museum doorway are authored geometry, not photo textures.
    for (const x of [1.62, 3.38])
      for (let y = 0.15; y < 2.05; y += 0.37)
        B(museum, 'stone', x, y, 0.5, 0.31, 0.34, 0.16, rgb(y < 1 ? 'a79d86' : 'b4aa92'));
  }
}
export function jamaicaSkyline(o) {
  jamaica(o, undefined, 0);
}
export function jamaicaDistrict(o) {
  jamaica(o, undefined, 1);
}
export function jamaicaStreet(o) {
  jamaica(o, undefined, 2);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
  cladding: { slot: 'wall', localRef: 'palette:#feffff', roughness: 0.92, metallic: 0 },
  roof: { ...landmarkSurfaces.roof },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const jamaicaModel = {
  id: 'jamaica_inn',
  recipe: 'structure-jamaica-inn.mjs',
  key: 'jamaica_inn',
  cell: 'gb/gbu',
  title: 'Jamaica Inn',
  brief:
    'Historic slate-hung five-window bar range with twin chimney stacks and gabled porch; perpendicular granite museum/stables wing with eaves dormers, attached rear range and lower east connector.',
  camera: [62, 39, 78],
  lookAt: [1, 3, 1],
  qaCameras: [
    { name: 'front', position: [35, 13, 68], lookAt: [1, 4, 8] },
    { name: 'back', position: [-55, 30, -65], lookAt: [0, 4, -7] },
  ],
  build: jamaica,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: 'Forecourt outside Smugglers Bar at [4,9.5], independent terrain evidence.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-jamaica-inn.mjs',
    level: 'skyline',
    export: 'jamaicaSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'jamaicaDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'jamaicaStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior based on individually inspected local 2008–2010 photographs, Historic England architectural description and mapped roof layout.',
    'Main facade and axial chimneys are slate-hung; original geometry and color courses represent this distinct cladding. Shared granite, roof slate and timber surfaces are bound; glass and vertical slate cladding use separate local materials.',
    'Modern long east hotel wing and far rear service wing excluded. Rear elevations, roof joins, heights and fine stonework remain approximate; interiors, signs and temporary furniture excluded.',
    'Independent Terrarium elevations are preserved without flattening; ground contact and foundations remain host-dependent rather than surveyed.',
  ],
};
