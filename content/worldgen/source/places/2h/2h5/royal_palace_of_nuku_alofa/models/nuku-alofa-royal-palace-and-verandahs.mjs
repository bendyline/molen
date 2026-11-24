import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  deck: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0.14 },
  footing: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54 },
};

const wall = rgb('d0d1c6');
const ivory = rgb('e3e0d2');
const paint = rgb('ae402e');
const redShade = rgb('973f30');
const glass = rgb('465056');
const foundation = rgb('a8b5b2');
const deck = rgb('9a9c8d');
const F = facade(site.frame.origin, site.frame.along);
const terrace = site.terrace;
const upper = 4.36;
const awning = 7.47;
const cornice = 8.7;

const P = (u, y, d) => F.P(u, y, -d);
const xz = ([x, , z]) => [x, z];
const plan = (points) => points.map(([u, d]) => xz(P(u, 0, d)));
const rect = (u, d, U, D) => [
  [u, d],
  [U, d],
  [U, D],
  [u, D],
];
const at = (f, u, y, d = 0) => f.P(u, y, d);

function block(out, slot, outline, y, Y, color, topSlot = slot, topColor = color) {
  extrude(out, slot, outline, y, Y, color, { top: false });
  cap(out, topSlot, outline, Y, topColor);
}

function box(out, slot, u, U, d, D, y, Y, color) {
  fbox(out, slot, F, u, U, y, Y, -D, -d, color);
}

function beams(out, f, a, b, width, back, front, color = ivory) {
  const [u, v] = a,
    [U, V] = b;
  const L = Math.hypot(U - u, V - v);
  const dx = (-(V - v) * width) / (2 * L),
    dy = ((U - u) * width) / (2 * L);
  const shape = [
    [u - dx, v - dy],
    [U - dx, V - dy],
    [U + dx, V + dy],
    [u + dx, v + dy],
  ];
  const face = (d) => shape.map(([x, y]) => at(f, x, y, d));
  const A = face(front),
    B = face(back);
  quad4(out, 'trim', ...A, color);
  quad4(out, 'trim', ...B.slice().reverse(), color);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(out, 'trim', B[i], B[j], A[j], A[i], color);
  }
}

function wallBody(out, detail) {
  const wallPlan = plan([
    [3.31, -28.96],
    [3.31, -3.45],
    [25.92, -3.45],
    [25.92, 3.92],
    [34.45, 3.92],
    [34.45, -2.99],
    [56.11, -2.99],
    [56.11, -28.87],
    [37.06, -28.87],
    [37.06, -19.94],
    [22.82, -19.94],
    [22.82, -28.96],
  ]);
  block(out, 'footing', wallPlan, site.groundBed, terrace + 0.04, foundation);
  block(out, 'siding', wallPlan, terrace + 0.03, cornice, wall, 'roof', redShade);
  if (detail === 0) return;
  const ring = outwardRing(wallPlan);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    if (f.length < 6.95) continue;
    const n = Math.max(2, Math.round(f.length / 4.65));
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * f.length) / n;
      const forward =
        f.normal[0] * site.frame.normal[0] + f.normal[1] * site.frame.normal[1] > 0.55;
      const doors = forward && i % 2 === j % 2;
      const opts = {
        glassSlot: 'glazing',
        glass,
        frameSlot: 'trim',
        frame: ivory,
        frameWidth: detail === 1 ? 0 : 0.095,
        frameDepth: 0.108,
        mullions: detail > 1 ? 1 : 0,
        transoms: detail > 1 ? 1 : 0,
        head: doors ? 'round' : 'flat',
        sill: false,
      };
      opening(
        out,
        f,
        u,
        doors ? terrace + 0.11 : terrace + 0.73,
        doors ? 1.36 : 1.11,
        doors ? 2.53 : 1.83,
        opts,
      );
      opening(out, f, u, upper + 0.55, 1.02, 1.71, opts);
      if (detail > 1) {
        fbox(out, 'trim', f, u - 0.65, u + 0.65, upper + 0.38, upper + 0.53, 0, 0.159, ivory);
        if (!doors)
          fbox(out, 'trim', f, u - 0.68, u + 0.68, terrace + 0.54, terrace + 0.7, 0, 0.15, ivory);
      }
    }
  }
}

