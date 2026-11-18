import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { terrainUrbanGroundPaved } from '../src/building-coverage';
import {
  TERRAIN_GROUND_CROWN_FULL,
  TERRAIN_GROUND_CROWN_OFFSETS,
  TERRAIN_GROUND_CROWNS,
  TERRAIN_GROUND_LATTICE_SIZE,
  terrainGroundCell,
  terrainGroundCrown,
  terrainGroundLattice,
} from '../src/ground-crowns';
import { createTerrainGroundMaterial } from '../src/ground-material';

function landcoverShader(): THREE.WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <color_fragment>\n#include <normal_fragment_maps>',
  } as THREE.WebGLProgramParametersWithUniforms;
  createTerrainGroundMaterial({ agriculture: true }).onBeforeCompile(
    shader,
    {} as THREE.WebGLRenderer,
  );
  return shader;
}

describe('painted shrub crowns', () => {
  it('reads the lattice the ground material samples, at the cells its shader reads', () => {
    const shader = landcoverShader();
    const map = shader.uniforms.terrainGroundNoiseMap?.value as THREE.DataTexture;
    expect(map.image.data).toBe(terrainGroundLattice());
    expect(map.image.width).toBe(TERRAIN_GROUND_LATTICE_SIZE);
    const at = ([x, z]: readonly [number, number]) =>
      `cell + vec2(${x.toFixed(1)}, ${z.toFixed(1)})`;
    for (const offset of Object.values(TERRAIN_GROUND_CROWN_OFFSETS))
      expect(shader.fragmentShader).toContain(`terrainGroundCell(${at(offset)})`);
    expect(shader.fragmentShader).toContain(
      `vec2 cell = floor(p / ${TERRAIN_GROUND_CROWNS.cell.toFixed(1)});`,
    );
    expect(shader.fragmentShader).toContain(`share / ${TERRAIN_GROUND_CROWN_FULL.toFixed(4)}`);
    // The dome the crown paints feeds the relief the light models.
    expect(shader.fragmentShader).toContain('terrainGroundRelief += terrainGroundCrownHeight;');
  });

  it('places each crown inside its cell, as the shader draws it', () => {
    const { cell, radius: range, share } = TERRAIN_GROUND_CROWNS;
    for (let k = 0; k < 2000; k++) {
      const i = Math.floor((terrainGroundCell(k, 3) - 0.5) * 4e6),
        j = Math.floor((terrainGroundCell(7, k) - 0.5) * 4e6);
      const crown = terrainGroundCrown(i, j);
      expect(crown.radius).toBeGreaterThanOrEqual(range[0]);
      expect(crown.radius).toBeLessThanOrEqual(range[1]);
      expect(crown.x - crown.radius).toBeGreaterThanOrEqual(i * cell - 1e-9);
      expect(crown.x + crown.radius).toBeLessThanOrEqual((i + 1) * cell + 1e-9);
      expect(crown.z - crown.radius).toBeGreaterThanOrEqual(j * cell - 1e-9);
      expect(crown.z + crown.radius).toBeLessThanOrEqual((j + 1) * cell + 1e-9);
      // The shader shows it where step(cell value, min(brush * share / full, 1)) passes.
      const value = terrainGroundCell(
        i + TERRAIN_GROUND_CROWN_OFFSETS.shown[0],
        j + TERRAIN_GROUND_CROWN_OFFSETS.shown[1],
      );
      for (const brush of [0.1, 0.45, 0.85, 1])
        expect(crown.brush <= brush).toBe(
          value <= Math.min((brush * share) / TERRAIN_GROUND_CROWN_FULL, 1),
        );
    }
  });

  it('repeats with the lattice, so any frame agreeing modulo its period sees the same crowns', () => {
    const period = TERRAIN_GROUND_LATTICE_SIZE;
    const a = terrainGroundCrown(-1_337_000, 412_345);
    const b = terrainGroundCrown(-1_337_000 + period * 5, 412_345 - period * 3);
    expect(b.radius).toBe(a.radius);
    expect(b.brush).toBe(a.brush);
    expect(b.x - a.x).toBeCloseTo(period * 5 * TERRAIN_GROUND_CROWNS.cell, 6);
  });

  it('covers its share of the ground at full brush', () => {
    let area = 0;
    const cells = 256;
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) {
        const crown = terrainGroundCrown(i, j);
        if (crown.brush <= 1) area += Math.PI * crown.radius ** 2;
      }
    const covered = area / (cells * cells * TERRAIN_GROUND_CROWNS.cell ** 2);
    expect(covered).toBeGreaterThan(TERRAIN_GROUND_CROWNS.share * 0.95);
    expect(covered).toBeLessThan(TERRAIN_GROUND_CROWNS.share * 1.05);
  });

  it('paves built-up ground over between the default coverages', () => {
    expect(terrainUrbanGroundPaved(0.1)).toBe(0);
    expect(terrainUrbanGroundPaved(0.3)).toBeCloseTo(0.5, 6);
    expect(terrainUrbanGroundPaved(0.6)).toBe(1);
  });
});
