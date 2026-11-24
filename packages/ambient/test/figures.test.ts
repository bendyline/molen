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

/** Whether a body is still in the figures group (a disposed body is detached from it). */
function inGroup(figures: AmbientFigures, object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o !== null; o = o.parent)
    if (o === figures.group) return true;
  return false;
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
  it('builds a few new bodies a frame, nearest first, when many come into range at once', () => {
    const figures = new AmbientFigures();
    const crowd = Array.from({ length: 6 }, (_, i) => walker({ id: `w${i}` }));
    figures.update(crowd, CAMERA, 30, 30);
    expect(figures.count).toBe(2);
    figures.update(crowd, CAMERA, 30, 30);
    figures.update(crowd, CAMERA, 30, 30);
    expect(figures.count).toBe(6);
  });

  it('leaves a pooled, hidden body out of the world-matrix walk until it shows again', () => {
    const figures = new AmbientFigures();
    const body = draw(figures, [walker()]) as THREE.SkinnedMesh;
    let root: THREE.Object3D = body;
    while (root.parent !== figures.group && root.parent !== null) root = root.parent;
    // Out of range: the body returns to the pool, hidden.
    figures.update([], CAMERA, 30, 30);
    expect(root.visible).toBe(false);
    const before = body.matrixWorld.clone();
    figures.group.position.set(100, 0, 0);
    figures.group.updateMatrixWorld();
    expect(body.matrixWorld.equals(before)).toBe(true);
    // Shown again, it takes the move.
    root.visible = true;
    figures.group.updateMatrixWorld();
    expect(body.matrixWorld.equals(before)).toBe(false);
  });

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

  it('keeps seated feet on the floor of the seat', () => {
    const seated = { mode: 'sit', anchor: 'eye' } as const;
    const hanging = draw(new AmbientFigures(), [walker(seated)]);
    const resting = draw(new AmbientFigures(), [walker({ ...seated, floor: 0.88 })]);
    if (hanging === undefined || resting === undefined) throw new Error('no figure drawn');
    expect(joint(hanging, 'foot.l').y).toBeLessThan(AT[1] - 0.95);
    expect(joint(resting, 'foot.l').y).toBeGreaterThan(AT[1] - 0.88);
    expect(joint(resting, 'head').y).toBeCloseTo(joint(hanging, 'head').y, 4);
  });

  it('rebuilds a visible walker whose figure changes (a host changing a look)', () => {
    const figures = new AmbientFigures();
    const before = draw(figures, [walker()]);
    if (before === undefined) throw new Error('no figure drawn');
    const restyled: FigureData = { ...FIGURE, features: { hair: 'bun', legs: 'skirt' } };
    const after = draw(figures, [walker({ figure: restyled })]);
    if (after === undefined) throw new Error('no figure drawn');
    expect(after).not.toBe(before);
    expect(after.geometry).not.toBe(before.geometry);
    expect(figures.count).toBe(1);
    // The old body is disposed, not left in the group or the pool.
    expect(inGroup(figures, before)).toBe(false);
    let bodies = 0;
    figures.group.traverse((object) => {
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) bodies++;
    });
    expect(bodies).toBe(1);
  });

  it('keeps the same body for an equal figure under a new object', () => {
    const figures = new AmbientFigures();
    const before = draw(figures, [walker()]);
    const after = draw(figures, [walker({ figure: { ...FIGURE } })]);
    expect(after).toBe(before);
  });

  it('shows the old body until the new one is ready, so a change never blinks', async () => {
    const pending: (() => void)[] = [];
    const figures = new AmbientFigures(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    );
    const settle = async (): Promise<void> => {
      for (const resolve of pending.splice(0)) resolve();
      await Promise.resolve();
      await Promise.resolve();
    };
    figures.update([walker()], CAMERA, 30, 30);
    await settle();
    const first = draw(figures, [walker()]);
    if (first === undefined) throw new Error('no figure drawn');
    // A new look: its shaders are still building, so the old body is what shows.
    const restyled: FigureData = { ...FIGURE, palette: { top: '#aa2222' } };
    expect(draw(figures, [walker({ figure: restyled })])).toBe(first);
    await settle();
    const second = draw(figures, [walker({ figure: restyled })]);
    if (second === undefined) throw new Error('no figure drawn');
    expect(second).not.toBe(first);
    expect(inGroup(figures, first)).toBe(false);
  });

  it('drops the rig of a descriptor nobody draws any more', () => {
    const cache = new FigureGeometryCache();
    const a = resolveFigureDescriptor(FIGURE);
    const b = resolveFigureDescriptor({ ...FIGURE, height: 1.6 });
    const keys = [cache.acquire(a, 0).key, cache.acquire(a, 1).key, cache.acquire(b, 0).key];
    expect(cache.rigCount).toBe(2);
    cache.release(keys[0] as string);
    expect(cache.rigCount).toBe(2);
    cache.release(keys[1] as string);
    expect(cache.rigCount).toBe(1);
    cache.release(keys[2] as string);
    expect(cache.rigCount).toBe(0);
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
