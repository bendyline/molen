/** rembrandt_tower complete browser exteriors. Original detailed source is preserved. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  torus as sourceTorus,
} from './authored-structure-mesh.mjs';
import { box, quad, tube as sourceTube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const heights = JSON.parse(
    readFileSync(structureSourcePath('rembrandt_tower', 'roof-envelope.json')),
  ),
  means = {
    cladding: [0.701109, 0.701109, 0.701109],
    metal: [0.908889, 0.908889, 0.908889],
    concrete: [0.710816, 0.710816, 0.681928],
    stainless: [0.81896, 0.822889, 0.822889],
    stone: [0.701109, 0.701109, 0.701109],
  };
function detail(out, mode) {
  const beaconSegments = mode === 'closeup' ? 24 : mode === 'street' ? 12 : 8,
    doorSegments = mode === 'closeup' ? 24 : mode === 'street' ? 12 : 6,
    cornerBays = mode === 'closeup' ? 12 : mode === 'street' ? 6 : 1;
  const tube = (o, s, a, b, r, c, n) =>
    sourceTube(o, s, a, b, r, c, Math.min(n, mode === 'closeup' ? 8 : mode === 'street' ? 6 : 4));
  const torus = (o, s, p, r, w, c, n, _m) =>
    sourceTorus(
      o,
      s,
      p,
      r,
      w,
      c,
      Math.min(n, mode === 'closeup' ? 24 : mode === 'street' ? 12 : 6),
      4,
    );
  const roofHeight = (surface) => {
    const range = heights.roofs.find((r) => r.surface === surface).heightsAboveGround;
    return (range[0] + range[1]) / 2;
  };
  const baseRoof = roofHeight(484),
    middleRoof = roofHeight(494),
    terrace = roofHeight(479),
    colonnade = roofHeight(493),
    cornerRoof = roofHeight(474),
    capRoof = roofHeight(492);
  const shift = [0.36, 0.1]; // Center of the reconstructed upper cap in the retained ground frame.
  const granite = [0.64, 0.62, 0.56],
    metal = [0.135, 0.155, 0.16],
    silver = [0.63, 0.67, 0.67],
    dark = [0.065, 0.08, 0.085],
    glass = [0.225, 0.345, 0.41];
  const seed = (i) => {
    let h = Math.imul(i + 719, 374761393);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const tint = (color, i, amount = 0.025) => color.map((c) => c + (seed(i) - 0.5) * amount);
  function face(o, slot, points, color) {
    quad(o, slot, points, normalFor(...points), color);
  }
  function oriented(out, angle = 0, offset = shift) {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const rotate = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
    const point = (p) => {
      const v = rotate(p);
      return [v[0] + offset[0], v[1], v[2] + offset[1]];
    };
    return {
      addQuad: (slot, ref, points, n, uv, color) =>
        out.addQuad(slot, ref, points.map(point), rotate(n), uv, color),
      addTriangle: (slot, ref, points, n, uv, color) =>
        out.addTriangle(slot, ref, points.map(point), rotate(n), uv, color),
      addConvexPolygon: (slot, ref, points, n, uv, color) =>
        out.addConvexPolygon(slot, ref, points.map(point), rotate(n), uv, color),
    };
  }

  /** Granite slabs have real joints, edge returns and a 12 mm bevel. No facade atlas. */
  function slab(o, x0, x1, y0, y1, z, color = granite, thickness = 0.16) {
    if (x1 <= x0 || y1 <= y0) return;
    if (mode === 'closeup') box(o, 'cladding', [x0, y0, z - thickness], [x1, y1, z], color);
    else
      face(
        o,
        'cladding',
        [
          [x0, y0, z],
          [x1, y0, z],
          [x1, y1, z],
          [x0, y1, z],
        ],
        color,
      );
  }
  function planar(o, x0, x1, y0, y1, z, c) {
    face(
      o,
      'glass',
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      c,
    );
  }
  function glazed(o, x0, x1, y0, y1, z, serial, { clear = false } = {}) {
    face(
      o,
      clear ? 'clear_glass' : 'glass',
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      clear ? [0.75, 0.83, 0.84] : tint(glass, serial, 0.04),
    );
    if (mode === 'skyline' || mode === 'district') return;
    for (const x of [x0, x1])
      face(
        o,
        'metal',
        [
          [x - 0.026, y0, z + 0.045],
          [x + 0.026, y0, z + 0.045],
          [x + 0.026, y1, z + 0.045],
          [x - 0.026, y1, z + 0.045],
        ],
        metal,
      );
    for (const y of [y0, y1])
      face(
        o,
        'metal',
        [
          [x0, y - 0.032, z + 0.045],
          [x1, y - 0.032, z + 0.045],
          [x1, y + 0.032, z + 0.045],
          [x0, y + 0.032, z + 0.045],
        ],
        metal,
      );
  }

  function graniteFacade(o, width, depth, levels, serial = 0, { lobby = false } = {}) {
    const bays = Math.round(width / 1.8),
      pitch = width / bays,
      y0 = levels[0],
      y1 = levels.at(-1);
    face(
      o,
      'glass',
      [
        [-width / 2, y0, depth - 0.115],
        [width / 2, y0, depth - 0.115],
        [width / 2, y1, depth - 0.115],
        [-width / 2, y1, depth - 0.115],
      ],
      glass,
    );
    if (mode === 'skyline') {
      for (let i = 0; i <= bays; i += 2) {
        const x = -width / 2 + i * pitch;
        slab(o, x - 0.27, x + 0.27, y0, y1, depth, granite);
      }
      for (let i = 0; i < levels.length; i += 3)
        slab(o, -width / 2, width / 2, levels[i], Math.min(y1, levels[i] + 0.45), depth, granite);
      return;
    }
    for (let i = 0; i <= bays; i++) {
      const x = -width / 2 + i * pitch;
      slab(o, x - 0.3, x + 0.3, y0, y1, depth, granite, 0.24);
    }
    for (let i = 0; i < levels.length; i++)
      slab(
        o,
        -width / 2,
        width / 2,
        Math.max(y0, levels[i] - 0.33),
        Math.min(y1, levels[i] + 0.29),
        depth,
        granite,
        0.24,
      );
    if (mode !== 'closeup') return;
    for (let row = 0; row < levels.length - 1; row++)
      for (let bay = 0; bay < bays; bay++) {
        const x = -width / 2 + bay * pitch,
          a = x + 0.3,
          b = x + pitch - 0.3,
          lo = levels[row] + 0.29,
          hi = levels[row + 1] - 0.33,
          id = serial + row * 71 + bay;
        const openLobby = lobby && Math.abs(x + pitch / 2) < 7.3 && row < 3;
        glazed(o, a, b, lo, hi, depth - 0.112, id);
        if (!openLobby)
          planar(
            o,
            a,
            b,
            lo,
            lo + Math.min(0.68, (hi - lo) * 0.2),
            depth - 0.106,
            tint([0.11, 0.15, 0.17], id),
            0.012,
          );
      }
  }
  function roofCross(o, radius, halfArm, y, thickness = 0.26) {
    box(
      o,
      'concrete',
      [-radius, y - thickness, -halfArm],
      [radius, y, halfArm],
      [0.27, 0.29, 0.28],
    );
    box(
      o,
      'concrete',
      [-halfArm, y - thickness, -radius],
      [halfArm, y, -halfArm],
      [0.27, 0.29, 0.28],
    );
    box(
      o,
      'concrete',
      [-halfArm, y - thickness, halfArm],
      [halfArm, y, radius],
      [0.27, 0.29, 0.28],
    );
  }
  function body(out) {
    const low = [0, 5.1, 10.2, 15.3, 18.7, baseRoof],
      mid = Array.from({ length: 5 }, (_, i) => baseRoof + ((middleRoof - baseRoof) * i) / 4),
      shaft = Array.from({ length: 21 }, (_, i) => middleRoof + ((terrace - middleRoof) * i) / 20);
    for (let side = 0; side < 4; side++) {
      const o = oriented(out, (side * Math.PI) / 2);
      graniteFacade(o, 25.8, 24, low, side * 9000, { lobby: side === 0 });
      graniteFacade(o, 25.2, 19.35, mid, side * 9000 + 1000);
      graniteFacade(o, 25.2, 16.2, shaft, side * 9000 + 2000);
      // Exposed side walls of the two stepped podium arms.
      for (const sign of [-1, 1]) {
        const a = oriented(o, (sign * Math.PI) / 2, [sign * 12.9, 18.45]);
        graniteFacade(a, 11.1, 0, low, side * 800 + sign + 4000);
        const b = oriented(o, (sign * Math.PI) / 2, [sign * 12.6, 15.975]);
        graniteFacade(b, 6.75, 0, mid, side * 800 + sign + 5000);
      }
      // Two narrow recessed glass planes meet in each shaft corner.
      const glassCorner = oriented(o, 0, [14.4, 14.4]);
      for (let a = 0; a < 2; a++) {
        const r = oriented(glassCorner, (a * Math.PI) / 2, [0, 0]);
        const fullLevels = [...low, ...mid.slice(1), ...shaft.slice(1)];
        for (let row = 0; row < fullLevels.length - 1; row++)
          for (let col = 0; col < 2; col++) {
            const x0 = (a === 0 ? -1.8 : 0) + col * 0.9;
            glazed(
              r,
              x0,
              x0 + 10.8 / cornerBays,
              fullLevels[row] + 0.045,
              fullLevels[row + 1] - 0.045,
              0,
              side * 100 + row + col,
            );
          }
      }
      // Short stone returns make the inset glazing read as a deep corner reveal.
      for (const sign of [-1, 1]) {
        const ro = oriented(o, (sign * Math.PI) / 2, [sign * 12.6, 15.3]);
        for (let i = 0; i < shaft.length - 1; i++)
          slab(
            ro,
            -0.9,
            0.9,
            shaft[i] + 0.012,
            shaft[i + 1] - 0.012,
            0,
            tint(granite, i + side * 82),
          );
      }
    }
    const centered = oriented(out);
    roofCross(centered, 24, 12.9, baseRoof);
    roofCross(centered, 19.35, 12.6, middleRoof);
    roofCross(centered, 16.2, 12.6, terrace);
    // Two low north-side roofs are independently visible in the retained 3DBAG envelope.
    for (const sign of [-1, 1]) {
      const x0 = sign > 0 ? 12.9 : -24,
        x1 = sign > 0 ? 24 : -12.9;
      box(centered, 'concrete', [x0, 3.1, -24], [x1, 3.43, -12.9], [0.31, 0.32, 0.3]);
      for (const x of [x0 + 0.3, x1 - 0.3])
        box(centered, 'cladding', [x - 0.22, 0, -23.5], [x + 0.22, 3.1, -23.05], granite);
    }
  }
  function rail(o, x0, x1, y, z) {
    for (const dy of mode === 'closeup' ? [0.18, 0.65, 1.02] : [1.02])
      tube(o, 'metal', [x0, y + dy, z], [x1, y + dy, z], 0.018, metal, 8);
    const count = mode === 'skyline' ? 1 : mode === 'district' ? 2 : Math.ceil((x1 - x0) / 1.8);
    for (let i = 0; i <= count; i++) {
      const x = x0 + ((x1 - x0) * i) / count;
      tube(o, 'metal', [x, y, z], [x, y + 1.03, z], 0.021, metal, 8);
    }
  }
  function crown(out) {
    const level = [
      colonnade,
      (2 * colonnade + cornerRoof) / 3,
      (colonnade + 2 * cornerRoof) / 3,
      cornerRoof,
    ];
    for (let side = 0; side < 4; side++) {
      const o = oriented(out, (side * Math.PI) / 2);
      for (let i = 0; i <= 7; i++) {
        const x = -12.6 + i * 3.6;
        box(o, 'cladding', [x - 0.24, terrace, 15.69], [x + 0.24, colonnade, 16.24], granite);
        beam(o, 'metal', [x, terrace + 0.15, 15.45], [x, colonnade - 0.2, 11.9], 0.15, 0.24, metal);
      }
      for (const y of [terrace + 0.1, colonnade - 0.2])
        slab(o, -12.85, 12.85, y - 0.18, y + 0.18, 16.26, granite);
      rail(o, -12.55, 12.55, terrace + 0.15, 15.58);
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const center = [shift[0] + sx * 10.8, shift[1] + sz * 10.8];
        box(
          oriented(out, 0, center),
          'concrete',
          [-5.4, colonnade - 0.24, -5.4],
          [5.4, colonnade, 5.4],
          [0.31, 0.32, 0.3],
        );
        for (let side = 0; side < 4; side++) {
          const o = oriented(out, (side * Math.PI) / 2, center);
          for (let row = 0; row < 3; row++)
            for (let col = 0; col < cornerBays; col++) {
              const x0 = -5.4 + col * (10.8 / cornerBays);
              const y0 = level[row],
                y1 = level[row + 1];
              glazed(
                o,
                x0 + 0.022,
                x0 + 10.8 / cornerBays - 0.022,
                y0 + 0.16,
                y1 - 0.16,
                5.36,
                row * 121 + col + side * 90,
              );
              face(
                o,
                'metal',
                [
                  [x0, y0 - 0.13, 5.46],
                  [x0 + 10.8 / cornerBays, y0 - 0.13, 5.46],
                  [x0 + 10.8 / cornerBays, y0 + 0.16, 5.46],
                  [x0, y0 + 0.16, 5.46],
                ],
                silver,
              );
            }
          box(
            o,
            'metal',
            [-5.48, cornerRoof - 0.17, 5.28],
            [5.48, cornerRoof + 0.18, 5.49],
            silver,
          );
        }
        box(
          oriented(out, 0, center),
          'metal',
          [-5.4, cornerRoof - 0.14, -5.4],
          [5.4, cornerRoof, 5.4],
          [0.26, 0.28, 0.27],
        );
      }
    // Six 1.8 m windows across each cross-shaped cap arm; the inset returns continue the grid.
    const upper = [
      terrace,
      colonnade,
      ...level.slice(1),
      cornerRoof + 3.4,
      cornerRoof + 6.8,
      capRoof,
    ];
    for (let side = 0; side < 4; side++) {
      const o = oriented(out, (side * Math.PI) / 2);
      graniteFacade(o, 10.8, 10.8, upper, side * 811 + 90000);
      for (const sign of [-1, 1]) {
        const r = oriented(o, (sign * Math.PI) / 2, [sign * 5.4, 8.1]);
        graniteFacade(r, 5.4, 0, upper, 92000 + side * 900 + sign);
      }
      // Three large recessed louver panels in the raised mechanical parapet.
      for (const sign of [-1, 1]) {
        const returnFace = oriented(o, (sign * Math.PI) / 2, [sign * 5.4, 9.63]);
        slab(returnFace, -1.23, 1.23, capRoof, 135, 0, granite);
      }
      box(o, 'cladding', [-5.4, 134.78, 8.4], [5.4, 135, 10.86], granite);
      box(o, 'cladding', [-5.4, capRoof, 8.32], [5.4, 134.78, 8.5], granite);
      for (let bay = 0; bay < 3; bay++) {
        const x0 = -5.4 + bay * 3.6,
          x1 = x0 + 3.6;
        slab(o, x0 + 0.01, x0 + 0.3, capRoof, 135, 10.86);
        slab(o, x1 - 0.3, x1 - 0.01, capRoof, 135, 10.86);
        slab(o, x0 + 0.3, x1 - 0.3, 134.72, 135, 10.86);
        box(o, 'recess', [x0 + 0.3, capRoof + 0.1, 10.6], [x1 - 0.3, 134.73, 10.65], dark);
        for (
          let y = capRoof + 0.23;
          y < 134.68;
          y += mode === 'closeup' ? 0.21 : mode === 'street' ? 0.45 : 2
        )
          box(o, 'metal', [x0 + 0.31, y, 10.66], [x1 - 0.31, y + 0.04, 10.78], metal);
      }
    }
    roofCross(oriented(out), 10.8, 5.4, capRoof, 0.25);
    beacon(oriented(out));
  }
  function beacon(o) {
    const shape = [
      [capRoof, 1.2],
      [135.2, 1.2],
      [137.4, 1.22],
      [138.3, 0.8],
      [148.3, 0.56],
      [149.1, 0.16],
      [150, 0.035],
    ];
    loft(
      o,
      'metal',
      shape.map(([y, r]) => radialRing(y, r, r, beaconSegments)),
      silver,
    );
    for (const y of [136.05, 136.95, 137.85])
      loft(
        o,
        'metal',
        [
          [y - 0.075, 1.72],
          [y + 0.075, 1.72],
        ].map(([h, r]) => radialRing(h, r, r, beaconSegments)),
        [0.78, 0.8, 0.77],
      );
    for (let i = 0; mode === 'closeup' && i < 12; i++) {
      const a = (i * Math.PI) / 6;
      tube(
        o,
        'metal',
        [0.83 * Math.cos(a), 139, 0.83 * Math.sin(a)],
        [0.62 * Math.cos(a), 148.25, 0.62 * Math.sin(a)],
        0.022,
        metal,
        6,
      );
    }
    for (let i = 0; mode === 'closeup' && i < 8; i++) {
      const t = i / 7;
      torus(o, 'metal', [0, 139 + t * 9.2, 0], 0.83 - t * 0.21, 0.026, silver, 12, 4);
    }
    // Parked maintenance cradle and horizontal jib: proportions follow the published crown image.
    box(o, 'metal', [3.7, capRoof, -2.8], [5, 136, -1.5], silver);
    box(o, 'metal', [4.1, 135.6, -2.65], [14.3, 136.35, -1.65], [0.76, 0.78, 0.74]);
    for (let x = 4.3; x < 14.3; x += 1.2)
      beam(
        o,
        'metal',
        [x, 135.65, -2.67],
        [Math.min(x + 1.1, 14.3), 136.32, -2.67],
        0.08,
        0.075,
        metal,
      );
    box(o, 'metal', [13.2, 136.1, -3.05], [16, 136.35, -1.2], silver);
    for (const z of [-3.05, -1.2]) rail(o, 13.2, 16, 136.35, z);
  }
  function entrance(out) {
    const baseOut = oriented(out),
      o = {
        addQuad(s, r, p, n, u, c) {
          baseOut.addQuad(
            s,
            r,
            p.map(([x, y, z]) => [x, y + 0.45, z]),
            n,
            u,
            c,
          );
        },
        addTriangle(s, r, p, n, u, c) {
          baseOut.addTriangle(
            s,
            r,
            p.map(([x, y, z]) => [x, y + 0.45, z]),
            n,
            u,
            c,
          );
        },
        addConvexPolygon(s, r, p, n, u, c) {
          baseOut.addConvexPolygon(
            s,
            r,
            p.map(([x, y, z]) => [x, y + 0.45, z]),
            n,
            u,
            c,
          );
        },
      };
    // Individual revolving doors remain visibly cylindrical and retain transparent local PBR.
    for (const x of [-3.6, 0, 3.6]) {
      const z = 24.05,
        r = 1.4;
      for (let i = 0; i < doorSegments; i++) {
        const a = (i * Math.PI * 2) / doorSegments,
          b = ((i + 1) * Math.PI * 2) / doorSegments;
        if (
          mode !== 'skyline' &&
          mode !== 'district' &&
          i >= doorSegments * 0.15625 &&
          i <= doorSegments * 0.328125
        )
          continue;
        const p = [
          [x + r * Math.cos(a), 0.07, z + r * Math.sin(a)],
          [x + r * Math.cos(b), 0.07, z + r * Math.sin(b)],
          [x + r * Math.cos(b), 3.05, z + r * Math.sin(b)],
          [x + r * Math.cos(a), 3.05, z + r * Math.sin(a)],
        ];
        face(o, 'clear_glass', p.toReversed(), [0.75, 0.83, 0.84]);
      }
      for (const y of [0.08, 3.04])
        torus(o, 'stainless', [x, y, z], r, 0.045, silver, doorSegments, 4);
      tube(o, 'metal', [x, 0, z], [x, 3.16, z], 0.06, metal, 12);
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3;
        const end = [x + r * Math.cos(a), 0, z + r * Math.sin(a)];
        face(
          o,
          'clear_glass',
          [
            [x, 0.08, z],
            [end[0], 0.08, end[2]],
            [end[0], 3, end[2]],
            [x, 3, z],
          ],
          [0.75, 0.83, 0.84],
        );
        tube(o, 'stainless', [end[0], 0.08, end[2]], [end[0], 3, end[2]], 0.025, silver, 8);
      }
      loft(
        o,
        'metal',
        [radialRing(3.05, r, r, doorSegments, [x, z]), radialRing(3.4, r, r, doorSegments, [x, z])],
        silver,
      );
    }
    const canopyOut = oriented(out);
    // November2020 Amstelplein panorama: glazed steel canopy with five substantial columns.
    for (const z of [23.5, 29.4])
      box(canopyOut, 'metal', [-7.3, 5.08, z - 0.1], [7.3, 5.36, z + 0.1], metal);
    for (const x of [-7.3, 7.3])
      box(canopyOut, 'metal', [x - 0.1, 5.08, 23.5], [x + 0.1, 5.36, 29.4], metal);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        const x = -7.2 + i * 3.6,
          z = 23.6 + j * 1.9;
        face(
          canopyOut,
          'clear_glass',
          [
            [x, 5.27, z],
            [x, 5.27, z + 1.85],
            [x + 3.55, 5.27, z + 1.85],
            [x + 3.55, 5.27, z],
          ],
          [0.72, 0.8, 0.81],
        );
      }
    for (const z of [25.5, 27.4])
      box(canopyOut, 'metal', [-7.2, 5.09, z - 0.07], [7.2, 5.25, z + 0.07], metal);
    for (const x of [-7.1, -3.6, 0, 3.6, 7.1]) {
      beam(canopyOut, 'metal', [x, 4.96, 23.8], [x, 4.96, 29.25], 0.09, 0.16, metal);
      tube(canopyOut, 'metal', [x, 0, 28.9], [x, 5.08, 28.9], 0.23, [0.48, 0.5, 0.46], 24);
      loft(
        canopyOut,
        'metal',
        [radialRing(0, 0.34, 0.34, 24, [x, 28.9]), radialRing(0.16, 0.34, 0.34, 24, [x, 28.9])],
        silver,
      );
    }
    for (const x of [-9.4, 9.4])
      box(canopyOut, 'cladding', [x - 0.25, 0, 24.05], [x + 0.25, 5.1, 24.65], granite);
    for (const sx of [-1, 1])
      for (let k = 0; k < 4; k++) {
        const x = sx * (14.6 + k * 1.05);
        box(
          canopyOut,
          'stone',
          [Math.min(x, x + sx * 0.98), 0, 13.1],
          [Math.max(x, x + sx * 0.98), 0.12 + k * 0.045, 18.7 - k * 1.15],
          [0.4, 0.42, 0.4],
        );
      }
    box(canopyOut, 'stone', [-7.3, 0, 23.5], [7.3, 0.45, 25.65], [0.4, 0.42, 0.4]);
    for (let i = 0; i < 3; i++)
      box(
        canopyOut,
        'stone',
        [-5.2, 0, 25.65 + i * 0.32],
        [5.2, 0.45 - i * 0.15, 25.97 + i * 0.32],
        [0.4, 0.42, 0.4],
      );
  }

  body(out);
  crown(out);
  entrance(out);
}
export function buildRembrandtStreet(o) {
  detail(o, 'street');
}
export function buildRembrandtCloseup(o) {
  detail(o, 'closeup');
}
function farModel(out, mode) {
  const skyline = mode === 'skyline',
    granite = [0.64, 0.62, 0.56],
    glass = [0.225, 0.345, 0.41],
    metal = [0.135, 0.155, 0.16],
    silver = [0.63, 0.67, 0.67];
  const shift = [0.36, 0.1],
    roof = (id) => {
      const a = heights.roofs.find((r) => r.surface === id).heightsAboveGround;
      return (a[0] + a[1]) / 2;
    },
    base = roof(484),
    mid = roof(494),
    terrace = roof(479),
    gallery = roof(493),
    corners = roof(474),
    cap = roof(492);
  function oriented(out, angle = 0, offset = shift) {
    const c = Math.cos(angle),
      s = Math.sin(angle),
      rot = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z],
      pt = (p) => {
        const v = rot(p);
        return [v[0] + offset[0], v[1], v[2] + offset[1]];
      };
    return {
      addQuad(s, r, p, n, u, col) {
        out.addQuad(s, r, p.map(pt), rot(n), u, col);
      },
      addTriangle(s, r, p, n, u, col) {
        out.addTriangle(s, r, p.map(pt), rot(n), u, col);
      },
      addConvexPolygon(s, r, p, n, u, col) {
        out.addConvexPolygon(s, r, p.map(pt), rot(n), u, col);
      },
    };
  }
  function face(o, slot, p, col) {
    quad(o, slot, p, normalFor(...p), col);
  }
  function plane(o, slot, a, b, lo, hi, z, c) {
    face(
      o,
      slot,
      [
        [a, lo, z],
        [b, lo, z],
        [b, hi, z],
        [a, hi, z],
      ],
      c,
    );
  }
  function grid(o, w, z, lo, hi, floors, bays) {
    if (skyline && w < 12) {
      plane(
        o,
        'cladding',
        -w / 2,
        w / 2,
        lo,
        hi,
        z,
        granite.map((v, i) => v * 0.65 + glass[i] * 0.35),
      );
      return;
    }
    plane(o, 'glass', -w / 2, w / 2, lo, hi, z - 0.12, glass);
    const step = skyline ? 2 : 1;
    for (let i = 0; i <= bays; i += step) {
      const x = -w / 2 + (i * w) / bays;
      plane(
        o,
        'cladding',
        Math.max(-w / 2, x - 0.28),
        Math.min(w / 2, x + 0.28),
        lo,
        hi,
        z,
        granite,
      );
    }
    for (let i = 0; i <= floors; i += skyline ? 3 : 1) {
      const y = lo + ((hi - lo) * i) / floors;
      plane(
        o,
        'cladding',
        -w / 2,
        w / 2,
        Math.max(lo, y - 0.31),
        Math.min(hi, y + 0.29),
        z,
        granite,
      );
    }
  }
  function crossRoof(o, r, arm, y) {
    if (skyline) {
      for (const [a, b, c, d] of [
        [-r, -arm, r, arm],
        [-arm, -r, arm, -arm],
        [-arm, arm, arm, r],
      ])
        face(
          o,
          'concrete',
          [
            [a, y, b],
            [a, y, d],
            [c, y, d],
            [c, y, b],
          ],
          [0.27, 0.29, 0.28],
        );
      return;
    }
    box(o, 'concrete', [-r, y - 0.24, -arm], [r, y, arm], [0.27, 0.29, 0.28]);
    box(o, 'concrete', [-arm, y - 0.24, -r], [arm, y, -arm], [0.27, 0.29, 0.28]);
    box(o, 'concrete', [-arm, y - 0.24, arm], [arm, y, r], [0.27, 0.29, 0.28]);
  }
  const centered = oriented(out);
  for (let side = 0; side < 4; side++) {
    const o = oriented(out, (side * Math.PI) / 2);
    grid(o, 25.8, 24, 0, base, 5, 14);
    grid(o, 25.2, 19.35, base, mid, 4, 14);
    grid(o, 25.2, 16.2, mid, terrace, 20, 14);
    for (const sign of [-1, 1]) {
      grid(oriented(o, (sign * Math.PI) / 2, [sign * 12.9, 18.45]), 11.1, 0, 0, base, 5, 6);
      grid(oriented(o, (sign * Math.PI) / 2, [sign * 12.6, 15.975]), 6.75, 0, base, mid, 4, 4);
    }
    const inset = oriented(o, 0, [14.4, 14.4]);
    plane(inset, 'glass', -1.8, 0, 0, terrace, 0, glass);
    plane(oriented(inset, Math.PI / 2, [0, 0]), 'glass', 0, 1.8, 0, terrace, 0, glass);
    // Seven genuinely open crown bays: no opaque box fills the gallery.
    for (let i = 0; i <= 7; i++) {
      const x = -12.6 + i * 3.6;
      if (skyline) plane(o, 'cladding', x - 0.24, x + 0.24, terrace, gallery, 16.24, granite);
      else box(o, 'cladding', [x - 0.24, terrace, 15.69], [x + 0.24, gallery, 16.24], granite);
    }
    for (const y of [terrace + 0.1, gallery - 0.2])
      plane(o, 'cladding', -12.85, 12.85, y - 0.18, y + 0.18, 16.26, granite);
    grid(o, 10.8, 10.8, terrace, cap, 7, 6);
    for (const sign of [-1, 1])
      grid(oriented(o, (sign * Math.PI) / 2, [sign * 5.4, 8.1]), 5.4, 0, terrace, cap, 7, 3);
    plane(o, 'metal', -5.4, 5.4, cap, 135, 10.8, metal);
    for (const sign of [-1, 1])
      plane(
        oriented(o, (sign * Math.PI) / 2, [sign * 5.4, 9.63]),
        'cladding',
        -1.23,
        1.23,
        cap,
        135,
        0,
        granite,
      );
  }
  for (const [r, a, y] of [
    [24, 12.9, base],
    [19.35, 12.6, mid],
    [16.2, 12.6, terrace],
    [10.8, 5.4, cap],
  ])
    crossRoof(centered, r, a, y);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const o = oriented(out, 0, [shift[0] + sx * 10.8, shift[1] + sz * 10.8]);
      box(o, 'concrete', [-5.4, gallery - 0.24, -5.4], [5.4, gallery, 5.4], [0.31, 0.32, 0.3]);
      box(o, 'metal', [-5.4, corners - 0.14, -5.4], [5.4, corners, 5.4], silver);
      for (let side = 0; side < 4; side++)
        grid(
          oriented(o, (side * Math.PI) / 2, [0, 0]),
          10.8,
          5.36,
          gallery,
          corners,
          3,
          skyline ? 2 : 6,
        );
    }
  for (const sign of [-1, 1])
    box(
      centered,
      'concrete',
      [sign > 0 ? 12.9 : -24, 3.1, -24],
      [sign > 0 ? 24 : -12.9, 3.43, -12.9],
      [0.31, 0.32, 0.3],
    );
  const n = skyline ? 4 : 8;
  loft(
    centered,
    'metal',
    [
      [cap, 1.2],
      [137.4, 1.22],
      [138.3, 0.8],
      [148.3, 0.56],
      [149.1, 0.16],
      [150, 0.035],
    ].map(([y, r]) => radialRing(y, r, r, n)),
    silver,
  );
  for (const y of [136.05, 136.95, 137.85])
    loft(
      centered,
      'metal',
      [radialRing(y - 0.075, 1.72, 1.72, n), radialRing(y + 0.075, 1.72, 1.72, n)],
      silver,
    );
  box(centered, 'metal', [3.7, cap, -2.8], [5, 136, -1.5], silver);
  box(centered, 'metal', [4.1, 135.6, -2.65], [14.3, 136.35, -1.65], silver);
  box(centered, 'metal', [13.2, 136.1, -3.05], [16, 136.35, -1.2], silver);
  // Entrance canopy footprint and its five supporting columns remain visible at distance.
  face(
    centered,
    'clear_glass',
    [
      [-7.3, 5.27, 23.5],
      [-7.3, 5.27, 29.4],
      [7.3, 5.27, 29.4],
      [7.3, 5.27, 23.5],
    ],
    [0.72, 0.8, 0.81],
  );
  for (const z of [23.5, 29.4])
    box(centered, 'metal', [-7.3, 5.08, z - 0.1], [7.3, 5.36, z + 0.1], metal);
  for (const x of [-7.1, -3.6, 0, 3.6, 7.1])
    sourceTube(centered, 'metal', [x, 0, 28.9], [x, 5.08, 28.9], 0.23, silver, 4);
  for (const x of [-3.6, 0, 3.6])
    loft(
      centered,
      'glass',
      [radialRing(0.52, 1.4, 1.4, 6, [x, 24.05]), radialRing(3.85, 1.4, 1.4, 6, [x, 24.05])],
      glass,
    );
  box(centered, 'stone', [-7.3, 0, 23.5], [7.3, 0.45, 25.65], [0.4, 0.42, 0.4]);
  for (let i = 0; i < 3; i++)
    box(
      centered,
      'stone',
      [-5.2, 0, 25.65 + i * 0.32],
      [5.2, 0.45 - i * 0.15, 25.97 + i * 0.32],
      [0.4, 0.42, 0.4],
    );
}
export function buildRembrandtDistrict(o) {
  farModel(o, 'district');
}
export function buildRembrandtSkyline(out) {
  const color = (s, c) => c.map((v, i) => v * (means[s]?.[i] ?? 1));
  const sink = {
    addQuad(s, _r, p, n, u, c) {
      out.addQuad('far', 'palette:#ffffff', p, n, u, color(s, c));
    },
    addTriangle(s, _r, p, n, u, c) {
      out.addTriangle('far', 'palette:#ffffff', p, n, u, color(s, c));
    },
    addConvexPolygon(s, _r, p, n, u, c) {
      out.addConvexPolygon('far', 'palette:#ffffff', p, n, u, color(s, c));
    },
  };
  farModel(sink, 'skyline');
}
