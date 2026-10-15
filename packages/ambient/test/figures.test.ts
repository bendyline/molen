// AmbientFigures beyond ambient pedestrians: a seated body anchored at its eye (a vehicle seat),
// the sitting pose, and a head turned toward a point — the pieces a host uses to draw its own
// characters with the same pooled figures.

import {
  type FigureData,
  FigureGeometryCache,
  resolveFigureDescriptor,
} from '@bendyline/molen-figures/client';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AmbientFigures, type WalkerView } from '../src/client';

const FIGURE: FigureData = { preset: 'human.adult', height: 1.75 };
const RIG = new FigureGeometryCache().rigFor(resolveFigureDescriptor(FIGURE));
const AT: [number, number, number] = [10, 2, -4];
const CAMERA: [number, number, number] = [10, 3, 0];

function walker(over: Partial<WalkerView> = {}): WalkerView {
  return {
    id: 'w',
    figure: FIGURE,
    pos: AT,
    rot: [0, 0, 0, 1],
    speed: 0,
    since: 0,
    hidden: false,
    ...over,
  };
}

/** Draw one frame of walkers and return the visible skinned body, if any. */
function draw(figures: AmbientFigures, walkers: WalkerView[]): THREE.SkinnedMesh | undefined {
  figures.update(walkers, CAMERA, 30, 30);
  figures.group.updateMatrixWorld(true);
  let found: THREE.SkinnedMesh | undefined;
  figures.group.traverseVisible((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) found = object as THREE.SkinnedMesh;
  });
  return found;
}

function joint(mesh: THREE.SkinnedMesh, name: string): THREE.Vector3 {
  const bone = mesh.skeleton.bones[RIG.index[name] as number] as THREE.Bone;
  return bone.getWorldPosition(new THREE.Vector3());
}

function headRotation(mesh: THREE.SkinnedMesh): THREE.Quaternion {
  const bone = mesh.skeleton.bones[RIG.index.head as number] as THREE.Bone;
  return bone.getWorldQuaternion(new THREE.Quaternion());
}

describe('AmbientFigures for host characters', () => {
  it('anchors a figure at its eye instead of its feet', () => {
    const standing = draw(new AmbientFigures(), [walker()]);
    if (standing === undefined) throw new Error('no figure drawn');
    // Feet at the position: the head is well above it.
    expect(joint(standing, 'head').y - AT[1]).toBeGreaterThan(1.3);
    const anchored = draw(new AmbientFigures(), [walker({ anchor: 'eye' })]);
    if (anchored === undefined) throw new Error('no figure drawn');
    // The eye socket sits at the position, so the head joint is just below it.
    expect(Math.abs(joint(anchored, 'head').y - AT[1])).toBeLessThan(0.25);
    expect(joint(anchored, 'hips').y).toBeLessThan(AT[1] - 0.4);
  });

  it('sits a figure with its knees forward, and never draws a seated stand-in', () => {
    const standing = draw(new AmbientFigures(), [walker()]);
    if (standing === undefined) throw new Error('no figure drawn');
    const standingKnee = joint(standing, 'lowerLeg.l').z - joint(standing, 'upperLeg.l').z;
    expect(Math.abs(standingKnee)).toBeLessThan(0.12);
    const seated = draw(new AmbientFigures(), [walker({ mode: 'sit', anchor: 'eye', speed: 12 })]);
    if (seated === undefined) throw new Error('no figure drawn');
    // Facing +Z, the thighs point forward from the hips.
    expect(joint(seated, 'lowerLeg.l').z - joint(seated, 'upperLeg.l').z).toBeGreaterThan(0.25);
    // Past the animated tiers a standing walker becomes a rigid stand-in; a seated one is not drawn.
    const far = new AmbientFigures();
    // 4.1 m away: past the animated tiers (1.1 × radius), inside the drawn range (1.25 ×).
    far.setBudget({ radius: 3.5 });
    far.update([walker({ id: 'a' })], CAMERA, 30, 30);
    expect(far.count).toBe(1);
    far.update([walker({ id: 'a', mode: 'sit', anchor: 'eye' })], CAMERA, 31, 30);
    expect(far.count).toBe(0);
  });

  it('turns the head toward a look target on either side', () => {
    const neutral = draw(new AmbientFigures(), [walker()]);
    const right = draw(new AmbientFigures(), [
      walker({ lookAt: [AT[0] + 3, AT[1] + 1.6, AT[2] + 3] }),
    ]);
    const left = draw(new AmbientFigures(), [
      walker({ lookAt: [AT[0] - 3, AT[1] + 1.6, AT[2] + 3] }),
    ]);
    if (neutral === undefined || right === undefined || left === undefined)
      throw new Error('no figure drawn');
    const base = headRotation(neutral).invert();
    const towardRight = headRotation(right).multiply(base);
    const towardLeft = headRotation(left).multiply(base);
    // A turn about +Y toward +X (the figure faces +Z) and the mirror turn toward -X.
    expect(towardRight.y).toBeGreaterThan(0.1);
    expect(towardLeft.y).toBeLessThan(-0.1);
  });
});
