/** ATR 72-600/PW127M. Stations measured from ATR CM Marketing June 2015,
 * checked against the 2020 fact sheet and Pierre Barthe's in-flight photograph.
 * The nose and window band are traced from that sheet's side and plan outlines.
 * Metres, +Z forward. References are local review inputs, never runtime textures.
 */
import { atr72Deck, buildATR72Cockpit } from './atr-72-cockpit.mjs';
import {
  cleanGeometry,
  detailKit,
  ellipsoid,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';
export const atr72Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 1.43,
  cy: 2.31,
  ry: 1.31,
  cabinZ: atr72Deck.eye[2],
  cabinWidth: 2.57,
  eye: atr72Deck.eye,
  panelZ: atr72Deck.panelZ,
  floor: atr72Deck.floor,
});
/** The nose is a smooth moulding; share area-weighted normals between coincident vertices. */
function smoothNormals(mesh) {
  const g = mesh.geometry,
    p = g.getAttribute('position'),
    n = g.getAttribute('normal'),
    index = g.index,
    key = (i) =>
      `${Math.round(p.getX(i) * 2e3)},${Math.round(p.getY(i) * 2e3)},${Math.round(p.getZ(i) * 2e3)}`,
    sums = new Map(),
    a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(p, ids[0]);
    b.fromBufferAttribute(p, ids[1]).sub(a);
    c.fromBufferAttribute(p, ids[2]).sub(a);
    b.cross(c);
    for (const id of ids) {
      const sum = sums.get(key(id)) ?? [0, 0, 0];
      sum[0] += b.x;
      sum[1] += b.y;
      sum[2] += b.z;
      sums.set(key(id), sum);
    }
  }
  for (let i = 0; i < n.count; i++) {
    const [x, y, z] = sums.get(key(i)) ?? [n.getX(i), n.getY(i), n.getZ(i)],
      length = Math.sqrt(x * x + y * y + z * z);
    if (length > 0) n.setXYZ(i, x / length, y / length, z / length);
  }
}
export function buildATR72(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('ATR72-ivory', '#e9e9e4', { side: T.DoubleSide }),
    accent = mat('ATR72-teal', '#286b80', { side: T.DoubleSide }),
    dark = mat('ATR72-trim', '#263136', { side: T.DoubleSide }),
    metal = mat('ATR72-alloy', '#a8b0b3', { metalness: 0.7 }),
    rubber = mat('ATR72-tyres', '#192025'),
    glass = mat('ATR72-glazing', '#a8c8d0', {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    });
  const d = detailKit(root, 'ATR72-shell'),
    noseKit = detailKit(root, 'ATR72-nose'),
    bindings = [],
    rotors = [],
    enginePoints = [],
    gearNodes = [];
  const ppm = 1033 / 27.166,
    z = (u) => 13.583 - (u - 35) / ppm,
    y = (v) => (330 - v) / ppm;
  // Nose outline traced from page 2 of the 2015 sheet: [z, half width, belly, crown] in that
  // drawing's metres, fitted to the 2.86 m width and the 0.97 to 3.60 m body.
  const noseY = (v) => 0.97 + (v - 1) * 0.991;
  const nose = [
    [13.583, 0.02, 1.87, 1.93],
    [13.57, 0.132, 1.79, 1.99],
    [13.53, 0.212, 1.73, 2.05],
    [13.46, 0.318, 1.66, 2.125],
    [13.4, 0.397, 1.61, 2.17],
    [13.3, 0.489, 1.54, 2.245],
    [13.133, 0.616, 1.45, 2.36],
    [12.91, 0.754, 1.347, 2.485],
    [12.712, 0.862, 1.277, 2.594],
    [12.514, 0.943, 1.218, 2.703],
    [12.365, 1.007, 1.188, 2.792],
    [12.118, 1.09, 1.139, 3.05],
    [11.821, 1.19, 1.089, 3.327],
    [11.524, 1.27, 1.059, 3.475],
    [11.128, 1.355, 1.03, 3.584],
    [10.732, 1.415, 1.01, 3.634],
    [10.137, 1.447, 1.01, 3.653],
  ].map(([zz, w, b, t]) => [zz, w * 0.988, noseY(b), noseY(t)]);
  const samples = [
    [240, 1.43, 293, 193],
    [350, 1.43, 293, 193],
    [474, 1.43, 293, 193],
    [618, 1.43, 293, 193],
    [742, 1.4, 292, 194],
    [800, 1.32, 284, 198],
    [880, 1.06, 269, 202],
    [960, 0.68, 248, 207],
    [1035, 0.3, 229, 212],
    [1068, 0.015, 222, 218],
  ];
  const noseEnd = nose.length; // The loft takes over here, 9.77 m, on the round barrel.
  const stations = [
    ...nose,
    [z(180), 1.43, y(293), y(193)],
    ...samples.map(([u, w, b, t]) => [z(u), w, y(b), y(t)]),
  ];
  const rings = stations.map(([zz, w, b, t]) => ({
    z: zz,
    points: Array.from({ length: 16 }, (_, j) => {
      const a = (j * Math.PI) / 8;
      return [Math.sin(a) * w, (b + t) / 2 + (Math.cos(a) * (t - b)) / 2];
    }),
  }));
  const p = (i, j) => [...rings[i].points[(j + 16) % 16], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) => i < noseEnd || (i <= noseEnd + 6 && [2, 3, 12, 13].includes(j)),
  });
  const sample = (zz, k) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (zz <= stations[i][0] && zz >= stations[i + 1][0]) {
        const t = (stations[i][0] - zz) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][k] * (1 - t) + stations[i + 1][k] * t;
      }
    return stations.at(-1)[k];
  };
  // Flat windscreen panes leave the upper nose narrower than an ellipse at sill height, so the
  // crown carries a super-elliptic exponent over the flight deck and relaxes to the round barrel.
  const crownPower = (zz) => {
    const up = Math.min(1, Math.max(0, (zz - 10.2) / 0.9)),
      down = Math.min(1, Math.max(0, (12.9 - zz) / 0.6));
    return 2 - 0.3 * up * down;
  };
  const skinCentre = (zz) => (sample(zz, 2) + sample(zz, 3)) / 2,
    skinRadius = (zz) => (sample(zz, 3) - sample(zz, 2)) / 2;
  /** Half width of the skin at a height, so a drawn side-view point can sit on the surface. */
  const skinX = (zz, yy) => {
    const v = (yy - skinCentre(zz)) / skinRadius(zz);
    if (v <= 0) return sample(zz, 1) * Math.sqrt(Math.max(0, 1 - v * v));
    const e = crownPower(zz);
    return sample(zz, 1) * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, v), e)), 1 / e);
  };
  // Window band from the same sheet, in its pixels at 101 px/m with the ground line at 857.
  const sideZ = (u) => 13.583 - (u - 52) / 101,
    sideY = (v) => noseY((857 - v) / 101);
  const profile = (points) => {
    const line = points.map(([u, v]) => [sideZ(u), sideY(v)]);
    return (zz) => {
      if (zz >= line[0][0]) return line[0][1];
      for (let i = 0; i < line.length - 1; i++)
        if (zz >= line[i + 1][0]) {
          const t = (line[i][0] - zz) / (line[i][0] - line[i + 1][0]);
          return line[i][1] * (1 - t) + line[i + 1][1] * t;
        }
      return line.at(-1)[1];
    };
  };
  const glassTop = profile([
      [231, 530],
      [312, 530],
      [331, 572.5],
    ]),
    glassBottom = profile([
      [221, 570.75],
      [233, 572],
      [284, 581],
      [295, 581],
      [331, 572.5],
    ]),
    bandTop = profile([
      [230, 523],
      [316, 523],
      [341, 577],
    ]),
    bandBottom = profile([
      [227.5, 577.5],
      [290, 589],
      [341, 577],
    ]);
  const bandAft = sideZ(341),
    glassAft = sideZ(331),
    postHalfWidth = 0.035;
  // Every ring carries the same columns per side. They bend onto the drawn band edges, so the
  // openings are real gaps in the skin and the sills stay level instead of following facets.
  const columns = [5, 1, 6, 1, 19];
  const ringAngles = (zz) => {
    if (zz < bandAft - 0.001) return Array.from({ length: 33 }, (_, k) => (k * Math.PI) / 32);
    const angle = (yy) => {
      const v = Math.max(-1, Math.min(1, (yy - skinCentre(zz)) / skinRadius(zz)));
      return Math.acos(v <= 0 ? v : Math.pow(v, crownPower(zz) / 2));
    };
    const post = Math.asin(Math.min(1, postHalfWidth / sample(zz, 1))),
      sill = angle(bandBottom(Math.max(zz, bandAft))),
      top = zz < bandAft ? sill : Math.min(sill, angle(bandTop(zz))),
      bottom = angle(glassBottom(zz)),
      open = zz >= glassAft && bottom > post,
      upper = open ? Math.min(bottom, Math.max(post, angle(glassTop(zz)))) : (top + sill) / 2,
      lower = open ? Math.min(sill, bottom) : upper;
    const stops = [0, top, Math.max(top, upper), Math.max(top, lower), sill, Math.PI],
      angles = [];
    columns.forEach((count, part) => {
      for (let k = 0; k < count; k++)
        angles.push(stops[part] + ((stops[part + 1] - stops[part]) * k) / count);
    });
    angles.push(Math.PI);
    return angles;
  };
  const noseRings = [
    ...new Set(
      [
        ...nose.map((n) => n[0]),
        10.45,
        9.95,
        ...[175, 189, 205, 221, 233, 246, 259, 272, 284, 295, 312, 331, 336, 341].map(sideZ),
      ].map((zz) => Math.round(zz * 1e4) / 1e4),
    ),
    z(180),
  ].sort((a, b) => b - a);
  const skinPoint = (zz, angle, sign) => {
    const s = Math.sin(angle),
      c = Math.cos(angle),
      e = c > 0 ? crownPower(zz) : 2,
      facet = Math.min(1, Math.max(0, (10.6 - zz) / (10.6 - z(180))));
    let x = Math.pow(Math.max(0, s), 2 / e),
      v = Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
    if (facet > 0) {
      // Relax onto the sixteen-sided barrel so the loft behind it meets vertex for vertex.
      const m = Math.min(15, Math.floor((angle * 8) / Math.PI)),
        t = (angle * 8) / Math.PI - m,
        a = (m * Math.PI) / 8,
        b = ((m + 1) * Math.PI) / 8;
      x += (Math.sin(a) * (1 - t) + Math.sin(b) * t - x) * facet;
      v += (Math.cos(a) * (1 - t) + Math.cos(b) * t - v) * facet;
    }
    return [sign * sample(zz, 1) * x, skinCentre(zz) + skinRadius(zz) * v, zz];
  };
  const shell = new Map();
  const triangle = (material, a, b, c, zz) => {
    const pa = new T.Vector3(...a),
      n = new T.Vector3(...b).sub(pa).cross(new T.Vector3(...c).sub(pa));
    if (n.lengthSq() < 1e-14) return;
    const outward = (a[0] + b[0] + c[0]) * n.x + (a[1] + b[1] + c[1] - 3 * skinCentre(zz)) * n.y;
    const list = shell.get(material) ?? [];
    list.push(...(outward >= 0 ? [...a, ...b, ...c] : [...a, ...c, ...b]));
    shell.set(material, list);
  };
  const noseAngles = noseRings.map(ringAngles);
  for (const side of [-1, 1])
    for (let i = 0; i < noseRings.length - 1; i++)
      for (let k = 0; k < 32; k++) {
        const band = noseRings[i + 1] >= bandAft - 0.001;
        const material = !band
          ? paint
          : k === 5 || k === 12
            ? dark
            : k > 5 && k < 12
              ? glass
              : paint;
        const at = (r, c) => skinPoint(noseRings[r], noseAngles[r][c], side);
        const a = at(i, k),
          b = at(i + 1, k),
          c = at(i + 1, k + 1),
          e = at(i, k + 1),
          mid = (noseRings[i] + noseRings[i + 1]) / 2;
        triangle(material, a, b, c, mid);
        triangle(material, a, c, e, mid);
      }
  for (const [material, list] of shell) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(list, 3));
    geometry.computeVertexNormals();
    noseKit.add(geometry, material);
  }
  noseKit.finish();
  // Flat posts between the panes, from the drawn band to the header, standing on the skin.
  const onSkin = (u, v, sign, lift = 0.004) => {
    const zz = sideZ(u),
      yy = sideY(v);
    return [sign * (skinX(zz, yy) + lift), yy, zz];
  };
  for (const side of [-1, 1])
    for (const [from, to] of [
      [
        [227, 574],
        [260, 527],
      ],
      [
        [289.5, 585],
        [289.5, 527],
      ],
    ])
      outline(
        d,
        [0, 0.25, 0.5, 0.75, 1].map((t) =>
          onSkin(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, side),
        ),
        0.024,
        dark,
        false,
      );
  // Rebuild each side belt separately by station. Real holes, no dark decals covering a solid wall.
  for (const side of [-1, 1]) {
    const sideX = (zz, yy) => side * skinX(zz, yy);
    const pt = (zz, yy, off = 0) => [sideX(zz, yy) + side * off, yy, zz];
    const holes = [];
    // Passenger belt: 25 openings per side.
    for (let j = 0; j < 25; j++) {
      const zz = z(257 + j * 20.65),
        yy = y(233),
        w = 0.29,
        h = 0.39,
        r = 0.058;
      holes.push(
        [
          [-w / 2 + r, -h / 2],
          [w / 2 - r, -h / 2],
          [w / 2, -h / 2 + r],
          [w / 2, h / 2 - r],
          [w / 2 - r, h / 2],
          [-w / 2 + r, h / 2],
          [-w / 2, h / 2 - r],
          [-w / 2, -h / 2 + r],
        ].map(([dz, dy]) => pt(zz + dz, yy + dy)),
      );
    }
    for (let i = noseEnd; i <= noseEnd + 6; i++) {
      const upper = side > 0 ? 2 : 14,
        lower = side > 0 ? 4 : 12,
        a = stations[i][0],
        b = stations[i + 1][0];
      // Insert an extra boundary when a window crosses a station so no aperture gets clipped.
      const relevant = holes.filter(
        (h) => Math.max(...h.map((q) => q[2])) < a && Math.min(...h.map((q) => q[2])) > b,
      );
      sheet(
        d,
        [p(i, upper), p(i + 1, upper), p(i + 1, lower), p(i, lower)],
        paint,
        [side, 0, 0],
        relevant,
      );
    }
    for (const h of holes) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.006, dark);
    }
    // Port forward cargo door and rear entry; starboard servicing doors. No airline logos.
    const doors =
      side > 0
        ? [
            [179, 215, 227, 276],
            [248, 218, 270, 250],
            [778, 206, 804, 277],
          ]
        : [
            [185, 211, 216, 278],
            [248, 218, 270, 250],
            [778, 206, 804, 277],
          ];
    for (const [a, b, c, e] of doors) {
      const h = [
        [a, b],
        [c, b],
        [c, e],
        [a, e],
      ].map(([u, v]) => pt(z(u), y(v), 0.006));
      outline(d, h, 0.003, dark);
      d.rod(pt(z(c - 6), y(e - 18), 0.02), pt(z(c - 6), y(e - 28), 0.02), 0.011, metal);
    }
    for (const u of [155, 234, 310, 410, 510, 610, 705, 770, 850, 930]) {
      const zz = z(u),
        b = sample(zz, 2),
        t = sample(zz, 3);
      const arc = Array.from({ length: 7 }, (_, j) =>
        pt(zz, b + 0.18 + ((t - b - 0.36) * j) / 6, 0.004),
      );
      outline(d, arc, 0.0014, metal, false);
      for (const q of arc)
        d.add(new T.SphereGeometry(0.003, 4, 2), metal, [q[0] + side * 0.002, q[1], q[2] + 0.025]);
    }
    for (let i = noseEnd; i < stations.length - 2; i++) {
      const a = stations[i],
        b = stations[i + 1];
      quad(
        d,
        pt(a[0], a[2] + 0.27, 0.004),
        pt(b[0], b[2] + 0.27, 0.004),
        pt(b[0], b[2] + 0.4, 0.004),
        pt(a[0], a[2] + 0.4, 0.004),
        accent,
        [side, 0, 0],
      );
    }
    const label = group(root, `ATR72-label-${side}`, [side * 1.434, 1.88, -3.5]);
    label.rotation.y = (side * Math.PI) / 2;
    const ld = detailKit(label, label.name);
    ld.text('ATR 72 600', [0, 0, 0], 0.14, 0, accent);
    ld.finish();
    // Windscreen wiper on each main pane and the probe under each side of the window band.
    d.rod(onSkin(222, 566, side, 0.03), onSkin(248, 537, side, 0.03), 0.008, dark);
    const probe = onSkin(214, 602, side, 0);
    d.rod(probe, [probe[0] + side * 0.07, probe[1], probe[2] + 0.32], 0.011, metal);
  }
  // High wing, straight inner panel and tapered outer panel. Printed 61 m² takes priority over artwork.
  const wy = (x) => 3.58 + Math.max(0, x - 4.05) * 0.013,
    le = (x) => 2.72 - Math.max(0, x - 4.05) * 0.073,
    te = (x) => -0.14 + Math.max(0, x - 4.05) * 0.06;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.9, wy(0.9), le(0.9), 0.4, 0.17],
        [side * 4.05, wy(4.05), le(4.05), 0.4, 0.17],
        [side * 13.28, wy(13.28), le(13.28), te(13.28) + 0.35, 0.1],
        [side * 13.525, wy(13.525), le(13.525) - 0.13, te(13.525) + 0.12, 0.045],
      ],
      paint,
    );
    wing(
      d,
      [
        [side * 1.42, wy(1.42) + 0.002, 2.727, 2.52, 0.027],
        [side * 4.05, wy(4.05) + 0.002, 2.727, 2.52, 0.027],
        [side * 13.25, wy(13.25) + 0.002, le(13.25) + 0.006, le(13.25) - 0.17, 0.023],
      ],
      dark,
    );
    // Thin boots follow the actual airfoil skin; a second small airfoil would be buried in it.
    const boot = [1.42, 4.05, 13.25].map((x) => {
      const h = 0.17 - (Math.max(0, x - 4.05) * 0.07) / 9.23;
      const back = x <= 4.05 ? 0.4 : te(x) + 0.35;
      const rise = (h * 0.22) / ((le(x) - back) * 0.25);
      return [
        [side * x, wy(x) + 0.005, le(x) + 0.005],
        [side * x, wy(x) + rise + 0.005, le(x) - 0.22],
        [side * x, wy(x) - rise * 0.65 - 0.005, le(x) - 0.22],
      ];
    });
    for (let j = 0; j < boot.length - 1; j++) {
      quad(d, boot[j][0], boot[j + 1][0], boot[j + 1][1], boot[j][1], dark, [0, 1, 0]);
      quad(d, boot[j][0], boot[j + 1][0], boot[j + 1][2], boot[j][2], dark, [0, -1, 0]);
    }
    for (const [kind, a, b] of [
      ['flap', 1.45, 9.5],
      ['aileron', 9.56, 13.25],
    ]) {
      const hinge = (x) => (kind === 'flap' ? 0.4 : te(x) + 0.35),
        g = group(root, `ATR72-${kind}-${side}`, [side * a, wy(a), hinge(a)]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(a) - hinge(a), 0.028],
          [side * (b - a), wy(b) - wy(a), hinge(b) - hinge(a), te(b) - hinge(a), 0.025],
        ],
        paint,
      );
      if (kind === 'flap')
        for (let x = a + 0.35; x < b; x += 1.15) {
          dd.rod([side * (x - a), -0.04, -0.03], [side * (x - a), -0.19, -0.27], 0.019, metal);
          dd.rod([side * (x - a), -0.19, -0.27], [side * (x - a), -0.13, -0.43], 0.025, dark);
        }
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : 'rollInput',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -Math.PI / 6 : -side * 0.35,
      });
    }
    for (let x = 1.6; x < 13; x += 0.6) {
      d.rod([side * x, wy(x) + 0.171, le(x) - 0.6], [side * x, wy(x) + 0.07, 0.44], 0.0017, metal);
      for (let u = 0.2; u < 0.8; u += 0.17)
        d.add(new T.SphereGeometry(0.003, 4, 2), metal, [
          side * x,
          wy(x) + 0.16 - (u - 0.25) * 0.17,
          le(x) - u * (le(x) - 0.4),
        ]);
    }
    ellipsoid(
      d,
      [side * 13.49, wy(13.49), 1.35],
      [0.04, 0.035, 0.1],
      side > 0 ? d.red : d.green,
      8,
    );
    for (let x = 10.2; x < 13.3; x += 0.7)
      d.rod([side * x, wy(x), te(x)], [side * x, wy(x), te(x) - 0.22], 0.004, dark);
    // Narrow, gently tapered horizontal stabilizer atop the fin.
    wing(
      d,
      [
        [side * 0.08, 6.98, -10.76, -11.96, 0.095],
        [side * 3.32, 6.98, -11.3, -11.96, 0.065],
        [side * 3.65, 6.98, -11.52, -12.04, 0.04],
      ],
      paint,
    );
    const e = group(root, `ATR72-elevator-${side}`, [side * 0.12, 6.98, -11.96]),
      ed = detailKit(e, e.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.55, 0.027],
        [side * 3.2, 0, 0, -0.4, 0.023],
        [side * 3.53, 0, -0.08, -0.4, 0.018],
      ],
      accent,
    );
    ed.finish();
    // Fin/tailplane junction fairing: a slim bullet along the stabilizer root.
    if (side > 0) ellipsoid(d, [0, 7.0, -11.35], [0.14, 0.13, 0.95], paint, 16);
    bindings.push({
      node: e.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.4,
    });
  }
  const finPart = (dd, pts, m) => {
    for (const side of [-1, 1])
      sheet(
        dd,
        pts.map(([zz, yy]) => [side * 0.075, yy, zz]),
        m,
        [side, 0, 0],
      );
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      quad(
        dd,
        [-0.075, a[1], a[0]],
        [-0.075, b[1], b[0]],
        [0.075, b[1], b[0]],
        [0.075, a[1], a[0]],
        m,
        [0, 1, 0],
      );
    }
  };
  finPart(
    d,
    [
      [z(675), y(193)],
      [z(840), y(174)],
      [z(944), y(111)],
      [z(987), y(43)],
      [z(1047), 7.65],
      [z(998), y(207)],
    ],
    paint,
  );
  const pivot = group(root, 'ATR72-rudder-hinge', [0, y(207), z(998)]);
  pivot.rotation.x = -Math.atan2((1047 - 998) / ppm, 7.65 - y(207));
  const rud = group(pivot, 'ATR72-rudder'),
    rd = detailKit(rud, rud.name);
  finPart(
    rd,
    [
      [0, 0],
      [0, 4.64],
      [-0.55, 4.64],
      [-0.61, 0],
    ],
    accent,
  );
  rd.finish();
  bindings.push({
    node: rud.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.45,
  });
  // PW127M cowls and Hamilton Standard 568F six-blade propellers; individual engine drivers.
  for (const [i, side] of [1, -1].entries()) {
    const x = side * 4.05,
      ey = 3.3,
      ez = 4.48,
      eg = group(root, `engine-${i + 1}`, [x, ey, ez]),
      nd = detailKit(eg, `ATR72-nacelle-${i}`);
    const ns = [
      [0.02, 0.34, -0.48, 0.35],
      [-0.3, 0.48, -0.69, 0.49],
      [-1.05, 0.54, -0.7, 0.55],
      [-1.9, 0.49, -0.57, 0.42],
      [-2.7, 0.36, -0.35, 0.24],
      [-3.78, 0.055, -0.05, 0.055],
    ].map(([zz, w, b, t]) => ({
      z: zz,
      points: Array.from({ length: 16 }, (_, j) => {
        const a = (j * Math.PI) / 8;
        return [Math.sin(a) * w, (b + t) / 2 + (Math.cos(a) * (t - b)) / 2];
      }),
    }));
    loft(nd, ns, paint);
    // Chin intake scoop under the spinner: a painted lip around a dark mouth (ZK-MVG photo).
    ellipsoid(nd, [0, -0.43, -0.02], [0.3, 0.18, 0.12], paint, 18);
    ellipsoid(nd, [0, -0.43, 0.06], [0.25, 0.135, 0.07], dark, 18);
    for (const r of ns.slice(1, -1))
      outline(
        nd,
        r.points.map((q) => [...q, r.z]),
        0.002,
        metal,
      );
    const exhaust = group(eg, `ATR72-exhaust-${i}`, [side * 0.31, -0.39, -2.56]);
    exhaust.rotation.y = side * 0.37;
    const xd = detailKit(exhaust, exhaust.name);
    xd.add(new T.CylinderGeometry(0.18, 0.21, 0.57, 20, 1, true).rotateX(Math.PI / 2), metal);
    xd.add(new T.CircleGeometry(0.17, 20).rotateY(Math.PI), dark, [0, 0, -0.29]);
    xd.finish();
    nd.finish();
    const prop = group(eg, `ATR72-propeller-${i}`, [0, 0, 0.035]),
      pd = detailKit(prop, prop.name);
    // Spinner about 0.66 m across, nearly filling the cowl nose (ZK-MVG / F-WWEY photos).
    pd.add(new T.ConeGeometry(0.33, 0.76, 24).rotateX(Math.PI / 2), dark, [0, 0, 0.36]);
    for (let j = 0; j < 6; j++) {
      const blade = group(prop, `ATR72-blade-${i}-${j}`);
      blade.rotation.z = (j * Math.PI) / 3;
      // 568F scimitar blade: widest at mid-span, the outer third sweeping back to a narrow,
      // rounded tip (leading edge on -y, ahead in z).
      const bd = detailKit(blade, blade.name),
        pts = [
          [0.2, -0.07, 0],
          [0.5, -0.13, 0.02],
          [0.9, -0.15, 0.025],
          [1.3, -0.109, 0.02],
          [1.6, -0.015, 0.012],
          [1.85, 0.105, 0.005],
          [1.95, 0.18, 0],
          [1.98, 0.225, 0],
          [1.94, 0.258, 0],
          [1.6, 0.205, -0.02],
          [1.3, 0.171, -0.025],
          [0.9, 0.15, -0.03],
          [0.5, 0.13, -0.02],
          [0.2, 0.07, 0],
        ];
      sheet(bd, pts, dark, [0, 0, 1]);
      sheet(
        bd,
        pts.map((q) => [q[0], q[1], q[2] - 0.022]),
        dark,
        [0, 0, -1],
      );
      bd.box([0.07, 0.12, 0.024], [1.9, 0.205, -0.003], paint);
      bd.finish();
    }
    pd.finish();
    rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: eg.name });
    enginePoints.push({ id: eg.name, position: [x, ey, ez] });
  }
  // Belly sponsons and short dual-wheel main legs, unlike nacelle-mounted Dash 8 gear.
  for (const side of [-1, 1]) {
    const sg = group(root, `ATR72-sponson-${side}`, [side * 1.33, 1.21, 0.4]),
      sd = detailKit(sg, sg.name);
    loft(
      sd,
      [
        [3.3, 0.05, 0.05],
        [2.1, 0.48, 0.34],
        [0.5, 0.64, 0.44],
        [-1.6, 0.51, 0.25],
        [-2.7, 0.02, 0.035],
      ].map(([zz, w, h]) => ({
        z: zz,
        points: Array.from({ length: 12 }, (_, j) => [
          Math.sin((j * Math.PI) / 6) * w,
          Math.cos((j * Math.PI) / 6) * h,
        ]),
      })),
      paint,
    );
    sd.finish();
  }
  for (const [i, x, zz, r, top] of [
    [0, 0, 11.77, 0.28, 1.3],
    [1, 2.05, 1, 0.43, 1.36],
    [2, -2.05, 1, 0.43, 1.36],
  ]) {
    const g = group(root, `ATR72-gear-${i}`, [i ? Math.sign(x) * 1.6 : 0, top, zz]),
      gd = detailKit(g, g.name),
      dx = i ? Math.sign(x) * 0.45 : 0;
    gd.rod([0, 0, 0], [dx, r - top, 0], i ? 0.075 : 0.048, metal);
    gd.rod([0, -0.03, -0.42], [dx, r - top + 0.16, 0], 0.036, dark);
    gd.rod([dx, r - top + 0.24, 0.07], [dx, r - top + 0.07, 0.15], 0.018, metal);
    for (const off of [-0.16, 0.16]) {
      gd.add(new T.CylinderGeometry(r, r, 0.22, 28).rotateZ(Math.PI / 2), rubber, [
        dx + off,
        r - top,
        0,
      ]);
      for (const sign of [-1, 1]) {
        gd.add(new T.CircleGeometry(r * 0.52, 20).rotateY((sign * Math.PI) / 2), metal, [
          dx + off + sign * 0.112,
          r - top,
          0,
        ]);
        for (let j = 0; j < 8; j++)
          gd.add(new T.SphereGeometry(0.014, 4, 2), dark, [
            dx + off + sign * 0.114,
            r - top + Math.cos((j * Math.PI) / 4) * r * 0.34,
            Math.sin((j * Math.PI) / 4) * r * 0.34,
          ]);
      }
    }
    gd.box([i ? 0.48 : 0.45, 0.035, i ? 1.05 : 0.85], [0, 0.03, -0.12], paint);
    gd.finish();
    gearNodes.push(g.name);
    bindings.push(
      {
        node: g.name,
        source: 'gearPosition',
        property: 'position',
        axis: 'y',
        scale: i ? -1 : -0.85,
        offset: i ? 1 : 0.85,
      },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  for (const [u, h] of [
    [166, 0.19],
    [458, 0.21],
    [690, 0.16],
  ])
    d.rod([0, 3.61, z(u)], [0, 3.61 + h, z(u) - 0.1], 0.015, dark);
  d.finish();
  const interior = buildATR72Cockpit(
    root,
    {
      paint,
      accent,
      dark,
      metal,
      skinX,
      sill: glassBottom,
    },
    rings,
  );
  cleanGeometry(root);
  smoothNormals(root.getObjectByName('ATR72-nose-ATR72-ivory'));
  return {
    root,
    frame: atr72Frame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps: [], ailerons: [], animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}
