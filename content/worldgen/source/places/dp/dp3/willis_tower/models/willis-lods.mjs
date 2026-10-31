import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  sphere as fullSphere,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  willisMapEvidence as evidence,
  willisLocalFrame as frame,
  willisFloorHeight as level,
  willisMappedPlan as mapPlan,
  willisMechanicalFloor as mechanical,
  willisTubes as towers,
  willisTubeWidth as W,
} from './willis-tower-model.mjs';

const black = [0.105, 0.115, 0.115],
  bronze = [0.24, 0.235, 0.21],
  silver = [0.77, 0.78, 0.77],
  concrete = [0.64, 0.63, 0.59];
const parts = [
  1178212992, 1178212993, 1178212994, 1178212995, 1178212996, 1178212997, 1178212998, 1178212999,
  1178213001, 1178226263, 1178226264,
];
const canopies = [
  1178212981, 1178212983, 1178212984, 1178212985, 1178212986, 1178212987, 1178212988, 1178212989,
  1178212990, 1178212991, 1178213002, 1178234330,
];
const face = (out, slot, ps, color) => quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
function panel(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}
function cap(out, plan, y, slot, color) {
  for (const inds of ShapeUtils.triangulateShape(
    plan.map((p) => new Vector2(...p)),
    [],
  )) {
    let ps = inds.map((i) => [plan[i][0], y, plan[i][1]]);
    if (normalFor(...ps)[1] < 0) ps = ps.toReversed();
    out.addTriangle(
      slot,
      'metric:uv',
      ps,
      [0, 1, 0],
      ps.map((p) => [p[0], p[2]]),
      color,
    );
  }
}

