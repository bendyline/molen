/**
 * The one material every figure body is drawn with: vertex colours (the body's colour regions)
 * under a matte standard shader. Shared by the `figure` kind, ambient walkers and the designer
 * preview, so a figure looks the same wherever it is drawn.
 */

import * as THREE from 'three';

/** A new figure material (callers own and dispose it). */
export function createFigureMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
}
