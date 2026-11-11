import type { RailVehicleProfile } from '@bendyline/molen-schema';
import * as THREE from 'three';

/** What a rail vehicle stand-in is built from (a rail `VehicleSpec` satisfies it). */
export interface RailVehicleProxyDimensions {
  width: number;
  length: number;
  height: number;
  wheelRadius: number;
  rail?: { truckCenters: number; profile?: RailVehicleProfile };
}

const templates = new Map<string, THREE.BufferGeometry>();
type Point = readonly [number, number, number];

const PAINT = new THREE.Color('#ffffff');
const GEAR = new THREE.Color('#25282b');
const DECK = new THREE.Color('#34322f');
const GLASS = new THREE.Color('#1b252d');
const SCRAP = new THREE.Color('#5d554b');

/**
 * Low-detail stand-in for a rail vehicle seen from a distance: a parked cut of cars in a yard, or
 * far traffic. One silhouette per `rail.profile` (boxcar, covered hopper, tank car, gondola,
 * flatcar with a load, double-stack well car, autorack, road locomotive, bilevel coach, light-rail
 * car) over two dark trucks. Front +Z, +X the left side, y = 0 the top of rail. The painted faces
 * come first (`userData.bodyVertices`) so a batch tints the body and never the running gear.
 * A few dozen triangles, one material, no textures. Never dispose the cached result.
 */
