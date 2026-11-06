import * as THREE from 'three';

/**
 * Draw a model's double-sided transparent materials (canopies, windscreens, instrument covers) in
 * one pass. Three otherwise draws each such mesh twice, back faces then front, and flags the
 * material for a new program before each pass: two program lookups and two full uniform uploads
 * per pane, every frame. A P-51 on an apron of parked aircraft switched 52 programs a frame that
 * way. The panes are thin and blended without depth writes (glTF BLEND), so only the order in
 * which a pane's two faces blend can change.
 */
export function drawGlassInOnePass(mesh: THREE.Mesh): void {
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    if (material.transparent && material.side === THREE.DoubleSide) material.forceSinglePass = true;
}
