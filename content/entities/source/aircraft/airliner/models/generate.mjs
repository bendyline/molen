/**
 * Deterministic Bendy Small Airliner, with an operator cabin and polygonal close-view fittings.
 * Local shared procedural finishes. Nose +Z; origin at ground level with gear down.
 * `node models/generate.mjs` rewrites models/source.glb and the generated parts of
 * entity.types.json (hand edits to the master are preserved); `--out <path>` writes a review
 * candidate instead.
 *
 * An invented type. The exterior composes the shared transport kit with Bendy's own station tables:
 * the kit's u runs aft from the nose tip and h is height above the barrel keel. The kit's generic
 * cockpit is dropped and `flightDeck` builds this aircraft's own behind the glass, fitted to the
 * same surface tables so nothing in it can stand outside the skin.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { completeCockpitControls } from '../../../../../../packages/entities/scripts/aircraft/cockpit-controls.mjs';
import {
  embedCockpitTextures,
  finishAircraftCockpit,
  writeCockpitTextures,
} from '../../../../../../packages/entities/scripts/aircraft/cockpit-surfaces.mjs';
import {
  beveledBox,
  group,
  mat,
} from '../../../../../../packages/entities/scripts/aircraft/mesh-kit.mjs';
import {
  bodySurface,
  buildTransport,
  canoe,
  pchip,
} from '../../../../../../packages/entities/scripts/aircraft/transport-kit.mjs';
import {
  addRivetRows,
  detailKit,
} from '../../../../../../packages/entities/scripts/vehicle-detail.mjs';
import { aircraftPanelTools as panelTools } from '../../../../../../packages/entities/scripts/vehicle-interiors.mjs';

// GLTFExporter uses FileReader only to pack its binary buffer in Node.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};
const root = dirname(fileURLToPath(import.meta.url));

const WHITE = '#f3f4f2';
const LIVERY = '#1f4f8c';
const R = 1.95; // barrel radius
const KEEL = 1.85; // barrel keel above the ground, gear down
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  const s = clamp(t, 0, 1);
  return s * s * (3 - 2 * s);
};
const span = (from, to, n) => Array.from({ length: n + 1 }, (_, i) => lerp(from, to, i / n));

const wingH = (x) => 0.95 + 0.0875 * (x - R);
const tailH = (x) => 2.92 + 0.09 * x;

/** Bendy's airframe, in the kit's tables. Invented: proportions sit between real small twinjets. */
export const airliner = {
  prefix: 'airliner',
  length: 39,
  width: 2 * R,
  bodyHeight: 2 * R,
  stance: [0, 8, KEEL],
  midFraction: 0.5,
  bellyAngle: 2,
  bellyColor: '#b9bfc4',
  wingColor: '#c9cdd0',
  controlColor: '#b9bfc4',
  tailColor: LIVERY,
  body: [
    // u, half-breadth, keel, crown. The crown's change of slope at u 1.6 is the windscreen break.
    [0, 0.02, 1.41, 1.45],
    [0.01, 0.09, 1.35, 1.51],
    [0.04, 0.18, 1.28, 1.58],
    [0.1, 0.28, 1.18, 1.66],
    [0.2, 0.39, 1.07, 1.75],
    [0.35, 0.51, 0.96, 1.83],
    [0.55, 0.64, 0.84, 1.92],
    [0.8, 0.78, 0.7, 2.02],
    [1.05, 0.9, 0.57, 2.11],
    [1.3, 1.02, 0.46, 2.2],
    [1.6, 1.14, 0.35, 2.3],
    [1.85, 1.25, 0.27, 2.56],
    [2.1, 1.35, 0.2, 2.8],
    [2.35, 1.44, 0.15, 3],
    [2.6, 1.52, 0.11, 3.16],
    [2.9, 1.6, 0.08, 3.31],
    [3.4, 1.71, 0.04, 3.5],
    [4, 1.81, 0.01, 3.66],
    [5, 1.91, 0, 3.82],
    [6, 1.945, 0, 3.89],
    [7, R, 0, 2 * R],
    [26, R, 0, 2 * R],
    [27.5, 1.94, 0.06, 2 * R],
    [29, 1.9, 0.22, 2 * R],
    [30.5, 1.82, 0.44, 2 * R],
    [32, 1.7, 0.72, 2 * R],
    [33.5, 1.54, 1.06, 3.89],
    [35, 1.32, 1.46, 3.86],
    [36.5, 1.02, 1.92, 3.8],
    [37.5, 0.74, 2.3, 3.7],
    [38.3, 0.46, 2.66, 3.56],
    [38.8, 0.22, 2.92, 3.42],
    [39, 0.12, 3.02, 3.32],
  ],
  cockpit: {
    uStart: 1.6,
    uEnd: 3.8,
    centerPost: 2.46,
    // The sill is a waterline, so the windscreen base sweeps round the nose in a plan-view arc.
    low: [
      [1.4, 2.3],
      [2.6, 2.3],
      [3.1, 2.33],
      [3.5, 2.42],
      [3.8, 2.54],
      [4.1, 2.6],
    ],
    top: [
      [2, 3.09],
      [2.55, 3.07],
      [3, 3.04],
      [3.5, 3.02],
      [3.8, 3],
      [4.1, 2.98],
    ],
    // A-pillar, then the frames either side of the sliding window.
    posts: [
      [2.2, 2.92],
      [2.9, 2.98],
      [3.38, 3.42],
    ],
  },
  eye: { u: 3.4, x: 0.55, h: 2.8, floor: 1.6, bulkhead: 4.75 },
  cabinWidth: 2.6,
  windows: {
    y: 2.68,
    w: 0.27,
    h: 0.42,
    pitch: 0.85,
    runs: [{ from: 6.7, count: 29 }],
  },
  doors: [
    { u0: 5, u1: 5.9, y0: 1.5, y1: 3.35, corner: 0.16 },
    { u0: 31.8, u1: 32.65, y0: 1.5, y1: 3.35, corner: 0.16 },
    { u0: 8, u1: 9.3, y0: 0.2, y1: 1.25, side: -1 },
    { u0: 26.2, u1: 27.4, y0: 0.3, y1: 1.3, side: -1 },
  ],
  seams: [1.25],
  wing: {
    rows: [
      // x, h, u leading edge, u trailing edge, half thickness
      [0.3, wingH(0.3), 12.77, 19.65, 0.4],
      [R, wingH(R), 13.6, 19.6, 0.36],
      [6.2, wingH(6.2), 15.72, 19.45, 0.22],
      [17.4, wingH(17.4), 21.32, 22.5, 0.06],
      [17.9, wingH(17.9), 22, 22.8, 0.025],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 2.15, to: 6.1, chord: 0.3 },
      { kind: 'flap', from: 6.3, to: 11.6, chord: 0.3 },
      { kind: 'aileron', from: 11.8, to: 16.4, chord: 0.25 },
    ],
    pods: [
      { x: 7.4, rows: canoe(18.6, 2.6, 0.85) },
      { x: 10.4, rows: canoe(19.5, 2.5, 0.8) },
    ],
  },
  fin: {
    rows: [
      // h, u leading edge, u trailing edge, half thickness; the first rows are the dorsal fillet.
      [3.2, 28.2, 36.4, 0.4],
      [3.9, 28.9, 36.5, 0.36],
      [4.35, 30.6, 36.6, 0.24],
      [4.9, 31.9, 36.75, 0.19],
      [6.5, 33.2, 37.1, 0.16],
      [8.5, 34.8, 37.5, 0.115],
      [10.2, 36.2, 37.85, 0.07],
      [10.35, 36.5, 37.9, 0.03],
    ],
    rudder: { from: 4.5, to: 10.1, chord: 0.3 },
  },
  tailplane: {
    rows: [
      [0.3, tailH(0.3), 33.6, 37, 0.19],
      [1.4, tailH(1.4), 34.4, 37.2, 0.16],
      [6.1, tailH(6.1), 37.35, 38.55, 0.05],
      [6.5, tailH(6.5), 37.9, 38.7, 0.025],
    ],
    elevator: { from: 0.8, to: 6, chord: 0.33 },
  },
  fairings: [
    {
      name: 'wing-body-fairing',
      rows: [
        [10.6, 1, 0.25, 1.05],
        [12, 1.6, 0.05, 1.35],
        [14, 2.1, -0.05, 1.5],
        [16.5, 2.25, -0.09, 1.55],
        [18.5, 2.2, -0.08, 1.5],
        [20.3, 1.9, 0, 1.4],
        [22, 1.2, 0.25, 1.15],
        [23.3, 0.35, 0.55, 0.85],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 5.8,
    u: 13.3,
    h: 0.4,
    lip: [
      [0.45, 0.84, 0.84, 0.84],
      [0.12, 0.84, 0.84, 0.84],
      [0, 0.92, 0.92, 0.92],
      [0.06, 1, 1, 1],
      [0.2, 1.05, 1.05, 1.05],
    ],
    cowl: [
      [0.2, 1.05, 1.05, 1.05],
      [0.6, 1.09, 1.09, 1.09],
      [1.2, 1.11, 1.11, 1.11],
      [1.9, 1.08, 1.08, 1.08],
      [2.5, 0.98, 0.98, 0.98],
      [3, 0.84, 0.84, 0.84],
    ],
    duct: [
      [0.45, 0.84, 0.84, 0.84],
      [0.75, 0.84, 0.84, 0.84],
    ],
    fanAt: 0.7,
    fanRadius: 0.82,
    spinner: [0.27, 0.58],
    blades: 22,
    core: [
      [2.5, 0.66, -0.04],
      [3, 0.56, -0.06],
      [3.7, 0.42, -0.08],
      [4, 0.36, -0.08],
    ],
    plug: [
      [4, 0.2, -0.08],
      [4.3, 0.12, -0.08],
      [4.6, 0.012, -0.08],
    ],
    pylon: [
      [14, 0.03, 1.4, 1.52],
      [14.8, 0.1, 1.38, 1.55],
      [15.8, 0.14, 1.28, 1.52],
      [16.9, 0.14, 1.15, 1.46],
      [18, 0.1, 1.2, 1.42],
      [18.8, 0.03, 1.28, 1.36],
    ],
  },
  gear: {
    nose: { u: 3.95, r: 0.38, w: 0.21, spread: 0.44, top: 2.3, strut: 0.08 },
    main: { u: 18.3, x: 3.2, pivotX: 3.9, r: 0.55, w: 0.38, spread: 0.76, top: 2.9, strut: 0.12 },
  },
};

const { eye: EYE, cockpit: CK } = airliner;
const PANEL = { u: 2.655, h: 2.33, tilt: 0.17 }; // face origin, in the tilted plane
const LIP = { u: 2.62, h: 2.6 }; // aft edge of the glareshield

const deckMaterials = () => ({
  lining: mat('deck-lining', '#c9ced0', { side: T.DoubleSide, flatShading: false }),
  panel: mat('deck-panel', '#5a666d', { side: T.DoubleSide }),
  hood: mat('deck-glareshield', '#23282c', { side: T.DoubleSide, roughness: 0.9 }),
  floor: mat('deck-floor', '#33383c', { side: T.DoubleSide, roughness: 0.95 }),
  frame: mat('deck-window-trim', '#7b8387', { side: T.DoubleSide }),
  seat: mat('deck-seat', '#2c4a78', { roughness: 0.85 }),
  shell: mat('deck-seat-shell', '#3b4247'),
  belt: mat('deck-seat-harness', '#b7b29c'),
  sky: mat('display-sky', '#2d6ea8', { roughness: 0.4 }),
  earth: mat('display-earth', '#7a5230', { roughness: 0.4 }),
});

/** Indexed quad strip over rows of points; double sided materials carry these. */
function gridGeometry(rows) {
  const n = rows[0].length,
    indices = [];
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j,
        b = a + 1,
        c = a + n + 1,
        e = a + n;
      indices.push(a, b, c, a, c, e);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(rows.flat(2), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The blue cheatline, on the skin: under the cabin windows, then sweeping down round the nose. */
function cheatline(body, M, zOf, material) {
  const ride = pchip([1.35, 3.3, 6.4, 33], [1.86, 1.96, 2.3, 2.3]),
    stations = [...span(1.35, 7, 24), ...span(8, 33, 25), ...span(33.5, 35.5, 4)];
  const taper = (u) => 0.11 * Math.min(1, (u - 1.3) / 1.6, (35.55 - u) / 2.5);
  for (const side of [-1, 1]) {
    const rows = stations.map((u) =>
      [1, 0.33, -0.33, -1].map((f) => {
        const y = ride(u) + f * taper(u),
          [x, h] = M.point(u, M.angle(u, y), side, 0.006);
        return [x, h, zOf(u)];
      }),
    );
    const mesh = new T.Mesh(gridGeometry(rows), material);
    mesh.name = side > 0 ? 'cheatline-left' : 'cheatline-right';
    body.add(mesh);
  }
}

/** Lining, floor, glareshield and panel board: the surfaces that fit the fuselage. */
function deckShell(d, D) {
  const { M, zOf, low, top, wall, m } = D,
    { uEnd } = CK,
    { floor, bulkhead } = EYE;
  const strip = (us, from, to, cols = 6) => {
    for (const side of [1, -1])
      d.add(
        gridGeometry(
          us.map((u) =>
            span(from(u), to(u), cols).map((a) => {
              const [x, y] = M.point(u, a, side, -0.05);
              return [x, y, zOf(u)];
            }),
          ),
        ),
        m.lining,
      );
  };
  const floorAngle = (u) => M.angle(u, floor);
  strip(
    span(2.47, uEnd, 8),
    () => 0,
    (u) => M.angle(u, top(u)),
  );
  strip(span(2.55, uEnd, 8), (u) => M.angle(u, low(u)), floorAngle);
  strip(span(uEnd, bulkhead, 4), () => 0, floorAngle, 12);
  // Floor, running forward under the panel to a closure that keeps the nose bay out of sight.
  d.add(
    gridGeometry(
      span(2.16, bulkhead, 8).map((u) => {
        const w = wall(u, floor) - 0.02;
        return [
          [-w, floor, zOf(u)],
          [w, floor, zOf(u)],
        ];
      }),
    ),
    m.floor,
  );
  d.add(
    gridGeometry(
      span(floor, 2.28, 4).map((h) => {
        const w = wall(2.16, h) - 0.02;
        return [
          [-w, h, zOf(2.16)],
          [w, h, zOf(2.16)],
        ];
      }),
    ),
    m.hood,
  );
  // The glareshield starts on the windscreen sill and rises aft, so its front edge is the sill arc.
  // Across the deck it is flat over the instruments and falls to the sill at the walls.
  const across = span(-1, 1, 20);
  const hoodAt = (u, t) => {
    const rise = (LIP.h - low(u)) * Math.pow(clamp((u - 1.6) / (LIP.u - 1.6), 0, 1), 0.8);
    return low(u) - 0.012 + rise * smooth((1 - Math.abs(t)) / 0.34);
  };
  const halfWidth = (u) => wall(u, low(u)) - 0.012;
  d.add(
    gridGeometry(
      span(1.66, LIP.u, 12).map((u) => across.map((t) => [t * halfWidth(u), hoodAt(u, t), zOf(u)])),
    ),
    m.hood,
  );
  // Padded lip, then the panel board in its tilted plane, widening with the skin below the sill.
  const boardU = (h) => PANEL.u - (h - PANEL.h) * Math.tan(PANEL.tilt);
  d.add(
    gridGeometry(
      [0, 0.04, 0.05].map((drop) =>
        across.map((t) => [
          t * halfWidth(LIP.u),
          hoodAt(LIP.u, t) - drop,
          zOf(drop < 0.045 ? LIP.u : boardU(hoodAt(LIP.u, t) - drop)),
        ]),
      ),
    ),
    m.hood,
  );
  d.add(
    gridGeometry(
      [1, 0.75, 0.4, 0].map((f) =>
        across.map((t) => {
          const roof = hoodAt(LIP.u, t) - 0.05,
            h = lerp(1.98, roof, f),
            u = boardU(h);
          return [t * (wall(u, Math.min(h, 2.3)) - 0.03), h, zOf(u)];
        }),
      ),
    ),
    m.panel,
  );
}

/** Window structure behind the glass. Boxed sections rooted on the skin, under its outer ribbons,
 * so a pillar seen edge-on from the seat is one solid member and not two parallel lines. */
function windowFrames(d, D) {
  const { M, zOf, low, top, m } = D;
  const onSkin = (u, y, side) => {
    const a = M.angle(u, y),
      [x, h] = M.point(u, a, side),
      [nx, nh] = M.point(u, a, side, 0.1);
    return {
      p: new T.Vector3(x, h, zOf(u)),
      n: new T.Vector3(nx - x, nh - h, 0).normalize(),
    };
  };
  const member = (path, half, depth, inset = 0.02) => {
    const rows = path.map(({ p, n }, i) => {
      const t = path[Math.min(i + 1, path.length - 1)].p
          .clone()
          .sub(path[Math.max(i - 1, 0)].p)
          .normalize(),
        across = t.cross(n).normalize().multiplyScalar(half),
        a = p.clone().add(across).addScaledVector(n, -inset),
        e = p.clone().sub(across).addScaledVector(n, -inset),
        b = a.clone().addScaledVector(n, -depth),
        c = e.clone().addScaledVector(n, -depth);
      return [a, b, c, e, a].map((v) => v.toArray());
    });
    d.add(gridGeometry(rows), m.frame);
  };
  for (const side of [-1, 1]) {
    for (const [uLow, uTop] of CK.posts) {
      const y0 = low(uLow),
        y1 = top(uTop),
        pillar = uLow === CK.posts[0][0];
      member(
        span(0, 1, 8)
          .map((t) => [lerp(uLow, uTop, t), lerp(y0, y1, t)])
          .filter(([u, y]) => M.crown(u) > y)
          .map(([u, y]) => onSkin(u, y, side)),
        pillar ? 0.04 : 0.03,
        pillar ? 0.05 : 0.04,
      );
    }
    member(
      span(CK.uStart + 0.06, CK.uEnd, 16).map((u) => onSkin(u, low(u), side)),
      0.035,
      0.05,
      0.04,
    );
    member(
      span(2.5, CK.uEnd, 8).map((u) => onSkin(u, top(u), side)),
      0.04,
      0.05,
      0.03,
    );
    member(
      [low(CK.uEnd), top(CK.uEnd)].map((y) => onSkin(CK.uEnd, y, side)),
      0.035,
      0.05,
    );
  }
  member(
    span(CK.uStart + 0.03, CK.centerPost, 8).map((u) => onSkin(u, M.crown(u), 1)),
    0.035,
    0.04,
    0.02,
  );
}

/** Instrument panel. All of it sits in one tilted frame, faces toward the crew (-Z). */
function mainPanel(body, D) {
  const { zOf, m, bindings } = D;
  const face = group(body, 'main-panel', [0, PANEL.h, zOf(PANEL.u)]);
  face.rotation.x = PANEL.tilt;
  const k = detailKit(face, 'main-panel-fittings');
  const tools = panelTools({ ...k, green: m.sky, amber: m.earth });
  const z = -0.012,
    W = 0.152, // a 6 by 8 in display
    H = 0.203,
    Y = 0.012;
  const unit = (x, y, w, h, kind) => {
    k.box([w + 0.036, h + 0.046, 0.014], [x, y - 0.008, -0.002], m.panel);
    tools.display(x, y, z, w, h, kind);
    tools.buttons(x, y - h / 2 - 0.016, z, 5, 0.026);
  };
  const front = z - 0.008;
  const pfd = (x, name) => {
    unit(x, Y, W, H, 'attitude');
    // Speed and altitude tapes either side of the sphere, compass rose under it.
    for (const s of [-1, 1]) k.box([0.022, 0.12, 0.001], [x + s * 0.066, Y + 0.012, front], k.dark);
    k.ring(0.03, 0.0015, [x, Y - 0.074, front], k.ivory);
    const node = `horizon-${name}`,
      horizon = group(face, node, [x, Y + 0.012, front - 0.003]),
      line = detailKit(horizon, `${node}-line`);
    line.box([W * 0.56, 0.003, 0.002], [0, 0, 0], line.amber);
    line.box([0.004, H * 0.14, 0.002], [0, 0, 0], line.amber);
    line.finish();
    bindings.push(
      { node, source: 'roll', property: 'rotation', axis: 'z', scale: 1 },
      {
        node,
        source: 'pitch',
        property: 'position',
        axis: 'y',
        scale: -0.09,
        min: -0.04,
        max: 0.04,
      },
    );
  };
  // Pilot's pair ahead of each seat, engine and system displays between them.
  pfd(0.655, 'left');
  unit(0.445, Y, W, H, 'map');
  unit(-0.445, Y, W, H, 'map');
  pfd(-0.655, 'right');
  unit(0.105, Y, W, H, 'engine');
  unit(-0.105, Y, W, H, 'radar');
  for (const s of [-1, 1])
    for (const row of [0, 1])
      k.ring(0.026, 0.0016, [0.105 + s * 0.036, Y + 0.05 - row * 0.066, front], k.ivory);
  // Standby instruments, real 3 1/8 in dials, and a lower centre display turned landscape.
  for (const x of [-0.275, 0.275]) {
    tools.gauge(x, 0.065, z, 0.04);
    tools.gauge(x, -0.045, z, 0.04);
  }
  unit(0, -0.2, H, W * 0.72, 'bars');
  // Mode control panel along the top of the board, its legends on its own face.
  k.box([1.42, 0.078, 0.046], [0, 0.178, -0.024], k.dark);
  ['COURSE', 'SPEED', 'HDG', 'ALT', 'VS', 'COURSE'].forEach((label, i) => {
    const x = 0.56 - i * 0.224; // +X is the captain's left, so legends read left to right
    tools.display(x, 0.175, -0.05, 0.085, 0.024, 'mode');
    tools.knob(x + 0.066, 0.175, -0.05, 0.013);
    k.text(label, [x, 0.2, -0.0475], 0.012, Math.PI);
    tools.buttons(x, 0.153, -0.05, 4, 0.021);
  });
  // Knee panels, side vents and the gear handle.
  for (const s of [-1, 1]) {
    for (let row = 0; row < 3; row++) tools.buttons(s * 0.55, -0.17 - row * 0.03, -0.004, 13, 0.03);
    tools.vent(s * 0.97, 0.03, -0.006, 'round', 0.11);
    tools.gauge(s * 0.86, 0.075, z, 0.028);
    tools.buttons(s * 0.9, -0.09, -0.004, 6, 0.03);
  }
  k.box([0.1, 0.14, 0.012], [-0.265, -0.2, -0.004], k.dark);
  k.rod([-0.265, -0.17, -0.01], [-0.265, -0.17, -0.1], 0.0065, k.metal);
  k.add(new T.CylinderGeometry(0.026, 0.026, 0.024, 12), k.ivory, [-0.265, -0.17, -0.1]);
  tools.knob(0.265, -0.19, -0.012, 0.024);
  k.finish();
}

/** Centre pedestal: profile extruded across the deck, then the units laid on its faces. */
function pedestal(body, d, D) {
  const { zOf, m, bindings } = D;
  const shape = new T.Shape(
    [
      [2.72, EYE.floor],
      [2.72, 2.27],
      [2.99, 2.1],
      [3.85, 2.1],
      [3.85, EYE.floor],
    ].map(([u, h]) => new T.Vector2(zOf(u), h)),
  );
  const solid = new T.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false })
    .rotateY(-Math.PI / 2)
    .translate(0.25, 0, 0);
  d.add(solid, m.panel);
  const slope = group(body, 'pedestal-slope', [0, 2.188, zOf(2.86)]);
  slope.rotation.x = 1.01;
  const up = group(body, 'pedestal-top', [0, 2.1, zOf(3.43)]);
  up.rotation.x = Math.PI / 2;
  const a = detailKit(slope, 'pedestal-slope-units'),
    b = detailKit(up, 'pedestal-top-units'),
    cdu = panelTools(a),
    radio = panelTools(b);
  for (const s of [-1, 1]) {
    // Flight management keypads on the slope, either pilot's reach.
    a.box([0.2, 0.28, 0.012], [s * 0.118, 0, -0.002], a.dark);
    cdu.display(s * 0.118, 0.07, -0.012, 0.13, 0.09, 'route');
    for (let row = 0; row < 5; row++)
      cdu.buttons(s * 0.118, -0.008 - row * 0.024, -0.012, 6, 0.024);
  }
  a.finish();
  // Quadrant strip with its two slots, then speedbrake and flap handles beside it, radios aft.
  b.box([0.2, 0.3, 0.01], [0, 0.12, -0.002], b.dark);
  for (const s of [-1, 1]) b.box([0.016, 0.26, 0.002], [s * 0.045, 0.12, -0.008], b.metal);
  for (const [s, cap] of [
    [1, b.dark],
    [-1, b.ivory],
  ]) {
    b.box([0.012, 0.22, 0.002], [s * 0.17, 0.12, -0.003], b.metal);
    b.rod([s * 0.17, 0.11, -0.006], [s * 0.17, 0.12, -0.1], 0.006, b.metal);
    b.box([0.06, 0.035, 0.03], [s * 0.17, 0.12, -0.105], cap);
  }
  for (const row of [0, 1]) {
    radio.display(0, -0.12 - row * 0.11, -0.012, 0.3, 0.05, 'mode');
    radio.buttons(0, -0.165 - row * 0.11, -0.012, 12, 0.033);
  }
  b.finish();
  // Thrust levers: the throttle axis runs through the quadrant, so a lever swings fore and aft.
  for (const [i, x] of [0.045, -0.045].entries()) {
    const node = `power-lever-${i}`,
      lever = group(body, node, [x, 2.05, zOf(3.33)]),
      p = detailKit(lever, `${node}-handle`);
    p.rod([0, 0, 0], [0, 0.2, 0], 0.009, p.metal);
    p.rod([-0.03, 0.2, 0], [0.03, 0.2, 0], 0.014, p.dark);
    p.finish();
    bindings.push({
      node,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
  }
}

function seats(d, D) {
  const { zOf, wall, m } = D,
    { floor } = EYE,
    // A seated eye is about 0.3 m ahead of the seatback.
    aft = 0.12;
  for (const x of [EYE.x, -EYE.x]) {
    beveledBox(d, [0.5, 0.13, 0.48], [x, 1.955, zOf(3.29 + aft)], m.seat, 0.035);
    const back = beveledBox(d, [0.48, 0.78, 0.14], [x, 2.41, zOf(3.6 + aft)], m.seat, 0.04);
    back.rotation.x = -0.16;
    beveledBox(d, [0.3, 0.2, 0.1], [x, 2.9, zOf(3.66 + aft)], m.seat, 0.03);
    d.box([0.36, 0.26, 0.4], [x, floor + 0.15, zOf(3.3 + aft)], m.shell);
    for (const s of [-1, 1]) {
      beveledBox(d, [0.06, 0.05, 0.36], [x + s * 0.29, 2.2, zOf(3.36 + aft)], m.shell, 0.016);
      d.box([0.04, 0.2, 0.05], [x + s * 0.29, 2.09, zOf(3.5 + aft)], m.shell);
      d.rod(
        [x + s * 0.13, floor + 0.02, zOf(3.0 + aft)],
        [x + s * 0.13, floor + 0.02, zOf(3.65 + aft)],
        0.012,
        d.metal,
      );
      // Five-point harness: shoulder straps down to the buckle, lap straps across.
      d.rod(
        [x + s * 0.15, 2.73, zOf(3.5 + aft)],
        [x + s * 0.05, 2.09, zOf(3.2 + aft)],
        0.014,
        m.belt,
      );
      d.rod([x + s * 0.22, 2.05, zOf(3.42 + aft)], [x, 2.05, zOf(3.14 + aft)], 0.014, m.belt);
    }
    d.box([0.05, 0.035, 0.015], [x, 2.05, zOf(3.12 + aft)], d.metal);
  }
  // Side consoles and tillers. The outer edge follows the wall, so the console stays in the skin.
  const shelf = 2.2,
    us = span(2.98, 4.45, 6);
  for (const side of [-1, 1]) {
    const inner = side * 1.24,
      edge = us.map((u) => [
        [inner, floor, zOf(u)],
        [inner, shelf, zOf(u)],
        [side * (wall(u, shelf) - 0.07), shelf, zOf(u)],
        [side * (wall(u, floor) - 0.07), floor, zOf(u)],
      ]);
    d.add(gridGeometry(edge), m.panel);
    d.add(
      gridGeometry([
        [edge[0][0], edge[0][1]],
        [edge[0][3], edge[0][2]],
      ]),
      m.panel,
    );
    const x = side * 1.34;
    d.ring(0.075, 0.012, [x, shelf + 0.05, zOf(3.12)], d.dark, 'y');
    d.rod([x, shelf, zOf(3.12)], [x, shelf + 0.05, zOf(3.12)], 0.018, d.metal);
    for (let row = 0; row < 5; row++)
      d.box([0.2, 0.006, 0.05], [x, shelf + 0.003, zOf(3.45 + row * 0.15)], d.dark);
  }
}

/** Control columns pivot in the floor. The yoke rides on top and turns about its own hub. */
function controls(body, D) {
  const { zOf, m, bindings } = D;
  for (const [x, suffix] of [
    [EYE.x, ''],
    [-EYE.x, '-right'],
  ]) {
    const name = `control-column${suffix}`,
      yokeName = `control-yoke${suffix}`,
      column = group(body, name, [x, EYE.floor + 0.02, zOf(2.87)]),
      c = detailKit(column, `${name}-post`);
    c.rod([0, 0, 0], [0, 0.68, -0.1], 0.03, m.panel);
    c.box([0.09, 0.09, 0.12], [0, 0.02, 0], m.shell);
    c.finish();
    const yoke = group(column, yokeName, [0, 0.68, -0.1]),
      y = detailKit(yoke, `${yokeName}-trim`);
    y.box([0.075, 0.06, 0.05], [0, 0, 0], m.shell);
    y.rod([-0.14, 0, 0], [0.14, 0, 0], 0.016, y.dark);
    for (const s of [-1, 1]) {
      y.rod([s * 0.14, 0, 0], [s * 0.17, 0.08, 0], 0.021, y.dark);
      y.rod([s * 0.17, 0.08, 0], [s * 0.15, 0.13, 0], 0.021, y.dark);
    }
    y.box([0.06, 0.02, 0.012], [0, 0.012, -0.03], y.ivory);
    y.finish();
    bindings.push(
      { node: yokeName, source: 'pitchInput', property: 'rotation', axis: 'x', scale: 0.2 },
      { node: yokeName, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.4 },
      { node: name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.2 },
    );
    for (const s of [-1, 1]) {
      const node = `pedal${suffix}-${s > 0 ? 'left' : 'right'}`,
        pedal = group(body, node, [x + s * 0.13, EYE.floor + 0.17, zOf(2.5)]),
        p = detailKit(pedal, `${node}-plate`);
      pedal.rotation.x = 0.3;
      p.box([0.11, 0.24, 0.025], [0, 0, 0], p.metal);
      for (let i = 0; i < 4; i++)
        p.box([0.09, 0.006, 0.004], [0, (i - 1.5) * 0.05, -0.014], p.dark);
      p.rod([0, -0.1, 0.01], [0, -0.17, 0.12], 0.012, p.dark);
      p.finish();
      bindings.push({
        node,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: s * 0.035,
      });
    }
  }
}

/** Overhead panel, parallel to the roof, starting aft of the windscreen header. */
function overhead(body, D) {
  const { zOf, m } = D;
  const ceiling = group(body, 'overhead-panel', [0, 3.03, zOf(3)]);
  ceiling.rotation.x = -(Math.PI / 2 - 0.28);
  const k = detailKit(ceiling, 'overhead-switches');
  k.box([1.2, 1.26, 0.06], [0, 0.63, 0.03], m.panel);
  // Three columns of systems modules, each a dark plate with a row of toggles and a legend bar.
  for (const [c, x] of [-0.39, 0, 0.39].entries())
    for (let row = 0; row < 7; row++) {
      const y = 0.11 + row * 0.17;
      k.box([0.35, 0.14, 0.004], [x, y, -0.002], k.dark);
      k.box([0.26, 0.008, 0.001], [x, y + 0.05, -0.0045], k.ivory);
      for (let i = 0; i < 5; i++) {
        const sx = x + (i - 2) * 0.062;
        if ((row + c * 2 + i) % 7 === 3) {
          k.box([0.05, 0.03, 0.006], [sx, y - 0.012, -0.004], (row + i) % 2 ? k.amber : k.green);
          continue;
        }
        k.box([0.026, 0.05, 0.003], [sx, y - 0.014, -0.004], k.metal);
        k.rod([sx, y - 0.014, -0.004], [sx, y - 0.002, -0.028], 0.0045, k.metal);
      }
    }
  for (const x of [-0.26, 0, 0.26]) k.box([0.07, 0.04, 0.012], [x, 1.24, -0.006], k.red);
  k.finish();
}

function flightDeck(body, D) {
  const d = detailKit(body);
  deckShell(d, D);
  windowFrames(d, D);
  seats(d, D);
  pedestal(body, d, D);
  // Flight deck door on the bulkhead.
  const { zOf, m, M } = D;
  d.box([0.86, 1.95, 0.03], [0, EYE.floor + 0.98, zOf(EYE.bulkhead - 0.03)], m.panel);
  d.rod(
    [-0.3, EYE.floor + 1, zOf(EYE.bulkhead - 0.06)],
    [-0.3, EYE.floor + 1.12, zOf(EYE.bulkhead - 0.06)],
    0.012,
    d.metal,
  );
  d.finish();
  // Exterior fittings are their own batch, so the cockpit finishes and lettering applied to the
  // deck (entity.types interior nodes) leave the livery title and skin fittings alone.
  const e = detailKit(body, 'airliner-exterior-detail');
  for (const side of [-1, 1]) {
    e.text('BENDY', [side * 1.957, 1.72, zOf(9.6)], 0.5, (side * Math.PI) / 2, D.livery);
    for (const u of [5.45, 32.2]) {
      const [x, y] = M.point(u, M.angle(u, 2.62), side, 0.02);
      e.box([0.04, 0.06, 0.19], [x, y, zOf(u)], e.metal);
    }
    // Wipers park along the windscreen sill.
    const skin = (u, y, off) => {
      const [x, h] = M.point(u, M.angle(u, y), side, off);
      return [x, h, zOf(u)];
    };
    e.rod(skin(2.03, 2.31, 0.03), skin(1.98, 2.37, 0.03), 0.01, e.dark);
    e.rod(skin(1.98, 2.37, 0.03), skin(1.74, 2.38, 0.03), 0.007, e.dark);
    // Pitot masts forward of the door.
    e.rod(skin(2.7, 1.75, 0), skin(2.5, 1.75, 0.13), 0.012, e.metal);
    e.box([0.08, 0.08, 0.2], [side * 17.86, wingH(17.8), zOf(22.25)], side > 0 ? e.red : e.green);
  }
  e.finish();
  mainPanel(body, D);
  controls(body, D);
  overhead(body, D);
}

function build() {
  const { root: model, visual } = buildTransport(
    {
      slug: 'airliner',
      color: WHITE,
      accent: LIVERY,
      shape: 'twin-jet',
      count: 2,
      category: 'airliner',
    },
    airliner,
  );
  const body = model.getObjectByName('airframe');
  body.remove(body.getObjectByName('cockpit'));
  // Blue fin and white tailplanes. The fin's material is the one agent colours repaint.
  const skin = model.getObjectByName('fuselage-skin'),
    paint = skin.material,
    livery = model.getObjectByName('fin').material;
  paint.name = 'airliner-white';
  livery.name = 'airliner-livery';
  model.traverse((o) => {
    if (o.isMesh && /^(tailplane|elevator)-/.test(o.name)) o.material = paint;
  });
  // The runtime, the damage parts and the animation channels in entity.types name these nodes;
  // the kit numbers them.
  const names = {
    'gear-0': 'gear-nose',
    'gear-1': 'gear-left',
    'gear-2': 'gear-right',
    'fan-1': 'fan-left',
    'fan-2': 'fan-right',
    'engine-1': 'engine-left',
    'engine-2': 'engine-right',
    'wing-1': 'wing-left',
    'wing--1': 'wing-right',
    'tailplane-1': 'stabilizer-left',
    'tailplane--1': 'stabilizer-right',
    'aileron-left': 'airliner-aileron-1',
    'aileron-right': 'airliner-aileron--1',
    'elevator-1': 'airliner-elevator-1',
    'elevator--1': 'airliner-elevator--1',
    rudder: 'airliner-rudder',
  };
  model.traverse((o) => {
    if (names[o.name]) o.name = names[o.name];
  });
  // A wing, stabilizer or fin that breaks away takes its hinged surfaces along. Each surface turns
  // inside its hinge frame, and the owners sit at the identity, so re-parenting moves nothing.
  for (const [owner, surfaces] of Object.entries({
    'wing-left': ['flap-left-inner', 'flap-left', 'airliner-aileron-1'],
    'wing-right': ['flap-right-inner', 'flap-right', 'airliner-aileron--1'],
    'stabilizer-left': ['airliner-elevator-1'],
    'stabilizer-right': ['airliner-elevator--1'],
    fin: ['airliner-rudder'],
  }))
    for (const surface of surfaces)
      model.getObjectByName(owner).attach(model.getObjectByName(surface).parent);
  // The kit hinges every moving surface on this airframe's own hinge lines; its channels drive them.
  const animation = [
    ...visual.animation.bindings.map((b) => ({
      ...b,
      node: names[b.node] ?? b.node,
      // Elevators follow the elevator channel, which carries trim as well as the pilot's input.
      ...(/^elevator-/.test(b.node) ? { source: 'elevator' } : {}),
    })),
    ...visual.ailerons.map(({ node, axis, multiplier }) => ({
      node: names[node] ?? node,
      source: 'rollInput',
      property: 'rotation',
      axis,
      scale: multiplier,
    })),
  ];
  // Tinted from outside; seen from the seat the glass is clear, so the view is the outside.
  model.getObjectByName('cockpit-canopy-glazing').material.side = T.FrontSide;
  const M = bodySurface(airliner),
    zOf = (u) => airliner.length / 2 - u,
    curve = (rows) =>
      pchip(
        rows.map((r) => r[0]),
        rows.map((r) => r[1]),
      ),
    D = {
      M,
      zOf,
      low: curve(CK.low),
      top: curve(CK.top),
      wall: (u, h) => M.point(u, M.angle(u, h), 1)[0],
      m: deckMaterials(),
      livery,
      bindings: [],
    };
  cheatline(body, M, zOf, livery);
  const before = new Set(body.children);
  flightDeck(body, D);
  // Everything the flight deck added, bar the skin fittings, is cabin: it takes the cockpit finish
  // profile and the walker ignores it.
  const deck = body.children
    .filter((node) => !before.has(node) && node.name !== 'airliner-exterior-detail')
    .map((node) => node.name);
  // Flush heads on the constant barrel.
  const rows = [];
  for (let z = -11.5; z < 12.5; z += 1.25) {
    const row = [];
    for (let i = 0; i < 128; i++) {
      const a = (i * Math.PI * 2) / 128;
      row.push({
        point: [R * Math.cos(a), R * Math.sin(a) + KEEL + R, z],
        normal: [Math.cos(a), Math.sin(a), 0],
      });
    }
    rows.push(row);
  }
  addRivetRows(model, [skin, model.getObjectByName('fuselage-belly')], rows, 0.0035);
  model.updateMatrixWorld(true);
  const world = (h, u) => body.localToWorld(new T.Vector3(0, h, zOf(u)));
  return {
    model,
    deck,
    animation,
    frame: { panelZ: world(PANEL.h, PANEL.u).z, floor: world(EYE.floor, EYE.u).y },
  };
}

// source.json pins the master this generator last wrote. A master that matches neither the pin
// nor this run's output was edited by hand, and regenerating would discard that work.
const sourcePath = resolve(root, '../source.json');
const sourceText = await readFile(sourcePath, 'utf8');
const pinned = JSON.parse(sourceText).files.models.find(
  (m) => m.path === 'models/source.glb',
)?.sha256;
const definitionPath = resolve(root, '../entity.types.json');
const definitionText = await readFile(definitionPath, 'utf8');
const definition = JSON.parse(definitionText);
const controlSpec = Object.values(definition.types)[0].components.aircraft.spec;
const built = build();
controlSpec.visual.interior.nodes = built.deck;
controlSpec.visual.animation = { ...controlSpec.visual.animation, bindings: built.animation };
controlSpec.airplane.gearTransitTime = 10;
controlSpec.airplane.flapTransitTime = 6;
const controlledModel = completeCockpitControls(built.model, controlSpec, built.frame);
finishAircraftCockpit(controlledModel, controlSpec, 'airliner');
const { completeAircraftArticulation } = await import(
  '../../../../../../packages/entities/scripts/aircraft-articulation.mjs'
);
// Articulation's own 'airliner' pass cuts ailerons, elevators and the rudder out of the earlier
// hand-built wing and tail. The kit already hinges those, so run the generic transport pass:
// gear left as the kit rigs it, and wing spoilers for the speed brake.
completeAircraftArticulation(controlledModel, controlSpec, {
  slug: 'airliner-kit',
  category: 'airliner',
});
const bytes = embedCockpitTextures(
  Buffer.from(
    await new GLTFExporter().parseAsync(controlledModel, { binary: true, onlyVisible: false }),
  ),
);
const path = resolve(root, 'source.glb');
const current = await readFile(path).catch(() => undefined);
const hash = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const generatedHash = hash(bytes);
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const candidate = resolve(process.argv[outIndex + 1] ?? '');
  if (candidate === path || candidate === sourcePath)
    throw new Error('--out must be separate from the source master and its source.json');
  await mkdir(dirname(candidate), { recursive: true });
  await writeFile(candidate, bytes);
  console.log(`Candidate: ${candidate} ${generatedHash}`);
  process.exit(0);
}
if (current && pinned && hash(current) !== pinned && !current.equals(bytes))
  throw new Error(`Preserving artist edits in ${path}; move the master before regenerating.`);
if (!current?.equals(bytes)) await writeFile(path, bytes);
const source = JSON.parse(sourceText);
source.files.models.find((model) => model.path === 'models/source.glb').sha256 = generatedHash;
source.files.textures = await writeCockpitTextures(resolve(root, '..'), bytes);
async function writeChangedJson(path, value, previous) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (text === previous) return;
  // Live Windows editors can memory-map these manifests. Replace a completed
  // file instead of truncating it, as the aircraft batch generator does.
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, text);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
await writeChangedJson(sourcePath, source, sourceText);
await writeChangedJson(definitionPath, definition, definitionText);
console.log(`airliner: ${bytes.length} bytes, ${generatedHash}`);
