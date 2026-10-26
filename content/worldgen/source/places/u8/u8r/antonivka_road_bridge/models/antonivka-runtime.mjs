/** Four complete browser levels share the source alignment and explicit damage gaps. */
import { buildAntonivkaLevel } from '../../../../../../../../packages/worldgen/scripts/antonivka-bridge-model.mjs';
export const buildAntonivkaSkyline = (out) => buildAntonivkaLevel(out, 'skyline');
export const buildAntonivkaDistrict = (out) => buildAntonivkaLevel(out, 'district');
export const buildAntonivkaStreet = (out) => buildAntonivkaLevel(out, 'street');
export const buildAntonivkaCloseup = (out) => buildAntonivkaLevel(out, 'closeup');
