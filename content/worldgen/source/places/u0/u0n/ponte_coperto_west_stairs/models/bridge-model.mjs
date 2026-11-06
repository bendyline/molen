import { buildCopertoComponent, surfacesById } from '../../ponte_coperto/models/kit.mjs';
export const componentId = 'ponte_coperto_west_stairs';
export const bridgeSurfaces = surfacesById[componentId];
export const buildBridgeLevel = (out, level = 'master') =>
  buildCopertoComponent(out, level, componentId);
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
