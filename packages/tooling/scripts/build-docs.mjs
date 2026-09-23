import { cp } from 'node:fs/promises';

await cp(
  new URL('../../../docs-src/', import.meta.url),
  new URL('../dist/docs-src/', import.meta.url),
  { recursive: true },
);
