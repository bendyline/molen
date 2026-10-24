import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';

const WINDOWS_FILE_LOCKS = new Set(['EBUSY', 'EPERM', 'EACCES', 'EUNKNOWN', 'UNKNOWN']);

/** Retry short-lived Windows scanner/editor locks at the filesystem operation, not the import. */
export async function retryFileOperation<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        process.platform !== 'win32' ||
        attempt >= 20 ||
        !WINDOWS_FILE_LOCKS.has((error as NodeJS.ErrnoException).code ?? '')
      )
        throw error;
      await new Promise((done) => setTimeout(done, Math.min(25 * 2 ** attempt, 250)));
    }
  }
}

/** Replace a file without truncating a destination that another process may have mapped. */
export async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await retryFileOperation(() => writeFile(temporary, data));
    await retryFileOperation(() => rename(temporary, path));
  } finally {
    await retryFileOperation(() => rm(temporary, { force: true }));
  }
}
