import {
  courtyardWalls,
  facadeWindows,
  openArcade,
  roofedWing,
} from '../../../../../../../../packages/worldgen/scripts/courtyard-landmark-geometry.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  ribbon,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.93 },
  shingle: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.95 },
  iron: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.83 },
  pane: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
};
const pale = rgb('d6cbb2'),
  trim = rgb('d9cfb9'),
  foundation = rgb('b0a590'),
  plasterShade = rgb('c4b99e');
const roof = rgb('7e6f64'),
  steel = rgb('697070'),
  copper = rgb('85705e'),
  trimDark = rgb('66645b');
const clay = rgb('a26b54'),
  green = rgb('637e70'),
  oak = rgb('6c5746');
const glass = rgb('53605d');
const windows = {
  glassSlot: 'pane',
  frameSlot: 'stone',
  glass,
  frame: trim,
  frameWidth: 0.09,
  mullions: 0,
  transoms: 0,
};
const pos = ([x, , z]) => [x, z];
const dot = (p, v) => p[0] * v[0] + p[1] * v[1];
const body = (id) => site.body.find((p) => p.id === id).wing;
const part = (id) => site.towerPoints[id];
const ringCenter = (r) =>
  r.reduce(([x, z], [a, b]) => [x + a / r.length, z + b / r.length], [0, 0]);
const spans = (r, f) => {
  const v = r.map((p) => dot([p[0] - f.origin[0], p[1] - f.origin[1]], f.along));
  const d = r.map((p) => dot([p[0] - f.origin[0], p[1] - f.origin[1]], f.normal));
  return [Math.min(...v), Math.max(...v), Math.min(...d), Math.max(...d)];
};
function cross(out, [x, z], y, size, tone, detail) {
  const f = facade([x, z], [1, 0]),
    p = (u, U, a, b) =>
      fbox(out, 'pane', f, u, U, y + a * size, y + b * size, -0.065 * size, 0.065 * size, tone);
  p(-0.06 * size, 0.06 * size, 0, 1);
  if (detail) p(-0.31 * size, 0.31 * size, 0.59, 0.69);
  if (detail > 1) p(-0.2 * size, 0.2 * size, 0.31, 0.4);
  if (detail === 3) p(-0.4 * size, 0.4 * size, 0.75, 0.82);
}

function cupola(out, point, y, r, h, tone, detail, slot = 'iron') {
  const rings = [
    [y, r * 0.34, r * 0.34],
    [y + h * 0.18, r * 0.75, r * 0.75],
    [y + h * 0.42, r, r],
    [y + h * 0.61, r * 0.91, r * 0.91],
    [y + h * 0.83, r * 0.5, r * 0.5],
    [y + h * 0.94, r * 0.16, r * 0.16],
    [y + h, 0, 0],
  ].filter((_, i) => detail || i === 0 || i === 2 || i === 4 || i === 6);
  lathe(out, slot, point, rings, detail > 1 ? 12 : detail ? 8 : 5, tone);
  cross(out, point, y + h, 0.95 + r * 0.26, trimDark, detail);
}

