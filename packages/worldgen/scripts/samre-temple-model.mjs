/** 'N0529': N0529: Banteay Samré's own mapped enclosures and photographed sanctuary group. */
import { box, corbel, loft, pediment, prism } from './khmer-structure-geometry.mjs';

function pose(f, x, y, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([u, v, w]) => [x + c * u - s * w, y + v, z + s * u + c * w]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
}
function facade(f, width, thickness, bottom, height, door, detail) {
  const pier = (width - door) / 2;
  for (const side of [-1, 1])
    box(f, 'stone', (side * (door + pier)) / 2, bottom, 0, pier, height, thickness);
  box(f, 'stone', 0, bottom + 3, 0, door, height - 3, thickness);
  if (detail >= 1) {
    for (const side of [-1, 1]) {
      box(f, 'carved', side * (door / 2 + 0.18), bottom, thickness / 2 + 0.12, 0.25, 3.15, 0.3);
      if (detail >= 2)
        for (const y of [0.2, 0.5, 2.55, 2.85])
          box(
            f,
            'carved',
            side * (door / 2 + 0.18),
            bottom + y,
            thickness / 2 + 0.17,
            0.36,
            0.12,
            0.33,
          );
    }
    box(f, 'carved', 0, bottom + 3.15, thickness / 2 + 0.15, door + 0.9, 0.35, 0.45);
    pediment(f, 0, bottom + height, thickness / 2, width * 0.7, 1.65, detail);
  }
}
function stairs(f, width, run, rise, bottom) {
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const top = rise * (1 - i / steps);
    box(
      f,
      'carved',
      0,
      bottom,
      ((i + 0.5) * run) / steps,
      width,
      top - bottom,
      run / steps + 0.025,
    );
  }
}
function chamber(f, p, detail) {
  const w = p.width,
    d = p.depth,
    base = p.kind === 'sanctuary' ? 1.2 : 0.8,
    body = p.kind === 'sanctuary' ? 4.3 : 3.8;
  const tiers = detail === 0 ? 1 : 3;
  for (let k = 0; k < tiers; k++) {
    const y = (k * base) / tiers,
      extra = (tiers - k) * 0.18;
    box(
      f,
      'carved',
      0,
      k === 0 ? p.foundationBase - p.floorY : y,
      0,
      w + extra,
      base / tiers + (k === 0 ? y - p.foundationBase + p.floorY : 0),
      d + extra,
    );
  }
  if (p.kind === 'sanctuary') {
    for (let k = 0; k < 4; k++) {
      const alongX = k % 2 === 1,
        width = alongX ? d : w,
        offset = alongX ? w / 2 - 0.55 : d / 2 - 0.55;
      const side = k < 2 ? 1 : -1,
        front = pose(
          f,
          alongX ? side * offset : 0,
          0,
          alongX ? 0 : side * offset,
          alongX ? (-side * Math.PI) / 2 : side === 1 ? 0 : Math.PI,
        );
      facade(front, width, 1.1, base, body, 1.6, detail);
    }
    const shapes = (() => {
      const points = [[5.5, 6.8]],
        ys = [5.5, 8.2, 10.9, 13.5, 15.8],
        ws = [6.8, 5.9, 4.9, 3.8, 2.6, 1.35];
      for (let k = 0; k < 5; k++) {
        const hi = k === 4 ? 17.2 : ys[k + 1],
          h = hi - ys[k];
        points.push(
          [ys[k] + h * 0.56, ws[k] * 0.98],
          [ys[k] + h * 0.62, ws[k] * 1.08],
          [ys[k] + h * 0.72, ws[k] * 1.08],
          [hi, ws[k + 1]],
        );
      }
      points.push([17.65, 0.95], [18, 0.5]);
      return points;
    })();
    const plan =
      detail >= 2
        ? (width) => {
            const radius = width / 2,
              quarter = [
                [-radius, -radius],
                [-radius * 0.58, -radius],
                [-radius * 0.58, -radius * 0.85],
                [radius * 0.58, -radius * 0.85],
                [radius * 0.58, -radius],
              ];
            return [0, 1, 2, 3].flatMap((k) => {
              const a = (k * Math.PI) / 2,
                c = Math.cos(a),
                s = Math.sin(a);
              return quarter.map(([x, z]) => [c * x - s * z, s * x + c * z]);
            });
          }
        : undefined;
    loft(f, 'stone', 0, 0, shapes, detail >= 1, plan);
    if (detail >= 2) {
      const radiusAt = (y) => {
        let i = 1;
        while (i < shapes.length - 1 && shapes[i][0] < y) i++;
        const [a, b] = [shapes[i - 1], shapes[i]],
          q = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
        return ((a[1] + (b[1] - a[1]) * q) * 0.85) / 2;
      };
      for (const k of [0, 1, 2, 3])
        for (const [y, width] of [
          [6, 2.9],
          [8.8, 2.3],
          [11.4, 1.7],
          [14, 1.2],
        ]) {
          const turn = pose(f, 0, 0, 0, (k * Math.PI) / 2),
            front = (role, ps, n) =>
              turn(
                role,
                ps.map(([u, v, z]) => [u, v, radiusAt(v) + z + 0.08]),
                n,
              );
          for (const hand of [-1, 1])
            box(front, 'carved', hand * width * 0.25, y, 0, 0.16, 0.85, 0.2);
          box(front, 'carved', 0, y + 0.75, 0, width * 0.65, 0.18, 0.23);
          pediment(front, 0, y + 0.85, 0, width, 0.95, detail);
        }
    }
  } else {
    for (const side of [-1, 1]) box(f, 'stone', 0, base, side * (d / 2 - 0.3), w, body, 0.6);
    facade(pose(f, -w / 2 + 0.3, 0, 0, Math.PI / 2), d, 0.6, base, body, 1.6, detail);
    if (p.kind === 'mandapa')
      facade(pose(f, w / 2 - 0.3, 0, 0, -Math.PI / 2), d, 0.6, base, body, 1.6, detail);
    else box(f, 'stone', w / 2 - 0.3, base, 0, 0.6, body, d);
    const roof = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, base + body + (y - 4.2) * 1.7, z]),
        n,
      );
    corbel(roof, [0, 0], w + 0.45, d + 0.4, true, detail === 0 ? 1 : detail);
  }
  if (detail >= 1) {
    const sides = p.kind === 'sanctuary' ? 4 : p.kind === 'mandapa' ? 2 : 1;
    for (let k = 0; k < sides; k++) {
      const angle =
        p.kind === 'sanctuary' ? (k * Math.PI) / 2 : k === 0 ? Math.PI / 2 : -Math.PI / 2;
      const distance = p.kind === 'sanctuary' ? (k % 2 === 1 ? w / 2 : d / 2) : w / 2;
      stairs(
        pose(f, -Math.sin(angle) * distance, 0, Math.cos(angle) * distance, angle),
        2.4,
        1.9,
        base,
        p.foundationBase - p.floorY,
      );
    }
  }
}
function proxyRing(f, halfX, halfZ, center, gates, height, width) {
  for (const alongX of [true, false])
    for (const side of [-1, 1]) {
      const gate = gates.find(
          (g) => g.alongX === alongX && Math.sign(g.center[alongX ? 0 : 1]) === side,
        ),
        half = alongX ? halfZ : halfX;
      const axis = alongX ? 1 : 0,
        offset = gate.center[axis] - center[axis],
        opening = 1.8;
      for (const sign of [-1, 1]) {
        const lo = sign === -1 ? -half : offset + opening / 2,
          hi = sign === -1 ? offset - opening / 2 : half;
        const x = alongX ? center[0] + side * halfX : center[0] + (lo + hi) / 2,
          z = alongX ? center[1] + (lo + hi) / 2 : center[1] + side * halfZ;
        box(
          f,
          'wall',
          x,
          -0.65,
          z,
          alongX ? width : hi - lo,
          height + 0.65,
          alongX ? hi - lo : width,
        );
      }
      box(
        f,
        'wall',
        gate.center[0],
        3,
        gate.center[1],
        alongX ? width : opening,
        height - 3,
        alongX ? opening : width,
      );
    }
}
export function buildSamreTemple(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    native = ([u, v]) => [c * u - s * v, s * u + c * v],
    grade = (u, v) => sampleTerrain(...native([u, v]));
  const f = (role, ps, n) => {
    if (detail === 0 && n[1] < -0.5) return;
    face(
      { wall: 'stone', trim: 'carved' }[role] ?? role,
      ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
  };
  const ground = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [u, grade(u, v) + y, v]),
        n,
      ),
    m = r.main;
  if (detail === 0) {
    proxyRing(
      (role, ps, n) => ground(role === 'wall' ? 'laterite' : role, ps, n),
      41.4,
      40,
      [0, 0],
      m.outerGates,
      3.8,
      1.3,
    );
    proxyRing(ground, 19.7, 17.55, [-0.7, -2.75], m.innerGates, 4.2, 2.9);
  } else {
    const l = m.levels[detail];
    for (const p of l.outerFoot) prism(ground, 'laterite', p, -0.65, 0.18, false);
    for (const p of l.outerLow) prism(ground, 'laterite', p, 0.18, 3, false);
    for (const p of l.outerTop) prism(ground, 'laterite', p, 3, 3.8, false);
    for (const p of l.innerFoot) prism(ground, 'carved', p, -0.65, 0.22, false);
    for (const p of l.innerLow) prism(ground, 'stone', p, 0.22, 1.25, false);
    for (const p of detail === 1 ? l.innerLow : l.innerWindows)
      prism(ground, 'stone', p, 1.25, 3, false);
    for (const p of l.innerTop) prism(ground, 'stone', p, 3, 4.2, false);
  }
  for (const roof of m.roofs)
    corbel(ground, roof.center, roof.length, roof.width, roof.alongX, detail === 0 ? 1 : detail);
  for (const p of [r.tower, r.hall, ...r.libraries])
    chamber(pose(f, ...[p.center[0], p.floorY, p.center[1]]), p, detail);
  if (detail >= 1)
    for (const gate of r.gates) {
      const [x, z] = gate.center,
        base = grade(x, z),
        rotation = gate.alongX ? Math.PI / 2 : 0;
      const at = pose(f, x, base, z, rotation),
        width = gate.outer ? 4.3 : 4.5;
      for (const side of [-1, 1]) {
        const front = pose(at, 0, 0, side * (gate.outer ? 0.75 : 2), side === 1 ? 0 : Math.PI);
        if (detail >= 2 || !gate.outer)
          for (const hand of [-1, 1]) box(front, 'carved', hand * 1.15, 0.2, 0, 0.3, 3.15, 0.28);
        box(front, 'carved', 0, 3.15, 0, 2.9, 0.4, 0.45);
        pediment(
          front,
          0,
          gate.outer ? 3.8 : 4.2,
          0,
          width,
          gate.outer ? 1.5 : 2,
          detail === 1 ? 0 : detail,
        );
      }
    }
}
