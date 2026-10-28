/** Four complete representations share the signed source frame and span schedule. */
import { buildPivnichnyiLevel } from './pivnichnyi-browser.mjs';
export const buildPivnichnyiSkyline = (out) => buildPivnichnyiLevel(out, 'skyline');
export const buildPivnichnyiDistrict = (out) => buildPivnichnyiLevel(out, 'district');
export const buildPivnichnyiStreet = (out) => buildPivnichnyiLevel(out, 'street');
export const buildPivnichnyiCloseup = (out) => buildPivnichnyiLevel(out, 'closeup');