// Remove redundant survey vertices while keeping the irregular podium and entrance recesses.
export function willisOutline(plan, tolerance) {
  const p = [...plan];
  for (let changed = true; changed && p.length > 3; ) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        den = dx * dx + dz * dz;
      if (!den) continue;
      const t = Math.max(0, Math.min(1, ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / den));
      if (Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}

function components(detail) {
  const sky = detail === 'skyline',
    district = detail === 'district',
    close = detail === 'closeup',
    stride = close ? 1 : district ? 8 : sky ? 999 : 3,
    bays = close ? 10 : district ? 5 : sky ? 1 : 10;
  function facade(out, start, end) {
    const lo = level(start),
      hi = level(end);
    if (district) panel(out, 'metal', -W / 2, W / 2, lo, hi, 0, black);
    for (let floor = start + 1; floor <= end; ) {
      const m = mechanical(floor);
      let last = Math.min(end, floor + stride - 1);
      for (let f = floor + 1; f <= last; f++)
        if (mechanical(f) !== m) {
          last = f - 1;
          break;
        }
      const y0 = level(floor - 1),
        y1 = level(last);
      if (m) {
        panel(
          out,
          'metal',
          -W / 2,
          W / 2,
          y0,
          y1,
          sky || district ? 0.025 : -1.2,
          sky || district ? [0.16, 0.17, 0.165] : black,
        );
        if (!district && !sky)
          for (let y = y0 + 0.18; y < y1 - 0.09; y += close ? 0.48 : 1.4) {
            const top = Math.min(y + 0.065, y1);
            panel(
              out,
              'metal',
              -W / 2 + 0.14,
              W / 2 - 0.14,
              y,
              top,
              0.16,
              silver.map((v) => v * 0.26),
            );
            if (close)
              face(
                out,
                'metal',
                [
                  [-W / 2 + 0.14, top, 0],
                  [W / 2 - 0.14, top, 0],
                  [W / 2 - 0.14, top, 0.16],
                  [-W / 2 + 0.14, top, 0.16],
                ],
                black,
              );
          }
      } else {
        if (!district) panel(out, 'metal', -W / 2, W / 2, y0, y1, 0, black);
        for (let i = 0; i < bays; i++) {
          const a = -W / 2 + (i * W) / bays,
            b = -W / 2 + ((i + 1) * W) / bays;
          panel(
            out,
            'glass',
            a,
            b,
            y0 + 0.83,
            y1 - 0.13,
            0.025,
            bronze.map((v, c) => {
              // Preserve the average dark-spandrel/glass balance when storeys merge.
              const coverage = (y1 - y0 - 0.96 * (last - floor + 1)) / (y1 - y0 - 0.96);
              return (
                black[c] + (v * (0.94 + ((i * 7 + floor * 11) % 13) * 0.006) - black[c]) * coverage
              );
            }),
          );
        }
      }
      floor = last + 1;
    }
    const piers = sky ? 2 : bays;
    for (let i = 0; i <= piers; i++) {
      const x = -W / 2 + (i * W) / piers,
        w = sky ? 0.8 : i % 2 === 0 ? 0.24 : 0.095;
      if (close) box(out, 'metal', [x - w / 2, lo, 0.015], [x + w / 2, hi, 0.21], black);
      else panel(out, 'metal', x - w / 2, x + w / 2, lo, hi, 0.215, black);
    }
  }
  function rooftop(out, x, z, h) {
    const o = frame(out, x, z);
    face(
      o,
      'metal',
      [
        [-W / 2, h, -W / 2],
        [-W / 2, h, W / 2],
        [W / 2, h, W / 2],
        [W / 2, h, -W / 2],
      ],
      [0.18, 0.19, 0.18],
    );
    if (sky) return;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const f = frame(o, (Math.sin(a) * W) / 2, (Math.cos(a) * W) / 2, a);
      if (close) box(f, 'metal', [-W / 2, h, -0.2], [W / 2, h + 0.6, 0.05], black);
      else panel(f, 'metal', -W / 2, W / 2, h, h + 0.6, 0.05, black);
    }
    for (const u of district ? [0] : [-5.8, 5.8]) {
      box(o, 'metal', [u - 2.3, h, -3.3], [u + 2.3, h + 1.5, 3.3], [0.24, 0.25, 0.24]);
      if (close)
        for (let z = -2.8; z < 3; z += 0.8)
          panel(frame(o, u, z, Math.PI / 2), 'metal', -2.1, 2.1, h + 1.51, h + 1.58, 0, silver);
    }
  }
  function antenna(out, x, z, tip) {
    box(out, 'metal', [x - 2, 442.1, z - 2], [x + 2, 446, z + 2], black);
    if (sky || district) {
      const r0 = 1.55,
        r1 = 0.62,
        n = 4;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / 2,
          b = ((i + 1) * Math.PI) / 2;
        face(
          out,
          'metal',
          [
            [x + Math.cos(a) * r0, 446, z + Math.sin(a) * r0],
            [x + Math.cos(b) * r0, 446, z + Math.sin(b) * r0],
            [x + Math.cos(b) * r1, 481, z + Math.sin(b) * r1],
            [x + Math.cos(a) * r1, 481, z + Math.sin(a) * r1],
          ],
          silver,
        );
      }
    } else {
      for (const [a, b] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ])
        tube(
          out,
          'metal',
          [x + a * 1.55, 446, z + b * 1.55],
          [x + a * 0.62, 481, z + b * 0.62],
          0.115,
          silver,
          close ? 6 : 4,
        );
      const step = close ? 2.5 : 5;
      for (let y = 446; y < 481; y += step) {
        const w = 1.55 - (0.93 * (y - 446)) / 35,
          w2 = 1.55 - (0.93 * Math.min(35, y + step - 446)) / 35;
        for (const s of [-1, 1]) {
          beam(
            out,
            'metal',
            [x - w, y, z + s * w],
            [x + w2, Math.min(481, y + step), z + s * w2],
            0.065,
            0.065,
            silver,
          );
          beam(
            out,
            'metal',
            [x + s * w, y, z - w],
            [x + s * w2, Math.min(481, y + step), z + w2],
            0.065,
            0.065,
            silver,
          );
        }
      }
    }
    tube(
      out,
      'metal',
      [x, 481, z],
      [x, tip - 3, z],
      0.53,
      [0.88, 0.89, 0.87],
      sky ? 4 : district ? 6 : close ? 16 : 8,
    );
    tube(
      out,
      'metal',
      [x, tip - 3, z],
      [x, tip, z],
      0.17,
      silver,
      sky ? 3 : district ? 4 : close ? 8 : 6,
    );
    if (close)
      for (let y = 482; y < tip - 4; y += 3.1)
        tube(out, 'metal', [x, y, z], [x, y + 0.1, z], 0.59, silver, 12);
  }
  function balcony(out, z) {
    const x = -1.5 * W - 1.31,
      y = 412.3944,
      a = z - 1.524,
      b = z + 1.524,
      X = -1.5 * W,
      c = [0.38, 0.52, 0.55];
    for (const ps of [
      [
        [x, y, a],
        [x, y, b],
        [x, y + 3.048, b],
        [x, y + 3.048, a],
      ],
      [
        [x, y + 3.048, a],
        [x, y + 3.048, b],
        [X, y + 3.048, b],
        [X, y + 3.048, a],
      ],
      [
        [X, y, a],
        [X, y, b],
        [x, y, b],
        [x, y, a],
      ],
    ])
      face(out, sky ? 'glass' : 'clear_glass', ps, c);
    if (sky) return;
    for (const zz of [a, b])
      face(
        out,
        'clear_glass',
        [
          [x, y, zz],
          [X, y, zz],
          [X, y + 3.048, zz],
          [x, y + 3.048, zz],
        ],
        c,
      );
    if (!district)
      for (const yy of [y, y + 3.048])
        for (const zz of [a, b])
          tube(out, 'metal', [x, yy, zz], [X + 0.4, yy, zz], 0.045, silver, close ? 6 : 4);
  }
  function podium(out) {
    for (const id of parts) {
      const e = evidence.elements.find((e) => e.id === id),
        h = Number(e.tags.height),
        plan = close ? mapPlan(id) : willisOutline(mapPlan(id), sky ? 1 : district ? 0.35 : 0.05);
      cap(
        out,
        plan,
        h,
        'concrete',
        e.tags['roof:colour'] === '#868456' ? [0.5, 0.53, 0.38] : concrete,
      );
      for (let i = 0; i < plan.length; i++) {
        const a = plan[i],
          b = plan[(i + 1) % plan.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          width = Math.hypot(dx, dz);
        if (width < 0.01) continue;
        const f = frame(out, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
        panel(f, 'metal', -width / 2, width / 2, 0, h, 0, black);
        const count = Math.max(
            1,
            Math.ceil(width / (close ? 1.8 : district ? 9 : sky ? 999 : 4.5)),
          ),
          floors = sky ? 1 : Math.max(1, Math.round(h / (district ? 10 : 5)));
        if (width > 0.5)
          for (let k = 0; k < floors; k++)
            for (let j = 0; j < count; j++) {
              const x0 = -width / 2 + (j * width) / count,
                x1 = x0 + width / count;
              panel(
                f,
                'glass',
                x0 + 0.08,
                x1 - 0.08,
                (k * h) / floors + 0.24,
                ((k + 1) * h) / floors - 0.14,
                0.025,
                [0.22, 0.32, 0.35],
              );
            }
        if (!sky) {
          panel(f, 'metal', -width / 2, width / 2, h - 0.22, h + 0.12, 0.06, black);
          for (let u = -width / 2 + 0.5; u < width / 2; u += close ? 1.5 : district ? 9 : 4.5)
            panel(f, 'metal', u, u + 0.045, h, h + 1.05, -0.13, black);
          panel(f, 'metal', -width / 2, width / 2, h + 1, h + 1.05, -0.12, black);
        }
      }
    }
    const nx = close ? 8 : district ? 3 : sky ? 2 : 4,
      nz = close ? 10 : district ? 4 : sky ? 2 : 6,
      point = (i, j) => {
        const u = -1 + (2 * i) / nx,
          v = -1 + (2 * j) / nz;
        return [0.3 + u * 11.43, 20.15 + 4.1 * (1 - u * u) * (1 - v * v), 48.6 + v * 12.954];
      };
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const p = [point(i, j), point(i, j + 1), point(i + 1, j + 1), point(i + 1, j)];
        face(out, 'glass', p, [0.36, 0.49, 0.53]);
        if (!sky) {
          if (close) {
            beam(out, 'metal', p[0], p[1], 0.055, 0.09, silver);
            beam(out, 'metal', p[0], p[3], 0.055, 0.09, silver);
          } else {
            for (const [a, b] of [
              [p[0], p[1]],
              [p[0], p[3]],
            ]) {
              const dx = b[0] - a[0],
                dz = b[2] - a[2],
                length = Math.hypot(dx, dz),
                u = [(-dz / length) * 0.03, 0, (dx / length) * 0.03],
                ps = [
                  a.map((v, k) => v - u[k] + (k === 1 ? 0.025 : 0)),
                  b.map((v, k) => v - u[k] + (k === 1 ? 0.025 : 0)),
                  b.map((v, k) => v + u[k] + (k === 1 ? 0.025 : 0)),
                  a.map((v, k) => v + u[k] + (k === 1 ? 0.025 : 0)),
                ];
              face(out, 'metal', ps, silver);
            }
          }
        }
      }
    if (!sky)
      for (const [x, z, w, d] of [
        [-15, 62, 7, 2.6],
        [20, 64, 10, 3],
        [-44, 42, 3, 9],
        [-8, 30, 7, 2.4],
      ]) {
        box(
          out,
          'concrete',
          [x - w / 2, 20, z - d / 2],
          [x + w / 2, 20.55, z + d / 2],
          [0.57, 0.59, 0.56],
        );
        box(
          out,
          'foliage',
          [x - w / 2 + 0.15, 20.55, z - d / 2 + 0.15],
          [x + w / 2 - 0.15, 20.75, z + d / 2 - 0.15],
          [0.24, 0.34, 0.2],
        );
        box(
          out,
          'wood',
          [x - w / 2, 20.57, z + d / 2 + 0.15],
          [x + w / 2, 20.65, z + d / 2 + 0.7],
          [0.48, 0.36, 0.24],
        );
        if (close)
          for (let u = -w / 2 + 0.45; u < w / 2; u += 1.2)
            fullSphere(
              out,
              'foliage',
              [x + u, 20.88, z],
              [0.4, 0.35, 0.6],
              [0.31, 0.39, 0.21],
              8,
              4,
            );
      }
    for (const id of canopies) {
      const p = close ? mapPlan(id) : willisOutline(mapPlan(id), sky ? 1 : district ? 0.35 : 0.05),
        h = id === 1178212981 ? 18 : 4.2;
      cap(out, p, h, 'metal', black);
      if (!sky && !district)
        for (let i = 0; i < p.length; i++) {
          const a = p[i],
            b = p[(i + 1) % p.length];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.01)
            beam(out, 'metal', [a[0], h, a[1]], [b[0], h, b[1]], 0.14, 0.2, black);
        }
    }
  }
  return (out) => {
    for (const [ix, iz, floors] of towers) {
      const x = ix * W,
        z = iz * W;
      for (const [dx, dz, a] of [
        [0, 1, 0],
        [1, 0, Math.PI / 2],
        [0, -1, Math.PI],
        [-1, 0, -Math.PI / 2],
      ]) {
        const neighbor = towers.find(([nx, nz]) => nx === ix + dx && nz === iz + dz),
          start = neighbor ? neighbor[2] : 0;
        if (start < floors)
          facade(frame(out, x + (dx * W) / 2, z + (dz * W) / 2, a), start, floors);
      }
      rooftop(out, x, z, level(floors));
    }
    for (const z of [-9.144, -4.572, 0, 4.572, 9.144]) balcony(out, z);
    antenna(out, -24.55, -0.1, 527.3);
    antenna(out, 2.25, 0, 527.3);
    for (const [x, z, h] of [
      [-W - 8, 5, 467],
      [-W + 7, -7, 460],
      [7, -5, 462],
      [8, 7, 453],
    ])
      tube(out, 'metal', [x, 442.1, z], [x, h, z], 0.12, silver, district ? 3 : close ? 8 : 4);
    podium(out);
  };
}
export const willisSkyline = components('skyline'),
  willisDistrict = components('district'),
  willisStreet = components('street'),
  willisCloseup = components('closeup');
