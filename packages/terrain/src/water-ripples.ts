import * as THREE from 'three';

// A shared slope/height field, generated once rather than evaluating dozens of waves per pixel.
// Integer Fourier frequencies make both values and derivatives seamless at the texture edges.
// The independently drifting, warped samples below hide its period in world space.
// Like the ground noise lattice, this immutable texture lives for the module's lifetime.
let rippleTexture: THREE.DataTexture | undefined;

export function waterRippleTexture(): THREE.DataTexture {
  if (rippleTexture) return rippleTexture;
  const size = 256;
  const field = new Float32Array(size * size * 3);
  let seed = 0x72a4f19b;
  const random = (): number => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let wave = 0; wave < 48; wave++) {
    const angle = random() * Math.PI * 2;
    const frequency = 6 + random() * 26;
    const x = Math.round(Math.cos(angle) * frequency);
    const y = Math.round(Math.sin(angle) * frequency);
    const length = Math.hypot(x, y);
    const phase = random() * Math.PI * 2;
    const amplitude = 0.5 + random() * 0.5;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const p = ((col * x + row * y) / size) * Math.PI * 2 + phase;
        const slope = Math.cos(p) * amplitude;
        const index = (row * size + col) * 3;
        field[index] = (field[index] ?? 0) + (slope * x) / length;
        field[index + 1] = (field[index + 1] ?? 0) + (slope * y) / length;
        field[index + 2] = (field[index + 2] ?? 0) + (Math.sin(p) * amplitude * 16) / length;
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    for (let channel = 0; channel < 3; channel++)
      data[i * 4 + channel] = Math.round(
        127.5 + THREE.MathUtils.clamp((field[i * 3 + channel] ?? 0) / 16, -1, 1) * 127.5,
      );
    data[i * 4 + 3] = 255;
  }
  rippleTexture = new THREE.DataTexture(data, size, size);
  rippleTexture.name = 'terrain:water-ripples';
  rippleTexture.wrapS = rippleTexture.wrapT = THREE.RepeatWrapping;
  rippleTexture.magFilter = THREE.LinearFilter;
  rippleTexture.minFilter = THREE.LinearMipmapLinearFilter;
  rippleTexture.generateMipmaps = true;
  rippleTexture.needsUpdate = true;
  return rippleTexture;
}

/** Shared coefficients keep GLSL and TSL sampling the same moving surface. */
export const WATER_RIPPLE_LAYERS: ReadonlyArray<{
  scale: number;
  direction: readonly [number, number];
  drift: readonly [number, number];
  weight: number;
}> = [
  { scale: 0.12, direction: [0.8, 0.6], drift: [0.013, -0.007], weight: 0.85 },
  { scale: 0.67, direction: [0.6, -0.8], drift: [-0.011, -0.017], weight: 1 },
  { scale: 2.17, direction: [-0.8, 0.6], drift: [0.019, 0.009], weight: 0.6 },
];

const literal = (value: number): string => value.toFixed(6);

export const WATER_RIPPLES_GLSL: string = /* glsl */ `
  uniform sampler2D terrainWaterRipples;
  vec3 terrainWaterDetail(vec2 worldPosition, float phase) {
    vec2 p = worldPosition * terrainWaterWaveScale;
    // Slow patches bend the wavelets and vary their energy, instead of tinting the water
    // with broad, painted-looking sine bands. Four filtered reads for the entire surface.
    vec3 area = texture2D(terrainWaterRipples, p * 0.009 + vec2(phase * 0.001, 0.0)).rgb * 2.0 - 1.0;
    vec2 warp = area.rg * 0.025;
    vec2 slope = vec2(0.0);
    ${WATER_RIPPLE_LAYERS.map(
      ({ scale, direction: [x, y], drift: [dx, dy], weight }, i) => `
      vec2 uv${i} = vec2(dot(p, vec2(${literal(x)}, ${literal(y)})),
        dot(p, vec2(${literal(-y)}, ${literal(x)}))) * vec2(1.0, 0.65) * ${literal(scale)};
      vec2 n${i} = texture2D(terrainWaterRipples, uv${i} + warp +
        vec2(${literal(dx)}, ${literal(dy)}) * phase).rg * 2.0 - 1.0;
      slope += (vec2(${literal(x)}, ${literal(y)}) * n${i}.x +
        vec2(${literal(-y)}, ${literal(x)}) * n${i}.y * 0.65) * ${literal(weight)};`,
    ).join('\n')}
    return vec3(slope * (1.0 + area.b * 0.7) * terrainWaterWaveStrength * 14.0,
      area.b * terrainWaterWaveStrength);
  }
`;
