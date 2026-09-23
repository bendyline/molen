import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { localCommand } from '../src/client';

describe('localCommand', () => {
  it('builds a schema-valid command envelope', () => {
    const cmd = localCommand(0, 'spawn_cube', {});
    const r = validate('command', cmd);
    expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
  });

  it('carries the payload and sequence through', () => {
    const cmd = localCommand(7, 'move', { dir: [1, 0] });
    expect(cmd.seq).toBe(7);
    expect(cmd.source).toBe('local');
    expect(cmd.payload).toEqual({ dir: [1, 0] });
    expect(validate('command', cmd).ok).toBe(true);
  });
});
