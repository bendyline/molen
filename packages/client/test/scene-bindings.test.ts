import type { JsonObject, SceneInput } from '@bendyline/molen-schema';
import { describe, expect, it, vi } from 'vitest';
import { InputMap } from '../src/input';
import { applyInputRules, applySceneCamera, type CameraTarget } from '../src/scene-bindings';
import { orthoFrustum } from '../src/three/renderer';

const arenaInput: SceneInput = {
  bindings: { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', Space: 'fire' },
  emit: [
    {
      kind: 'axis2d',
      xNeg: 'left',
      xPos: 'right',
      yNeg: 'up',
      yPos: 'down',
      command: 'move',
      field: 'dir',
    },
    { kind: 'press', action: 'fire', command: 'shoot', payload: { charge: 1 } },
    { kind: 'release', action: 'fire', command: 'stop_shooting', payload: {} },
  ],
};

/** A fake interval timer so the axis poller runs under test control. */
function fakeTimer(): {
  timer: { set(fn: () => void, ms: number): unknown; clear(h: unknown): void };
  tick(): void;
  cleared: number;
} {
  let fn: (() => void) | undefined;
  const state = { cleared: 0 };
  return {
    timer: {
      set: (f: () => void) => {
        fn = f;
        return 'h';
      },
      clear: () => {
        state.cleared++;
        fn = undefined;
      },
    },
    tick: () => fn?.(),
    get cleared() {
      return state.cleared;
    },
  };
}

describe('applyInputRules', () => {
  it('axis2d emits once on change, not while held, and [0,0] on release', () => {
    const map = new InputMap({ bindings: arenaInput.bindings });
    const emitted: [string, JsonObject][] = [];
    const ft = fakeTimer();
    applyInputRules(arenaInput, map, (t, p) => emitted.push([t, p]), { timer: ft.timer });
    ft.tick(); // initial sample: [0,0]
    map.press('KeyD');
    ft.tick();
    ft.tick(); // held: no re-emit
    map.press('KeyW');
    ft.tick();
    map.release('KeyD');
    map.release('KeyW');
    ft.tick();
    expect(emitted.filter(([t]) => t === 'move').map(([, p]) => p)).toEqual([
      { dir: [0, 0] },
      { dir: [1, 0] },
      { dir: [1, -1] },
      { dir: [0, 0] },
    ]);
  });

  it('press and release rules emit on edges with their payloads', () => {
    const map = new InputMap({ bindings: arenaInput.bindings });
    const emitted: [string, JsonObject][] = [];
    const ft = fakeTimer();
    applyInputRules(arenaInput, map, (t, p) => emitted.push([t, p]), { timer: ft.timer });
    map.press('Space');
    map.press('Space'); // repeat while held: no second edge
    map.release('Space');
    expect(emitted.filter(([t]) => t !== 'move')).toEqual([
      ['shoot', { charge: 1 }],
      ['stop_shooting', {}],
    ]);
  });

  it('the disposer clears the poller and the edge subscriptions', () => {
    const map = new InputMap({ bindings: arenaInput.bindings });
    const emitted: string[] = [];
    const ft = fakeTimer();
    const off = applyInputRules(arenaInput, map, (t) => emitted.push(t), { timer: ft.timer });
    off();
    expect(ft.cleared).toBe(1);
    map.press('Space');
    expect(emitted).toEqual([]);
  });

  it('uses setInterval by default', () => {
    vi.useFakeTimers();
    try {
      const map = new InputMap({ bindings: arenaInput.bindings });
      const emitted: JsonObject[] = [];
      const off = applyInputRules(arenaInput, map, (_t, p) => emitted.push(p), { pollMs: 20 });
      map.press('KeyA');
      vi.advanceTimersByTime(25);
      expect(emitted).toEqual([{ dir: [-1, 0] }]);
      off();
      map.release('KeyA');
      vi.advanceTimersByTime(50);
      expect(emitted).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('applySceneCamera', () => {
  function target(): CameraTarget & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      setCamera: (pose) => calls.push(`camera:${JSON.stringify(pose)}`),
      setTopDownOrtho: (o) => calls.push(`ortho:${JSON.stringify(o)}`),
      setFov: (f) => calls.push(`fov:${f}`),
    };
  }

  it('routes fixed and free-fly to setCamera (+ fov), top-down-ortho to setTopDownOrtho', () => {
    const t = target();
    applySceneCamera({ mode: 'fixed', position: [0, 6, 16], lookAt: [0, 0, 0], fov: 50 }, t);
    applySceneCamera({ mode: 'free-fly', position: [1, 2, 3], moveSpeed: 10, boost: 4 }, t);
    applySceneCamera({ mode: 'top-down-ortho', center: [0, 0], viewHeight: 26 }, t);
    expect(t.calls).toEqual([
      'camera:{"position":[0,6,16],"lookAt":[0,0,0]}',
      'fov:50',
      'camera:{"position":[1,2,3]}',
      'ortho:{"center":[0,0],"viewHeight":26}',
    ]);
  });
});

describe('orthoFrustum', () => {
  it('derives half extents from viewHeight and aspect', () => {
    expect(orthoFrustum(26, 2)).toEqual({ halfW: 26, halfH: 13 });
    expect(orthoFrustum(10, 0.5)).toEqual({ halfW: 2.5, halfH: 5 });
    expect(() => orthoFrustum(0, 1)).toThrow();
  });
});

describe('follow cameras', () => {
  it('composes world offsets for side-scrolling and overhead views', () => {
    const target = { setCamera: vi.fn(), setTopDownOrtho: vi.fn(), setFov: vi.fn() };
    applySceneCamera(
      { mode: 'follow', entity: 'hero', offset: [0, 10, 20], lookOffset: [0, 2, 0], fov: 50 },
      target,
      { pos: [5, 3, -4], rot: [0, 0, 0, 1] },
    );
    expect(target.setCamera).toHaveBeenCalledWith({ position: [5, 13, 16], lookAt: [5, 5, -4] });
    expect(target.setFov).toHaveBeenCalledWith(50);
  });
  it('rotates first-person offsets with the target quaternion', () => {
    const target = { setCamera: vi.fn(), setTopDownOrtho: vi.fn(), setFov: vi.fn() };
    applySceneCamera(
      {
        mode: 'follow',
        entity: 'hero',
        offset: [0, 1.6, 0],
        lookOffset: [0, 1.6, -1],
        space: 'local',
      },
      target,
      { pos: [2, 0, 3], rot: [0, 1, 0, 0] },
    );
    expect(target.setCamera).toHaveBeenCalledWith({ position: [2, 1.6, 3], lookAt: [2, 1.6, 4] });
  });
  it('holds its previous pose while a target is absent', () => {
    const target = { setCamera: vi.fn(), setTopDownOrtho: vi.fn(), setFov: vi.fn() };
    applySceneCamera(
      { mode: 'follow', entity: 'later', offset: [0, 2, 10], lookOffset: [0, 0, 0] },
      target,
    );
    expect(target.setCamera).not.toHaveBeenCalled();
  });
});
