import { buildCausewaySection } from '../../sheikh_jaber_al_ahmad_al_sabah_causeway/models/causeway-model.mjs';

const id = 'sheikh_jaber_al_ahmad_al_sabah_causeway_ramp_09';
export const buildSkyline = (out) => buildCausewaySection(out, 'skyline', id);
export const buildDistrict = (out) => buildCausewaySection(out, 'district', id);
export const buildStreet = (out) => buildCausewaySection(out, 'street', id);
export const buildCloseup = (out) => buildCausewaySection(out, 'closeup', id);
export const buildMaster = (out) => buildCausewaySection(out, 'master', id);
