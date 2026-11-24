import { beamPath } from '../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const granite = rgb('a69f8d');
const cut = rgb('b8ad9c');
const steel = rgb('555e5f');
const stiffener = rgb('677073');
const rail = rgb('817e74');
const wood = rgb('6d5d49');
const grass = rgb('777b59');
const alongTrack = (path) => {
  const marks = [0];
  for (let i = 1; i < path.length; i++)
    marks.push(marks[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const length = marks.at(-1);
  const position = (s) => {
    const upper = marks.findIndex((mark) => mark >= s);
    const i = upper < 1 ? (upper === 0 ? 1 : marks.length - 1) : upper;
    const t = (s - marks[i - 1]) / (marks[i] - marks[i - 1]);
    return path[i - 1].map((x, j) => x + (path[i][j] - x) * t);
  };
  const frame = (s) => {
    const a = position(s - 0.65);
    const b = position(s + 0.65);
    return facade(position(s), [b[0] - a[0], b[1] - a[1]]);
  };
  return { length, frame };
};

function strip(out, slot, A, B, d, D, bottomA, bottomB, topA, topB, tint, ends = false) {
  const a = A.P(0, bottomA, d);
  const b = B.P(0, bottomB, d);
  const c = B.P(0, topB, d);
  const y = A.P(0, topA, d);
  const p = A.P(0, bottomA, D);
  const q = B.P(0, bottomB, D);
  const r = B.P(0, topB, D);
  const s = A.P(0, topA, D);
  quad4(out, slot, p, q, r, s, tint);
  quad4(out, slot, b, a, y, c, tint);
  quad4(out, slot, a, b, q, p, tint);
  quad4(out, slot, s, r, c, y, tint);
  if (ends) {
    quad4(out, slot, a, p, s, y, tint);
    quad4(out, slot, q, b, c, r, tint);
  }
}

function pier(out, frame, bridge, s, bottom, top, detail, end = false) {
  const f = frame(s);
  const H = Math.max(top - bottom, 0.9);
  const L = (end ? bridge.abutment : bridge.pier) * 0.5;
  const W = bridge.width * 0.5 + (bridge.girder ? -0.09 : 0.17);
  const taper = Math.min(H * 0.048, bridge.girder ? 0.4 : 1.22);
  const section = (y, u, d) => [f.P(-u, y, d), f.P(u, y, d), f.P(u, y, -d), f.P(-u, y, -d)];
  const a = section(bottom, L + taper * 0.68, W + taper);
  const b = section(top, L, W);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(out, 'stone', a[i], a[j], b[j], b[i], granite);
  }
  if (bridge.cutwaters && !end && detail > 0) {
    for (const side of [-1, 1]) {
      const P = (d) => f.P(0, 0, d).filter((_, i) => i !== 1);
      const r = L + taper * 0.68;
      lathe(
        out,
        'stone',
        P(side * (W + taper * 0.65)),
        [
          [bottom, r * 0.94, r * 0.94],
          [
            Math.max(bottom + 0.5, Math.min(top - 0.52, bridge.waterHeight + 1.7)),
            r * 0.91,
            r * 0.91,
          ],
          [Math.max(bottom + 0.54, Math.min(top - 0.29, bridge.waterHeight + 2.33)), 0.021, 0.021],
        ],
        detail < 2 ? 5 : 8,
        granite,
      );
    }
  }
  if (detail > 0)
    fbox(out, 'stone', f, -L - 0.16, L + 0.16, top - 0.3, top + 0.06, -W - 0.13, W + 0.13, cut);
}

function arcBay(out, bridge, frame, deck, bay, detail) {
  const { start, end } = bay;
  const half = (end - start) * 0.5;
  const center = (start + end) * 0.5;
  const w = bridge.width * 0.5;
  const rise = Math.min(half * bridge.arcRatio, bridge.arcRise);
  const depth = rise + bridge.crownDepth;
  const count = [5, 9, 13, 19][detail];
  const arc = Array.from({ length: count + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / count);
    const s = center + Math.cos(angle) * half;
    return { s, frame: frame(s), bottom: deck(s) - depth + rise * Math.sin(angle), top: deck(s) };
  });
  for (let i = 0; i < count; i++) {
    const A = arc[i];
    const B = arc[i + 1];
    strip(out, 'stone', A.frame, B.frame, -w, w, A.bottom, B.bottom, A.top, B.top, granite);
    if (detail < 2) continue;
    const band = 0.47;
    for (const side of [-1, 1]) {
      const P = (q, dy) => q.frame.P(0, q.bottom + dy, side * (w + 0.026));
      const ring = [P(A, 0), P(B, 0), P(B, band), P(A, band)];
      if (side < 0) ring.reverse();
      quad4(out, 'stone', ...ring, (i + bay.index) % 4 ? cut : granite);
    }
  }
}

