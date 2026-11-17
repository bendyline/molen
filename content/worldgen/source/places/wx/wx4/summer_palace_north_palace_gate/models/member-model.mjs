import { readFileSync } from 'node:fs';
import { buildSummerPalaceMember } from '../../summer_palace/models/summer-palace-entrance-model.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export { surfaces } from '../../summer_palace/models/summer-palace-entrance-model.mjs';
export const buildMaster = (out) => buildSummerPalaceMember(out, layout, 'master');
export const buildSkyline = (out) => buildSummerPalaceMember(out, layout, 'skyline');
export const buildDistrict = (out) => buildSummerPalaceMember(out, layout, 'district');
export const buildStreet = (out) => buildSummerPalaceMember(out, layout, 'street');
export const buildCloseup = (out) => buildSummerPalaceMember(out, layout, 'closeup');
