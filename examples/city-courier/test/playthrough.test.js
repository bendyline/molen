import { buildWorld, componentHandle, Transform } from '@bendyline/molen-kernel';
import { expect, it } from 'vitest';
import { scene } from '../src/scene';

const get = (w, id, c) => w.get(id, componentHandle(c));
const p = (w) => w.get('player', Transform).pos;
it('completes city-courier using only player commands, then restarts', () => {
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
  const route = [
    [0, -24],
    [24, -24],
    [24, 24],
    [0, 24],
    [0, 0],
  ];
  for (let n = 0; n < 3400 && get(w, 'game', 'courierGame').status === 'playing'; n++) {
    const point = route[i];
    if (!point) break;
    const [x, , z] = p(w);
    const dx = point[0] - x,
      dz = point[1] - z,
      d = Math.hypot(dx, dz);
    if (d < 1.7 && i < route.length - 1) i++;
    const q = get(w, 'player', 'transform').rot,
      yaw = 2 * Math.atan2(q[1], q[3]);
    const desired = Math.atan2(-dx, -dz),
      error = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
    const speed = get(w, 'game', 'courierGame').speed;
    const target = Math.abs(error) > 0.5 ? 3.8 : 7;
    send(w, 'drive', { dir: [Math.max(-1, Math.min(1, -error * 2)), speed < target ? -1 : 0] });
    send(w, 'brake', { held: speed > target + 1 });
    w.step();
  }
  expect(get(w, 'game', 'courierGame').status).toBe('won');
  send(w, 'restart');
  w.stepN(2);
  expect(get(w, 'game', 'courierGame').status).toBe('playing');
  expect(get(w, 'game', 'courierGame').delivered).toBe(0);
});
