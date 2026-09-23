import { describe, expect, it } from 'vitest';
import { canonicalBytes, hashBytes, hashJson } from '../src/hash';

const enc = new TextEncoder();

describe('sha256 correctness (known vectors)', () => {
  it('hashes the empty input', () => {
    expect(hashBytes(enc.encode(''))).toBe(
      'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
  it('hashes "abc"', () => {
    expect(hashBytes(enc.encode('abc'))).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('hashes a longer multi-block message', () => {
    const msg = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
    expect(hashBytes(enc.encode(msg))).toBe(
      'sha256:248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });
});

describe('canonical JSON hashing', () => {
  it('is key-order independent', () => {
    expect(hashJson({ a: 1, b: 2 })).toBe(hashJson({ b: 2, a: 1 }));
  });
  it('distinguishes values', () => {
    expect(hashJson({ a: 1 })).not.toBe(hashJson({ a: 2 }));
  });
  it('treats -0 and 0 identically', () => {
    expect(hashJson({ x: -0 })).toBe(hashJson({ x: 0 }));
  });
  it('distinguishes number from numeric string', () => {
    expect(hashJson({ x: 1 })).not.toBe(hashJson({ x: '1' }));
  });
  it('ignores undefined-valued keys (JSON-pure)', () => {
    expect(hashJson({ a: 1, b: undefined } as never)).toBe(hashJson({ a: 1 }));
  });
  it('canonicalBytes is stable for equal values', () => {
    expect(canonicalBytes({ a: [1, 2, 3] })).toEqual(canonicalBytes({ a: [1, 2, 3] }));
  });
});
