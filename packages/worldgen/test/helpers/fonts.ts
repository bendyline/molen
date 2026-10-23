import { readFileSync } from 'node:fs';
import { loadFontLibrary } from '@bendyline/molen-materials/text';

const read = async (path: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../../content/earth/fonts/${path}`, import.meta.url), 'utf8'),
  );
export const FONTS = await loadFontLibrary(await read('catalog.json'), read);
