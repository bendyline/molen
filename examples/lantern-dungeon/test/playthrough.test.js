import { buildWorld, componentHandle, Transform } from '@bendyline/molen-kernel';
import { expect, it } from 'vitest';
import { scene } from '../src/scene';

const get = (w, id, c) => w.get(id, componentHandle(c));
const p = (w) => w.get('player', Transform).pos;
it('completes lantern-dungeon using only player commands, then restarts', () => {
  let seq = 0;
  function send(w, type, payload = {}) {
    const result = w.submitCommand({
      kind: 'command',
      source: 'proof',
      seq: seq++,
      tick: w.tick,
      type,
      payload,
    });
    expect(result.accepted, result.reason).toBe(true);
  }
  const w = buildWorld(scene());
  let i = 0;
  const path = [
    [-3, 12],
    [-3, 6],
    [-9, 6],
    [-3, 6],
    [0, 3],
    [0, 0],
    [0, -6],
    [0, -12],
  ];
  for (let n = 0; n < 2200 && get(w, 'game', 'dungeonGame').status === 'playing'; n++) {
    const [x, , z] = p(w);
    const q = get(w, 'player', 'transform').rot;
    const yaw = 2 * Math.atan2(q[1], q[3]);
    let nearest;
    for (const [id, t, e] of w.query(Transform, componentHandle('sentinel')))
      if (e.alive) {
        const d = Math.hypot(t.pos[0] - x, t.pos[2] - z);
        if (d < 2.5 && (!nearest || d < nearest.d)) nearest = { id, d, pos: t.pos };
      }
    let target = path[i] ?? [0, -12];
    if (Math.hypot(target[0] - x, target[1] - z) < 0.3 && i < path.length - 1) {
      i++;
      target = path[i];
    }
    if (nearest) target = [nearest.pos[0], nearest.pos[2]];
    const dx = target[0] - x,
      dz = target[1] - z,
      desired = Math.atan2(-dx, -dz),
      error = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
    send(w, 'look', { yaw: Math.max(-1, Math.min(1, -error * 0.35)) });
    send(w, 'move', { dir: [0, nearest || Math.abs(error) > 0.1 ? 0 : -1] });
    if (nearest) send(w, 'attack');
    if (i >= 5) send(w, 'interact');
    if (get(w, 'game', 'dungeonGame').health < 50) send(w, 'heal');
    w.step();
  }
  expect(get(w, 'game', 'dungeonGame').status).toBe('won');
  send(w, 'restart');
  w.stepN(2);
  expect(get(w, 'game', 'dungeonGame').status).toBe('playing');
  expect(get(w, 'game', 'dungeonGame').key).toBe(false);
});
