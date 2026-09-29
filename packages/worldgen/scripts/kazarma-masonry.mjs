/** Original polygonal reconstruction of the photographed Cyclopean face.
 * Coordinates were measured in the cited 202418 front photograph; they describe
 * stone silhouettes, not a texture or a photogrammetric survey. */
import { normalFor } from './authored-structure-mesh.mjs';

const noise = (s) => {
  const n = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
  return n - Math.floor(n);
};
// Separate bed, jamb, corbel and infill stones. Unequal heights and oblique joints
// are essential here: a repeated horizontal bond would describe another structure.
const outlines = [
  [
    [270, 333],
    [305, 332],
    [331, 343],
    [334, 390],
    [309, 389],
    [290, 373],
  ],
  [
    [244, 320],
    [263, 300],
    [302, 298],
    [335, 306],
    [330, 336],
    [301, 330],
    [272, 330],
  ],
  [
    [286, 284],
    [306, 251],
    [339, 246],
    [372, 250],
    [362, 281],
    [331, 293],
    [311, 297],
  ],
  [
    [348, 189],
    [381, 199],
    [406, 206],
    [412, 235],
    [394, 252],
    [369, 249],
    [346, 234],
  ],
  [
    [420, 328],
    [449, 326],
    [461, 347],
    [448, 366],
    [420, 380],
    [415, 358],
  ],
  [
    [409, 281],
    [438, 275],
    [459, 282],
    [452, 313],
    [426, 329],
    [417, 312],
  ],
  [
    [402, 247],
    [424, 244],
    [449, 252],
    [444, 276],
    [414, 284],
    [397, 269],
  ],
  [
    [427, 207],
    [460, 211],
    [467, 230],
    [455, 246],
    [420, 241],
    [418, 225],
  ],
  [
    [475, 282],
    [502, 270],
    [524, 280],
    [531, 306],
    [509, 321],
    [476, 319],
    [463, 300],
  ],
  [
    [455, 248],
    [477, 236],
    [496, 241],
    [506, 257],
    [484, 271],
    [459, 273],
  ],
  [
    [510, 242],
    [532, 220],
    [558, 219],
    [562, 242],
    [543, 264],
    [514, 268],
    [502, 257],
  ],
  [
    [534, 270],
    [557, 255],
    [576, 258],
    [578, 281],
    [549, 293],
    [532, 288],
  ],
  [
    [232, 311],
    [257, 306],
    [270, 324],
    [255, 341],
    [234, 334],
  ],
  [
    [209, 281],
    [237, 275],
    [260, 283],
    [250, 304],
    [224, 312],
    [200, 298],
  ],
  [
    [252, 257],
    [280, 250],
    [296, 261],
    [281, 287],
    [258, 289],
    [244, 278],
  ],
  [
    [228, 217],
    [250, 211],
    [274, 216],
    [288, 238],
    [269, 253],
    [238, 253],
    [217, 238],
  ],
  [
    [289, 214],
    [303, 195],
    [329, 196],
    [341, 211],
    [335, 238],
    [307, 245],
    [286, 236],
  ],
  [
    [195, 211],
    [216, 216],
    [225, 238],
    [204, 258],
    [181, 258],
    [173, 244],
  ],
  [
    [172, 257],
    [197, 258],
    [208, 277],
    [192, 295],
    [164, 291],
    [154, 277],
  ],
  [
    [140, 266],
    [158, 269],
    [166, 289],
    [153, 303],
    [136, 294],
  ],
  [
    [143, 218],
    [160, 199],
    [180, 197],
    [190, 214],
    [171, 240],
    [146, 241],
  ],
  [
    [207, 184],
    [226, 173],
    [250, 185],
    [245, 208],
    [223, 215],
    [205, 201],
  ],
  [
    [244, 174],
    [260, 168],
    [288, 175],
    [293, 195],
    [276, 212],
    [251, 209],
  ],
  [
    [294, 174],
    [315, 171],
    [332, 182],
    [328, 195],
    [303, 193],
  ],
  [
    [335, 174],
    [372, 167],
    [389, 178],
    [396, 197],
    [377, 202],
    [346, 191],
  ],
  [
    [399, 178],
    [418, 175],
    [437, 187],
    [433, 206],
    [410, 207],
    [393, 195],
  ],
  [
    [441, 188],
    [457, 180],
    [480, 187],
    [483, 207],
    [462, 213],
    [438, 207],
  ],
  [
    [474, 215],
    [493, 211],
    [511, 220],
    [505, 235],
    [480, 237],
  ],
  [
    [492, 181],
    [513, 176],
    [530, 184],
    [529, 205],
    [508, 218],
    [491, 207],
  ],
  [
    [536, 169],
    [566, 164],
    [585, 172],
    [578, 194],
    [551, 209],
    [532, 202],
  ],
  [
    [565, 206],
    [594, 184],
    [617, 178],
    [640, 183],
    [630, 207],
    [602, 225],
    [574, 224],
  ],
  [
    [570, 228],
    [597, 223],
    [603, 239],
    [587, 253],
    [568, 253],
    [559, 244],
  ],
  [
    [624, 211],
    [646, 205],
    [662, 219],
    [651, 238],
    [625, 243],
    [609, 231],
  ],
  [
    [652, 177],
    [672, 167],
    [694, 172],
    [693, 193],
    [674, 209],
    [649, 205],
  ],
  [
    [239, 136],
    [260, 145],
    [279, 141],
    [293, 157],
    [279, 173],
    [253, 168],
    [230, 155],
  ],
  [
    [301, 130],
    [325, 123],
    [343, 130],
    [344, 156],
    [330, 171],
    [305, 168],
    [292, 152],
  ],
  [
    [351, 128],
    [374, 124],
    [391, 134],
    [395, 158],
    [383, 177],
    [350, 165],
    [342, 149],
  ],
  [
    [404, 138],
    [421, 128],
    [439, 133],
    [445, 152],
    [435, 178],
    [411, 177],
    [398, 159],
  ],
  [
    [445, 140],
    [473, 133],
    [494, 141],
    [493, 166],
    [477, 181],
    [451, 178],
  ],
  [
    [497, 135],
    [518, 129],
    [538, 137],
    [533, 168],
    [516, 181],
    [495, 172],
  ],
  [
    [526, 120],
    [548, 111],
    [570, 117],
    [574, 133],
    [556, 144],
    [532, 139],
  ],
  [
    [545, 148],
    [570, 139],
    [593, 145],
    [594, 163],
    [577, 175],
    [552, 167],
    [536, 163],
  ],
  [
    [596, 129],
    [618, 126],
    [634, 139],
    [632, 159],
    [606, 166],
    [593, 151],
  ],
  [
    [606, 167],
    [636, 158],
    [649, 166],
    [643, 181],
    [619, 180],
  ],
  [
    [676, 133],
    [690, 122],
    [713, 127],
    [712, 141],
    [690, 152],
    [675, 147],
  ],
  [
    [682, 153],
    [707, 143],
    [721, 157],
    [710, 173],
    [691, 174],
  ],
  [
    [212, 161],
    [232, 156],
    [241, 167],
    [226, 180],
    [210, 177],
  ],
  [
    [184, 187],
    [201, 179],
    [211, 192],
    [201, 211],
    [188, 208],
  ],
  [
    [307, 298],
    [321, 290],
    [336, 290],
    [339, 305],
    [320, 309],
  ],
  [
    [461, 330],
    [477, 320],
    [491, 329],
    [490, 341],
    [473, 348],
  ],
];

