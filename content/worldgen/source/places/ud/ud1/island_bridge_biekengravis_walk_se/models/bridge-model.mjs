import {
  bridgeSurfaces,
  buildIslandComponent,
} from '../../island_bridge/models/island-bridge-kit.mjs';

export { bridgeSurfaces };
export const componentId = 'island_bridge_biekengravis_walk_se';
export const buildBridgeLevel = (out, level = 'master') =>
  buildIslandComponent(out, level, componentId);
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