function build(out, bridge, detail) {
  const { length, frame } = alongTrack(bridge.path);
  const deck = (s) => bridge.grade[0] + ((bridge.grade[1] - bridge.grade[0]) * s) / length;
  const W = bridge.width * 0.5;
  const pad = bridge.pad;
  const pierS = bridge.pierMarks;
  const halfPier = bridge.pier * 0.47;
  for (let i = 0; i < pierS.length; i++) {
    const s = pierS[i];
    const end = i === 0 || i === pierS.length - 1;
    const startY =
      deck(s) - (bridge.girder ? bridge.girderDepth : bridge.arcRise + bridge.crownDepth);
    pier(
      out,
      frame,
      bridge,
      s,
      bridge.pierBases[i],
      Math.max(startY, bridge.pierBases[i] + 0.6),
      detail,
      end,
    );
    if (!bridge.girder && !end) {
      const f = frame(s);
      fbox(
        out,
        'stone',
        f,
        -halfPier,
        halfPier,
        startY - 0.09,
        deck(s) + (bridge.cutwaters ? 0.27 : 0),
        -W - 0.025,
        W + 0.025,
        granite,
      );
      if (bridge.cutwaters && detail > 0)
        fbox(
          out,
          'stone',
          f,
          -0.83,
          0.83,
          deck(s) - 0.48,
          deck(s) + 0.76,
          -W - 0.22,
          W + 0.22,
          cut,
        );
    }
  }
  const num = Math.ceil(length / (detail === 0 ? 47 : bridge.girder ? 14 : 13));
  const station = Array.from({ length: num + 1 }, (_, i) => (i * length) / num);
  for (let i = 0; i < station.length - 1; i++) {
    const a = station[i],
      b = station[i + 1];
    const A = frame(a),
      B = frame(b);
    const ay = deck(a),
      by = deck(b);
    const ends = i === 0 || i === station.length - 2;
    const depth = bridge.girder ? bridge.girderDepth : bridge.crownDepth + 0.1;
    strip(
      out,
      bridge.girder ? 'metal' : 'stone',
      A,
      B,
      -W,
      W,
      ay - depth,
      by - depth,
      ay - 0.035,
      by - 0.035,
      bridge.girder ? steel : granite,
      ends,
    );
    for (const side of [-1, 1]) {
      const pair = [side * (W - (bridge.girder ? 0.14 : 0.4)), side * W].sort((x, y) => x - y);
      const height = bridge.girder ? 0.105 : 0.77;
      const threshold = bridge.girder ? 0.88 : -0.035;
      strip(
        out,
        bridge.girder ? 'metal' : 'stone',
        A,
        B,
        ...pair,
        ay + threshold,
        by + threshold,
        ay + threshold + height,
        by + threshold + height,
        bridge.girder ? rail : cut,
        ends,
      );
    }
    if (!bridge.railways.length && detail > 0)
      strip(
        out,
        'deck',
        A,
        B,
        -0.31,
        0.31,
        ay - 0.055,
        by - 0.055,
        ay - 0.01,
        by - 0.01,
        grass,
        ends,
      );
  }
  if (bridge.girder && detail > 0) {
    const every = 3.15;
    for (let s = 0.8; s < length; s += every)
      for (const side of [-1, 1]) {
        const f = frame(s),
          z = side * (W - 0.06),
          y = deck(s);
        fbox(out, 'metal', f, -0.052, 0.052, y - 0.17, y + 0.97, z - 0.05, z + 0.05, rail);
      }
    if (detail > 1)
      for (let i = 0; i + 1 < pierS.length; i++) {
        const a = pierS[i];
        const b = pierS[i + 1];
        const sections = detail === 2 ? [0.18, 0.81] : [0.14, 0.37, 0.63, 0.86];
        for (const t of sections)
          for (const side of [-1, 1]) {
            const s = a + (b - a) * t;
            const y = deck(s);
            const z = side * W;
            const f = frame(s);
            fbox(
              out,
              'metal',
              f,
              -0.066,
              0.066,
              y - bridge.girderDepth + 0.038,
              y - 0.057,
              z - 0.047,
              z + 0.047,
              stiffener,
            );
          }
      }
  } else if (!bridge.girder) {
    for (let i = 0; i < bridge.count; i++) {
      const start = pierS[i] + halfPier;
      const end = pierS[i + 1] - halfPier;
      arcBay(out, bridge, frame, deck, { start, end, index: i }, detail);
    }
    for (const [a, b] of [
      [0, pad + halfPier],
      [length - pad - halfPier, length],
    ]) {
      const pierBase = a === 0 ? bridge.pierBases[0] : bridge.pierBases.at(-1);
      strip(
        out,
        'stone',
        frame(a),
        frame(b),
        -W,
        W,
        pierBase,
        pierBase,
        deck(a),
        deck(b),
        granite,
        true,
      );
    }
  }
  if (!bridge.railways.length || detail === 0) return;
  for (const z of bridge.railways) {
    for (const side of [-1, 1]) {
      const path = station.map((s) => frame(s).P(0, deck(s) + 0.145, z + side * 0.718));
      beamPath(out, 'metal', path, 0.09, 0.12, rail);
    }
    if (detail < 2) continue;
    for (let s = 1.15; s < length - 0.4; s += detail === 2 ? 2.12 : 1.08) {
      const f = frame(s),
        y = deck(s);
      fbox(out, 'sleeper', f, -0.12, 0.12, y - 0.01, y + 0.06, z - 1.08, z + 1.08, wood);
    }
  }
}

export function cornishViaductGeometry(bridge) {
  const surfaces = {
    stone: {
      slot: 'wall',
      graph: bridge.cutwaters ? 'concrete_panel' : 'stone_ashlar',
      roughness: 0.95,
    },
    ...(bridge.railways.length
      ? {
          metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
          sleeper: { slot: 'trim', graph: 'wood_vertical', roughness: 0.97 },
        }
      : { deck: { slot: 'foundation', graph: 'gravel', roughness: 0.98 } }),
  };
  const buildSkyline = (out) => build(out, bridge, 0);
  const buildDistrict = (out) => build(out, bridge, 1);
  const buildStreet = (out) => build(out, bridge, 2);
  const buildCloseup = (out) => build(out, bridge, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
