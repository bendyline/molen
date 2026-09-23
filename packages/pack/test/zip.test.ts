import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  crc32,
  decodeMember,
  findZipEnd,
  localDataOffset,
  parseCentralDirectory,
  writeZip,
} from '../src/zip';
import { encode, noise } from './helpers';

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('writes archives other zip readers open, with stored and deflated members', () => {
    const text = encode('hello '.repeat(200));
    const random = noise(4096);
    const bytes = writeZip([
      { name: 'dir/text.txt', data: text, compression: 'auto' },
      { name: 'random.bin', data: random, compression: 'auto' },
      { name: 'empty', data: new Uint8Array(0), compression: 'auto' },
    ]);
    const files = unzipSync(bytes);
    expect(files['dir/text.txt']).toEqual(text);
    expect(files['random.bin']).toEqual(random);
    expect(files.empty).toEqual(new Uint8Array(0));

    const end = findZipEnd(bytes, 0);
    expect(end.archiveSize).toBe(bytes.length);
    const members = parseCentralDirectory(
      bytes.subarray(end.centralOffset, end.centralOffset + end.centralSize),
      end.entries,
    );
    // Text compresses, so it is deflated; random bytes don't, so they are stored.
    expect(members.get('dir/text.txt')?.method).toBe(8);
    expect(members.get('random.bin')?.method).toBe(0);
    for (const member of members.values()) {
      const header = bytes.subarray(member.localOffset);
      const start = member.localOffset + localDataOffset(header);
      const data = decodeMember(member, bytes.subarray(start, start + member.compressedSize));
      expect(data).toEqual(files[member.name]);
    }
  });

  it('is deterministic', () => {
    const members = [
      { name: 'a.json', data: encode('{"a":1}'), compression: 'auto' as const },
      { name: 'b.bin', data: noise(1000), compression: 'auto' as const },
    ];
    expect(writeZip(members)).toEqual(writeZip(members));
  });

  it('recovers the archive size from the end record alone', () => {
    const bytes = writeZip([{ name: 'x', data: noise(5000), compression: 'store' }]);
    const tail = bytes.subarray(bytes.length - 100);
    expect(findZipEnd(tail).archiveSize).toBe(bytes.length);
    expect(findZipEnd(tail).offset).toBe(bytes.length - 22);
  });

  it('rejects corrupt members', () => {
    const bytes = writeZip([{ name: 'x', data: noise(64), compression: 'store' }]);
    const end = findZipEnd(bytes, 0);
    const member = parseCentralDirectory(
      bytes.subarray(end.centralOffset, end.centralOffset + end.centralSize),
      end.entries,
    ).get('x');
    if (member === undefined) throw new Error('missing member');
    const start = localDataOffset(bytes);
    const body = bytes.slice(start, start + member.compressedSize);
    body[3] = (body[3] as number) ^ 0xff;
    expect(() => decodeMember(member, body)).toThrow(/corrupt/);
    expect(() => findZipEnd(encode('not a zip at all, just text'))).toThrow(/not a zip/);
  });
});
