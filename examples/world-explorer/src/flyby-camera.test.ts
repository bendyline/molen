import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FlybyCamera } from './flyby-camera';

const SPEC = { length: 10, span: 11, height: 3 };
const LEVEL: [number, number, number, number] = [0, 0, 0, 1];

describe('flyby camera', () => {
  it('waits beside the path ahead, follows the aircraft past, then moves ahead again', () => {
    const flyby = new FlybyCamera();
    const ground = () => 0;
    // 100 m/s north (+Z), 300 m up.
    const at = (z: number) =>
      flyby.pose({ pos: [0, 300, z], rot: LEVEL }, [0, 0, 100], SPEC, ground);
    const first = at(0);
    const [x, y, z] = first.position;
    expect(z).toBeCloseTo(350, 0);
    expect(Math.abs(x)).toBeGreaterThanOrEqual(SPEC.span);
    expect(y).toBeLessThan(301.5);
    // Fixed in the world while the aircraft approaches and passes, looking at it all the way.
    for (const along of [100, 300, 350, 400, 600]) {
      const pose = at(along);
      expect(pose.position).toEqual(first.position);
      const look = new THREE.Vector3(0, 0, -1).applyQuaternion(
        new THREE.Quaternion().fromArray(pose.rotation),
      );
      const toAircraft = new THREE.Vector3(0, 301.5, along)
        .sub(new THREE.Vector3().fromArray(pose.position))
        .normalize();
      expect(look.dot(toAircraft)).toBeGreaterThan(0.999);
    }
    // Gone by: ahead again, across the path.
    const next = at(800);
    expect(next.position[2]).toBeCloseTo(1150, 0);
    expect(Math.sign(next.position[0])).toBe(-Math.sign(x));
  });

  it('stays above the ground and sees over a rise toward the aircraft', () => {
    const flyby = new FlybyCamera();
    // Low toward a 50 m hill halfway to where the camera waits.
    const ground = (_x: number, z: number) => 50 * Math.max(0, 1 - Math.abs(z - 175) / 100);
    const pose = flyby.pose({ pos: [0, 20, 0], rot: LEVEL }, [0, 0, 100], SPEC, ground);
    const camera = new THREE.Vector3().fromArray(pose.position);
    const aircraft = new THREE.Vector3(0, 21.5, 0);
    for (let f = 0; f <= 1; f += 0.01) {
      const point = camera.clone().lerp(aircraft, f);
      expect(point.y).toBeGreaterThanOrEqual(ground(point.x, point.z) - 1e-6);
    }
    expect(camera.y).toBeGreaterThan(1.7);
  });

  it('waits off the nose of a parked aircraft and places afresh after a reset', () => {
    const flyby = new FlybyCamera();
    // Facing east: local +Z turned onto +X.
    const east: [number, number, number, number] = [
      0,
      Math.sin(Math.PI / 4),
      0,
      Math.cos(Math.PI / 4),
    ];
    const parked = () => flyby.pose({ pos: [0, 0, 0], rot: east }, [0, 0, 0], SPEC, () => 0);
    const first = parked().position;
    expect(first[0]).toBeCloseTo(SPEC.length * 4, 0);
    expect(first[1]).toBeCloseTo(1.7, 5);
    expect(parked().position).toEqual(first);
    flyby.reset();
    expect(parked().position[2]).toBeCloseTo(-first[2], 5);
  });
});
