import { beam } from './authored-structure-mesh.mjs';
import { lathe, quad4, rgb, tri } from './place-recipe-kit.mjs';

export const reflectorSurfaces = {
  dish: { slot: 'roof', graph: 'metal_painted', roughness: 0.81 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.86 },
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.96 },
  housing: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.89 },
};

const dishTones = ['d9d8ce', 'd7d7cd', 'dedbd0', 'd6d7cf'].map(rgb);
export const steel = rgb('b5b8ac');
export const lightSteel = rgb('ced0c2');
export const darkSteel = rgb('737c77');
export const concrete = rgb('a5a295');

const turn = 2 * Math.PI;

/** An orthonormal, site-oriented aperture frame. Y remains survey-up for the mount. */
export function reflectorFrame(spec) {
  const azimuth = (spec.bearing * Math.PI) / 180;
  const elevation = (spec.alt * Math.PI) / 180;
  const sin = Math.sin(azimuth);
  const cos = Math.cos(azimuth);
  const s = Math.sin(elevation);
  const c = Math.cos(elevation);
  const mount = (u, y, d) => [cos * u + sin * d, y, -sin * u + cos * d];
  const point = (u, v, height) => mount(u, spec.vertex + v * c + height * s, height * c - v * s);
  const onDish = (fraction, angle, offset = 0) =>
    point(
      spec.rx * fraction * Math.cos(angle),
      spec.rz * fraction * Math.sin(angle),
      spec.depth * fraction * fraction + offset,
    );
  return { mount, point, onDish };
}

/** Apply the same aperture profile to the solid reflector and the exposed rear bracing. */
export function reflector(out, spec, detail, style) {
  const { point, onDish } = reflectorFrame(spec);
  const { sections, rim, backDepth, feedAngles } = style;
  const n = sections[detail];
  const rings = [3, 4, 7, 10][detail];
  const thickness = spec.rx * 0.0084;
  const face = (r, i, offset = 0) => onDish(r, (i * turn) / n, offset);
  for (let i = 0; i < n; i++) {
    const c = dishTones[detail < 2 ? 0 : Math.floor(i / 3) % dishTones.length];
    const r0 = 1 / rings;
    tri(out, 'dish', point(0, 0, 0), face(r0, i), face(r0, i + 1), c);
    tri(
      out,
      'dish',
      point(0, 0, -thickness),
      face(r0, i + 1, -thickness),
      face(r0, i, -thickness),
      darkSteel,
    );
    for (let j = 1; j < rings; j++) {
      const m = j / rings,
        M = (j + 1) / rings;
      quad4(out, 'dish', face(m, i), face(M, i), face(M, i + 1), face(m, i + 1), c);
      quad4(
        out,
        'dish',
        face(m, i + 1, -thickness),
        face(M, i + 1, -thickness),
        face(M, i, -thickness),
        face(m, i, -thickness),
        steel,
      );
    }
    quad4(
      out,
      'steel',
      face(1, i + 1),
      face(1, i),
      face(1, i, -rim),
      face(1, i + 1, -rim),
      lightSteel,
    );
  }
  const feed = point(0, 0, spec.focusLength);
  const housingTail = point(0, 0, spec.focusLength + spec.rx * 0.067);
  beam(out, 'housing', feed, housingTail, spec.rx * 0.087, spec.rx * 0.083, lightSteel);
  const braceLength = spec.rx * (detail ? 0.024 : 0.036);
  for (const angle of feedAngles) {
    const foot = onDish(style.feedFoot, angle, 0.065);
    beam(out, 'steel', foot, feed, braceLength, braceLength, lightSteel);
    if (detail > 1 && spec.rx > 10) {
      const start = onDish(style.feedFoot + 0.037, angle + 0.05, 0.065);
      let prev = foot;
      for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        const top = foot.map((v, j) => v * (1 - t) + feed[j] * t);
        const lower = start.map((v, j) => v * (1 - t) + feed[j] * t);
        if (i < 5) beam(out, 'steel', top, lower, braceLength * 0.29, braceLength * 0.29, steel);
        beam(out, 'steel', prev, lower, braceLength * 0.31, braceLength * 0.31, steel);
        prev = top;
      }
      beam(out, 'steel', start, feed, braceLength * 0.56, braceLength * 0.49, steel);
    }
  }

  const ribs = (detail < 2 ? [4, 8] : [12, 16])[detail % 2];
  const hub = point(0, 0, -backDepth);
  const rounds = detail < 2 ? [0.58] : [0.3, 0.57, 0.8];
  const back = (r, angle) => onDish(r, angle, -thickness - rim - backDepth * (1 - r) * 0.56);
  const width = spec.rx * (detail ? 0.018 : 0.029);
  for (let i = 0; i < ribs; i++) {
    const a = (turn * i) / ribs;
    let start = hub;
    for (const r of [...rounds, 1]) {
      const end = back(r, a);
      beam(out, 'steel', start, end, width, width * 0.77, steel);
      if (detail > 0 && r < 1) {
        beam(out, 'steel', end, onDish(r, a, -thickness), width * 0.53, width * 0.49, darkSteel);
      }
      start = end;
    }
    if (detail > 0) {
      const next = (turn * (i + 1)) / ribs;
      for (const r of rounds) {
        beam(out, 'steel', back(r, a), back(r, next), width * 0.7, width * 0.63, steel);
      }
      beam(
        out,
        'steel',
        back(rounds.at(-1), a),
        back(1, next),
        width * 0.47,
        width * 0.39,
        darkSteel,
      );
    }
  }
}

/** Ring section mounted at an elevation, with a clear center. */
export function rimTrack(out, slot, r, w, y, h, n, tone) {
  const p = (i, radius, height) => [
    radius * Math.cos((i * turn) / n),
    height,
    radius * Math.sin((i * turn) / n),
  ];
  for (let i = 0; i < n; i++) {
    const a = p(i, r + w / 2, y + h),
      b = p(i + 1, r + w / 2, y + h);
    const c = p(i, r - w / 2, y + h),
      d = p(i + 1, r - w / 2, y + h);
    quad4(out, slot, b, a, c, d, tone);
    quad4(out, slot, a, b, p(i + 1, r + w / 2, y), p(i, r + w / 2, y), tone);
    quad4(out, slot, d, c, p(i, r - w / 2, y), p(i + 1, r - w / 2, y), tone);
  }
}

export function collar(out, center, y, height, radius, detail, tone = darkSteel) {
  lathe(
    out,
    'steel',
    center,
    [
      [y, radius, radius],
      [y + height, radius, radius],
    ],
    detail ? 10 : 5,
    tone,
  );
}
