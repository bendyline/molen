import * as THREE from 'three';
import type { BundleGroup, WebGPURenderer } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import { WebGpuSceneOptimizer } from '../src/three/webgpu-scene-optimizer';

function fixture() {
  const setRenderObjectFunction = vi.fn();
  const driver = {
    setRenderObjectFunction,
    getRenderObjectFunction: () => setRenderObjectFunction.mock.lastCall?.[0],
    shadowMap: { enabled: false },
    backend: { updateBinding: vi.fn() },
    _nodes: { needsRefresh: vi.fn(() => true) },
    getMRT: () => null,
    getDrawingBufferSize: (target: THREE.Vector2) => target.set(320, 240),
    getPixelRatio: () => 1,
  };
  const optimizer = new WebGpuSceneOptimizer(driver as unknown as WebGPURenderer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 8;
  const group = optimizer.createGroup() as BundleGroup;
  scene.add(group);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial(),
    2,
  );
  group.add(mesh);
  const prepare = () => optimizer.prepare(scene, camera);
  return { optimizer, scene, camera, group, mesh, prepare, driver };
}

describe('WebGPU persistent buffers and command invalidation', () => {
  it('skips only initialized unchanged observers, refreshing edits and node animation', () => {
    const { optimizer, group, mesh, prepare, driver } = fixture();
    const monitor = { hasNode: false, hasAnimation: false, renderObjects: new WeakMap() };
    const object = { bundle: group, getMonitor: () => monitor };
    prepare();
    expect(driver._nodes.needsRefresh(object)).toBe(true);
    Object.assign(group, { recordedVersion: group.version });
    expect(driver._nodes.needsRefresh(object)).toBe(true);
    monitor.renderObjects.set(object, {});
    expect(driver._nodes.needsRefresh(object)).toBe(false);
    monitor.hasNode = true;
    expect(driver._nodes.needsRefresh(object)).toBe(true);
    monitor.hasNode = false;
    mesh.position.x++;
    prepare();
    expect(driver._nodes.needsRefresh(object)).toBe(true);
    optimizer.dispose();
    expect(driver._nodes.needsRefresh(object)).toBe(true);
  });
  it('preserves shared instance attributes and honors writes through retained references', () => {
    const { mesh, group, prepare } = fixture();
    const source = mesh.instanceMatrix;
    const other = new THREE.InstancedMesh(mesh.geometry, mesh.material, 0);
    other.count = mesh.count;
    other.instanceMatrix = source;
    group.add(other);
    prepare();
    expect(mesh.instanceMatrix).toBe(source);
    expect(other.instanceMatrix).toBe(mesh.instanceMatrix);
    expect(mesh.instanceMatrix.array).toBe(source.array);
    const version = mesh.instanceMatrix.version;
    prepare();
    expect(mesh.instanceMatrix.version).toBe(version);
    source.setXYZ(0, 2, 3, 4);
    source.needsUpdate = true;
    prepare();
    expect(mesh.instanceMatrix.version).toBe(version + 1);
    mesh.instanceMatrix.needsUpdate = true;
    prepare();
    expect(other.instanceMatrix.version).toBe(version + 2);
  });

  it('keeps stable command versions but invalidates camera, transforms, visibility and draw changes', () => {
    const { group, mesh, prepare } = fixture();
    prepare();
    let version = group.version;
    prepare();
    expect(group.version).toBe(version);
    const edits = [
      () => {
        mesh.position.x++;
      },
      () => {
        mesh.count = 1;
      },
      () => {
        mesh.visible = false;
      },
      () => {
        mesh.visible = true;
      },
      () => {
        mesh.geometry.setDrawRange(0, 12);
      },
      () => {
        (mesh.material as THREE.MeshStandardMaterial).color.set('red');
      },
      () => {
        group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
      },
      () => {
        group.remove(mesh);
      },
    ];
    for (const edit of edits) {
      edit();
      prepare();
      expect(group.version).toBeGreaterThan(version);
      version = group.version;
      prepare();
      expect(group.version).toBe(version);
    }
  });

  it('uses normal draws during camera motion and resumes command caching after settling', () => {
    const { group, camera, prepare } = fixture();
    prepare();
    prepare();
    camera.position.x++;
    prepare();
    expect(group.isBundleGroup).toBe(false);
    camera.position.x++;
    prepare();
    expect(group.isBundleGroup).toBe(false);
    for (let frame = 1; frame < 8; frame++) {
      prepare();
      expect(group.isBundleGroup).toBe(false);
    }
    prepare();
    expect(group.isBundleGroup).toBe(true);
    const version = group.version;
    prepare();
    expect(group.version).toBe(version);
  });

  it('keeps the one-time WebGPU projection initialization cached', () => {
    const { group, camera, prepare } = fixture();
    prepare();
    camera.projectionMatrix.elements[0] = 2;
    prepare();
    expect(group.isBundleGroup).toBe(true);
    prepare();
    expect(group.isBundleGroup).toBe(true);
  });

  it('does not mistake repeated fixed-step poses for a settled camera', () => {
    const { group, camera, prepare } = fixture();
    prepare();
    prepare();
    for (let step = 0; step < 4; step++) {
      camera.position.x++;
      prepare();
      expect(group.isBundleGroup).toBe(false);
      for (let interstitialFrame = 0; interstitialFrame < 7; interstitialFrame++) {
        prepare();
        expect(group.isBundleGroup).toBe(false);
      }
    }
  });

  it('updates automatic LOD while commands are cached and catches lighting changes', () => {
    const { mesh, group, scene, camera, prepare } = fixture();
    const lod = new THREE.LOD();
    const low = new THREE.Mesh(new THREE.BoxGeometry(), mesh.material);
    lod.addLevel(mesh, 0).addLevel(low, 20);
    group.add(lod);
    const light = new THREE.DirectionalLight();
    scene.add(light);
    prepare();
    expect(mesh.visible).toBe(true);
    camera.position.z = 40;
    prepare();
    expect(low.visible).toBe(true);
    expect(mesh.visible).toBe(false);
    const version = group.version;
    light.intensity = 3;
    prepare();
    expect(group.version).toBeGreaterThan(version);
  });

  it('uses ordinary drawing for unsupported content and never creates nested bundles', () => {
    const { optimizer, group, mesh, prepare, driver } = fixture();
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.transparent = true;
    prepare();
    expect(group.isBundleGroup).toBe(false);
    material.transparent = false;
    prepare();
    expect(group.isBundleGroup).toBe(true);
    driver.shadowMap.enabled = true;
    prepare();
    expect(group.isBundleGroup).toBe(false);
    driver.shadowMap.enabled = false;
    const nested = optimizer.createGroup() as BundleGroup;
    group.add(nested);
    prepare();
    expect(group.isBundleGroup).toBe(false);
    expect(nested.isBundleGroup).toBe(true);
  });
});
