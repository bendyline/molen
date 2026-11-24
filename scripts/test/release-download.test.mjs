import assert from 'node:assert/strict';
import { test } from 'node:test';
import { httpError, isTransient, reason, retryTransient } from '../release-download.mjs';

/** What Node's fetch throws for a connection the network dropped. */
const dropped = (code = 'ECONNRESET') =>
  new TypeError('fetch failed', {
    cause: Object.assign(new Error(`read ${code}`), { code }),
  });

test('the network and a busy server are worth another try; the file itself is not', () => {
  for (const error of [
    dropped(),
    new TypeError('fetch failed'),
    new TypeError('terminated'),
    Object.assign(new Error('connect timed out'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
    new DOMException('The operation timed out.', 'TimeoutError'),
    httpError('Asset download failed: HTTP 503', 503),
    httpError('Asset download failed: HTTP 429', 429),
  ])
    assert.equal(isTransient(error), true, reason(error));
  for (const error of [
    httpError('Asset download failed: HTTP 404', 404),
    httpError('Listing releases failed: HTTP 403', 403),
    new Error('Archive checksum mismatch: a.tar.gz'),
    new Error('Asset download exceeds its declared size.'),
    new TypeError('Invalid URL'),
    Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }),
    Object.assign(new Error('file already exists'), { code: 'EEXIST' }),
  ])
    assert.equal(isTransient(error), false, reason(error));
});

test('a failure names what the network reported, not only "fetch failed"', () => {
  assert.equal(reason(dropped()), 'fetch failed: read ECONNRESET');
  assert.equal(
    reason(Object.assign(new Error('socket closed'), { code: 'UND_ERR_SOCKET' })),
    'socket closed [UND_ERR_SOCKET]',
  );
  assert.equal(reason(new Error('plain')), 'plain');
});

test('tries again after a transient failure and returns the first success', async () => {
  const waits = [];
  const messages = [];
  let calls = 0;
  const result = await retryTransient(
    async () => {
      if (++calls < 3) throw dropped();
      return 'bytes';
    },
    {
      what: 'Download of a.tar.gz',
      wait: async (ms) => waits.push(ms),
      log: (line) => messages.push(line),
    },
  );
  assert.equal(result, 'bytes');
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2_000, 8_000]);
  assert.deepEqual(messages, [
    'Download of a.tar.gz: fetch failed: read ECONNRESET; trying again in 2 seconds.',
    'Download of a.tar.gz: fetch failed: read ECONNRESET; trying again in 8 seconds.',
  ]);
});

test('gives up after four attempts, saying why, and never repeats a permanent failure', async () => {
  const waits = [];
  const options = { what: 'Download of a.tar.gz', wait: async (ms) => waits.push(ms), log() {} };
  let calls = 0;
  await assert.rejects(
    retryTransient(async () => {
      calls++;
      throw dropped('ETIMEDOUT');
    }, options),
    (error) =>
      error.message === 'Download of a.tar.gz failed 4 times: fetch failed: read ETIMEDOUT' &&
      error.cause instanceof TypeError,
  );
  assert.equal(calls, 4);
  assert.deepEqual(waits, [2_000, 8_000, 30_000]);
  calls = 0;
  const missing = httpError('Asset download failed: HTTP 404', 404);
  await assert.rejects(
    retryTransient(async () => {
      calls++;
      throw missing;
    }, options),
    (error) => error === missing,
  );
  assert.equal(calls, 1);
  assert.equal(waits.length, 3, 'no pause before giving up on a missing file');
});