function transverseRoof(out) {
  const w = 2.79,
    e = 56.72,
    s = -20.29,
    n = -2.72,
    ridge = -11.44;
  const Y = 12.8;
  quad4(out, 'roof', P(e, cornice, s), P(e, Y, ridge), P(w, Y, ridge), P(w, cornice, s), redShade);
  quad4(out, 'roof', P(w, cornice, n), P(w, Y, ridge), P(e, Y, ridge), P(e, cornice, n), paint);
  tri(out, 'siding', P(w, cornice, n), P(w, Y, ridge), P(w, cornice, s), wall);
  tri(out, 'siding', P(e, cornice, s), P(e, Y, ridge), P(e, cornice, n), wall);
}

function wingRoof(out, mid, half, front, back, Y, detail) {
  const left = mid - half,
    right = mid + half;
  quad4(
    out,
    'roof',
    P(left, cornice, back),
    P(mid, Y, back),
    P(mid, Y, front),
    P(left, cornice, front),
    redShade,
  );
  quad4(
    out,
    'roof',
    P(mid, Y, back),
    P(right, cornice, back),
    P(right, cornice, front),
    P(mid, Y, front),
    paint,
  );
  const f = wallFace(xz(P(right, 0, front)), xz(P(left, 0, front)));
  const g = wallFace(xz(P(left, 0, back)), xz(P(right, 0, back)));
  tri(out, 'siding', P(right, cornice, front), P(left, cornice, front), P(mid, Y, front), wall);
  tri(out, 'siding', P(left, cornice, back), P(right, cornice, back), P(mid, Y, back), wall);
  if (detail > 0) {
    for (const face of [f, g]) {
      beams(out, face, [0, cornice], [half, Y], 0.19, 0.006, 0.14);
      beams(out, face, [half, Y], [2 * half, cornice], 0.19, 0.006, 0.14);
    }
  }
}

function frontGable(out, mid, half, Y, detail) {
  const left = mid - half,
    right = mid + half;
  const front = -2.51,
    join = -11.45;
  const face = wallFace(xz(P(right, 0, front)), xz(P(left, 0, front)));
  tri(out, 'siding', P(right, cornice, front), P(left, cornice, front), P(mid, Y, front), wall);
  tri(out, 'roof', P(left, cornice, front), P(mid, 12.86, join), P(mid, Y, front), redShade);
  tri(out, 'roof', P(mid, Y, front), P(mid, 12.86, join), P(right, cornice, front), paint);
  if (detail === 0) return;
  beams(out, face, [0, cornice], [half, Y], 0.16, 0.03, 0.24);
  beams(out, face, [half, Y], [2 * half, cornice], 0.16, 0.03, 0.24);
  const apex = xz(P(mid, 0, front + 0.08));
  lathe(
    out,
    'trim',
    apex,
    [
      [Y - 0.04, 0.115, 0.115],
      [Y + 0.3, 0.105, 0.105],
      [Y + 0.96, 0, 0],
    ],
    detail > 1 ? 8 : 4,
    ivory,
  );
  if (detail > 1) {
    for (const s of [-1, 1]) {
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const u = half + s * half * t;
        const y = Y + (cornice - Y) * t;
        beams(out, face, [u - 0.08, y - 0.21], [u + 0.086, y - 0.025], 0.088, 0.145, 0.23);
      }
    }
  }
}

