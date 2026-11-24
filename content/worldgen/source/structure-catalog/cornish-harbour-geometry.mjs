import { beamPath } from '../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  rgb,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const wetStone = rgb('87816f');
const granite = rgb('a39a86');
const coping = rgb('b2a998');
const dockWood = rgb('655849');
const iron = rgb('626760');
const plaster = rgb('ddd5c4');

function quay(out, caps, q, detail) {
  extrude(caps, 'stone', q.outline, q.base, q.top, q.exposed ? granite : wetStone, {
    topSlot: 'paving',
    topColor: coping,
  });
  if (detail === 0) return;
  for (const [a, b] of q.edges) {
    const f = wallFace(a, b);
    if (f.length < 1.4) continue;
    fbox(out, 'stone', f, 0, f.length, q.top - 0.32, q.top + 0.045, -0.22, 0.031, coping);
    if (!q.posts) continue;
    const pitch = detail > 1 ? 8.2 : 17.1;
    for (let x = pitch * 0.46; x < f.length - 0.4; x += pitch) {
      const p = f.P(x, 0, -0.53);
      lathe(
        out,
        'iron',
        [p[0], p[2]],
        [
          [q.top, 0.115, 0.115],
          [q.top + 0.44, 0.105, 0.105],
          [q.top + 0.53, 0.14, 0.14],
        ],
        detail > 1 ? 8 : 6,
        iron,
      );
    }
  }
}

function lock(out, gate, detail) {
  const f = wallFace(gate.ends[0], gate.ends[1]);
  const V = gate.top;
  const W = f.length;
  const point = (u, y, d = 0) => f.P(u, y, d + Math.min(u, W - u) * 0.13);
  for (const [a, b] of [
    [0, W * 0.5],
    [W * 0.5, W],
  ]) {
    const trace = [a, b].map((u) => point(u, V));
    const wall = wallFace(
      trace[0].filter((_, i) => i !== 1),
      trace[1].filter((_, i) => i !== 1),
    );
    fbox(out, 'wood', wall, 0, wall.length, gate.base, V, -0.18, 0.2, dockWood);
    fbox(out, 'iron', wall, 0, wall.length, V - 0.17, V + 0.065, -0.31, 0.31, iron);
    if (detail === 0) continue;
    for (const s of [-1, 1]) {
      const line = [wall.P(0, V + 0.93, s * 0.33), wall.P(wall.length, V + 0.93, s * 0.33)];
      beamPath(out, 'iron', line, 0.064, 0.064, iron);
      for (let i = 0; i < 4; i++) {
        const x = (i * wall.length) / 3;
        fbox(
          out,
          'iron',
          wall,
          x - 0.035,
          x + 0.035,
          V,
          V + 0.93,
          s * 0.33 - 0.026,
          s * 0.33 + 0.026,
          iron,
        );
      }
    }
  }
}

function dockSteps(out, stairs, detail) {
  if (detail === 0) return;
  for (const p of stairs) {
    const f = facade(p.center, p.along);
    const run = p.length / p.count;
    for (let i = 0; i < p.count; i++) {
      const y = p.top - ((p.top - p.base) * (i + 1)) / p.count;
      fbox(
        out,
        'stone',
        f,
        -p.width / 2,
        p.width / 2,
        p.base - 0.07,
        y + 0.045,
        i * run,
        (i + 1) * run + 0.025,
        granite,
      );
    }
  }
}

function daymark(out, mark, detail) {
  const { center, grade, base } = mark;
  const n = [7, 10, 16, 22][detail];
  lathe(
    out,
    'stone',
    center,
    [
      [base, 1.67, 1.67],
      [grade + 0.16, 1.6, 1.6],
    ],
    n,
    granite,
    { capTop: true },
  );
  lathe(
    out,
    'plaster',
    center,
    [
      [grade + 0.14, 1.42, 1.42],
      [grade + 2.1, 1.36, 1.36],
      [grade + 2.17, 1.52, 1.52],
      [grade + 2.36, 1.4, 1.4],
      [grade + 2.94, 0.83, 0.83],
      [grade + 3.19, 0.22, 0.22],
      [grade + 3.34, 0.04, 0.04],
    ],
    n,
    plaster,
  );
  if (detail === 0) return;
  const f = facade(center, mark.axis);
  opening(out, f, 0, grade + 0.18, 0.76, 1.51, {
    head: 'round',
    glassSlot: 'wood',
    frameSlot: 'stone',
    glass: dockWood,
    frame: coping,
    d: 1.493,
    frameWidth: 0,
    sill: false,
  });
}

function build(out, harbour, detail) {
  const caps = withFootprintCaps(out);
  for (const q of harbour.quays) quay(out, caps, q, detail);
  for (const gate of harbour.gates) lock(out, gate, detail);
  dockSteps(out, harbour.stairs, detail);
  if (harbour.mark) daymark(out, harbour.mark, detail);
}

export function cornishHarbourGeometry(harbour) {
  const surfaces = {
    stone: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
    paving: { slot: 'foundation', graph: 'gravel', roughness: 0.97 },
    iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.91 },
    wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.96 },
    ...(harbour.mark ? { plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 } } : {}),
  };
  const buildSkyline = (out) => build(out, harbour, 0);
  const buildDistrict = (out) => build(out, harbour, 1);
  const buildStreet = (out) => build(out, harbour, 2);
  const buildCloseup = (out) => build(out, harbour, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
