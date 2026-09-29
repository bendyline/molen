import { describe, expect, it } from 'vitest';
import { schemaToTsType } from '../src/schema-to-ts';

describe('schemaToTsType', () => {
  it('parenthesizes union array items', () => {
    const union = { anyOf: [{ type: 'string' }, { type: 'number' }] };
    expect(schemaToTsType({ type: 'array', items: union })).toBe('(string | number)[]');
    expect(schemaToTsType({ type: 'array', items: { type: 'string' } })).toBe('string[]');
  });
});

describe('schemaToTsType objects', () => {
  it('leaves non-union items bare even when they contain unions', () => {
    const obj = { type: 'object', properties: { a: { enum: ['x', 'y'] } }, required: ['a'] };
    expect(schemaToTsType({ type: 'array', items: obj })).toBe("{\n  a: 'x' | 'y';\n}[]");
    expect(schemaToTsType({ type: 'array', items: { enum: ['x', 'y'] } })).toBe("('x' | 'y')[]");
    expect(schemaToTsType({ type: 'array', items: { type: 'string' } })).toBe('string[]');
  });
});
