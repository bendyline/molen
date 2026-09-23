import { buildWorld, componentHandle, Transform } from '@bendyline/molen-kernel';
import { expect, it } from 'vitest';
import { scene } from '../src/scene';

const get = (w, id, c) => w.get(id, componentHandle(c));
const p = (w) => w.get('player', Transform).pos;
it('completes skybound using only player commands, then restarts', () => {
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
  const jumps = [6, 16, 21.5, 27, 38.5, 44.5, 55.5, 65, 72];
  for (let n = 0; n < 1600 && get(w, 'game', 'skyGame').status === 'playing'; n++) {
    const [x] = p(w);
    const b = get(w, 'player', 'platformBody');
    send(w, 'move', { dir: [1, 0] });
    if (x >= jumps[i] && b.grounded) {
      send(w, 'jump', { held: true });
      i++;
    }
    w.step();
  }
  expect(get(w, 'game', 'skyGame').status).toBe('won');
  send(w, 'restart');
  w.stepN(2);
  expect(get(w, 'game', 'skyGame').status).toBe('playing');
  expect(get(w, 'game', 'skyGame').coins).toBe(0);
});
