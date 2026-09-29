/** Explicit semantic surfaces for authored models; no material inference from names or colors. */
import { cross, normalize } from './authored-structure-mesh.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';

const slots = new Set(['wall', 'roof', 'trim', 'foundation', 'window', 'door']);
const graphPrefix = 'matgraph:molen.worldgen.material.';
const portableFields = ['alphaMode', 'baseColorFactor', 'doubleSided', 'alphaCutoff'];

/** Resolve one declared surface and validate the shared catalog's physical repeat. */
export function resolveArchitecturalSurface(surface, repeats = MATERIAL_REPEAT_METERS) {
  if (!surface || !slots.has(surface.slot))
    throw new Error(`Invalid architectural material slot: ${surface?.slot}`);
  const shared = surface.graph !== undefined;
  if (shared) {
    if (typeof surface.graph !== 'string' || !Object.hasOwn(repeats, surface.graph))
      throw new Error(`Unknown architectural material graph: ${surface.graph}`);
    if (surface.localRef !== undefined)
      throw new Error('A surface must declare either a shared graph or a localRef');
  } else if (typeof surface.localRef !== 'string' || !surface.localRef.trim()) {
    throw new Error('A local architectural surface needs an explicit localRef');
  }
  const repeat = shared ? repeats[surface.graph] : [1, 1];
  if (
    !Array.isArray(repeat) ||
    repeat.length !== 2 ||
    repeat.some((value) => !Number.isFinite(value) || value <= 0)
  )
    throw new Error(`Invalid physical repeat for ${surface.graph}`);
  return { surface, repeat, ref: shared ? `${graphPrefix}${surface.graph}` : surface.localRef };
}

/**
 * Planar metric projection plus explicitly supplied `metric:uv` coordinates.
 * Geometry, normals and vertex colors pass through unchanged. Cylindrical/long-edge mapping
 * remains with its specialized authors until it is deliberately supported here.
 *
 * metricTriangleUv preserves the existing per-model triangle convention; quads always honor
 * `metric:uv`. legacyAlphaFields retains older generators' alpha-only factor/sidedness export,
 * including their single-sided opaque fallbacks. New callers should leave it false.
 */
export function createArchitecturalSurfaceAuthoring(
  definitions,
  {
    metricTriangleUv = false,
    defaultLocalName = 'local-architectural-surface',
    legacyAlphaFields = false,
    repeats = MATERIAL_REPEAT_METERS,
  } = {},
) {
  const declared = new Map(
    Object.entries(definitions).map(([component, surface]) => [
      component,
      resolveArchitecturalSurface(surface, repeats),
    ]),
  );
  const used = new Map();
  function prepare(component, normal) {
    const item = declared.get(component);
    if (!item) throw new Error(`Unknown architectural surface ${component}`);
    used.set(`${item.surface.slot}:${item.ref}`, item);
    const n = normalize(normal),
      u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
      v = normalize(cross(n, u));
    const uv = (point) => [
      point.reduce((sum, value, axis) => sum + value * u[axis], 0) / item.repeat[0],
      point.reduce((sum, value, axis) => sum + value * v[axis], 0) / item.repeat[1],
    ];
    return { ...item, uv };
  }
  const metricUvs = (uvs, repeat) => uvs.map((uv) => [uv[0] / repeat[0], uv[1] / repeat[1]]);
  return {
    wrap(builder) {
      return {
        addQuad(component, inputRef, points, normal, inputUv, color) {
          const item = prepare(component, normal);
          const uv =
            inputRef === 'metric:uv' ? metricUvs(inputUv, item.repeat) : points.map(item.uv);
          builder.addQuad(item.surface.slot, item.ref, points, normal, uv, color);
        },
        addTriangle(component, inputRef, points, normal, inputUv, color) {
          const item = prepare(component, normal);
          const uv =
            metricTriangleUv && inputRef === 'metric:uv'
              ? metricUvs(inputUv, item.repeat)
              : points.map(item.uv);
          builder.addTriangle(item.surface.slot, item.ref, points, normal, uv, color);
        },
        addConvexPolygon(component, _inputRef, points, normal, _inputUv, color) {
          const item = prepare(component, normal);
          builder.addConvexPolygon(item.surface.slot, item.ref, points, normal, item.uv, color);
        },
      };
    },
    materials(groups) {
      return groups.map((group) => {
        const item = used.get(`${group.slot}:${group.materialRef}`);
        if (!item) throw new Error(`Unknown GLB surface ${JSON.stringify(group)}`);
        const material = item.surface;
        const result = {
          name: material.graph ?? material.name ?? defaultLocalName,
          roughness: material.roughness,
          metallic: material.metallic,
        };
        if (!legacyAlphaFields || material.alphaMode)
          for (const field of portableFields)
            if (material[field] !== undefined) result[field] = material[field];
        if (material.graph)
          result.sharedSurface = { ref: item.ref, slot: material.slot, uv: 'repeats' };
        return result;
      });
    },
  };
}