function holyGates(out, detail) {
  const gate = body(841406516);
  const center = ringCenter(gate.ring);
  const frame = facade(center, site.gateAxis);
  const [a, b, d, D] = spans(gate.ring, frame);
  const front = wallFace(pos(frame.P(a, 0, D)), pos(frame.P(b, 0, D)));
  const ground = -4.02;
  extrude(out, 'stone', site.gateRing, -6.55, ground, foundation);
  openArcade(out, front, {
    count: 2,
    bottom: ground,
    top: 2.23,
    spring: -1.06,
    depth: D - d,
    slot: 'plaster',
    color: pale,
    openRatio: 0.39,
    steps: detail > 1 ? 9 : 3,
    shallow: !detail,
  });
  const openings = [0, 0.4];
  for (const [i, offset] of openings.entries()) {
    const u = (front.length * (i + 0.5)) / 2;
    if (detail > 0) {
      opening(out, front, u, 3.21, 1.1, 2.15, { ...windows, head: 'round', frameWidth: 0.13 });
      fbox(out, 'stone', front, u - 0.8, u + 0.8, 2.92, 3.23, -0.035, 0.19, trim);
    }
    if (detail > 1) {
      const half = front.length * 0.25 * 0.39;
      for (const side of [-1, 1])
        fbox(
          out,
          'stone',
          front,
          u + half * side - 0.16,
          u + half * side + 0.16,
          ground,
          -1.02,
          -0.13,
          0.19,
          trim,
        );
      opening(out, front, u + offset, 5.95, 0.43, 1.02, { ...windows, head: 'round' });
    }
  }
  const top = { ...gate, base: 2.23 };
  roofedWing(out, top, 'plaster', pale, 'iron', clay);
  if (detail)
    ribbon(out, 'stone', gate.ring, 7.54, 7.81, trim, { offset: 0.11, minLength: 1, inset: 0 });
  roofedWing(out, body(841406515), 'plaster', plasterShade, 'shingle', roof);
  if (detail)
    for (const f of courtyardWalls(body(841406515).ring)) {
      if (f.length > 3.6)
        facadeWindows(out, f, -0.45, 0.94, 1.62, f.length > 8 ? 3 : 1, detail, windows);
    }
  for (const [roofId, capId, y] of [
    [841406513, 841406512, 10.15],
    [841406514, 841406511, 10.28],
  ]) {
    const spire = part(roofId),
      c = spire.center;
    const layers = [
      [y, 1.72, 1.72],
      [y + 1.05, 1.67, 1.67],
      [y + 2.48, 1.2, 1.2],
      [y + 6.85, 0.42, 0.42],
      [y + 7.53, 0.35, 0.35],
    ];
    tower(out, 'plaster', c, 1.73, detail ? 8 : 5, y - 0.55, y + 1.08, trim, { rotation: 0.46 });
    lathe(
      out,
      'shingle',
      c,
      detail ? layers : [layers[0], layers[3], layers[4]],
      detail ? 8 : 5,
      steel,
      { rotation: 0.46 },
    );
    cupola(out, part(capId).center, y + 7.46, 0.57, 1.29, rgb('a39179'), detail, 'copper');
  }
}

