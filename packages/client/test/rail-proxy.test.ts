import type { RailVehicleProfile } from '@bendyline/molen-schema';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { railVehicleProxyGeometry } from '../src/rail-proxy';
import { createParkedVehicleBatch } from '../src/vehicles';

const PROFILES: RailVehicleProfile[] = [
  'box',
  'hopper',
  'tank',
  'gondola',
  'flat',
  'well',
  'autorack',
  'locomotive',
  'coach',
  'railcar',
];

describe('rail vehicle stand-ins', () => {
  it('draws each kind of car as its own few-dozen-triangle silhouette within its size', () => {
    const shapes = new Set<string>();
    for (const profile of PROFILES) {
      const geometry = railVehicleProxyGeometry({
        width: 3.2,
        length: 18,
        height: 4.6,
        wheelRadius: 0.457,
        rail: { truckCenters: 13, profile },
      });
      const triangles = geometry.getAttribute('position').count / 3;
      expect(triangles, profile).toBeLessThan(200);
      const body = geometry.userData.bodyVertices as number;
      expect(body, profile).toBeGreaterThan(0);
      expect(body, profile).toBeLessThan(geometry.getAttribute('position').count);
      const box = geometry.boundingBox as THREE.Box3;
      expect(box.min.y, profile).toBeGreaterThanOrEqual(0);
      expect(box.max.y, profile).toBeLessThanOrEqual(4.6 + 1e-6);
      expect(box.max.z - box.min.z, profile).toBeLessThanOrEqual(18 + 1e-6);
      // Window bands sit a centimetre outside the body.
      expect(box.max.x - box.min.x, profile).toBeLessThanOrEqual(3.2 + 0.021);
      shapes.add(`${triangles}:${body}`);
    }
    expect(shapes.size).toBeGreaterThan(6);
    // Cached per size and kind.
    expect(
      railVehicleProxyGeometry({
        width: 3.2,
        length: 18,
        height: 4.6,
        wheelRadius: 0.457,
        rail: { truckCenters: 13, profile: 'tank' },
      }),
    ).toBe(
      railVehicleProxyGeometry({
        width: 3.2,
        length: 18,
        height: 4.6,
        wheelRadius: 0.457,
        rail: { truckCenters: 13, profile: 'tank' },
      }),
    );
  });

  it('paints a parked rail car body and leaves its trucks dark', () => {
    const spec = {
      width: 3.2,
      length: 17,
      height: 4.6,
      wheelbase: 13,
      wheelTrack: 1.5,
      wheelRadius: 0.457,
      rail: { truckCenters: 13, profile: 'box' as const },
    };
    const group = createParkedVehicleBatch([
      {
        id: 'rail-car:1',
        kind: 'boxcar',
        color: '#ff0000',
        spec: spec as never,
        position: [0, 0, 0],
        yaw: 0,
      },
    ]);
    const mesh = group.children[0] as THREE.Mesh;
    const colors = mesh.geometry.getAttribute('color');
    const body = railVehicleProxyGeometry(spec).userData.bodyVertices as number;
    expect(colors.getX(0)).toBeCloseTo(1, 5);
    expect(colors.getY(0)).toBeCloseTo(0, 5);
    expect(colors.getX(colors.count - 1)).toBeLessThan(0.3);
    expect(body).toBeLessThan(colors.count);
  });
});