function tower(out, detail) {
  const {
    center: [u, d],
    eave,
    roof,
    flag,
  } = site.tower;
  const half = 4.16;
  const body = plan(rect(u - half, d - half, u + half, d + half));
  block(out, 'siding', body, upper - 0.1, eave, wall);
  box(
    out,
    'trim',
    u - half - 0.16,
    u + half + 0.16,
    d - half - 0.16,
    d + half + 0.16,
    eave - 0.27,
    eave - 0.05,
    ivory,
  );
  const height = roof - eave;
  const levels = [
    [eave - 0.03, 4.31],
    [eave + 0.18, 4.31],
    [eave + height * 0.32, 3.83],
    [eave + height * 0.67, 2.96],
    [eave + height * 0.92, 1.93],
    [roof, 1.29],
  ];
  for (let j = 0; j < levels.length - 1; j++) {
    const [y, r] = levels[j],
      [Y, R] = levels[j + 1];
    const a = rect(u - r, d - r, u + r, d + r).map(([x, z]) => P(x, y, z));
    const b = rect(u - R, d - R, u + R, d + R).map(([x, z]) => P(x, Y, z));
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      quad4(out, 'roof', a[i], a[k], b[k], b[i], i % 2 === 0 ? paint : redShade);
      if (detail > 1) {
        for (let j = 1; j < 8; j++) {
          const t = j / 8;
          const face = (A, B, s, h) => [A[0] + (B[0] - A[0]) * s, h, A[2] + (B[2] - A[2]) * s];
          const tf = 0.007;
          const normal = wallFace(xz(a[i]), xz(a[k])).normal;
          const edge = ([x, y, z]) => [x + normal[0] * 0.022, y, z + normal[1] * 0.022];
          quad4(
            out,
            'roof',
            edge(face(a[i], a[k], t - tf, y)),
            edge(face(a[i], a[k], t + tf, y)),
            edge(face(b[i], b[k], t + tf, Y)),
            edge(face(b[i], b[k], t - tf, Y)),
            redShade,
          );
        }
      }
    }
  }
  const top = plan(rect(u - 1.29, d - 1.29, u + 1.29, d + 1.29));
  cap(out, 'roof', top, roof, paint);
  if (detail > 0) {
    const ring = outwardRing(body);
    for (const [i, a] of ring.entries()) {
      const f = wallFace(a, ring[(i + 1) % ring.length]);
      for (const v of [-1.09, 1.09])
        opening(out, f, f.length * 0.5 + v, eave - 3.21, 0.83, 1.98, {
          head: 'round',
          glassSlot: 'glazing',
          glass,
          frameSlot: 'trim',
          frame: ivory,
          frameWidth: detail === 1 ? 0 : 0.085,
          frameDepth: 0.11,
          sill: false,
          transoms: 1,
        });
      if (detail > 1) {
        const rim = wallFace(top[(i + 1) % 4], top[i]);
        fbox(out, 'trim', rim, 0, rim.length, roof + 0.4, roof + 0.461, -0.045, 0.045, ivory);
        for (let j = 0; j < 6; j++) {
          const q = (j * rim.length) / 5;
          fbox(
            out,
            'trim',
            rim,
            q - 0.022,
            q + 0.022,
            roof - 0.05,
            roof + 0.461,
            -0.027,
            0.027,
            ivory,
          );
        }
      }
    }
  }
  const center = xz(P(u, roof, d));
  lathe(
    out,
    'trim',
    center,
    [
      [roof - 0.03, 0.055, 0.055],
      [flag, 0.031, 0.031],
    ],
    detail > 1 ? 8 : 4,
    ivory,
  );
}

function balcony(out, f, W, detail, crossBraced) {
  const count = Math.max(1, Math.round(W / 4.32));
  const spacing = W / count;
  if (detail === 0) {
    fbox(out, 'trim', f, 0, W, upper + 0.19, upper + 0.97, -0.15, -0.05, ivory);
    for (let i = 0; i <= count; i += 2) {
      const u = i * spacing;
      fbox(
        out,
        'trim',
        f,
        u - 0.102,
        u + 0.102,
        site.groundBed,
        awning - 0.09,
        -0.23,
        -0.05,
        ivory,
      );
    }
    return;
  }
  for (let i = 0; i <= count; i++) {
    const u = i * spacing;
    fbox(out, 'trim', f, u - 0.087, u + 0.087, site.groundBed, awning - 0.1, -0.32, -0.146, ivory);
    if (detail > 1) {
      fbox(out, 'trim', f, u - 0.126, u + 0.126, terrace, terrace + 0.195, -0.357, -0.108, ivory);
      for (const side of i === 0 ? [1] : i === count ? [-1] : [-1, 1]) {
        beams(out, f, [u, upper - 0.66], [u + side * 0.68, upper - 0.06], 0.082, -0.294, -0.163);
        beams(out, f, [u, awning - 0.65], [u + side * 0.57, awning - 0.13], 0.069, -0.29, -0.153);
      }
    }
  }
  for (const y of [upper + 0.14, upper + 0.93]) {
    fbox(out, 'trim', f, 0, W, y, y + 0.091, -0.28, -0.079, ivory);
  }
  if (detail === 1) {
    for (let i = 0; i < count; i++) {
      const mid = (i + 0.5) * spacing;
      fbox(
        out,
        'trim',
        f,
        mid - 0.056,
        mid + 0.056,
        upper + 0.17,
        upper + 0.96,
        -0.24,
        -0.133,
        ivory,
      );
    }
    return;
  }
  for (let j = 0; j < count; j++) {
    const u = j * spacing;
    const slots = Math.round(spacing / (detail === 3 ? 0.213 : 0.36));
    for (let k = 1; k < slots; k++) {
      const a = u + (spacing * k) / slots;
      if (detail === 3) {
        beams(out, f, [a - 0.039, upper + 0.24], [a + 0.038, upper + 0.66], 0.043, -0.249, -0.126);
        beams(out, f, [a + 0.038, upper + 0.66], [a - 0.036, upper + 0.945], 0.045, -0.25, -0.128);
      } else
        fbox(
          out,
          'trim',
          f,
          a - 0.029,
          a + 0.029,
          upper + 0.22,
          upper + 0.95,
          -0.24,
          -0.126,
          ivory,
        );
    }
    for (let k = 1; k < 8; k++) {
      const a = u + (spacing * k) / 8;
      beams(out, f, [a - 0.117, awning - 0.135], [a + 0.117, awning - 0.135], 0.115, -0.11, 0.024);
    }
    if (crossBraced) {
      const a = u + 0.24,
        b = u + spacing - 0.24;
      beams(out, f, [a, terrace + 0.16], [b, upper - 0.22], 0.106, -0.41, -0.31);
      beams(out, f, [a, upper - 0.22], [b, terrace + 0.16], 0.106, -0.409, -0.3);
    }
  }
}

