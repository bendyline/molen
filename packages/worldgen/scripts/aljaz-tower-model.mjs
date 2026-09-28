/** Aljaž Tower, restored exterior documented by ZVKDS in September 2025. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { deform, face } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const r = 0.625,
  tau = Math.PI * 2,
  body = [0.72, 0.73, 0.69],
  steel = [0.29, 0.33, 0.34],
  dark = [0.035, 0.043, 0.042];
const p = (u, y, d = 0) => [(r + d) * Math.sin(u / r), y, (r + d) * Math.cos(u / r)];
const glyphs = {
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.22, 0.43],
      [0.78, 0.43],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  J: [
    [
      [0, 0.18],
      [0.2, 0],
      [0.65, 0],
      [1, 0.23],
      [1, 1],
    ],
    [
      [0.55, 1],
      [1, 1],
    ],
  ],
  Z: [
    [
      [0, 1],
      [1, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.5],
      [0.78, 0.5],
    ],
  ],
  V: [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
  ],
  S: [
    [
      [1, 0.86],
      [0.8, 1],
      [0.18, 1],
      [0, 0.82],
      [0.1, 0.61],
      [0.84, 0.42],
      [1, 0.21],
      [0.82, 0],
      [0.18, 0],
      [0, 0.15],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  O: [
    [
      [0.2, 0],
      [0, 0.2],
      [0, 0.8],
      [0.2, 1],
      [0.8, 1],
      [1, 0.8],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
    ],
  ],
  P: [
    [
      [0, 0],
      [0, 1],
      [0.72, 1],
      [1, 0.8],
      [1, 0.58],
      [0.72, 0.5],
      [0, 0.5],
    ],
  ],
};
function inscription(out) {
  const t = deform(out, ([u, y, z]) => p(u, y, z)),
    text = 'ALJAZEV STOLP',
    step = 0.055,
    width = 0.038,
    h = 0.105;
  // Original line glyphs, wrapped onto a separate slightly proud label plate.
  for (let i = 0; i < 36; i++) {
    const a = -0.39 + (i * 0.78) / 36,
      b = a + 0.78 / 36;
    face(
      t,
      'metal',
      [
        [a, 1.748, 0.005],
        [b, 1.748, 0.005],
        [b, 1.935, 0.005],
        [a, 1.935, 0.005],
      ],
      body,
    );
  }
  for (const [i, c] of [...text].entries())
    for (const path of glyphs[c] ?? []) {
      for (let j = 1; j < path.length; j++) {
        const a = path[j - 1],
          b = path[j];
        beam(
          t,
          'shadow',
          [-0.328 + i * step + a[0] * width, 1.791 + a[1] * h, 0.011],
          [-0.328 + i * step + b[0] * width, 1.791 + b[1] * h, 0.011],
          0.0048,
          0.003,
          dark,
        );
      }
    }
  // The caron distinguishes the actual Slovenian inscription ALJAŽEV STOLP.
  for (const [a, b] of [
    [
      [0, 1.1],
      [0.5, 1.03],
    ],
    [
      [0.5, 1.03],
      [1, 1.1],
    ],
  ])
    beam(
      t,
      'shadow',
      [-0.328 + 4 * step + a[0] * width, 1.791 + a[1] * h, 0.011],
      [-0.328 + 4 * step + b[0] * width, 1.791 + b[1] * h, 0.011],
      0.0048,
      0.003,
      dark,
    );
  for (const u of [-0.373, 0.373])
    for (const y of [1.766, 1.916])
      sphere(out, 'metal', p(u, y, 0.014), [0.005, 0.005, 0.005], body, 8, 4);
}
function flag(out) {
  // Stencil-cut numerals retain small bridges, so the counters do not float.
  const digits = {
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    8: ['01110', '10001', '00001', '01110', '10000', '10001', '01110'],
    9: ['01110', '10001', '10000', '01111', '00001', '00001', '01110'],
    5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  };
  const scale = 0.016,
    word = '1895',
    left = -0.452,
    bottom = 2.715,
    plateLeft = -0.52,
    plateRight = -0.009;
  const xs = [plateLeft, plateRight],
    ys = [2.68, 2.88];
  for (let i = 0; i < word.length; i++)
    for (let k = 0; k <= 5; k++) xs.push(left + (i * 6 + k) * scale);
  for (let j = 0; j <= 7; j++) ys.push(bottom + j * scale);
  const xx = [...new Set(xs)].sort((a, b) => a - b),
    yy = [...new Set(ys)].sort((a, b) => a - b);
  // The conservation photographs show the reverse of 1895 from the doorway side.
  const cut = (x, y) => {
    const ix = 22 - Math.floor((x - left) / scale),
      iy = 6 - Math.floor((y - bottom) / scale);
    if (ix < 0 || iy < 0 || iy > 6) return false;
    const digit = Math.floor(ix / 6),
      col = ix % 6;
    return digit < 4 && col < 5 && digits[word[digit]][iy][col] === '1';
  };
  for (let i = 1; i < xx.length; i++)
    for (let j = 1; j < yy.length; j++) {
      const x = (xx[i - 1] + xx[i]) / 2,
        y = (yy[j - 1] + yy[j]) / 2;
      if (x < plateLeft || x > plateRight || y < 2.68 || y > 2.88 || cut(x, y)) continue;
      // Swallowtail is represented by a clipped left contour, not a painted V.
      const edge = y < 2.78 ? plateLeft + (y - 2.68) * 0.9 : plateLeft + (2.88 - y) * 0.9;
      const a = Math.max(xx[i - 1], edge),
        b = xx[i];
      if (b - a < 1e-5) continue;
      box(out, 'metal', [a, yy[j - 1], -0.003], [b, yy[j], 0.003], [0.67, 0.7, 0.69]);
    }
  beam(out, 'metal', [0, 2.38, 0], [0, 2.9, 0], 0.018, 0.018, steel);
  for (const y of [2.69, 2.85])
    sphere(out, 'metal', [-0.004, y, 0.007], [0.012, 0.012, 0.012], body, 10, 5);
}
function buildAljaz(out) {
  const circumference = tau * r,
    holes = [];
  for (let i = 0; i < 4; i++) {
    const u = ((i - 2) * circumference) / 4;
    holes.push({ u, y: 1.555, w: 0.15, h: 0.15 });
  }
  holes.push({ u: circumference / 2, y: 1.555, w: 0.15, h: 0.15 }); // Wrapped half of the same rear window.
  for (let i = 0; i < 4; i++) {
    const u = ((i - 1.5) * circumference) / 4;
    holes.push({ u, y: 0.97, w: 0.15, h: 0.145 });
  }
  const xs = [-circumference / 2, circumference / 2, -0.323, 0.323],
    ys = [0, 0.415, 1.475, 2];
  for (let i = 0; i <= 192; i++) xs.push(-circumference / 2 + (i * circumference) / 192);
  for (let y = 0.1; y < 2; y += 0.1) ys.push(y);
  for (const h of holes) {
    xs.push(h.u - h.w / 2, h.u + h.w / 2);
    ys.push(h.y, h.y + h.h);
  }
  const xx = [...new Set(xs.filter((x) => x >= -circumference / 2 && x <= circumference / 2))].sort(
      (a, b) => a - b,
    ),
    yy = [...new Set(ys.filter((y) => y >= 0 && y <= 2))].sort((a, b) => a - b);
  for (let i = 1; i < xx.length; i++)
    for (let j = 1; j < yy.length; j++) {
      const a = xx[i - 1],
        b = xx[i],
        c = yy[j - 1],
        d = yy[j],
        u = (a + b) / 2,
        y = (c + d) / 2;
      if (b - a < 1e-6 || d - c < 1e-6) continue;
      if (holes.some((h) => Math.abs(u - h.u) < h.w / 2 && y > h.y && y < h.y + h.h)) continue;
      const door = Math.abs(u) < 0.323 && y > 0.415 && y < 1.475;
      face(
        out,
        'metal',
        [
          p(a, c, door ? 0.004 : 0),
          p(b, c, door ? 0.004 : 0),
          p(b, d, door ? 0.004 : 0),
          p(a, d, door ? 0.004 : 0),
        ],
        body,
      );
    }
  // Recessed glazing and steel frames follow the curved shell.
  for (const h of holes) {
    const w = deform(out, ([u, y, z]) => p(u, y, z));
    box(
      w,
      'glass',
      [h.u - h.w / 2, h.y, -0.018],
      [h.u + h.w / 2, h.y + h.h, -0.015],
      [0.11, 0.17, 0.19],
    );
    for (const u of [h.u - h.w / 2, h.u + h.w / 2])
      box(
        w,
        'metal',
        [u - 0.006, h.y - 0.006, -0.014],
        [u + 0.006, h.y + h.h + 0.006, 0.005],
        steel,
      );
    for (const y of [h.y, h.y + h.h])
      box(
        w,
        'metal',
        [h.u - h.w / 2 - 0.006, y - 0.006, -0.014],
        [h.u + h.w / 2 + 0.006, y + 0.006, 0.005],
        steel,
      );
  }
  const shell = deform(out, ([u, y, z]) => p(u, y, z));
  for (const u of [-0.325, 0.325])
    box(shell, 'shadow', [u - 0.003, 0.413, 0.006], [u + 0.003, 1.477, 0.009], dark);
  for (const y of [0.413, 1.477]) {
    for (let i = 0; i < 32; i++) {
      const a = -0.325 + (i * 0.65) / 32,
        b = a + 0.65 / 32;
      face(
        shell,
        'shadow',
        [
          [a, y - 0.003, 0.006],
          [b, y - 0.003, 0.006],
          [b, y + 0.003, 0.006],
          [a, y + 0.003, 0.006],
        ],
        dark,
      );
    }
  }
  // Visible rivet seams and the two hinge barrels on the small raised door.
  for (const u of [-0.35, 0.35, circumference / 2 - 0.025])
    for (let y = 0.08; y < 1.98; y += 0.095)
      sphere(out, 'metal', p(u, y, 0.005), [0.005, 0.005, 0.005], body, 8, 4);
  for (let i = 0; i < 36; i++) {
    const u = -circumference / 2 + (i * circumference) / 36;
    for (const y of [0.06, 1.98])
      sphere(out, 'metal', p(u, y, 0.007), [0.008, 0.008, 0.008], body, 8, 4);
  }
  for (const y of [0.55, 1.29]) {
    box(shell, 'metal', [0.306, y - 0.06, 0.014], [0.365, y + 0.06, 0.033], body);
    loft(
      out,
      'metal',
      [
        radialRing(y - 0.062, 0.014, 0.014, 12, [...p(0.344, y, 0.04).filter((_, i) => i !== 1)]),
        radialRing(y + 0.062, 0.014, 0.014, 12, [...p(0.344, y, 0.04).filter((_, i) => i !== 1)]),
      ],
      body,
    );
  }
  beam(out, 'metal', p(-0.29, 0.94, 0.043), p(-0.21, 0.94, 0.043), 0.018, 0.016, steel);
  box(shell, 'metal', [-0.302, 0.899, 0.013], [-0.278, 0.989, 0.034], steel);
  // Original conical cap, panel seams, lower lip and the raised mast fitting.
  loft(
    out,
    'metal',
    [radialRing(1.993, 0.642, 0.642, 128), radialRing(2.395, 0.038, 0.038, 128)],
    steel,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * tau;
    beam(
      out,
      'metal',
      [0.643 * Math.cos(a), 2.002, 0.643 * Math.sin(a)],
      [0.038 * Math.cos(a), 2.4, 0.038 * Math.sin(a)],
      0.004,
      0.004,
      [0.22, 0.27, 0.28],
    );
  }
  loft(
    out,
    'metal',
    [radialRing(1.979, 0.63, 0.63, 128), radialRing(1.999, 0.643, 0.643, 128)],
    steel,
  );
  loft(
    out,
    'metal',
    [radialRing(2.386, 0.055, 0.055, 32), radialRing(2.437, 0.012, 0.012, 32)],
    steel,
  );
  flag(out);
  inscription(out);
  // Three original Y anchors retained in the 2018 restoration. Six rock bolts,
  // triangulated braces, guy-rope eyes and turnbuckles are explicit components.
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + (i * tau) / 3,
      c = Math.cos(a),
      s = Math.sin(a),
      q = (r, y, t = 0) => [r * c - t * s, y, r * s + t * c];
    beam(out, 'metal', q(0.55, 0.06), q(1.22, 0.06), 0.073, 0.095, steel);
    for (const side of [-1, 1]) {
      const end = q(1.22, 0.06, side * 0.3);
      beam(out, 'metal', q(0.78, 0.06), end, 0.065, 0.085, steel);
      box(
        out,
        'metal',
        [end[0] - 0.09, 0, end[2] - 0.07],
        [end[0] + 0.09, 0.045, end[2] + 0.07],
        steel,
      );
      loft(
        out,
        'metal',
        [
          radialRing(0.044, 0.024, 0.024, 6, [end[0], end[2]]),
          radialRing(0.088, 0.024, 0.024, 6, [end[0], end[2]]),
        ],
        steel,
      );
    }
    beam(out, 'metal', q(0.621, 0.5), q(1.12, 0.09), 0.032, 0.072, steel);
    sphere(out, 'metal', q(0.632, 0.49), [0.027, 0.026, 0.028], steel, 10, 6);
    const eye = q(0.635, 1.91),
      end = q(2.23, 0.08);
    // Visible wire rope, turnbuckle and shell attachment.
    beam(out, 'metal', eye, q(0.79, 1.73), 0.008, 0.008, [0.5, 0.53, 0.52]);
    beam(out, 'metal', q(0.81, 1.72), q(0.95, 1.58), 0.025, 0.025, [0.58, 0.61, 0.6]);
    beam(out, 'metal', q(0.95, 1.58), end, 0.007, 0.007, [0.52, 0.55, 0.54]);
    sphere(out, 'metal', eye, [0.025, 0.025, 0.025], [0.61, 0.63, 0.61], 12, 6);
  }
  // Lightning lead follows the summit rock separately from the guy ropes.
  beam(out, 'metal', [0.014, 2.5, 0], [-0.45, 1.72, -0.44], 0.008, 0.008, [0.52, 0.53, 0.47]);
  beam(out, 'metal', [-0.45, 1.72, -0.44], [-1.72, 0.018, -1.42], 0.008, 0.008, [0.52, 0.53, 0.47]);
}

export const aljazTower = {
  id: 'n0602_aljaz_tower',
  planId: 'N0602',
  title: 'Aljaž Tower',
  wikidata: 'Q650987',
  authoringFile: 'aljaz-tower-model.mjs',
  build: buildAljaz,
  brief:
    'The restored Triglav summit shelter: riveted pale-gray cylindrical shell, eight small viewing windows, closed raised door with hinges and latch, dark conical cap, readable Slovenian plaque, stencil-cut 1895 flag, Y anchors and guy ropes.',
  size: [4.5, 2.9, 4.5],
  front: '+Z is the door and ALJAŽEV STOLP plaque; final compass registration remains unresolved',
  origin: 'Cylinder axis at the rock-anchor contact plane',
  refs: [
    'https://www.zvkds.si/wp-content/uploads/2024/04/sto_let_net.pdf',
    'https://www.zvkds.si/wp-content/uploads/2024/03/vs_porocila_54_web-1.pdf',
    'https://www.zvkds.si/montaza-triglavske-panorame/',
    'https://planinskivestnik.pzs.si/arhiv/pdf/pv_1895_08.pdf',
    'https://www.openstreetmap.org/way/388344086',
  ],
  facts: {
    cylinderDiameterMeters: 1.25,
    cylinderHeightMeters: 2,
    overallHeightIncludingFlagSupportMeters: 2.9,
    viewingWindowCount: 8,
    originalYAnchorCount: 3,
    restorationYear: 2018,
    referenceAppearanceDate: '2025-09-04',
  },
  scaleBasis:
    'The heritage authority publishes the 1.25 m cylinder diameter, 2 m body and 2.90 m total including the flag support. Its 2025 conservation photographs establish the restored palette, raised door, eight windows, rivet seams, label, stencil flag and anchors. The 2018 intervention preserved all three original Y anchors, original site elevation and rotation. Small fittings and the visible shell/roof proportions are photographic reconstructions.',
  geographicProposal: {
    status: 'orientation-review',
    anchor: [13.836673765, 46.37830418],
    source: 'https://www.openstreetmap.org/way/388344086',
    evidence:
      'Exact-QID mapped circle supplies the cylinder location, but its polygon axis is not an entrance bearing. The 2018 conservation report confirms the original rotation was preserved; it does not publish that angle. A directed doorway bearing must be independently resolved before automatic geographic activation.',
    orientationConfidence: 'anchor-only; entrance-bearing-unresolved',
    limitations:
      'Do not use the arbitrary minimum-area axis of a near-circular OSM footprint. The model is available for asset review and explicit host placement while the doorway compass registration is pending.',
  },
  limits: [
    'Door is shown closed. The external inscription uses original polygonal letter strokes and the 1895 flag uses a simplified cut stencil; no historical lettering bitmap or the newly painted interior panorama is copied.',
    'Rock anchor positions, turnbuckles, rivet pitch and cable endpoints are reconstructed from conservation photographs. The natural summit rock and interior fixtures belong outside this static exterior asset.',
    'Exact entrance compass phase remains unresolved and is recorded independently of the verified model dimensions and mapped anchor.',
  ],
  cameras: [
    { name: 'door-label-and-rivets', position: [1.8, 1.6, 3.1], lookAt: [0, 1.35, 0.3] },
    { name: 'roof-and-stencil-flag', position: [1.8, 3.35, 2.7], lookAt: [0, 2.18, 0] },
    { name: 'anchors-and-turnbuckles', position: [2.8, 1.05, 2.6], lookAt: [0, 0.8, 0] },
    { name: 'rear-window-seams', position: [-2.8, 1.8, -3.4], lookAt: [0, 1.2, 0] },
    { name: 'far-silhouette', position: [5.4, 3.3, 6.4], lookAt: [0, 1.25, 0] },
  ],
};
