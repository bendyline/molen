import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { retryFileOperation, writeFileAtomic } from '../src/file-io';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename), writeFile: vi.fn(actual.writeFile) };
});

const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const platform = Object.getOwnPropertyDescriptor(process, 'platform');
if (!platform) throw new Error('Missing process.platform descriptor');
let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'molen-file-io-'));
});
beforeEach(() => {
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
});
afterEach(() => {
  Object.defineProperty(process, 'platform', platform);
  vi.useRealTimers();
  vi.mocked(rename).mockReset().mockImplementation(actual.rename);
  vi.mocked(writeFile).mockReset().mockImplementation(actual.writeFile);
});
afterAll(async () => {
  if (dirname(root) !== resolve(tmpdir())) throw new Error('Unexpected temporary directory');
  await rm(root, { recursive: true, force: true });
});

it('replaces mapped files without truncation and retries transient rename locks', async () => {
  const target = join(root, 'asset.json');
  const before = '{"hash":"old"}\n';
  const after = '{"hash":"new"}\n';
  await actual.writeFile(target, before);
  vi.mocked(writeFile).mockImplementation(async (path, data, options) => {
    if (path === target) throw Object.assign(new Error('mapped destination'), { code: 'UNKNOWN' });
    return actual.writeFile(path, data, options);
  });
  for (const code of ['UNKNOWN', 'EPERM'])
    vi.mocked(rename).mockImplementationOnce(async () => {
      expect(await readFile(target, 'utf8')).toBe(before);
      throw Object.assign(new Error('scanner lock'), { code });
    });
  await writeFileAtomic(target, after);
  expect(await readFile(target, 'utf8')).toBe(after);
  expect(rename).toHaveBeenCalledTimes(3);
  expect(await readdir(root)).toEqual(['asset.json']);
});

it('preserves the destination and cleans its temporary file when replacement fails', async () => {
  const target = join(root, 'failure.json');
  await actual.writeFile(target, 'previous');
  const error = Object.assign(new Error('disk full'), { code: 'ENOSPC' });
  vi.mocked(rename).mockRejectedValueOnce(error);
  await expect(writeFileAtomic(target, 'next')).rejects.toBe(error);
  expect(await readFile(target, 'utf8')).toBe('previous');
  expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  expect(rename).toHaveBeenCalledTimes(1);
});

it('bounds retries and reports the original persistent Windows error', async () => {
  vi.useFakeTimers();
  const error = Object.assign(new Error('persistent denial'), { code: 'EPERM' });
  const operation = vi.fn().mockRejectedValue(error);
  const result = expect(retryFileOperation(operation)).rejects.toBe(error);
  await vi.runAllTimersAsync();
  await result;
  expect(operation).toHaveBeenCalledTimes(21);
});

it.each(['ENOENT', 'ENOSPC', 'EINVAL'])('does not retry %s errors', async (code) => {
  const error = Object.assign(new Error(code), { code });
  const operation = vi.fn().mockRejectedValue(error);
  await expect(retryFileOperation(operation)).rejects.toBe(error);
  expect(operation).toHaveBeenCalledTimes(1);
});

it('does not retry permission errors on other platforms', async () => {
  Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
  const error = Object.assign(new Error('permissions'), { code: 'EPERM' });
  const operation = vi.fn().mockRejectedValue(error);
  await expect(retryFileOperation(operation)).rejects.toBe(error);
  expect(operation).toHaveBeenCalledTimes(1);
});