function verandah(out, detail) {
  const strips = [
    {
      outline: [
        [0.03, 0.0],
        [25.84, 0.007],
        [25.85, -3.6],
        [3.43, -3.6],
      ],
      wide: true,
    },
    {
      outline: [
        [34.78, 0.614],
        [59.43, 0.627],
        [56.01, -3.13],
        [34.78, -3.15],
      ],
      wide: true,
    },
    {
      outline: [
        [25.88, 7.14],
        [34.74, 7.14],
        [34.74, 3.83],
        [25.89, 3.83],
      ],
      cross: true,
    },
    {
      outline: [
        [25.87, 0.015],
        [25.88, 7.13],
        [26.17, 6.94],
        [26.16, -0.02],
      ],
      side: true,
    },
    {
      outline: [
        [34.74, 7.13],
        [34.75, 0.63],
        [34.48, 0.5],
        [34.47, 6.94],
      ],
      side: true,
    },
    {
      outline: [
        [59.43, 0.62],
        [59.47, -30.92],
        [55.94, -29.07],
        [55.94, -3.09],
      ],
    },
    {
      outline: [
        [0.03, -31.22],
        [0.03, 0],
        [3.46, -3.56],
        [3.46, -29.05],
      ],
    },
  ];
  for (const { outline, cross, side } of strips) {
    const ring = plan(outline);
    const f = wallFace(ring[1], ring[0]);
    block(out, 'footing', ring, terrace - 0.31, terrace - 0.094, foundation);
    block(out, 'deck', ring, terrace - 0.105, terrace + 0.01, deck);
    block(out, 'trim', ring, upper - 0.24, upper - 0.04, ivory, 'deck', deck);
    if (!side) {
      quad4(
        out,
        'roof',
        P(outline[3][0], awning + 0.78, outline[3][1]),
        P(outline[2][0], awning + 0.78, outline[2][1]),
        P(outline[1][0], awning, outline[1][1]),
        P(outline[0][0], awning, outline[0][1]),
        paint,
      );
    } else cap(out, 'roof', ring, awning + 0.012, paint);
    fbox(out, 'trim', f, 0, f.length, awning - 0.19, awning - 0.01, -0.155, 0.031, ivory);
    balcony(out, f, f.length, detail, cross);
  }
  const n = detail === 0 ? 2 : 5;
  for (let i = 0; i < n; i++) {
    const q = i / n;
    box(
      out,
      'footing',
      27.14,
      33.49,
      7.09 + q * 2.41,
      7.09 + ((i + 1) * 2.41) / n,
      -1.78,
      terrace - q * 2.26,
      foundation,
    );
  }
}

function build(out, detail) {
  wallBody(out, detail);
  transverseRoof(out);
  wingRoof(out, 12.7, 10.14, -11.56, -29.59, 12.56, detail);
  wingRoof(out, 46.81, 10.12, -11.56, -29.52, 12.51, detail);
  for (const [u, half, y] of [
    [11.47, 4.86, 12.62],
    [39.37, 4.52, 12.67],
    [50.47, 4.87, 12.82],
  ]) {
    frontGable(out, u, half, y, detail);
  }
  verandah(out, detail);
  tower(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
