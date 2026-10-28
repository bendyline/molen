/** Faceted, opaque, bounded animal families. One skinned draw per animal; shared recipe geometry. */
import * as THREE from 'three';
import type { WildlifeSpecies } from '../kernel/wildlife-types';

export type WildlifeTier = 0 | 1 | 2;
export interface WildlifeJoint {
  name: string;
  pivot: [number, number, number];
}
export interface WildlifeGeometry {
  geometry: THREE.BufferGeometry;
  joints: WildlifeJoint[];
  triangles: number;
}

/** +Z is the head/front. All geometry is baked in bind pose and skin weights are rigid. */
export function wildlifeGeometry(species: WildlifeSpecies, tier: WildlifeTier): WildlifeGeometry {
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    skin: number[] = [],
    weights: number[] = [];
  const joints: WildlifeJoint[] = [{ name: 'body', pivot: [0, 0, 0] }];
  const body = species.body,
    h = body.height,
    l = body.length,
    w = body.width;
  const detail = (name: (typeof body.details)[number]): boolean => body.details.includes(name);
  const joint = (name: string, pivot: [number, number, number]): number => {
    joints.push({ name, pivot });
    return joints.length - 1;
  };
  const add = (
    geometry: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    color: string,
    bone = 0,
  ): void => {
    const source = geometry.index === null ? geometry : geometry.toNonIndexed();
    source.applyMatrix4(matrix);
    source.computeVertexNormals();
    const p = source.getAttribute('position'),
      n = source.getAttribute('normal');
    const c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colors.push(c.r, c.g, c.b);
      skin.push(bone, 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
    source.dispose();
    if (source !== geometry) geometry.dispose();
  };
  const ellipsoid = (
    center: [number, number, number],
    size: [number, number, number],
    color = body.color,
    bone = 0,
    pitch = 0,
  ): void => {
    add(
      new THREE.SphereGeometry(
        1,
        tier === 0 ? 8 : tier === 1 ? 6 : 4,
        tier === 0 ? 5 : tier === 1 ? 4 : 3,
      ),
      new THREE.Matrix4().compose(
        new THREE.Vector3(...center),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch),
        new THREE.Vector3(...size),
      ),
      color,
      bone,
    );
  };
  // Striped coats: an ellipsoid lofted in rings along Z, each band colored by its world Z, so
  // stripes run continuously across neighbouring body masses with nothing standing proud.
  const stripe = (z: number): string =>
    Math.sin((z / l) * Math.PI * 2 * 8.5) > 0.15 ? body.accent : body.color;
  const barrel = (center: [number, number, number], size: [number, number, number]): void => {
    const rings = tier === 0 ? 14 : 8,
      sides = tier === 0 ? 8 : 6;
    const ring = (i: number): Array<[number, number, number]> => {
      const u = -1 + (2 * i) / rings,
        r = Math.sqrt(Math.max(0, 1 - u * u));
      return Array.from({ length: sides }, (_, k) => {
        const a = (k / sides) * Math.PI * 2;
        return [
          center[0] + Math.cos(a) * size[0] * r,
          center[1] + Math.sin(a) * size[1] * r,
          center[2] + u * size[2],
        ];
      });
    };
    for (let i = 0; i < rings; i++) {
      const [a, b] = [ring(i), ring(i + 1)];
      const positions: number[] = [];
      for (let k = 0; k < sides; k++) {
        const n = (k + 1) % sides;
        type Point = [number, number, number];
        const [p, q, r, s] = [a[k], b[k], b[n], a[n]] as [Point, Point, Point, Point];
        // Skip the zero-area triangle where a ring collapses to a pole.
        if (i < rings - 1) positions.push(...p, ...r, ...q);
        if (i > 0) positions.push(...p, ...s, ...r);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      add(geometry, new THREE.Matrix4(), stripe(center[2] + (-1 + (2 * i + 1) / rings) * size[2]));
    }
  };
  const segment = (
    a: [number, number, number],
    b: [number, number, number],
    r1: number,
    r2: number,
    color = body.color,
    bone = 0,
  ): void => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = end.clone().sub(start);
    add(
      new THREE.CylinderGeometry(r2, r1, delta.length(), tier === 0 ? 6 : 4, 1, false),
      new THREE.Matrix4().compose(
        start.add(end).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
        new THREE.Vector3(1, 1, 1),
      ),
      color,
      bone,
    );
  };
  const wedge = (
    points: Array<[number, number, number]>,
    thickness: number,
    color: string,
    bone: number,
  ): void => {
    // Closed triangular prism: opaque wings/fins remain visible from both sides without alpha.
    const [a, b, c] = points;
    if (a === undefined || b === undefined || c === undefined) return;
    const vertices = [
      a,
      b,
      c,
      [a[0], a[1] + thickness, a[2]],
      [b[0], b[1] + thickness, b[2]],
      [c[0], c[1] + thickness, c[2]],
    ];
    const indices = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
    geometry.setIndex(indices);
    add(geometry, new THREE.Matrix4(), color, bone);
  };
  const eye = (x: number, y: number, z: number, radius: number, bone = 0): void => {
    if (tier !== 0) return;
    ellipsoid([x, y, z], [radius, radius, radius * 0.55], '#272a26', bone);
  };

  if (body.family === 'bird' || body.family === 'insect') {
    const insect = body.family === 'insect';
    const flying = species.motion === 'fly';
    const y = flying ? 0 : detail('wader') ? h * 0.66 : h * 0.48;
    ellipsoid([0, y, 0], [w * 0.5, h * (detail('wader') ? 0.19 : 0.3), l * 0.38]);
    const headY = y + h * (detail('wader') ? 0.23 : 0.21),
      headZ = l * 0.36;
    if (detail('wader')) segment([0, y, l * 0.2], [0, headY, headZ], w * 0.16, w * 0.12);
    ellipsoid([0, headY, headZ], [w * 0.32, h * 0.17, l * 0.17], body.accent);
    segment(
      [0, headY, l * 0.46],
      [0, headY - h * 0.035, l * (detail('wader') ? 0.87 : 0.66)],
      w * 0.1,
      w * 0.012,
      '#a2966e',
    );
    eye(-w * 0.27, headY + h * 0.035, l * 0.45, h * 0.045);
    eye(w * 0.27, headY + h * 0.035, l * 0.45, h * 0.045);
    for (const side of [-1, 1]) {
      const wing = joint(side < 0 ? 'wing.l' : 'wing.r', [side * w * 0.25, y, l * 0.04]);
      if (flying) {
        const span = l * (detail('raptor') ? 1.65 : insect ? 0.9 : 1.05);
        if (insect)
          wedge(
            [
              [side * w * 0.25, y, l * 0.25],
              [side * span, y - h * 0.08, -l * 0.1],
              [side * w * 0.4, y, -l * 0.42],
            ],
            h * 0.045,
            body.accent,
            wing,
          );
        else {
          // A bird's wing bends at the wrist: the arm rises from the body (dihedral) and the
          // hand sweeps back to the tip, so the silhouette is never one flat sheet.
          const lift = h * (detail('raptor') ? 0.06 : 0.14);
          const rootFront: [number, number, number] = [side * w * 0.25, y, l * 0.22];
          const rootBack: [number, number, number] = [side * w * 0.35, y, -l * 0.3];
          const wrist: [number, number, number] = [side * span * 0.48, y + lift, l * 0.06];
          const wristBack: [number, number, number] = [side * span * 0.5, y + lift, -l * 0.24];
          const tip: [number, number, number] = [side * span, y + h * 0.02, -l * 0.16];
          wedge([rootFront, wrist, rootBack], h * 0.045, body.accent, wing);
          wedge([wrist, wristBack, rootBack], h * 0.045, body.accent, wing);
          wedge([wrist, tip, wristBack], h * 0.04, body.accent, wing);
        }
        if (tier === 0 && !insect)
          for (let i = 0; i < 3; i++)
            wedge(
              [
                [side * span * (0.65 + i * 0.1), y - h * 0.05, -l * 0.04],
                [side * span * (0.82 + i * 0.1), y - h * 0.08, -l * (0.23 + i * 0.03)],
                [side * span * (0.61 + i * 0.1), y, -l * 0.22],
              ],
              h * 0.025,
              body.color,
              wing,
            );
      } else
        ellipsoid(
          [side * w * 0.38, y + h * 0.05, -l * 0.03],
          [w * 0.16, h * 0.2, l * 0.34],
          body.accent,
          wing,
        );
      if (!flying && species.motion !== 'swim') {
        const leg = joint(side < 0 ? 'leg.l' : 'leg.r', [side * w * 0.2, y, 0]);
        segment(
          [side * w * 0.2, y, 0],
          [side * w * 0.2, h * 0.03, l * 0.04],
          w * 0.045,
          w * 0.03,
          '#655f4a',
          leg,
        );
        segment(
          [side * w * 0.2, h * 0.03, l * 0.04],
          [side * w * 0.2, h * 0.03, l * 0.18],
          w * 0.03,
          w * 0.025,
          '#655f4a',
          leg,
        );
      }
    }
    wedge(
      [
        [-w * 0.22, y, -l * 0.3],
        [w * 0.22, y, -l * 0.3],
        [0, y - h * 0.08, -l * (detail('long-tail') ? 1 : 0.64)],
      ],
      h * 0.05,
      body.accent,
      0,
    );
  } else if (body.family === 'fish') {
    ellipsoid([0, 0, 0], [w * 0.5, h * 0.48, l * 0.4]);
    const tail = joint('tail', [0, 0, -l * 0.32]);
    // Tail is vertical. A narrow closed ellipsoid supplies a sturdy fork-free distant silhouette.
    ellipsoid([0, 0, -l * 0.5], [w * 0.08, h * 0.65, l * 0.13], body.accent, tail);
    for (const side of [-1, 1])
      wedge(
        [
          [side * w * 0.2, 0, l * 0.1],
          [side * w, -h * 0.12, -l * 0.18],
          [side * w * 0.25, 0, -l * 0.2],
        ],
        h * 0.04,
        body.accent,
        0,
      );
    eye(-w * 0.4, h * 0.14, l * 0.25, h * 0.09);
    eye(w * 0.4, h * 0.14, l * 0.25, h * 0.09);
  } else if (body.family === 'reptile') {
    // A low, flat head, outward elbows and a long taper distinguish lizards from mammals.
    ellipsoid([0, h * 0.48, -l * 0.05], [w * 0.5, h * 0.28, l * 0.36]);
    const head = joint('head', [0, h * 0.44, l * 0.28]);
    ellipsoid([0, h * 0.43, l * 0.39], [w * 0.34, h * 0.2, l * 0.18], body.color, head);
    for (const side of [-1, 1]) {
      eye(side * w * 0.29, h * 0.54, l * 0.42, h * 0.045, head);
      for (const front of [false, true]) {
        const z = (front ? 1 : -1) * l * 0.22;
        const pivot: [number, number, number] = [side * w * 0.35, h * 0.4, z];
        const leg = joint(`leg.${front ? 'front' : 'rear'}.${side < 0 ? 'l' : 'r'}`, pivot);
        const knee: [number, number, number] = [
          side * w * 0.85,
          h * 0.2,
          z + (front ? -1 : 1) * l * 0.09,
        ];
        const foot: [number, number, number] = [
          side * w * 0.98,
          h * 0.04,
          z + (front ? 1 : -1) * l * 0.1,
        ];
        segment(pivot, knee, w * 0.12, w * 0.08, body.color, leg);
        segment(knee, foot, w * 0.08, w * 0.035, body.color, leg);
        if (tier < 2) ellipsoid(foot, [w * 0.12, h * 0.025, l * 0.055], body.accent, leg);
      }
    }
    const tail = joint('tail', [0, h * 0.4, -l * 0.34]);
    const bend: [number, number, number] = [w * 0.12, h * 0.14, -l * 0.77];
    segment([0, h * 0.4, -l * 0.34], bend, w * 0.22, w * 0.1, body.color, tail);
    segment(bend, [w * 0.32, h * 0.06, -l * 1.3], w * 0.1, w * 0.005, body.color, tail);
  } else {
    const hopper = body.family === 'hopper',
      low = ['rodent', 'lagomorph'].includes(body.family),
      elephant = body.family === 'elephant',
      ungulate = body.family === 'ungulate';
    const torsoY = h * (hopper ? 0.57 : low ? 0.5 : 0.72);
    const torsoRadius = h * (hopper ? 0.3 : low ? 0.31 : elephant ? 0.32 : 0.19);
    const striped = detail('stripes') && tier < 2;
    const mass = striped ? barrel : ellipsoid;
    mass([0, torsoY, -l * 0.04], [w * 0.5, torsoRadius, l * (hopper ? 0.28 : 0.38)]);
    if (!hopper && tier < 2) {
      // A deeper chest and a rounded rump give the back line shoulders and hips.
      mass([0, torsoY - torsoRadius * 0.08, l * 0.2], [w * 0.47, torsoRadius * 1.1, l * 0.17]);
      mass([0, torsoY + torsoRadius * 0.06, -l * 0.27], [w * 0.48, torsoRadius * 0.98, l * 0.15]);
    }
    if (tier === 0)
      ellipsoid(
        [0, torsoY - torsoRadius * 0.48, l * 0.04],
        [w * 0.39, torsoRadius * 0.62, l * 0.29],
        elephant ? body.color : body.accent,
      );
    const neckTop =
      h * (hopper ? 0.92 : low ? 0.61 : elephant ? 0.9 : detail('long-neck') ? 1.38 : 1.1);
    const headZ = l * (hopper ? 0.3 : 0.47),
      headR = h * (elephant ? 0.18 : low ? 0.23 : 0.13);
    if (detail('palmate') && tier < 2)
      // Moose: a high shoulder hump over the withers.
      ellipsoid(
        [0, torsoY + torsoRadius * 0.75, l * 0.19],
        [w * 0.3, torsoRadius * 0.55, l * 0.15],
        body.color,
      );
    segment(
      [0, torsoY, l * 0.27],
      [0, neckTop - headR * 0.4, headZ - l * 0.07],
      w * (elephant ? 0.4 : low ? 0.32 : 0.23),
      w * (low ? 0.28 : 0.17),
    );
    if (detail('mane') && tier < 2) {
      // Upright mane: one narrow crest pitched along the top of the neck.
      const dy = neckTop - headR * 0.4 - torsoY,
        dz = headZ - l * 0.34;
      const pitch = Math.atan2(-dy, dz),
        lift = w * 0.19;
      ellipsoid(
        [0, torsoY + dy / 2 + Math.cos(pitch) * lift, l * 0.27 + dz / 2 + Math.sin(pitch) * lift],
        [w * 0.035, h * 0.06, Math.hypot(dy, dz) * 0.55],
        body.accent,
        0,
        pitch,
      );
    }
    const head = joint('head', [0, neckTop - headR * 0.6, headZ - l * 0.06]);
    ellipsoid(
      [0, neckTop, headZ],
      [w * (elephant ? 0.4 : low ? 0.34 : 0.28), headR, l * (elephant || low ? 0.16 : 0.12)],
      body.color,
      head,
    );
    if (!elephant) {
      // Grazers carry a long face angled down to a broad muzzle; a moose's overhangs.
      const long = detail('palmate') ? 1.3 : 1;
      ellipsoid(
        [0, neckTop - headR * (ungulate ? 0.38 : 0.28), headZ + l * 0.1 * long],
        [w * (detail('palmate') ? 0.2 : 0.16), headR * 0.52, l * 0.075 * long],
        ungulate ? body.color : body.accent,
        head,
      );
      if (ungulate && tier === 0)
        // Dark nose pad at the tip of the face.
        ellipsoid(
          [0, neckTop - headR * 0.36, headZ + l * 0.17 * long],
          [w * 0.12, headR * 0.3, l * 0.012],
          '#2e2a26',
          head,
        );
      if (detail('palmate') && tier < 2)
        // The bell: a dewlap hanging under the throat.
        ellipsoid(
          [0, neckTop - headR * 1.2, headZ - l * 0.02],
          [w * 0.05, headR * 0.6, l * 0.03],
          body.color,
          head,
        );
    }
    for (const side of [-1, 1]) {
      const earHeight =
        body.family === 'lagomorph'
          ? h * 0.45
          : hopper
            ? h * 0.2
            : elephant
              ? h * 0.25
              : low
                ? h * 0.075
                : h * 0.11;
      ellipsoid(
        [
          side * w * (elephant ? 0.52 : 0.22),
          neckTop + headR * (elephant ? 0.15 : 0.8),
          headZ - l * 0.04,
        ],
        [w * (elephant ? 0.35 : 0.1), earHeight, l * 0.035],
        elephant || detail('stripes') ? body.color : body.accent,
        head,
      );
      eye(
        side * w * (low ? 0.3 : 0.25),
        neckTop + headR * 0.1,
        headZ + l * 0.09,
        headR * 0.1,
        head,
      );
      const horn = '#817963';
      const base: [number, number, number] = [
        side * w * 0.2,
        neckTop + headR * 0.8,
        headZ - l * 0.02,
      ];
      const along = (
        a: [number, number, number],
        b: [number, number, number],
        t: number,
      ): [number, number, number] => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
      if (detail('palmate')) {
        // Palmate antlers: a short beam out to a broad, flat palm fringed with tines.
        const root: [number, number, number] = [
          side * w * 0.45,
          neckTop + h * 0.08,
          headZ - l * 0.05,
        ];
        if (tier < 2) segment(base, root, w * 0.05, w * 0.04, horn, head);
        const front: [number, number, number] = [
          side * w * 1.05,
          neckTop + h * 0.2,
          headZ + l * 0.02,
        ];
        const back: [number, number, number] = [
          side * w * 1.0,
          neckTop + h * 0.16,
          headZ - l * 0.16,
        ];
        wedge([root, front, back], h * 0.025, horn, head);
        if (tier < 2)
          for (let i = 0; i < (tier === 0 ? 5 : 2); i++) {
            const at = along(front, back, (i + 0.5) / (tier === 0 ? 5 : 2));
            segment(
              at,
              [at[0] + side * w * 0.12, at[1] + h * 0.07, at[2]],
              w * 0.025,
              w * 0.008,
              horn,
              head,
            );
          }
      } else if (detail('antlers')) {
        // Main beam sweeping up and back, tines rising forward from it.
        const bend: [number, number, number] = [side * w * 0.5, neckTop + h * 0.2, headZ - l * 0.1];
        const tip: [number, number, number] = [
          side * w * 0.42,
          neckTop + h * 0.38,
          headZ - l * 0.03,
        ];
        if (tier === 2) segment(base, tip, w * 0.045, w * 0.013, horn, head);
        else {
          segment(base, bend, w * 0.045, w * 0.032, horn, head);
          segment(bend, tip, w * 0.032, w * 0.012, horn, head);
        }
        if (tier < 2)
          for (let branch = 0; branch < (tier === 0 ? 3 : 1); branch++) {
            const from =
              branch === 0 ? along(base, bend, 0.45) : along(bend, tip, branch === 1 ? 0.2 : 0.6);
            segment(
              from,
              [from[0] + side * w * 0.04, from[1] + h * 0.11, from[2] + l * 0.06],
              w * 0.024,
              w * 0.008,
              horn,
              head,
            );
          }
      } else if (detail('straight-horns')) {
        // Oryx type: long, nearly straight horns swept back in line with the face.
        segment(
          base,
          [side * w * 0.16, neckTop + h * 0.5, headZ - l * 0.28],
          w * 0.04,
          w * 0.01,
          horn,
          head,
        );
      } else if (detail('horns')) {
        // Lyre-shaped horns: out and back, then up and in at the tips.
        const mid: [number, number, number] = [
          side * w * 0.36,
          neckTop + h * 0.2,
          headZ - l * 0.08,
        ];
        const tip: [number, number, number] = [
          side * w * 0.26,
          neckTop + h * 0.38,
          headZ - l * 0.02,
        ];
        if (tier === 2) segment(base, tip, w * 0.042, w * 0.01, horn, head);
        else {
          segment(base, mid, w * 0.042, w * 0.028, horn, head);
          segment(mid, tip, w * 0.028, w * 0.01, horn, head);
        }
      }
      for (const front of [false, true]) {
        const legZ = (front ? 1 : -1) * l * (hopper ? 0.15 : 0.25);
        const pivot: [number, number, number] = [side * w * 0.34, torsoY - torsoRadius * 0.2, legZ];
        const leg = joint(`leg.${front ? 'front' : 'rear'}.${side < 0 ? 'l' : 'r'}`, pivot);
        const footY = hopper && front ? h * 0.42 : h * 0.055;
        const radius = w * (elephant ? 0.2 : hopper && !front ? 0.22 : low ? 0.13 : 0.1);
        if (hopper || elephant || tier === 2) {
          // Pillar legs (elephants), a kangaroo's folded limbs, and the far tier keep two parts.
          const knee: [number, number, number] = [
            pivot[0],
            (pivot[1] + footY) * 0.5,
            legZ + (hopper && !front ? l * 0.14 : -l * 0.02),
          ];
          segment(pivot, knee, radius, radius * 0.7, body.color, leg);
          segment(knee, [pivot[0], footY, legZ], radius * 0.7, radius * 0.46, body.color, leg);
        } else {
          // Jointed legs: a forearm down to the knee in front; behind, the thigh runs forward to
          // the stifle and the shank back to the hock, the angle that reads as a running animal.
          const x = pivot[0];
          const bends: Array<[number, number, number]> = front
            ? [
                [x, torsoY - torsoRadius * 0.9, legZ - l * 0.035],
                [x, h * (low ? 0.17 : 0.3), legZ - l * 0.005],
                [x, footY + h * 0.035, legZ + l * 0.008],
              ]
            : [
                [x, pivot[1] - (pivot[1] - footY) * 0.38, legZ + l * 0.07],
                [x, h * (low ? 0.16 : 0.31), legZ - l * 0.075],
                [x, footY + h * 0.035, legZ - l * 0.045],
              ];
          const radii = front ? [1.45, 0.95, 0.6, 0.5] : [1.6, 1.05, 0.6, 0.5];
          let from = pivot;
          bends.forEach((to, i) => {
            segment(
              from,
              to,
              radius * (radii[i] as number),
              radius * (radii[i + 1] as number),
              body.color,
              leg,
            );
            from = to;
          });
        }
        if (tier < 2) {
          const longFoot = (hopper || body.family === 'lagomorph') && !front;
          ellipsoid(
            [pivot[0], footY, legZ + (longFoot ? l * 0.08 : front ? l * 0.02 : -l * 0.03)],
            [
              radius * 0.65,
              Math.max(h * 0.025, hopper && front ? footY * 0.65 : h * 0.03),
              l * (longFoot ? 0.14 : 0.055),
            ],
            elephant ? body.color : ungulate ? '#3a3530' : body.accent,
            leg,
          );
        }
      }
    }
    const tail = joint('tail', [0, torsoY, -l * 0.34]);
    if (body.family === 'rodent' && detail('bushy-tail')) {
      // Squirrels carry a full plume that rises along the back and curls over at the top.
      segment(
        [0, torsoY, -l * 0.34],
        [0, h * 0.62, -l * 0.6],
        w * 0.19,
        w * 0.22,
        body.color,
        tail,
      );
      ellipsoid([0, h * 0.72, -l * 0.66], [w * 0.34, h * 0.3, l * 0.2], body.color, tail);
      ellipsoid([0, h * 1.08, -l * 0.62], [w * 0.36, h * 0.28, l * 0.2], body.color, tail);
      if (tier < 2)
        ellipsoid([0, h * 1.28, -l * 0.45], [w * 0.3, h * 0.17, l * 0.18], body.color, tail);
    } else if (
      detail('long-tail') ||
      detail('bushy-tail') ||
      ['canid', 'feline', 'elephant'].includes(body.family)
    ) {
      const end: [number, number, number] = [
        0,
        elephant ? h * 0.12 : hopper ? h * 0.08 : torsoY * 0.55,
        -l * (elephant ? 0.44 : detail('long-tail') ? 1.1 : 0.88),
      ];
      segment(
        [0, torsoY, -l * 0.34],
        end,
        w * (detail('bushy-tail') ? 0.2 : hopper ? 0.18 : 0.06),
        w * 0.025,
        body.color,
        tail,
      );
      if (detail('bushy-tail'))
        ellipsoid([0, torsoY * 0.72, -l * 0.68], [w * 0.22, h * 0.14, l * 0.2], body.accent, tail);
    } else if (body.family !== 'rodent')
      ellipsoid([0, torsoY, -l * 0.39], [w * 0.1, h * 0.05, l * 0.05], body.accent, tail);
    if (elephant) {
      const trunk = joint('trunk', [0, neckTop - headR * 0.3, headZ + l * 0.11]);
      segment(
        [0, neckTop - headR * 0.3, headZ + l * 0.11],
        [0, h * 0.38, headZ + l * 0.17],
        w * 0.14,
        w * 0.09,
        body.color,
        trunk,
      );
      segment(
        [0, h * 0.38, headZ + l * 0.17],
        [0, h * 0.16, headZ + l * 0.22],
        w * 0.09,
        w * 0.04,
        body.color,
        trunk,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, joints, triangles: positions.length / 9 };
}
