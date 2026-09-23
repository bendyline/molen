import type { SkyData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { Renderer } from './renderer';

/** Mirrors the schema `environment` component (loose; all fields optional). */
export interface EnvironmentData {
  /** Earth or authored clear sky. Owns ambient/sun/moon lights when present. */
  sky?: SkyData;
  ambient?: { sky?: string; ground?: string; intensity?: number };
  sun?: {
    direction?: [number, number, number];
    color?: string;
    intensity?: number;
    castShadow?: boolean;
  };
  background?: string;
  fog?: { color: string; near?: number; far?: number };
  toneMapping?: 'none' | 'aces' | 'agx';
  exposure?: number;
  shadows?: 'off' | 'low' | 'medium' | 'high';
}

/** Exactly the rig the renderer always shipped — existing scenes render byte-identical. */
export const defaultEnvironment: EnvironmentData = {
  ambient: { sky: '#ffffff', ground: '#444455', intensity: 1.1 },
  sun: { direction: [5, 10, 7], color: '#ffffff', intensity: 1.4 },
};

const RIG_NAME = '$environment';

const SHADOW_MAP_SIZE: Record<'low' | 'medium' | 'high', number> = {
  low: 1024,
  medium: 2048,
  high: 4096,
};

/**
 * Apply an environment onto the renderer + scene: replaces the ambient/sun rig, background,
 * fog, tone mapping, exposure, and the shadow quality tier. Passing `defaultEnvironment`
 * restores the stock rig; omitted fields fall back to it.
 */
export function applyEnvironment(renderer: Renderer, env: EnvironmentData): void {
  renderer.setSky(env.sky, env.shadows ?? 'off');
  const scene = renderer.scene;
  const existing = scene.getObjectByName(RIG_NAME);
  if (existing !== undefined) {
    existing.traverse((object) => {
      if ((object as THREE.Light).isLight) (object as THREE.Light).dispose();
    });
    scene.remove(existing);
  }

  const rig = new THREE.Group();
  rig.name = RIG_NAME;

  const ambient = env.ambient ?? defaultEnvironment.ambient;
  if (ambient !== undefined && env.sky === undefined) {
    rig.add(
      new THREE.HemisphereLight(
        new THREE.Color(ambient.sky ?? '#ffffff'),
        new THREE.Color(ambient.ground ?? '#444455'),
        ambient.intensity ?? 1.1,
      ),
    );
  }

  const shadows = env.shadows ?? 'off';
  const sun = env.sun ?? defaultEnvironment.sun;
  if (sun !== undefined && env.sky === undefined) {
    const dir = new THREE.DirectionalLight(
      new THREE.Color(sun.color ?? '#ffffff'),
      sun.intensity ?? 1.4,
    );
    const d = sun.direction ?? [5, 10, 7];
    dir.position.set(d[0], d[1], d[2]);
    if (shadows !== 'off' && sun.castShadow === true) {
      dir.castShadow = true;
      const size = SHADOW_MAP_SIZE[shadows];
      dir.shadow.mapSize.set(size, size);
      dir.shadow.camera.near = 0.5;
      dir.shadow.camera.far = 500;
      const extent = 50;
      dir.shadow.camera.left = -extent;
      dir.shadow.camera.right = extent;
      dir.shadow.camera.top = extent;
      dir.shadow.camera.bottom = -extent;
    }
    rig.add(dir);
  }
  scene.add(rig);

  renderer.three.shadowMap.enabled = shadows !== 'off';
  renderer.three.shadowMap.type = shadows === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

  renderer.three.setClearColor(
    env.background !== undefined ? new THREE.Color(env.background) : renderer.defaultClearColor,
    1,
  );
  scene.fog =
    env.fog !== undefined
      ? new THREE.Fog(new THREE.Color(env.fog.color), env.fog.near ?? 1, env.fog.far ?? 1000)
      : null;

  renderer.three.toneMapping =
    env.toneMapping === 'aces'
      ? THREE.ACESFilmicToneMapping
      : env.toneMapping === 'agx'
        ? THREE.AgXToneMapping
        : THREE.NoToneMapping;
  renderer.three.toneMappingExposure = env.exposure ?? 1;
}