function cathedralAndBell(out, detail) {
  for (const item of site.body.filter(
    (x) =>
      !(detail ? [841406515, 841406516] : [841406515, 841406516, 839688354, 1303850112]).includes(
        x.id,
      ),
  )) {
    const { id, wing } = item,
      c = id === 1303850112 ? oak : pale;
    roofedWing(
      out,
      wing,
      id === 1303850112 ? 'wood' : 'plaster',
      c,
      'iron',
      id === 839688355 ? clay : steel,
    );
    if (detail && id !== 839688359) {
      for (const f of courtyardWalls(wing.ring)) {
        if (f.length < 3) continue;
        const cap = wing.eave;
        const h = cap > 7 ? 2.05 : 1.1;
        const n = Math.max(1, Math.round(f.length / 4.5));
        facadeWindows(out, f, cap * 0.53, 0.67, h, n, detail, { ...windows, head: 'round' });
        if (detail > 1 && cap > 11 && id !== 839688353)
          facadeWindows(out, f, 3.9, 0.82, h, n, 1, { ...windows, head: 'round' });
      }
    }
  }
  if (detail) for (const wing of site.link) roofedWing(out, wing, 'plaster', pale, 'shingle', roof);
  const c = part(841406508).center;
  const lofts = [
    [part(841406510).center, 15.04, 1.52, 3.5, copper, 'copper'],
    [c, 19.86, 1.54, 3.72, steel, 'iron'],
    [part(841406506).center, 19.3, 1.14, 2.76, green, 'copper'],
  ];
  for (const [p, y, r, h, tone, slot] of lofts) {
    const drum = tower(out, 'plaster', p, r * 0.64, detail ? 10 : 5, y - 2.45, y + 0.02, trim, {
      rotation: 0.1,
    });
    if (detail > 1)
      for (const f of courtyardWalls(drum))
        if (f.length > 0.45)
          opening(out, f, f.length * 0.5, y - 1.84, 0.29, 0.83, {
            ...windows,
            head: 'round',
            frameWidth: 0.06,
          });
    cupola(out, p, y, r, h, tone, detail, slot);
  }
  for (const [id, y, Y] of [
    [841406509, 15.28, 20.35],
    [841406507, 12.5, 19.6],
  ]) {
    const r = part(id).ring,
      c = part(id).center;
    const p = outwardRing(r);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      tri(out, 'iron', [a[0], y, a[1]], [b[0], y, b[1]], [c[0], Y, c[1]], steel);
    }
  }
  const bell = part(841406505);
  const shaft = body(839688353);
  const stand = shaft.ring.map((p) => p.map((v, i) => 0.88 * v + 0.12 * bell.center[i]));
  const faces = courtyardWalls(stand);
  for (const f of faces) {
    openArcade(out, f, {
      count: 2,
      bottom: 13.33,
      top: 17.6,
      spring: 15.33,
      depth: 0.72,
      slot: 'stone',
      color: trim,
      steps: detail > 1 ? 7 : 3,
      openRatio: 0.375,
      shallow: !detail,
    });
  }
  if (detail === 3)
    for (const f of faces) {
      for (const u of [f.length * 0.25, f.length * 0.75]) {
        fbox(out, 'stone', f, u - 0.68, u + 0.68, 13.36, 13.52, -0.06, 0.18, trim);
      }
    }
  const b = bell.center;
  extrude(out, 'stone', stand, 17.52, 17.94, trim);
  lathe(
    out,
    'shingle',
    b,
    [
      [17.9, 3.64, 3.64],
      [19.1, 2.73, 2.73],
      [24.12, 0.56, 0.56],
      [24.7, 0.38, 0.38],
    ],
    4,
    steel,
    { rotation: 0.78 },
  );
  cupola(out, b, 24.62, 0.58, 1.22, copper, detail, 'copper');
  if (detail > 1)
    lathe(
      out,
      'pane',
      b,
      [
        [14.04, 0.77, 0.77],
        [14.24, 0.61, 0.61],
        [15.55, 0.36, 0.36],
      ],
      10,
      rgb('817663'),
    );
}

function enclosure(out, detail) {
  for (const { ring, grade, id } of site.fence) {
    if (!detail && [839688375, 839688376, 839688377, 839688378, 839688373, 839688361].includes(id))
      continue;
    const f = courtyardWalls(ring).reduce((a, b) => (a.length > b.length ? a : b));
    const base = ([x, z]) => {
      const t = Math.max(
        0,
        Math.min(1, dot([x - f.origin[0], z - f.origin[1]], f.along) / f.length),
      );
      return grade[0] * (1 - t) + grade[1] * t;
    };
    const path = outwardRing(ring);
    for (let i = 0; i < path.length; i++) {
      const a = path[i],
        b = path[(i + 1) % path.length],
        y = base(a),
        h = base(b);
      quad4(
        out,
        'plaster',
        [a[0], y - 0.98, a[1]],
        [b[0], h - 0.98, b[1]],
        [b[0], h + 2.28, b[1]],
        [a[0], y + 2.28, a[1]],
        pale,
      );
      if (detail)
        quad4(
          out,
          'stone',
          [a[0], y + 2.27, a[1]],
          [b[0], h + 2.27, b[1]],
          [b[0], h + 2.54, b[1]],
          [a[0], y + 2.54, a[1]],
          foundation,
        );
    }
    if (
      detail &&
      !out.addCap(
        'iron',
        'palette:#ffffff',
        path,
        [],
        (p) => base(p) + 2.54,
        [0, 1, 0],
        (p) => p,
        green,
      )
    )
      throw new Error('Enclosure cap failed');
  }
}

function build(mesh, detail) {
  const out = withFootprintCaps(mesh);
  enclosure(out, detail);
  cathedralAndBell(out, detail);
  holyGates(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
