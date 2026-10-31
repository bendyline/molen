import type { AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';

interface Band {
  inner: number;
  outer: number;
  area: number;
  color: THREE.Color;
  depth: number;
}

interface Blade {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
  faded: THREE.Material[];
  shadow: boolean;
}

interface Propeller {
  engine?: string;
  speed: number;
  parts: string[];
  blades: Blade[];
  disk: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export interface AircraftPropellers {
  update(state: AircraftStateData): void;
  dispose(): void;
}

// A rotational average needs no frame history, postprocessing, canvas or custom shader, and
// works identically with WebGL and WebGPU. Keep helicopters' articulated/jettisonable rotors
// and enclosed jet fans on their existing animation path.
export function createAircraftPropellers(
  model: THREE.Object3D,
  spec: AircraftSpec,
): AircraftPropellers {
  const propellers: Propeller[] = [];
  const engines = spec.engines ?? (spec.engine ? [{ ...spec.engine, id: 'main' }] : []);
  if (spec.model === 'airplane') {
    model.updateWorldMatrix(true, true);
    for (const binding of spec.visual.rotors) {
      const engine =
        binding.engine === undefined ? engines[0] : engines.find((e) => e.id === binding.engine);
      if (!engine || engine.propulsion === 'jet') continue;
      const nodes: THREE.Object3D[] = [];
      model.traverse((node) => {
        if (node.name === binding.node) nodes.push(node);
      });
      for (const node of nodes) {
        // Some GLBs repeat the group name on its hub. Only the outer group owns the disk.
        if (ancestors(node).some((parent) => nodes.includes(parent))) continue;
        const axis = binding.axis;
        const u = axis === 'x' ? 'y' : 'x';
        const v = axis === 'z' ? 'y' : 'z';
        const inverse = node.matrixWorld.clone().invert();
        const sources: Array<{ mesh: THREE.Mesh; bands: Band[] }> = [];
        const markings: THREE.Mesh[] = [];
        let radius = 0;
        node.traverse((mesh) => {
          if (!(mesh instanceof THREE.Mesh)) return;
          if (mesh.userData.liveryMarking) {
            markings.push(mesh);
            return;
          }
          const transform = inverse.clone().multiply(mesh.matrixWorld);
          const geometry = mesh.geometry;
          const position = geometry.getAttribute('position');
          if (!position) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const count = geometry.index?.count ?? position.count;
          const groups = Array.isArray(mesh.material)
            ? geometry.groups
            : [{ start: 0, count, materialIndex: 0 }];
          const bands: Band[] = [];
          for (const group of groups) {
            const material = materials[group.materialIndex ?? 0];
            if (!material?.visible || material.opacity <= 0) continue;
            let inner = Infinity,
              outer = 0,
              area = 0,
              depth = 0,
              vertices = 0;
            const points: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
              new THREE.Vector3(),
              new THREE.Vector3(),
              new THREE.Vector3(),
            ];
            for (let i = group.start; i + 2 < Math.min(count, group.start + group.count); i += 3) {
              for (const [j, p] of points.entries()) {
                p.fromBufferAttribute(position, geometry.index?.getX(i + j) ?? i + j);
                p.applyMatrix4(transform);
                const r = Math.hypot(p[u], p[v]);
                inner = Math.min(inner, r);
                outer = Math.max(outer, r);
                depth += p[axis];
                vertices++;
              }
              const [a, b, c] = points;
              // Project the blade's closed surface onto the plane of rotation. Its front and
              // back cover the same area, so halve the sum of the projected triangle areas.
              area += Math.abs((b[u] - a[u]) * (c[v] - a[v]) - (b[v] - a[v]) * (c[u] - a[u])) / 4;
            }
            if (outer <= inner || !area) continue;
            const color =
              (material as THREE.MeshBasicMaterial).color?.clone() ?? new THREE.Color(0x555555);
            bands.push({
              inner,
              outer,
              area: area * material.opacity,
              color,
              depth: depth / vertices,
            });
            radius = Math.max(radius, outer);
          }
          sources.push({ mesh, bands });
        });
        if (radius <= 0) continue;
        // Small central hubs stay solid. Blade tips are separate meshes on many library models;
        // include those too, even when their radial span is only a few centimetres.
        const blades = sources.filter(({ bands }) => bands.some((b) => b.outer > radius * 0.35));
        const bands = blades.flatMap((b) => b.bands);
        if (!bands.length) continue;
        // Decals are children of a blade mesh. Material visibility does not hide children, so
        // fade them too, without counting their projected area a second time in the disk.
        for (const mesh of markings)
          if (ancestors(mesh).some((parent) => blades.some((blade) => blade.mesh === parent)))
            blades.push({ mesh, bands: [] });
        const disk = blurDisk(bands, radius, axis);
        disk.name = `propeller-blur:${binding.node}`;
        disk.userData.walkIgnore = true;
        disk.userData.vehicleGeometry = true;
        disk.raycast = () => {};
        disk.visible = false;
        node.add(disk);
        const parents = [node, ...ancestors(node)];
        propellers.push({
          engine: engine.id,
          speed: Math.abs(engine.rotorAngularSpeed * binding.multiplier),
          parts: (spec.collisionParts ?? [])
            .filter((part) => parents.some((p) => part.nodes.includes(p.userData.name ?? p.name)))
            .map((part) => part.id),
          disk,
          blades: blades.map(({ mesh }) => {
            const original = mesh.material;
            const faded = (Array.isArray(original) ? original : [original]).map((m) => {
              const clone = m.clone();
              clone.transparent = true;
              clone.depthWrite = false;
              return clone;
            });
            return { mesh, original, faded, shadow: mesh.castShadow };
          }),
        });
      }
    }
  }
  return {
    update(state) {
      for (const prop of propellers) {
        const reading = prop.engine === undefined ? undefined : state.engines?.[prop.engine];
        const rpm = reading?.rpm ?? state.rpm;
        const detached = prop.parts.some((part) => state.damage?.[part]?.detached);
        // 20–60 rad/s (~190–570 RPM): reach a full disk before normal operating RPM can
        // alias against a typical frame rate. Actual shaft speed also handles governor and
        // independent-engine controls; throttle/engine switches do not describe spool state.
        const blend =
          detached || !Number.isFinite(rpm)
            ? 0
            : THREE.MathUtils.smoothstep(Math.abs(rpm * prop.speed), 20, 60);
        prop.disk.visible = blend > 0;
        prop.disk.material.opacity = blend;
        for (const { mesh, original, faded, shadow } of prop.blades) {
          const originals = Array.isArray(original) ? original : [original];
          for (const [i, material] of faded.entries()) {
            const source = originals[i] as THREE.Material;
            material.opacity = source.opacity * (1 - blend);
            material.visible = source.visible && blend < 1;
          }
          mesh.material =
            blend === 0 ? original : Array.isArray(original) ? faded : (faded[0] as THREE.Material);
          mesh.castShadow = shadow && blend === 0;
        }
      }
    },
    dispose() {
      for (const prop of propellers) {
        for (const { mesh, original, faded, shadow } of prop.blades) {
          mesh.material = original;
          mesh.castShadow = shadow;
          for (const material of faded) material.dispose();
        }
        prop.disk.removeFromParent();
        prop.disk.geometry.dispose();
        prop.disk.material.dispose();
      }
      propellers.length = 0;
    },
  };
}

function ancestors(node: THREE.Object3D): THREE.Object3D[] {
  const parents: THREE.Object3D[] = [];
  for (let parent = node.parent; parent; parent = parent.parent) parents.push(parent);
  return parents;
}

function blurDisk(bands: Band[], radius: number, axis: 'x' | 'y' | 'z'): Propeller['disk'] {
  const rings = 48,
    segments = 64;
  const geometry = new THREE.RingGeometry(0, radius, segments, rings);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 4);
  const totalArea = bands.reduce((sum, b) => sum + b.area, 0);
  const depth = bands.reduce((sum, b) => sum + b.depth * b.area, 0) / totalArea;
  for (let ring = 0; ring <= rings; ring++) {
    const r = (ring / rings) * radius;
    const color = new THREE.Color(0, 0, 0);
    let alpha = 0;
    for (const band of bands) {
      const feather = Math.min(radius / rings, (band.outer - band.inner) / 2);
      const coverage =
        (band.area / (Math.PI * (band.outer ** 2 - band.inner ** 2))) *
        THREE.MathUtils.smoothstep(r, band.inner, band.inner + feather) *
        (1 - THREE.MathUtils.smoothstep(r, band.outer - feather, band.outer));
      color.add(band.color.clone().multiplyScalar(coverage));
      alpha += coverage;
    }
    if (alpha > 0) color.multiplyScalar(1 / alpha);
    for (let segment = 0; segment <= segments; segment++) {
      const i = ring * (segments + 1) + segment;
      colors.set([color.r, color.g, color.b, Math.min(0.45, alpha)], i * 4);
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  if (axis === 'x') geometry.rotateY(Math.PI / 2);
  else if (axis === 'y') geometry.rotateX(-Math.PI / 2);
  geometry.translate(axis === 'x' ? depth : 0, axis === 'y' ? depth : 0, axis === 'z' ? depth : 0);
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    }),
  );
}
