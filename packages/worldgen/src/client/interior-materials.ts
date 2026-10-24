import * as THREE from 'three';
import type { WorldgenMaterialSet } from './upload';

/** Share of the daylight a room's surfaces return, seen from the street. */
const ROOM_LIGHT = 0.45;

/** Shared neutral detail maps: metric UVs, repeat wrapping and mipmaps. Household colors stay
 * in vertex data, so different homes reuse the same small texture/material set. No downloads,
 * per-building canvases, lights, or material allocations. */
export function createInteriorMaterialSet(): WorldgenMaterialSet {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const maps: THREE.DataTexture[] = [];
  return {
    materialFor: (_slot, ref) => {
      let material = materials.get(ref);
      if (material) return material;
      const kind = ref.replace('interior:', '');
      let map: THREE.DataTexture | undefined;
      if (['wood', 'ceramic', 'fabric', 'plaster'].includes(kind)) {
        const size = 256,
          pixels = new Uint8Array(size * size * 4);
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++) {
            const hash = (Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
            const noise = ((hash ^ (hash >>> 13)) & 255) / 255;
            // Faint grain only: per-texel noise any stronger reads as static through the glass.
            let value = 247 - noise * 3;
            if (kind === 'wood') {
              const board = Math.floor(y / 32),
                joint = (x + board * 83) % 256;
              value =
                y % 32 < 1 || joint < 1
                  ? 166
                  : 233 +
                    Math.sin(x * 0.035 + Math.sin(y * 0.37) * 1.8) * 9 -
                    noise * 4 -
                    (board % 3) * 3;
            } else if (kind === 'ceramic') value = x % 64 < 2 || y % 64 < 2 ? 160 : 246 - noise * 3;
            else if (kind === 'fabric') value = 228 + ((x + y) % 2) * 5 - noise * 4;
            const offset = (y * size + x) * 4;
            pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = Math.round(value);
            pixels[offset + 3] = 255;
          }
        map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
        map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.magFilter = THREE.LinearFilter;
        map.minFilter = THREE.LinearMipmapLinearFilter;
        map.generateMipmaps = true;
        map.needsUpdate = true;
        // A two-meter wood repeat gives 25cm boards; ceramic grout repeats every 50cm.
        map.repeat.set(kind === 'fabric' ? 4 : 0.5, kind === 'fabric' ? 4 : 0.5);
        maps.push(map);
      }
      // The shared sky PMREM supplies diffuse irradiance in world viewers. Lambert materials
      // cannot consume it, so interior surfaces use the same PBR lighting path as the exterior.
      // A room sees only the patch of sky its windows frame, so it returns a fraction of that
      // light: lit like the street outside, rooms read as pale smudges behind the glass. The
      // albedo carries it (WebGPU applies envMapIntensity only to a material's own envMap).
      material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: new THREE.Color().setScalar(kind === 'lamp' ? 1 : ROOM_LIGHT),
        roughness: 0.9,
        metalness: 0,
        map: map ?? null,
        emissive: kind === 'lamp' ? 0xffe5ac : 0xaaa79b,
        emissiveIntensity: kind === 'lamp' ? 0.8 : 0.12,
        emissiveMap: map ?? null,
      });
      materials.set(ref, material);
      return material;
    },
    dispose: () => {
      for (const m of materials.values()) m.dispose();
      for (const map of maps) map.dispose();
      materials.clear();
      maps.length = 0;
    },
  };
}
