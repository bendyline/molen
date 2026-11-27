import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FlybyCamera, type FlybySight, VEHICLE_FLYBY, WALKER_FLYBY } from './flyby-camera';

const SPEC = { length: 10, span: 11, height: 3 };
const LEVEL: [number, number, number, number] = [0, 0, 0, 1];
const CAR = { length: 4.5, span: 1.8, height: 1.5 };

/** Walls on the planes x = at or z = at, and how often the camera asked about them. */
function walls(...planes: { axis: 0 | 2; at: number }[]): FlybySight & { prepared: number } {
  const sight = {
    prepared: 0,
    prepare() {
      sight.prepared++;
    },
    obstruction(from: [number, number, number], to: [number, number, number]) {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      let nearest: number | undefined;
      for (const { axis, at } of planes) {
        const t = (at - from[axis]) / (to[axis] - from[axis]);
        if (Number.isFinite(t) && t > 0 && t < 1 && (nearest === undefined || t * length < nearest))
          nearest = t * length;
      }
      return nearest;
    },
  };
  return sight;
}

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

describe('ground flyby camera', () => {
  // 15 m/s north (+Z): 45 m ahead, 4.3 m (the width and 2.5 m) off the lane. The first placement
  // takes the -X side.
  const drive = (flyby: FlybyCamera, sight?: FlybySight, y = 0, ground = 0) =>
    flyby.pose({ pos: [0, y, 0], rot: LEVEL }, [0, 0, 15], CAR, () => ground, sight);

  it('waits at the roadside ahead, at eye height over the road', () => {
    const [x, y, z] = drive(new FlybyCamera(VEHICLE_FLYBY)).position;
    expect(z).toBeCloseTo(45, 5);
    expect(x).toBeCloseTo(-4.3, 5);
    expect(y).toBeCloseTo(1.7, 5);
  });

  it('keeps eye height over a deck or floor above the ground', () => {
    // On a bridge 12 m over the valley.
    expect(drive(new FlybyCamera(VEHICLE_FLYBY), undefined, 12).position[1]).toBeCloseTo(13.7, 5);
    // A walker at 1.4 m/s, on a floor 10 m up: 8 m ahead, 2.5 m aside, a passer-by's eye.
    const walker = new FlybyCamera(WALKER_FLYBY).pose(
      { pos: [0, 10, 0], rot: LEVEL },
      [1.4, 0, 0],
      { length: 0.5, span: 0.5, height: 1.75 },
      () => 0,
    );
    const [x, y, z] = walker.position;
    expect(x).toBeCloseTo(8, 5);
    expect(Math.abs(z)).toBeCloseTo(2.5, 5);
    expect(y).toBeCloseTo(11.65, 5);
  });

  it('takes the open side of the road when a facade stands on the other', () => {
    const sight = walls({ axis: 0, at: -3 });
    const [x] = drive(new FlybyCamera(VEHICLE_FLYBY), sight).position;
    expect(sight.prepared).toBe(1);
    expect(x).toBeCloseTo(4.3, 5);
  });

  it('stands in front of the facades of a narrow street', () => {
    const [x] = drive(
      new FlybyCamera(VEHICLE_FLYBY),
      walls({ axis: 0, at: -3 }, { axis: 0, at: 3 }),
    ).position;
    // 0.4 m short of the facade along the sight line, which rises a little from the car's middle.
    expect(x).toBeGreaterThan(-2.65);
    expect(x).toBeLessThan(-2.55);
  });

  it('waits short of a wall across the road ahead', () => {
    // The ray from the car's middle meets the wall 20 m on.
    const [, , z] = drive(new FlybyCamera(VEHICLE_FLYBY), walls({ axis: 2, at: 20 })).position;
    expect(z).toBeCloseTo(18.5, 5);
  });
});
