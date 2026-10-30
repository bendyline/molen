import * as THREE from 'three';

/** The dimensions a vehicle proxy is built from (a `VehicleSpec` satisfies it). */
export interface VehicleProxyDimensions {
  width: number;
  length: number;
  height: number;
  wheelbase: number;
  wheelTrack: number;
  wheelRadius: number;
}

const templates = new Map<string, THREE.BufferGeometry>();
type Point = [number, number, number];

/**
 * Shared street-distance silhouette for parked cars and instanced traffic. Painted faces come
 * first so a static batch can tint the body and roof without tinting the glass, tyres or lamps.
 * 148 triangles, one material, no textures or model downloads. Never dispose the cached result.
 */
export function vehicleProxyGeometry(spec: VehicleProxyDimensions): THREE.BufferGeometry {
  const { width: w, length: l, height: h, wheelbase, wheelTrack, wheelRadius: r } = spec;
  const key = `${w}:${l}:${h}:${wheelbase}:${wheelTrack}:${r}`;
  const cached = templates.get(key);
  if (cached) return cached;
  const positions: number[] = [];
  const colors: number[] = [];
  const paint = new THREE.Color('#ffffff');
  const glass = new THREE.Color('#4d6178');
  const tyre = new THREE.Color('#20242a');
  const wheelFace = new THREE.Color('#424950');
  const headlamp = new THREE.Color('#eee9d4');
  const tailLamp = new THREE.Color('#b82323');
  const triangle = (a: Point, b: Point, c: Point, color: THREE.Color): void => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const quad = (a: Point, b: Point, c: Point, d: Point, color = paint): void => {
    triangle(a, b, d, color);
    triangle(b, c, d, color);
  };
  // The hood and boot fall toward narrower bumpers; the sill leaves the tyres visible.
  const bottom = r * 1.2;
  const belt = h * 0.57;
  // Tall vehicles and short hatchbacks get a longer cabin and a more upright rear window.
  const tall = h / w > 0.9;
  const hatch = tall || l / w < 2.4;
  const rearBase = l * (hatch ? -0.44 : -0.32);
  const rearRoof = l * (hatch ? -0.34 : -0.18);
  const frontBase = l * 0.27;
  const frontRoof = l * (tall ? 0.15 : 0.1);
  const rings = [
    [-0.5, 0.44, h * 0.48],
    [rearBase / l, 0.48, belt],
    [frontBase / l, 0.48, belt],
    [0.5, 0.44, h * 0.46],
  ].map(([z = 0, x = 0, y = 0]): [Point, Point, Point, Point] => [
    [-w * x, bottom, l * z],
    [w * x, bottom, l * z],
    [w * x, y, l * z],
    [-w * x, y, l * z],
  ]);
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1] as [Point, Point, Point, Point];
    const b = rings[i] as [Point, Point, Point, Point];
    for (let j = 0; j < 4; j++)
      quad(a[j] as Point, a[(j + 1) % 4] as Point, b[(j + 1) % 4] as Point, b[j] as Point);
  }
  const rear = rings[0] as [Point, Point, Point, Point];
  const front = rings[3] as [Point, Point, Point, Point];
  quad(rear[3], rear[2], rear[1], rear[0]);
  quad(front[0], front[1], front[2], front[3]);

  const lower = w * 0.44;
  const upper = w * 0.36;
  const back: [Point, Point, Point, Point] = [
    [-lower, belt, rearBase],
    [lower, belt, rearBase],
    [upper, h, rearRoof],
    [-upper, h, rearRoof],
  ];
  const nose: [Point, Point, Point, Point] = [
    [-lower, belt, frontBase],
    [lower, belt, frontBase],
    [upper, h, frontRoof],
    [-upper, h, frontRoof],
  ];
  const cabinFaces: [Point, Point, Point, Point][] = [
    [back[0], nose[0], nose[3], back[3]],
    [nose[1], back[1], back[2], nose[2]],
    [back[1], back[0], back[3], back[2]],
    [nose[0], nose[1], nose[2], nose[3]],
  ];
  for (const face of cabinFaces) quad(...face);
  quad(back[3], nose[3], nose[2], back[2]);
  const bodyVertices = positions.length / 3;

  // Inset panes leave painted pillars, a belt line and a roof frame. Separate side panes retain
  // a B pillar instead of making the whole cabin one dark block.
  for (let side = 0; side < cabinFaces.length; side++) {
    const [a, b, c, d] = cabinFaces[side] as [Point, Point, Point, Point];
    const normal = new THREE.Vector3()
      .subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
      .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...d), new THREE.Vector3(...a)))
      .normalize()
      .multiplyScalar(0.003);
    const point = (u: number, v: number): Point =>
      new THREE.Vector3(...a)
        .lerp(new THREE.Vector3(...b), u)
        .lerp(new THREE.Vector3(...d).lerp(new THREE.Vector3(...c), u), v)
        .add(normal)
        .toArray();
    for (const [start = 0, end = 1] of side < 2
      ? [
          [0.06, 0.47],
          [0.53, 0.94],
        ]
      : [[0.07, 0.93]])
      quad(point(start, 0.12), point(end, 0.12), point(end, 0.9), point(start, 0.9), glass);
  }

  // Eight-sided tyres, with only the outward cap (the inner cap is hidden under the body).
  // The tread reaches the body's edge even when the type has a narrow wheel track.
  const halfTyre = Math.max(w * 0.05, (w - wheelTrack) / 2);
  for (const sign of [-1, 1]) {
    const inner = sign * (wheelTrack / 2 - halfTyre);
    const outer = sign * (wheelTrack / 2 + halfTyre);
    for (const z of [-wheelbase / 2, wheelbase / 2]) {
      const rim: Point[] = [];
      const inside: Point[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (sign * i * Math.PI) / 4;
        const y = r + Math.cos(angle) * r;
        const depth = z + Math.sin(angle) * r;
        rim.push([outer, y, depth]);
        inside.push([inner, y, depth]);
      }
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        quad(inside[i] as Point, inside[j] as Point, rim[j] as Point, rim[i] as Point, tyre);
      }
      for (let i = 1; i < 7; i++)
        triangle(rim[0] as Point, rim[i] as Point, rim[i + 1] as Point, wheelFace);
    }
  }
  for (const end of [-1, 1]) {
    const z = end * (l / 2 + 0.003);
    const y = h * (end > 0 ? 0.46 : 0.48);
    for (const side of [-1, 1]) {
      const x = side * w * 0.31;
      const a: Point = [x - w * 0.095, y - h * 0.1, z];
      const b: Point = [x + w * 0.095, y - h * 0.1, z];
      const c: Point = [b[0], y - h * 0.025, z];
      const d: Point = [a[0], c[1], z];
      if (end > 0) quad(a, b, c, d, headlamp);
      else quad(d, c, b, a, tailLamp);
    }
  }
  quad(
    [-w * 0.18, bottom, l / 2 + 0.004],
    [w * 0.18, bottom, l / 2 + 0.004],
    [w * 0.18, h * 0.36, l / 2 + 0.004],
    [-w * 0.18, h * 0.36, l / 2 + 0.004],
    tyre,
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.bodyVertices = bodyVertices;
  templates.set(key, geometry);
  return geometry;
}
