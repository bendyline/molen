import type { HudData, JsonValue } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { evaluateHud } from '../src/hud';

const hud: HudData = {
  items: [
    { label: 'Score', value: '#game.vars.score' },
    { label: 'Lives', value: '#game.vars.lives' },
  ],
  messages: [
    { when: { select: '#game.vars.status', op: 'eq', value: 'won' }, text: 'You made it!' },
    {
      when: { select: '#game.vars.lives', op: 'lte', value: 0 },
      text: 'Try again.',
      detail: 'Press R',
    },
  ],
  captions: [{ tick: 10, ticks: 20, text: "Saturday, nine o'clock." }],
  title: { text: 'Coin Garden', ticks: 30 },
};

function reader(vars: Record<string, JsonValue>) {
  return (entity: string, component: string): JsonValue | undefined =>
    entity === 'game' && component === 'vars' ? vars : undefined;
}

describe('hud evaluation', () => {
  it('reads values, picks the first message that holds, and times captions and the title', () => {
    const playing = evaluateHud(hud, reader({ score: 3, lives: 2, status: 'playing' }), 12);
    expect(playing.items).toEqual([
      { label: 'Score', text: '3' },
      { label: 'Lives', text: '2' },
    ]);
    expect(playing.message).toBeUndefined();
    expect(playing.caption).toBe("Saturday, nine o'clock.");
    expect(playing.title).toBe('Coin Garden');

    const lost = evaluateHud(hud, reader({ score: 3, lives: 0, status: 'lost' }), 40);
    expect(lost.message).toEqual({ text: 'Try again.', detail: 'Press R' });
    expect(lost.caption).toBeUndefined();
    expect(lost.title).toBeUndefined();

    const won = evaluateHud(hud, reader({ score: 5, lives: 0, status: 'won' }), 40);
    expect(won.message?.text).toBe('You made it!');
  });
});