export function railVehicleProxyGeometry(spec: RailVehicleProxyDimensions): THREE.BufferGeometry {
  const profile = spec.rail?.profile ?? 'box';
  const W = spec.width,
    L = spec.length,
    H = spec.height,
    r = spec.wheelRadius;
  const tc = spec.rail?.truckCenters ?? L * 0.7;
  const key = `${profile}:${W}:${L}:${H}:${r}:${tc}`;
  const cached = templates.get(key);
  if (cached) return cached;
  const positions: number[] = [];
  const colors: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, color: THREE.Color): void => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const quad = (a: Point, b: Point, c: Point, d: Point, color: THREE.Color): void => {
    triangle(a, b, c, color);
    triangle(a, c, d, color);
  };
  /**
   * A six-sided block: a `w0` by `l0` rectangle at `y0` under a `w1` by `l1` one at `y1`, centered
   * on (x, z). Tapering the bottom makes a hopper's slopes; the underside is left open.
   */
  const block = (
    x: number,
    z: number,
    y0: number,
    y1: number,
    w0: number,
    l0: number,
    color: THREE.Color,
    w1 = w0,
    l1 = l0,
  ): void => {
    const p = (w: number, l: number, y: number, sx: number, sz: number): Point => [
      x + (sx * w) / 2,
      y,
      z + (sz * l) / 2,
    ];
    const c: Point[] = [
      p(w0, l0, y0, -1, -1),
      p(w0, l0, y0, 1, -1),
      p(w0, l0, y0, 1, 1),
      p(w0, l0, y0, -1, 1),
      p(w1, l1, y1, -1, -1),
      p(w1, l1, y1, 1, -1),
      p(w1, l1, y1, 1, 1),
      p(w1, l1, y1, -1, 1),
    ];
    const [a, b, e, d, f, g, h, k] = c as [Point, Point, Point, Point, Point, Point, Point, Point];
    quad(f, k, h, g, color); // top
    quad(a, f, g, b, color); // rear (-Z)
    quad(b, g, h, e, color); // +X
    quad(e, h, k, d, color); // front (+Z)
    quad(d, k, f, a, color); // -X
  };
  /** A cylinder along Z (a tank) with closed ends. */
  const barrel = (y: number, radius: number, length: number, color: THREE.Color): void => {
    const sides = 10;
    const ring = (angle: number, z: number): Point => [
      Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      z,
    ];
    const z0 = -length / 2,
      z1 = length / 2;
    for (let i = 0; i < sides; i++) {
      const t0 = (i / sides) * Math.PI * 2,
        t1 = ((i + 1) / sides) * Math.PI * 2;
      quad(ring(t0, z0), ring(t1, z0), ring(t1, z1), ring(t0, z1), color);
      triangle([0, y, z1], ring(t0, z1), ring(t1, z1), color);
      triangle([0, y, z0], ring(t1, z0), ring(t0, z0), color);
    }
  };
  /** A dark band (windows) on both sides, a hair outside the body. */
  const windows = (y0: number, y1: number, half: number, length: number): void => {
    for (const side of [-1, 1]) {
      const x = side * (half + 0.01);
      const a: Point = [x, y0, -length / 2];
      const b: Point = [x, y0, length / 2];
      const c: Point = [x, y1, length / 2];
      const d: Point = [x, y1, -length / 2];
      if (side > 0) quad(a, d, c, b, GLASS);
      else quad(a, b, c, d, GLASS);
    }
  };
  const deck = Math.max(1.05, r * 2 + 0.15);

  // Painted body first.
  switch (profile) {
    case 'hopper':
      block(0, 0, 2.2, H - 0.12, W * 0.97, L * 0.94, PAINT);
      block(0, 0, deck - 0.1, 2.2, W * 0.58, L * 0.6, PAINT, W * 0.97, L * 0.94);
      block(0, 0, H - 0.12, H, W * 0.97, L * 0.94, PAINT, W * 0.55, L * 0.92);
      break;
    case 'tank': {
      const radius = Math.min(W * 0.48, (H - deck) / 2);
      barrel(H - radius, radius, L * 0.94, PAINT);
      break;
    }
    case 'gondola':
      for (const side of [-1, 1]) {
        block((side * (W - 0.14)) / 2, 0, deck, H, 0.14, L * 0.98, PAINT);
        block(0, (side * (L * 0.98 - 0.14)) / 2, deck, H, W, 0.14, PAINT);
      }
      break;
    case 'flat':
      // The load (wrapped lumber) takes the paint; the car is the dark deck and centerbeam.
      for (const side of [-1, 1])
        block((side * (W / 2 + 0.18)) / 2, 0, deck + 0.25, H - 0.2, W / 2 - 0.3, L * 0.88, PAINT);
      break;
    case 'well': {
      const box = Math.min(2.6, W * 0.8);
      const split = Math.max(deck + 1, (H + 0.4) / 2);
      block(0, 0, 0.45, split, box, L * 0.74, PAINT);
      block(0, 0, split + 0.02, H, box, L * 0.74, PAINT);
      break;
    }
    case 'locomotive': {
      const cab = L * 0.17;
      block(
        0,
        -L / 2 + (L / 2 + cab) / 2,
        deck + 0.25,
        H - 0.4,
        W * 0.62,
        L / 2 + cab - 0.3,
        PAINT,
      );
      block(0, cab + L * 0.08, deck + 0.25, H, W * 0.95, L * 0.16, PAINT);
      block(0, L * 0.415, deck + 0.25, Math.min(H, deck + 1.55), W * 0.86, L * 0.15, PAINT);
      break;
    }
    case 'coach':
    case 'railcar': {
      const floor = profile === 'coach' ? 0.55 : 0.4;
      block(0, 0, floor, H - 0.3, W, L * 0.99, PAINT);
      block(0, 0, H - 0.3, H, W, L * 0.99, PAINT, W * 0.7, L * 0.97);
      break;
    }
    default:
      block(0, 0, deck + 0.2, H, W * 0.98, L * 0.98, PAINT);
  }
  const bodyVertices = positions.length / 3;

  // Unpainted detail: decks, windows, loads and the trucks.
  switch (profile) {
    case 'box':
    case 'autorack':
    case 'hopper':
      block(0, 0, deck - 0.05, deck + 0.2, W * 0.9, L, DECK);
      break;
    case 'tank':
      block(0, 0, deck - 0.1, deck + 0.35, 0.7, L * 0.9, DECK);
      break;
    case 'gondola':
      block(0, 0, deck - 0.1, deck + 0.1, W, L, DECK);
      block(
        0,
        0,
        deck + 0.1,
        Math.max(deck + 0.4, H - 0.45),
        W - 0.4,
        L * 0.85,
        SCRAP,
        W * 0.6,
        L * 0.6,
      );
      break;
    case 'flat':
      block(0, 0, deck - 0.1, deck + 0.25, W, L, DECK);
      block(0, 0, deck + 0.25, H, 0.25, L * 0.9, DECK);
      break;
    case 'well':
      for (const side of [-1, 1])
        block((side * W * 0.9) / 2, 0, 0.4, deck + 0.2, 0.3, L * 0.8, DECK);
      for (const end of [-1, 1])
        block(0, end * L * 0.43, deck - 0.1, deck + 0.25, W, L * 0.14, DECK);
      break;
    case 'locomotive':
      block(0, 0, deck, deck + 0.25, W, L, DECK);
      block(0, 0, 0.55, deck, W * 0.72, L * 0.36, DECK);
      // Cab windscreen and side windows.
      quad(
        [-W * 0.42, H - 0.95, L * 0.33 + 0.01],
        [W * 0.42, H - 0.95, L * 0.33 + 0.01],
        [W * 0.42, H - 0.3, L * 0.33 + 0.01],
        [-W * 0.42, H - 0.3, L * 0.33 + 0.01],
        GLASS,
      );
      break;
    case 'coach':
      windows(1.25, 1.95, W / 2, L * 0.62);
      windows(2.95, 3.65, W / 2, L * 0.62);
      break;
    case 'railcar':
      windows(1.15, 2.6, W / 2, L * 0.86);
      break;
  }
  const truck = profile === 'locomotive' && L > 20 ? 4.3 : profile === 'locomotive' ? 3.3 : 2.9;
  for (const end of [-1, 1])
    block(
      0,
      (end * tc) / 2,
      0.12,
      Math.max(0.9, r * 2 + 0.05),
      Math.min(W * 0.85, 2.6),
      truck,
      GEAR,
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
