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

/** Collects flat-coloured faces; `paint` marks where the tinted body ends. */
function proxyBuilder() {
  const positions: number[] = [];
  const colors: number[] = [];
  let bodyVertices = 0;
  const triangle = (a: Point, b: Point, c: Point, color: THREE.Color): void => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const quad = (a: Point, b: Point, c: Point, d: Point, color: THREE.Color): void => {
    triangle(a, b, d, color);
    triangle(b, c, d, color);
  };
  /** An axis-aligned box from min to max corners; the bottom face is left out. */
  const box = (min: Point, max: Point, color: THREE.Color, taperTop = 1): void => {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const cx = (x0 + x1) / 2;
    const tx0 = cx + (x0 - cx) * taperTop,
      tx1 = cx + (x1 - cx) * taperTop;
    quad([x0, y0, z1], [x1, y0, z1], [tx1, y1, z1], [tx0, y1, z1], color);
    quad([x1, y0, z0], [x0, y0, z0], [tx0, y1, z0], [tx1, y1, z0], color);
    quad([x1, y0, z1], [x1, y0, z0], [tx1, y1, z0], [tx1, y1, z1], color);
    quad([x0, y0, z0], [x0, y0, z1], [tx0, y1, z1], [tx0, y1, z0], color);
    quad([tx0, y1, z1], [tx1, y1, z1], [tx1, y1, z0], [tx0, y1, z0], color);
  };
  /** An eight-sided tyre on an x axle, both caps. */
  const tyre = (
    x: number,
    z: number,
    r: number,
    width: number,
    tread: THREE.Color,
    face: THREE.Color,
  ) => {
    const rings = [-1, 1].map((side) =>
      Array.from({ length: 8 }, (_, i): Point => {
        const a = (i * Math.PI) / 4;
        return [x + (side * width) / 2, r + Math.cos(a) * r, z + Math.sin(a) * r];
      }),
    );
    const [left, right] = rings as [Point[], Point[]];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      quad(left[i] as Point, left[j] as Point, right[j] as Point, right[i] as Point, tread);
    }
    for (let i = 1; i < 7; i++) {
      triangle(right[0] as Point, right[i] as Point, right[i + 1] as Point, face);
      triangle(left[0] as Point, left[i + 1] as Point, left[i] as Point, face);
    }
  };
  return {
    triangle,
    quad,
    box,
    tyre,
    /** Everything added so far is tinted body. */
    paint(): void {
      bodyVertices = positions.length / 3;
    },
    finish(key: string): THREE.BufferGeometry {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.userData.bodyVertices = bodyVertices;
      templates.set(key, geometry);
      return geometry;
    },
  };
}

const PROXY_TYRE = new THREE.Color('#20242a');
const PROXY_WHEEL = new THREE.Color('#424950');
const PROXY_SEAT = new THREE.Color('#26292d');
const PROXY_GLASS = new THREE.Color('#4d6178');
const PROXY_CANOPY = new THREE.Color('#e2b33c');
const PROXY_PAINT = new THREE.Color('#ffffff');

/**
 * Street-distance silhouette of a parked motorcycle, scooter or moped: two tyres in line, a
 * painted body and front shield, seat and bars. About 110 triangles, one material, painted faces
 * first. Never dispose the cached result.
 */
export function twoWheelerProxyGeometry(spec: VehicleProxyDimensions): THREE.BufferGeometry {
  const { width: w, length: l, height: h, wheelbase: wb, wheelRadius: r } = spec;
  const key = `two:${w}:${l}:${h}:${wb}:${r}`;
  const cached = templates.get(key);
  if (cached) return cached;
  const b = proxyBuilder();
  const body = Math.min(0.32, w * 0.42) / 2;
  const seat = h * 0.7;
  // Body from behind the front wheel to the tail, rising to the seat; a shield ahead of the knees.
  b.box([-body, r * 0.9, -l * 0.45], [body, seat - 0.05, wb * 0.12], PROXY_PAINT, 0.85);
  b.box([-body * 1.1, r * 1.1, wb * 0.22], [body * 1.1, h * 0.82, wb * 0.36], PROXY_PAINT, 0.8);
  b.box([-0.05, r, wb * 0.36], [0.05, h * 0.84, wb * 0.46], PROXY_PAINT);
  b.paint();
  b.box(
    [-body * 0.85, seat - 0.05, -l * 0.42],
    [body * 0.85, seat + 0.04, -wb * 0.02],
    PROXY_SEAT,
    0.8,
  );
  b.box([-w * 0.45, h * 0.86, wb * 0.24], [w * 0.45, h * 0.9, wb * 0.3], PROXY_SEAT);
  for (const z of [-wb / 2, wb / 2]) b.tyre(0, z, r, 0.09, PROXY_TYRE, PROXY_WHEEL);
  return b.finish(key);
}

/**
 * Street-distance silhouette of a parked auto-rickshaw: a body tapering to the nose under a
 * canvas canopy on four posts, a windscreen, one front and two rear tyres. About 170 triangles,
 * one material, painted faces first. Never dispose the cached result.
 */
export function threeWheelerProxyGeometry(spec: VehicleProxyDimensions): THREE.BufferGeometry {
  const { width: w, length: l, height: h, wheelbase: wb, wheelTrack: track, wheelRadius: r } = spec;
  const key = `three:${w}:${l}:${h}:${wb}:${track}:${r}`;
  const cached = templates.get(key);
  if (cached) return cached;
  const b = proxyBuilder();
  const front = l / 2 - 0.05,
    rear = -l / 2;
  const belt = h * 0.55;
  // Rear tub over the rear axle, the cab floor and the rounded nose cowl over the front wheel.
  b.box([-w / 2, r * 1.3, rear], [w / 2, belt, -l * 0.12], PROXY_PAINT);
  b.box([-w * 0.42, r * 1.3, -l * 0.12], [w * 0.42, r * 1.6, front - 0.4], PROXY_PAINT);
  b.box([-w * 0.34, r * 2.3, front - 0.45], [w * 0.34, belt + 0.06, front], PROXY_PAINT, 0.7);
  b.paint();
  const roof = h - 0.06;
  b.box([-w * 0.48, roof, rear + 0.08], [w * 0.48, h, front - 0.5], PROXY_CANOPY, 0.94);
  for (const x of [-w * 0.46, w * 0.46])
    for (const z of [rear + 0.12, -0.08])
      b.box([x - 0.025, belt, z - 0.025], [x + 0.025, roof, z + 0.025], PROXY_SEAT);
  const glassZ = front - 0.48;
  b.quad(
    [-w * 0.32, belt + 0.06, glassZ + 0.06],
    [w * 0.32, belt + 0.06, glassZ + 0.06],
    [w * 0.32, roof, glassZ - 0.04],
    [-w * 0.32, roof, glassZ - 0.04],
    PROXY_GLASS,
  );
  b.tyre(0, wb / 2, r, 0.1, PROXY_TYRE, PROXY_WHEEL);
  for (const x of [-track / 2, track / 2]) b.tyre(x, -wb / 2, r, 0.1, PROXY_TYRE, PROXY_WHEEL);
  return b.finish(key);
}

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
