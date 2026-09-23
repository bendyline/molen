// Every op returns `{ ok: false, error }` (or `formatted`) instead of throwing: an agent reads
// the failure as data, and the MCP server maps it to `isError` text. These helpers make that
// contract cheap to keep — wrap the implementation, render any escaped exception.

/** Render an unknown thrown value as an agent-facing message (with the cause chain). */
export function opError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts: string[] = [e.message];
  let cause: unknown = e.cause;
  let guard = 0;
  while (cause instanceof Error && guard++ < 5) {
    parts.push(cause.message);
    cause = cause.cause;
  }
  return parts.join(' — ');
}

/**
 * Run an op implementation; if it throws, return `fail(message)` instead. Legitimate `ok:false`
 * results pass through untouched (only exceptions are converted).
 */
export async function guardOp<T>(fail: (error: string) => T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    return fail(opError(e));
  }
}
