import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  injectLampField,
  LAMP_FIELD_CELL_TEXELS,
  LAMP_FIELD_CELLS,
  LAMP_FIELD_MAX_BEAMS,
  LAMP_FIELD_SLOTS,
  LAMP_FIELD_WIDTH,
  LampField,
} from '../src/three/lamp-field';

/** three's point light falloff with a cutoff, decay 2 (getDistanceAttenuation). */
const falloff = (distance: number, reach: number): number =>
  Math.max(0, Math.min(1, 1 - (distance / reach) ** 4)) ** 2 / Math.max(distance ** 2, 0.01);

const smoothstep = (from: number, to: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** The shader's lamp sum (LAMP_FIELD_GLSL), read from the texture the way it reads it. */
function shaded(field: LampField, local: THREE.Vector3, normal: THREE.Vector3): number {
  const data = field.uniforms.molenLampData.value.image.data as Float32Array;
  const grid = field.uniforms.molenLampGrid.value;
  const view = field.uniforms.molenLampView.value;
  const fade = field.uniforms.molenLampFade.value;
  const cx = Math.floor((local.x - grid.x) / grid.z);
  const cz = Math.floor((local.z - grid.y) / grid.z);
  if (cx < 0 || cz < 0 || cx >= LAMP_FIELD_CELLS || cz >= LAMP_FIELD_CELLS) return 0;
  let total = 0;
  for (let t = 0; t < LAMP_FIELD_CELL_TEXELS; t++) {
    const at = (cz * LAMP_FIELD_WIDTH + cx * LAMP_FIELD_CELL_TEXELS + t) * 4;
    if ((data[at] as number) < 0) break;
    for (let s = 0; s < 4; s++) {
      const index = data[at + s] as number;
      if (index < 0) break;
      const l =
        ((LAMP_FIELD_CELLS + Math.floor(index / LAMP_FIELD_WIDTH)) * LAMP_FIELD_WIDTH +
          (index % LAMP_FIELD_WIDTH)) *
        4;
      total += lampLight(
        [data[l] as number, data[l + 1] as number, data[l + 2] as number, data[l + 3] as number],
        local,
        normal,
        grid.w,
        view,
        fade,
      );
    }
  }
  return total;
}

function lampLight(
  lamp: readonly [number, number, number, number],
  local: THREE.Vector3,
  normal: THREE.Vector3,
  reach: number,
  view: THREE.Vector4,
  fade: THREE.Vector4,
): number {
  const to = new THREE.Vector3(lamp[0], lamp[1], lamp[2]).sub(local);
  const distance = to.length();
  const away = Math.min(
    Math.hypot(lamp[0] - view.x, lamp[2] - view.y),
    Math.hypot(lamp[0] - view.z, lamp[2] - view.w) * fade.z,
  );
  const facing = Math.max(0, normal.dot(to)) / Math.max(distance, 0.01);
  return lamp[3] * facing * falloff(distance, reach) * (1 - smoothstep(fade.x, fade.y, away));
}

const litShader = (
  kind: 'standard' | 'physical' | 'lambert' | 'phong' | 'toon' | 'basic',
): THREE.WebGLProgramParametersWithUniforms =>
  ({
    vertexShader: THREE.ShaderLib[kind].vertexShader,
    fragmentShader: THREE.ShaderLib[kind].fragmentShader,
    uniforms: {},
  }) as unknown as THREE.WebGLProgramParametersWithUniforms;

describe('lamp field', () => {
  it('lists every lamp that reaches a point in its cell, as summing all of them would', () => {
    const field = new LampField();
    // A street of lamps every 28 m, alternating sides, a cross street, and a crowded plaza.
    const lamps: number[] = [];
    for (let i = 0; i < 24; i++) lamps.push(-330 + i * 28, 6.5, i % 2 ? 9 : -9, 1);
    for (let i = 0; i < 12; i++) lamps.push(i % 2 ? 7 : -7, 4.6, -160 + i * 28, 0.8);
    for (let i = 0; i < 10; i++) lamps.push(120 + (i % 4) * 6, 4.6, 40 + Math.floor(i / 4) * 6, 1);
    field.setLamps(lamps);
    field.setView({ anchor: [0, 0, 0], eye: [0, 1.6, 0], focus: [0, 0, 40], intensity: 180 });
    expect(field.lamps).toBe(46);
    const view = field.uniforms.molenLampView.value;
    const fade = field.uniforms.molenLampFade.value;
    let lit = 0;
    for (let x = -340; x <= 340; x += 7.3)
      for (let z = -170; z <= 170; z += 6.1)
        for (const [y, normal] of [
          [0.1, new THREE.Vector3(0, 1, 0)],
          [5, new THREE.Vector3(0, 0, Math.sign(z) || 1)],
        ] as const) {
          const local = new THREE.Vector3(x, y, z);
          let expected = 0;
          for (let i = 0; i < lamps.length; i += 4)
            expected += lampLight(
              lamps.slice(i, i + 4) as [number, number, number, number],
              local,
              normal,
              field.reach,
              view,
              fade,
            );
          // The texture holds float32: a strength of 0.8 reads back 1e-8 off.
          expect(shaded(field, local, normal)).toBeCloseTo(expected, 6);
          if (expected > 0) lit++;
        }
    expect(lit).toBeGreaterThan(500);
  });

  it('fades lamps out with distance from the camera, and from the focus counted 1.2 times', () => {
    const field = new LampField();
    const fade = field.uniforms.molenLampFade.value;
    expect(fade.toArray()).toEqual([210, 300, 1.2, 0]);
    // A lamp 250 m out: in the fade from the camera, nearly full beside the focus.
    field.setLamps([250, 5, 0, 1]);
    const under = new THREE.Vector3(250, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    field.setView({ anchor: [0, 0, 0], eye: [0, 0, 0], focus: [0, 0, -100], intensity: 180 });
    const fromEye = shaded(field, under, up);
    expect(fromEye).toBeCloseTo(falloff(5, 42) * (1 - smoothstep(210, 300, 250)), 9);
    field.setView({ anchor: [0, 0, 0], eye: [0, 0, 0], focus: [240, 0, 0], intensity: 180 });
    expect(shaded(field, under, up)).toBeCloseTo(falloff(5, 42), 9);
    // A caller that had more lamps than the field holds says where it stopped.
    field.setLamps([250, 5, 0, 1], 1, 200);
    expect(fade.toArray()).toEqual([140, 200, 1.2, 0]);
    field.setLamps([250, 5, 0, 1]);
    expect(fade.y).toBe(300);
  });

  it('keeps the lamps nearest a crowded cell and drops the farthest', () => {
    const field = new LampField();
    const lamps: number[] = [];
    // Thirty lamps in a 2 m ring, all reaching the middle cell; one far lamp sets the grid size.
    for (let i = 0; i < 30; i++)
      lamps.push(Math.cos(i / 5) * (1 + i * 0.05), 5, Math.sin(i / 5) * (1 + i * 0.05), 1);
    lamps.push(400, 5, 400, 1);
    field.setLamps(lamps);
    const data = field.uniforms.molenLampData.value.image.data as Float32Array;
    const grid = field.uniforms.molenLampGrid.value;
    const cx = Math.floor(-grid.x / grid.z),
      cz = Math.floor(-grid.y / grid.z);
    const listed: number[] = [];
    for (let t = 0; t < LAMP_FIELD_CELL_TEXELS; t++)
      for (let s = 0; s < 4; s++)
        listed.push(
          data[(cz * LAMP_FIELD_WIDTH + cx * LAMP_FIELD_CELL_TEXELS + t) * 4 + s] as number,
        );
    expect(listed).toHaveLength(LAMP_FIELD_SLOTS);
    expect(listed.every((index) => index >= 0)).toBe(true);
    // The ones kept are nearer the cell's middle than any left out.
    const middle = [grid.x + (cx + 0.5) * grid.z, grid.y + (cz + 0.5) * grid.z];
    const away = (i: number) =>
      Math.hypot(
        (lamps[i * 4] as number) - (middle[0] as number),
        (lamps[i * 4 + 2] as number) - (middle[1] as number),
      );
    const worstKept = Math.max(...listed.map(away));
    for (let i = 0; i < 30; i++)
      if (!listed.includes(i)) expect(away(i)).toBeGreaterThanOrEqual(worstKept);
  });

  it('places the anchor from its frame when drawn, after a floating-origin shift', () => {
    const field = new LampField();
    const world = new THREE.Group();
    const root = new THREE.Group();
    world.add(root);
    world.position.set(-7_542_000, 0, 2_919_000);
    field.setLamps([3, 5, 4, 1]);
    field.setView({
      frame: root,
      anchor: [7_542_120.5, 220, -2_919_040.25],
      eye: [7_542_121.5, 221.6, -2_919_040.25],
      focus: [7_542_131.5, 220, -2_919_040.25],
      intensity: 90,
    });
    const anchor = field.uniforms.molenLampAnchor.value;
    expect(anchor.toArray()).toEqual([120.5, 220, -40.25, 90]);
    expect(field.uniforms.molenLampView.value.toArray()).toEqual([1, 0, 11, 0]);
    // The renderer rebases before it draws; prepare follows without the host's help.
    world.position.set(-7_542_100, 0, 2_919_000);
    field.prepare();
    expect(anchor.toArray()).toEqual([20.5, 220, -40.25, 90]);
  });

  it('packs beams against the anchor, ends the list, and drops what does not fit', () => {
    const field = new LampField();
    field.setView({
      anchor: [100, 0, 100],
      eye: [100, 2, 100],
      focus: [100, 0, 160],
      intensity: 0,
    });
    const beam = (x: number, intensity = 35) => ({
      position: [x, 0.7, 100] as const,
      direction: [0, -6, 18] as const,
      intensity,
    });
    field.setBeams([beam(101), beam(102, 0), beam(103)]);
    const slots = field.uniforms.molenLampBeams.value;
    expect(slots[0]?.toArray()).toEqual([1, 0.7, 0, 35]);
    expect(slots[2]?.toArray()).toEqual([3, 0.7, 0, 35]);
    expect(slots[1]?.length()).toBeCloseTo(Math.hypot(1, 0.5), 9);
    expect(slots[1]?.w).toBe(0.5);
    expect(slots[4]?.w).toBe(0);
    field.setBeams(Array.from({ length: LAMP_FIELD_MAX_BEAMS + 3 }, (_, i) => beam(100 + i)));
    expect(slots.filter((slot, i) => i % 2 === 0 && slot.w > 0)).toHaveLength(LAMP_FIELD_MAX_BEAMS);
    field.clear();
    expect(slots[0]?.w).toBe(0);
    expect(field.uniforms.molenLampAnchor.value.w).toBe(0);
    expect(field.lamps).toBe(0);
  });

  it('adds the light to the direct diffuse of every lit shader kind, and leaves unlit ones', () => {
    const field = new LampField();
    for (const kind of ['standard', 'physical', 'lambert', 'phong', 'toon'] as const) {
      const shader = litShader(kind);
      expect(injectLampField(shader, field.uniforms)).toBe(true);
      const source = shader.fragmentShader;
      const call = source.indexOf('reflectedLight.directDiffuse += molenLampLight(');
      expect(call).toBeGreaterThan(source.indexOf('#include <lights_fragment_begin>'));
      expect(call).toBeLessThan(source.indexOf('#include <lights_fragment_maps>'));
      expect(source.indexOf('vec3 molenLampLight(')).toBeLessThan(source.indexOf('void main()'));
      expect(shader.uniforms.molenLampData).toBe(field.uniforms.molenLampData);
    }
    // After other hooks have expanded the lights chunk in place.
    const expanded = litShader('standard');
    expanded.fragmentShader = expanded.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      THREE.ShaderChunk.lights_fragment_begin,
    );
    expect(injectLampField(expanded, field.uniforms)).toBe(true);
    const unlit = litShader('basic');
    const before = unlit.fragmentShader;
    expect(injectLampField(unlit, field.uniforms)).toBe(false);
    expect(unlit.fragmentShader).toBe(before);
  });

  it('rejects bad input', () => {
    expect(() => new LampField({ fadeFrom: 300, fadeTo: 200 })).toThrow(RangeError);
    const field = new LampField();
    expect(() => field.setLamps([0, Number.NaN, 0, 1])).toThrow(RangeError);
    expect(() => field.setLamps([0, 0, 0, 1], 2)).toThrow(RangeError);
    expect(() => field.setLamps([0, 0, 0, 1], 1, 0)).toThrow(RangeError);
    expect(() =>
      field.setView({ anchor: [0, 0, 0], eye: [0, 0, Infinity], focus: [0, 0, 0], intensity: 1 }),
    ).toThrow(RangeError);
  });
});
