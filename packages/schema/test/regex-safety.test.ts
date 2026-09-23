// A scene-declared `pattern` is untrusted input that becomes a live RegExp on every incoming
// command. `^(a+)+$` backtracks catastrophically — measured at ~1.4 s for 26 characters, doubling
// per character — so anyone who can submit a command could stall the lockstep kernel and the
// validating tool. Patterns are screened structurally; the strings they see are length-capped.
import { describe, expect, it } from 'vitest';
import { commandPayloadValidator, compileCommandPayload, validate } from '../src/index';

const scene = (commands: unknown): Record<string, unknown> => ({
  format: 'molen/scene@3',
  name: 'patterns',
  commands,
});

const evil = { type: 'object', properties: { name: { type: 'string', pattern: '^(a+)+$' } } };
const benign = {
  type: 'object',
  properties: { name: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' } },
  required: ['name'],
  additionalProperties: false,
};

describe('catastrophic payload patterns are rejected at validation', () => {
  it('names the command and the pattern', () => {
    const r = validate('scene', scene({ rename: { payload: evil } }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const issue = r.issues.find((i) => i.code === 'unsafe_payload_pattern');
    expect(issue?.path).toBe('/commands/rename/payload/properties/name/pattern');
    expect(issue?.message).toContain('command "rename"');
    expect(issue?.received).toBe('"^(a+)+$"');
    expect(r.formatted).toContain('backtracks catastrophically');
  });

  it.each([
    ['nested quantifier', '^(a+)+$'],
    ['nested star', '^(a*)*$'],
    ['optional inside a repetition', '^(a?b)+$'],
    ['counted repetition of a repetition', '^(\\d{3}-){2,}$'],
    ['nested one level deeper', '^((ab+))*$'],
  ])('rejects %s', (_note, pattern) => {
    const r = validate('scene', scene({ c: { payload: { type: 'string', pattern } } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === 'unsafe_payload_pattern')).toBe(true);
  });

  it.each([
    ['anchored identifier', '^[a-z][a-z0-9_]*$'],
    ['hex color', '^#[0-9a-fA-F]{6}$'],
    ['alternation under one quantifier', '^(foo|bar)+$'],
    ['lookahead guard', '^(?!e\\d+$).+$'],
    ['escaped literal with a quantifier', '^\\d+\\.\\d+$'],
  ])('keeps accepting %s', (_note, pattern) => {
    const r = validate('scene', scene({ c: { payload: { type: 'string', pattern } } }));
    expect(r.ok, JSON.stringify(r.ok ? {} : r.issues)).toBe(true);
  });

  it('refuses to build a validator for one, so a host that skipped validate() is safe too', () => {
    expect(() => compileCommandPayload(evil)).toThrow(/backtracks catastrophically/);
  });

  it('is not a speed bump: screening a hostile pattern never runs it', () => {
    const started = Date.now();
    const r = validate('scene', scene({ rename: { payload: evil } }));
    expect(r.ok).toBe(false);
    // The vulnerable path took over a second for a 26-character input; screening is structural.
    expect(Date.now() - started).toBeLessThan(250);
  });
});

describe('a declared pattern only sees bounded input', () => {
  it('rejects an over-long string before the pattern is tested', () => {
    const check = commandPayloadValidator('rename', benign);
    expect(check({ name: 'goblin_2' })).toEqual({ ok: true });
    const r = check({ name: 'a'.repeat(5000) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('command "rename" payload failed validation');
      expect(r.message).toContain('/name');
      expect(r.message).toContain('capped at 4096');
    }
  });

  it('leaves payloads without a pattern free to carry long strings', () => {
    const check = commandPayloadValidator('say', {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    });
    expect(check({ text: 'x'.repeat(50_000) })).toEqual({ ok: true });
  });

  it('still reports ordinary payload failures through the issue formatter', () => {
    const check = commandPayloadValidator('rename', benign);
    const r = check({ name: 'Goblin 2' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('/name');
  });
});

describe('declared component schemas are screened the same way', () => {
  it('rejects a catastrophic pattern in a scene-declared component', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      components: {
        codeName: {
          description: 'A code name.',
          examples: [{ value: 'aaa' }],
          schema: { type: 'object', properties: { value: { type: 'string', pattern: '^(a+)+$' } } },
        },
      },
      entities: [{ id: 'a', components: { codeName: { value: 'aaa' } } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.code === 'component_schema_unsafe_pattern');
      expect(issue?.path).toBe('/components/codeName/schema/properties/value/pattern');
      expect(issue?.message).toContain('component "codeName"');
    }
  });

  it('accepts a bounded pattern in a declared component', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      components: {
        codeName: {
          description: 'A code name.',
          examples: [{ value: 'abc' }],
          schema: {
            type: 'object',
            properties: { value: { type: 'string', pattern: '^[a-z]+$' } },
          },
        },
      },
      entities: [{ id: 'a', components: { codeName: { value: 'abc' } } }],
    });
    expect(r.ok).toBe(true);
  });
});
