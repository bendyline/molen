/** Shared collection metadata; each concrete structure lives in source/structures/<thing>/. */
import catalog from '../../../content/worldgen/source/shared/structure-library/catalog.json' with {
  type: 'json',
};

export const TAXONOMIES = catalog.taxonomies;
export const REFERENCES = catalog.references;
export const STRUCTURE_ORDER = catalog.structureOrder;
