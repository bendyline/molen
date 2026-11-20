import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { buildFontisFrontage } from './catacombs-fontis.mjs';
import { buildCatacombInterior } from './catacombs-interior.mjs';
import { buildCatacombSurface } from './catacombs-surface.mjs';

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.88, metallic: 0 },
  rough: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  foundation: {
    slot: 'foundation',
    graph: 'stone_limestone_weathered',
    roughness: 0.94,
    metallic: 0,
  },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.18 },
  glazing: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.59, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.92, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.87, metallic: 0 },
  water: {
    slot: 'roof',
    localRef: 'palette:#ffffff',
    name: 'well water',
    roughness: 0.34,
    metallic: 0,
  },
};

const tiers = {
  skyline: { romans: 5, joinery: false, closedLandings: true },
  district: {
    romans: 6,
    joinery: false,
    tunnelFacets: 2,
    stairFacets: 16,
    authoredStairs: false,
    boneFaces: false,
  },
  street: {
    romans: 10,
    joinery: true,
    tunnelFacets: 3,
    stairFacets: 16,
    authoredStairs: true,
    boneFaces: false,
  },
  closeup: {
    romans: 14,
    joinery: true,
    tunnelFacets: 7,
    stairFacets: 26,
    authoredStairs: true,
    boneFaces: true,
    boneSpacing: 0.31,
    boneBands: 7,
  },
  master: {
    romans: 18,
    joinery: true,
    tunnelFacets: 10,
    stairFacets: 32,
    authoredStairs: true,
    boneFaces: true,
  },
};

export function buildCatacombs(out, name) {
  const detail = { name, ...tiers[name] };
  buildCatacombSurface(out, detail);
  buildFontisFrontage(out, detail);
  buildCatacombInterior(out, detail);
}

export const buildSkyline = (out) => buildCatacombs(out, 'skyline');
export const buildDistrict = (out) => buildCatacombs(out, 'district');
export const buildStreet = (out) => buildCatacombs(out, 'street');
export const buildCloseup = (out) => buildCatacombs(out, 'closeup');