/** Angular chipped polyhedron with a shallow faceted broad face and deep bedding. */
export function polygonStone(out, polygon, side, seed, depth = 0.82, faceOffset = 0) {
  let boundary = polygon.map((p) => [...p]);
  const area = boundary.reduce((sum, p, i) => {
    const q = boundary[(i + 1) % boundary.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area * side < 0) boundary.reverse();
  const center = [0, 1].map((axis) => boundary.reduce((s, p) => s + p[axis], 0) / boundary.length);
  // Split long edges so chips do not impose a perfectly planar broad polygon.
  boundary = boundary.flatMap((p, i) => {
    const q = boundary[(i + 1) % boundary.length];
    return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]];
  });
  const face = (y) => 2.79 - Math.max(0, y) * 0.29 + faceOffset;
  const color = [0.655, 0.637, 0.574].map((c) => c + (noise(seed * 11) - 0.5) * 0.17);
  const bulge = 0.09 + noise(seed * 23) * 0.075;
  const ring = (scale, inset, amplitude) =>
    boundary.map((p) => {
      const x = center[0] + (p[0] - center[0]) * scale;
      const y = center[1] + (p[1] - center[1]) * scale;
      return [
        x,
        y,
        side *
          (face(y) - inset + Math.sin(x * 6 + seed) * Math.cos(y * 5 + seed * 0.7) * amplitude),
      ];
    });
  const rings = [
    ring(0.9, depth, 0.045),
    ring(1, 0.055, 0.004),
    ring(0.92, -bulge * 0.18, 0.007),
    ring(0.6, -bulge * 0.72, 0.012),
    ring(0.25, -bulge * 0.97, 0.012),
  ];
  const triangle = (points) =>
    out.addTriangle(
      'limestone',
      'palette:#ffffff',
      points,
      normalFor(...points),
      points.map((p) => [p[0], p[1]]),
      color,
    );
  for (let r = 1; r < rings.length; r++)
    for (let i = 0; i < boundary.length; i++) {
      const j = (i + 1) % boundary.length;
      triangle([rings[r - 1][i], rings[r - 1][j], rings[r][j]]);
      triangle([rings[r - 1][i], rings[r][j], rings[r][i]]);
    }
  const c = [
    center[0],
    center[1],
    side *
      (face(center[1]) +
        bulge +
        Math.sin(center[0] * 6 + seed) * Math.cos(center[1] * 5 + seed * 0.7) * 0.012),
  ];
  for (let i = 0; i < boundary.length; i++)
    triangle([rings.at(-1)[i], rings.at(-1)[(i + 1) % boundary.length], c]);
}

