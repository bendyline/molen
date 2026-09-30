/**
 * Proxy shapes for ambient vehicles, built from dimensions alone so traffic renders with no
 * content: the parked-car shape for cars, a windowed box for buses and rail cars, and a simple
 * airliner. Bodies are white so `instanceColor` paints them; glass and tyres stay dark.
 */

import { vehicleProxyGeometry } from '@bendyline/molen-client/vehicles';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type ProxyShape = 'car' | 'bus' | 'rail' | 'aircraft';

export interface ProxyDimensions {
  length: number;
  width: number;
  height: number;
}

const cache = new Map<string, THREE.BufferGeometry>();

function box(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  length: number,
  color: string,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, length).translate(x, y, z).toNonIndexed();
  geometry.deleteAttribute('uv');
  const tint = new THREE.Color(color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts) as THREE.BufferGeometry;
  for (const part of parts) part.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const GLASS = '#3d4d57';
const DARK = '#20242a';
const WHITE = '#ffffff';

function busGeometry({ length, width, height }: ProxyDimensions): THREE.BufferGeometry {
  const parts = [
    box(0, height * 0.12 + 0.35, 0, width, height * 0.24, length, WHITE),
    box(0, height * 0.52 + 0.1, 0, width * 1.005, height * 0.42, length * 0.94, GLASS),
    box(0, height * 0.9, 0, width, height * 0.16, length, WHITE),
  ];
  for (const z of [-length * 0.32, length * 0.3])
    parts.push(box(0, 0.45, z, width * 1.01, 0.9, 1.0, DARK));
  return merged(parts);
}

function railGeometry({ length, width, height }: ProxyDimensions): THREE.BufferGeometry {
  const parts = [
    box(0, 0.95 + height * 0.2, 0, width, height * 0.4, length, WHITE),
    box(0, 0.95 + height * 0.52, 0, width * 1.005, height * 0.26, length * 0.97, GLASS),
    box(0, 0.95 + height * 0.73, 0, width, height * 0.16, length, WHITE),
    box(0, 0.95 + height * 0.83, 0, width * 0.5, 0.08, length * 0.2, DARK),
  ];
  for (const z of [-length * 0.36, length * 0.36])
    parts.push(box(0, 0.5, z, width * 0.8, 0.9, 2.6, DARK));
  return merged(parts);
}

function aircraftGeometry({ length, width }: ProxyDimensions): THREE.BufferGeometry {
  const fuselage = length * 0.1;
  const parts = [
    box(0, 0, 0, fuselage, fuselage, length, WHITE),
    box(0, fuselage * 0.05, length * 0.02, width, fuselage * 0.12, length * 0.12, WHITE),
    box(0, fuselage * 0.2, -length * 0.44, width * 0.32, fuselage * 0.1, length * 0.07, WHITE),
    box(0, fuselage * 1.1, -length * 0.43, fuselage * 0.12, fuselage * 1.6, length * 0.09, WHITE),
    box(0, fuselage * 0.18, length * 0.44, fuselage * 0.72, fuselage * 0.3, length * 0.05, GLASS),
  ];
  for (const x of [-width * 0.17, width * 0.17])
    parts.push(
      box(
        x,
        -fuselage * 0.45,
        length * 0.07,
        fuselage * 0.45,
        fuselage * 0.45,
        length * 0.09,
        '#c9ccd0',
      ),
    );
  return merged(parts);
}

/** The shape to draw for an agent kind and its dimensions. */
export function proxyShapeFor(kind: string, length: number): ProxyShape {
  if (kind === 'train') return 'rail';
  if (kind === 'aircraft') return 'aircraft';
  return length > 7.5 ? 'bus' : 'car';
}

/** Default body height for a proxy when the type gives none. */
export function proxyHeight(
  shape: ProxyShape,
  length: number,
  width: number,
  type: string,
): number {
  if (shape === 'bus') return 3.1;
  if (shape === 'rail') return 3.6;
  if (shape === 'aircraft') return length * 0.25;
  if (/van/.test(type) || width >= 1.98) return 2.0;
  if (/suv|pickup/.test(type)) return 1.75;
  return 1.45;
}

/** Cached geometry for a shape at given dimensions (rounded to 10 cm). Never dispose it. */
export function proxyGeometry(shape: ProxyShape, dims: ProxyDimensions): THREE.BufferGeometry {
  const d = {
    length: Math.round(dims.length * 10) / 10,
    width: Math.round(dims.width * 10) / 10,
    height: Math.round(dims.height * 10) / 10,
  };
  const key = `${shape}:${d.length}:${d.width}:${d.height}`;
  let geometry = cache.get(key);
  if (geometry !== undefined) return geometry;
  if (shape === 'car')
    geometry = vehicleProxyGeometry({
      ...d,
      wheelbase: d.length * 0.6,
      wheelTrack: d.width * 0.84,
      wheelRadius: Math.min(0.5, Math.max(0.28, d.length * 0.068)),
    });
  else if (shape === 'bus') geometry = busGeometry(d);
  else if (shape === 'rail') geometry = railGeometry(d);
  else geometry = aircraftGeometry(d);
  cache.set(key, geometry);
  return geometry;
}

/** The key `proxyGeometry` caches under (one instanced mesh per key). */
export function proxyKey(shape: ProxyShape, dims: ProxyDimensions): string {
  return `${shape}:${Math.round(dims.length * 10) / 10}:${Math.round(dims.width * 10) / 10}:${Math.round(dims.height * 10) / 10}`;
}
