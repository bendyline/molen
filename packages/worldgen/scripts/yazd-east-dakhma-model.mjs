/** Specific eastern Yazd dakhma: native irregular ring, low damaged walls and shallow pit. */
import { box } from './khmer-structure-geometry.mjs';

export function buildYazdEastDakhma(face, detail, r, sample) {
  const F = r.floorY,
    c = r.center,
    tau = 2 * Math.PI,
    wrap = (a) => ((a % tau) + tau) % tau,
    delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)),
    phase = r.entrancePhase,
    doorHalf = Math.asin(r.doorWidth / (2 * (r.radius - 0.4))),
    direction = (a) => [Math.cos(a), 0, Math.sin(a)],
    point = (a, radius, y) => [c[0] + radius * Math.cos(a), y, c[1] + radius * Math.sin(a)],
    nativeRadius = (a) => {
      const u = [Math.cos(a), Math.sin(a)];
      for (let i = 0; i < r.outer.length; i++) {
        const p = r.outer[i].map((v, k) => v - c[k]),
          q = r.outer[(i + 1) % r.outer.length].map((v, k) => v - c[k]),
          d = q.map((v, k) => v - p[k]),
          den = u[0] * d[1] - u[1] * d[0];
        if (Math.abs(den) < 1e-9) continue;
        const ray = (p[0] * d[1] - p[1] * d[0]) / den,
          edge = (p[0] * u[1] - p[1] * u[0]) / den;
        if (ray > 0 && edge >= -1e-8 && edge <= 1 + 1e-8) return ray;
      }
      throw Error('Dakhma radial section escaped mapped polygon');
    },
    top = (a) => {
      const loss = Math.max(0, 1 - Math.abs(delta(a, 1.3)) / 0.7);
      return Math.max(
        1.22,
        2.0 + 0.22 * Math.sin(3 * a) + 0.17 * Math.cos(7 * a) - 0.65 * loss,
        2.12 - Math.abs(delta(a, phase)) * 0.8,
      );
    },
    angles = r.outer.flatMap((p, i) => {
      const a = wrap(Math.atan2(p[1] - c[1], p[0] - c[0])),
        q = r.outer[(i + 1) % r.outer.length],
        b = wrap(Math.atan2(q[1] - c[1], q[0] - c[0])),
        step = delta(b, a),
        count = [1, 2, 4, 6][detail];
      return Array.from({ length: count }, (_, j) => wrap(a + (step * j) / count));
    });
  angles.push(wrap(phase - doorHalf), wrap(phase + doorHalf));
  if (detail > 0)
    for (let i = 1; i < 8; i++) angles.push(wrap(phase - doorHalf + (2 * doorHalf * i) / 8));
  const ordered = [...new Set(angles)].sort((a, b) => a - b),
    pitRadius = (a) => r.pitRadius * (1 + 0.055 * Math.sin(5 * a) + 0.035 * Math.cos(9 * a)),
    pitBottom = F - r.pitDepth,
    emit = (role, ps, n) => face(role, ps, n),
    floorCenter = [c[0], pitBottom, c[1]],
    bottomCenter = [c[0], sample(...c) - 0.3, c[1]];

  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i],
      b = ordered[(i + 1) % ordered.length] + (i === ordered.length - 1 ? tau : 0),
      middle = (a + b) / 2,
      n = direction(middle),
      A = nativeRadius(a) - 0.8,
      B = nativeRadius(b) - 0.8,
      pa = point(a, A + 0.8, 0),
      pb = point(b, B + 0.8, 0),
      oa = point(a, A + 0.8, sample(pa[0], pa[2]) - 0.3),
      ob = point(b, B + 0.8, sample(pb[0], pb[2]) - 0.3),
      sa = point(a, A + 0.24 + 0.12 * Math.sin(5 * a), F - 0.46 + 0.12 * Math.sin(3 * a)),
      sb = point(b, B + 0.24 + 0.12 * Math.sin(5 * b), F - 0.46 + 0.12 * Math.sin(3 * b)),
      fa = point(a, A, F),
      fb = point(b, B, F),
      ia = point(a, pitRadius(a), F),
      ib = point(b, pitRadius(b), F),
      da = point(a, pitRadius(a) * 0.85, pitBottom),
      db = point(b, pitRadius(b) * 0.85, pitBottom),
      ga = point(a, pitRadius(a) * 0.85, sample(da[0], da[2]) - 0.3),
      gb = point(b, pitRadius(b) * 0.85, sample(db[0], db[2]) - 0.3);
    // Only the occupied court is supported. Native terrain remains underneath and outside it.
    emit('foot', [oa, ob, sb, sa], n);
    emit('foot', [sa, sb, fb, fa], n);
    emit('wall', [oa, ob, gb, ga], [0, -1, 0]);
    emit('gravel', [fa, fb, ib, ia], [0, 1, 0]);
    emit(
      'stone',
      [ia, ib, db, da],
      n.map((v) => -v),
    );
    emit('gravel', [floorCenter, da, db], [0, 1, 0]);
    emit('wall', [bottomCenter, ga, gb], [0, -1, 0]);

    const opening = Math.abs(delta(middle, phase)) < doorHalf + 1e-8,
      arch = (angle) => {
        if (detail === 0) return r.doorApex;
        const t = Math.max(-1, Math.min(1, delta(angle, phase) / doorHalf));
        return r.doorSpring + (r.doorApex - r.doorSpring) * Math.sqrt(Math.max(0, 1 - t * t));
      },
      ya = opening ? F + arch(a) : F,
      yb = opening ? F + arch(b) : F,
      Oa = point(a, A - 0.2, F + top(a)),
      Ob = point(b, B - 0.2, F + top(b)),
      Ia = point(a, A - r.wallThickness, F + top(a)),
      Ib = point(b, B - r.wallThickness, F + top(b)),
      la = point(a, A, ya),
      lb = point(b, B, yb),
      ma = point(a, A - r.wallThickness, ya),
      mb = point(b, B - r.wallThickness, yb);
    emit('wall', [la, lb, Ob, Oa], n);
    emit(
      'wall',
      [ma, mb, Ib, Ia],
      n.map((v) => -v),
    );
    emit('stone', [Oa, Ob, Ib, Ia], [0, 1, 0]);
    emit('stone', [la, lb, mb, ma], [0, -1, 0]);
    for (const angle of [phase - doorHalf, phase + doorHalf]) {
      if (Math.abs(delta(a, angle)) > 1e-7) continue;
      const R = nativeRadius(a) - 0.8,
        normal = direction(a + (delta(a, phase) < 0 ? Math.PI / 2 : -Math.PI / 2));
      emit(
        'stone',
        [
          point(a, R, F),
          point(a, R - r.wallThickness, F),
          point(a, R - r.wallThickness, F + arch(a)),
          point(a, R, F + arch(a)),
        ],
        normal,
      );
    }
    // Sparse worn plaster islands sit on the actual outer wall; no photographed facade atlas.
    if (
      detail > 0 &&
      !opening &&
      [
        [0.15, 0.9],
        [1.85, 2.7],
        [3.5, 4.6],
        [4.98, 5.72],
      ].some(([lo, hi]) => wrap(middle) > lo && wrap(middle) < hi)
    ) {
      const low = F + 0.2 + 0.1 * Math.cos(5 * middle),
        highA = F + top(a) - 0.24,
        highB = F + top(b) - 0.36,
        radiusAt = (R, y, angle) => point(angle, R - (0.2 * (y - F)) / top(angle) + 0.018, y);
      emit(
        'earth',
        [radiusAt(A, low, a), radiusAt(B, low, b), radiusAt(B, highB, b), radiusAt(A, highA, a)],
        n,
      );
    }
  }

  // Bounded steps follow the mapped northeastern approach and terminate in the open passage.
  const start = r.approach[0],
    end = r.approach[1],
    length = Math.hypot(end[0] - start[0], end[1] - start[1]),
    beginY = sample(...start) + 0.055,
    count = Math.max(8, Math.ceil((F - beginY) / 0.24)),
    run = (a, b, t0, t1, y0, y1) => {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        side = [-dz / len, dx / len],
        ps = [
          [a[0] + dx * t0 + side[0] * 0.72, a[1] + dz * t0 + side[1] * 0.72],
          [a[0] + dx * t1 + side[0] * 0.72, a[1] + dz * t1 + side[1] * 0.72],
          [a[0] + dx * t1 - side[0] * 0.72, a[1] + dz * t1 - side[1] * 0.72],
          [a[0] + dx * t0 - side[0] * 0.72, a[1] + dz * t0 - side[1] * 0.72],
        ],
        low = ps.map(([x, z]) => [x, Math.min(y0 - 0.18, sample(x, z) - 0.2), z]),
        top = ps.map(([x, z], i) => [x, i === 0 || i === 3 ? y0 : y1, z]);
      emit('stone', top, [0, 1, 0]);
      emit('wall', low, [0, -1, 0]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        emit(
          'wall',
          [low[i], low[j], top[j], top[i]],
          [ps[i][0] + ps[j][0] - a[0] - b[0], 0, ps[i][1] + ps[j][1] - a[1] - b[1]],
        );
      }
    };
  if (detail === 0) run(start, end, 0, 1, beginY, F + 0.025);
  else
    for (let i = 0; i < count; i++) {
      const y = beginY + ((F + 0.025 - beginY) * (i + 1)) / count;
      run(start, end, i / count, (i + 1) / count, y, y);
    }
  if (length < 1) throw Error('Missing eastern dakhma approach');
  run(end, r.approach[2], 0, 1, F + 0.025, F + 0.025);

  if (detail > 0) {
    const stones = [8, 16, 28][detail - 1];
    for (let i = 0; i < stones; i++) {
      const a = i * 2.399963229728653,
        rad = r.pitRadius * (0.75 + 0.28 * Math.sin(i * 1.7)),
        y =
          pitBottom +
          Math.max(0, Math.min(1, (rad / pitRadius(a) - 0.85) / 0.15)) * r.pitDepth -
          0.035,
        p = point(a, rad, y),
        w = 0.24 + 0.17 * (1 + Math.sin(i * 1.3));
      box(emit, 'stone', p[0], y, p[2], w, 0.12 + 0.08 * (i % 3), w * 0.65);
    }
    for (const [angle, width, height] of [
      [-0.4, 0.3, 0.67],
      [-0.1, 0.24, 0.46],
    ]) {
      const p = point(angle, r.pitRadius * 1.07, F - 0.03);
      box(emit, 'stone', p[0], p[1], p[2], width, height, 0.35);
    }
  }
}