export function kazarmaFace(out, side) {
  const world = ([px, py]) => [(px - 382) * 0.0185, (394 - py) * 0.0145];
  for (const [i, points] of outlines.entries()) {
    const p = points.map(world);
    // The second elevation has the same structural corbels but independently
    // weathered stone faces; its exact hidden bedding is a documented inference.
    polygonStone(out, p, side, 33 + i * 17 + (side + 1) * 313);
  }
  // Reconstructed buried stones continue the structural face beneath the bank.
  // Unequal polygonal bedding avoids imposing regular courses on Cyclopean work.
  for (const [xmin, xmax, ymin, ymax] of [
    [-11, -1.06, 0, 3.52],
    [0.83, 11, 0, 3.52],
    [-1.06, 0.83, 2.2, 3.65],
  ]) {
    const sites = [];
    let s = 3301;
    for (let y = ymin + 0.2; y < ymax; y += 0.53)
      for (let x = xmin + 0.25; x < xmax; x += 0.81) {
        sites.push([
          Math.min(xmax - 0.03, x + (noise(s++) - 0.5) * 0.6),
          Math.max(ymin + 0.03, Math.min(ymax - 0.03, y + (noise(s++) - 0.5) * 0.39)),
        ]);
      }
    for (let i = 0; i < sites.length; i++) {
      const a = sites[i];
      let poly = [
        [xmin, ymin],
        [xmax, ymin],
        [xmax, ymax],
        [xmin, ymax],
      ];
      for (let j = 0; j < sites.length && poly.length >= 3; j++)
        if (i !== j) {
          const b = sites[j],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            limit = (b[0] ** 2 + b[1] ** 2 - a[0] ** 2 - a[1] ** 2) / 2;
          const next = [];
          for (let k = 0; k < poly.length; k++) {
            const p = poly[k],
              q = poly[(k + 1) % poly.length],
              dp = p[0] * dx + p[1] * dy - limit,
              dq = q[0] * dx + q[1] * dy - limit;
            if (dp <= 0) next.push(p);
            if (dp < 0 !== dq < 0) {
              const t = dp / (dp - dq);
              next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
            }
          }
          poly = next;
        }
      if (poly.length < 3) continue;
      const center = [0, 1].map((axis) => poly.reduce((sum, p) => sum + p[axis], 0) / poly.length);
      poly = poly.map((p) => p.map((v, axis) => center[axis] + (v - center[axis]) * 0.975));
      polygonStone(out, poly, side, 4401 + i * 17 + xmin, 0.71, -0.13);
    }
  }
}
