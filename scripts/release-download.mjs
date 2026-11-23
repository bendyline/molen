// Retries for requests to GitHub releases. A bundle is hundreds of attachments fetched one after
// another, so one dropped connection among them must not fail the job that asked for them.

const NETWORK = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);
const BUSY = new Set([408, 425, 429, 500, 502, 503, 504]);
/** Milliseconds before the second, third and fourth attempts. */
const DELAYS = [2_000, 8_000, 30_000];
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/** An HTTP failure that keeps its status, so a retry can tell a busy server from a missing file. */
export function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

const chain = (error) => {
  const errors = [];
  for (let e = error; e && errors.length < 5; e = e.cause) errors.push(e);
  return errors;
};

/**
 * Whether repeating a failed request may succeed: the network or a busy server failed, not the
 * file. Checksum mismatches, missing releases and local disk errors are not retried.
 */
export function isTransient(error) {
  return chain(error).some(
    (e) =>
      BUSY.has(e.status) ||
      e.name === 'TimeoutError' ||
      NETWORK.has(e.code) ||
      // Node's fetch reports any network failure as "fetch failed" and a body cut short as
      // "terminated", with the system error as the cause when there is one.
      (e instanceof TypeError && (e.message === 'fetch failed' || e.message === 'terminated')),
  );
}

/** An error's message with the causes behind it: "fetch failed" alone says nothing in a CI log. */
export function reason(error) {
  const parts = [];
  for (const e of chain(error)) {
    // A DOMException's code is a legacy number; only a system error's name adds anything.
    const code = typeof e.code === 'string' && !String(e.message).includes(e.code) ? e.code : '';
    const text = code ? `${e.message} [${code}]` : e.message;
    if (text && !parts.includes(text)) parts.push(text);
  }
  return parts.join(': ') || String(error);
}

/**
 * Run `work`, running it again after a pause when it fails for a transient reason. `work` must be
 * safe to repeat (a download writes its own temporary file each time). The error of the last
 * attempt is thrown with its causes spelled out.
 */
export async function retryTransient(
  work,
  { what = 'Request', delays = DELAYS, wait = pause, log = console.log } = {},
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!isTransient(error)) throw error;
      if (attempt >= delays.length)
        throw new Error(`${what} failed ${attempt + 1} times: ${reason(error)}`, { cause: error });
      log(
        `${what}: ${reason(error)}; trying again in ${Math.round(delays[attempt] / 1000)} seconds.`,
      );
      await wait(delays[attempt]);
    }
  }
}
