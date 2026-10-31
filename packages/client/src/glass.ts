import type { GlassData, GlassStateData, GlassSurfaceSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';

export interface GlassVisual {
  readonly missingNodes: string[];
  /** Simulation seconds, so pause, rewind and checkpoint restore reproduce the same debris. */
  update(state: GlassStateData | undefined, timeSeconds: number): void;
  dispose(): void;
}

function random(index: number): number {
  let value = Math.imul(index + 1, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Radial cracks and irregular connecting rings, clipped to the pane boundary. */
function laminateCracks(spec: GlassSurfaceSpec, point: [number, number]): number[] {
  const edges: number[] = [];
  const rings: THREE.Vector3[][] = [];
  for (let ring = 0; ring <= 4; ring++) {
    const vertices: THREE.Vector3[] = [];
    for (let ray = 0; ray < 20; ray++) {
      const angle = ((ray + (random(ray + 101) - 0.5) * 0.5) * Math.PI * 2) / 20;
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      const rx =
        Math.abs(dx) < 1e-9 ? Infinity : ((Math.sign(dx) * spec.size[0]) / 2 - point[0]) / dx;
      const ry =
        Math.abs(dy) < 1e-9 ? Infinity : ((Math.sign(dy) * spec.size[1]) / 2 - point[1]) / dy;
      const distance =
        Math.min(rx, ry) *
        (ring === 0 ? 0 : ring === 4 ? 1 : (ring + (random(ray + ring * 31) - 0.5) * 0.5) / 4);
      vertices.push(new THREE.Vector3(point[0] + dx * distance, point[1] + dy * distance, 0.003));
    }
    rings.push(vertices);
  }
  for (let ring = 1; ring <= 4; ring++)
    for (let ray = 0; ray < 20; ray++) {
      const p = rings[ring - 1]?.[ray] as THREE.Vector3;
      const q = rings[ring]?.[ray] as THREE.Vector3;
      edges.push(...p.toArray(), ...q.toArray());
      if (ring < 4)
        edges.push(...q.toArray(), ...(rings[ring]?.[(ray + 1) % 20] as THREE.Vector3).toArray());
    }
  return edges;
}

/** Bounded irregular cells: tempered granules, larger annealed shards, a connected laminate. */
function cells(pane: GlassSurfaceSpec): {
  geometry: THREE.BufferGeometry;
  centers: THREE.Vector3[];
  edges: number[];
} {
  const nx = pane.material === 'annealed' ? 4 : 12;
  const ny = pane.material === 'annealed' ? 3 : 8;
  const points: THREE.Vector3[] = [];
  for (let y = 0; y <= ny; y++)
    for (let x = 0; x <= nx; x++) {
      const index = y * (nx + 1) + x;
      points.push(
        new THREE.Vector3(
          ((x + (x > 0 && x < nx ? (random(index) - 0.5) * 0.6 : 0)) / nx - 0.5) * pane.size[0],
          ((y + (y > 0 && y < ny ? (random(index + 901) - 0.5) * 0.6 : 0)) / ny - 0.5) *
            pane.size[1],
          0,
        ),
      );
    }
  const positions: number[] = [],
    edges: number[] = [],
    centers: THREE.Vector3[] = [];
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const a = points[y * (nx + 1) + x] as THREE.Vector3;
      const b = points[y * (nx + 1) + x + 1] as THREE.Vector3;
      const c = points[(y + 1) * (nx + 1) + x + 1] as THREE.Vector3;
      const d = points[(y + 1) * (nx + 1) + x] as THREE.Vector3;
      // Each six-vertex cell travels together: small chunks instead of long triangular slivers.
      for (const point of [a, b, c, a, c, d]) positions.push(point.x, point.y, point.z);
      centers.push(a.clone().add(b).add(c).add(d).multiplyScalar(0.25));
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, d],
        [d, a],
      ] as const)
        edges.push(p.x, p.y, 0.003, q.x, q.y, 0.003);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return { geometry, centers, edges };
}

/**
 * Reusable rectangular glass visualization. Dedicated model panes are hidden only on release;
 * generated crack cells and debris are owned here, never written into shared GLB resources.
 * Debris is cosmetic, ballistic, bounded to eight seconds and has no collision authority.
 * `model` must carry the owner's simulation transform relative to its scene/origin-shift root.
 */
export function createGlassVisual(model: THREE.Object3D, data: GlassData): GlassVisual {
  const missingNodes: string[] = [];
  const claimed = new Set<THREE.Object3D>();
  const panes = data.surfaces
    .map((spec) => {
      const sources: THREE.Object3D[] = [];
      for (const name of spec.nodes ?? []) {
        const found: THREE.Object3D[] = [];
        model.traverse((node) => {
          if (node !== model && (node.userData.name ?? node.name) === name) found.push(node);
        });
        if (found.length === 0) missingNodes.push(name);
        for (const node of found) {
          node.traverse((child) => {
            if (claimed.has(child))
              throw new Error(`Glass node '${name}' belongs to more than one pane.`);
            claimed.add(child);
          });
          sources.push(node);
        }
      }
      return { spec, sources, visible: sources.map((node) => node.visible) };
    })
    .map(({ spec, sources, visible }) => {
      const group = new THREE.Group();
      group.name = `glass:${spec.id}`;
      model.add(group);
      const material = new THREE.MeshStandardMaterial({
        color: '#8baeb7',
        roughness: 0.18,
        metalness: 0.1,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const { geometry, centers, edges } = cells(spec);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `glass-pane:${spec.id}`;
      group.add(mesh);
      const rest = new Float32Array(geometry.getAttribute('position').array);
      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: '#e1f5f5',
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const cracks = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      cracks.name = `glass-cracks:${spec.id}`;
      group.add(cracks);
      // A detached laminate stays a sheet, preserving the source shape where available.
      const sheet = new THREE.Group();
      sheet.name = `glass-sheet:${spec.id}`;
      group.add(sheet);
      model.updateWorldMatrix(true, true);
      const paneMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3().fromArray(spec.center),
        new THREE.Quaternion().fromArray(spec.rotation),
        new THREE.Vector3(1, 1, 1),
      );
      const inverse = paneMatrix.clone().invert().multiply(model.matrixWorld.clone().invert());
      for (const node of sources) {
        const clone = node.clone(true);
        clone.matrixAutoUpdate = false;
        clone.matrix.copy(inverse).multiply(node.matrixWorld);
        clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
        clone.visible = node.visible;
        sheet.add(clone);
      }
      return {
        spec,
        sources,
        visible,
        group,
        mesh,
        cracks,
        sheet,
        geometry,
        edgeGeometry,
        material,
        edgeMaterial,
        rest,
        centers,
        paneMatrix,
        crackPoint: '',
        fragmentAge: -1,
      };
    });
  const inverse = new THREE.Matrix4(),
    pose = new THREE.Matrix4();
  const position = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    unit = new THREE.Vector3(1, 1, 1);
  const vertex = new THREE.Vector3(),
    offset = new THREE.Vector3(),
    spin = new THREE.Quaternion();
  let disposed = false;
  const update = (state: GlassStateData | undefined, time: number): void => {
    if (disposed) return;
    model.updateMatrix();
    inverse.copy(model.matrix).invert();
    for (const pane of panes) {
      const { spec, group, geometry, mesh, cracks, sheet, sources } = pane;
      const damage =
        state && Object.hasOwn(state.surfaces, spec.id) ? state.surfaces[spec.id] : undefined;
      const retained = damage?.retained !== false;
      const release = damage?.release;
      const age = release ? Math.max(0, time - release.time) : 0;
      const fragmented = damage?.fracture === 'shattered' && spec.material !== 'laminated';
      group.visible = retained || (!!release && age < 8);
      group.matrixAutoUpdate = false;
      group.matrix.copy(pane.paneMatrix);
      if (!retained && release) {
        position
          .fromArray(release.position)
          .addScaledVector(new THREE.Vector3().fromArray(release.velocity), age);
        position.y -= 0.5 * 9.81 * age * age;
        rotation.fromArray(release.rotation);
        pose.compose(position, rotation, unit);
        group.matrix.copy(inverse).multiply(pose);
      }
      group.matrixWorldNeedsUpdate = true;
      // Raw-object inspection can re-enable matrixAutoUpdate; keep its decomposed pose coherent.
      group.matrix.decompose(group.position, group.quaternion, group.scale);
      sources.forEach((node, i) => {
        node.visible = retained && (pane.visible[i] ?? true);
      });
      sheet.visible = !retained && !fragmented && sources.length > 0;
      mesh.visible = sources.length === 0 || (!retained && fragmented);
      cracks.visible = damage !== undefined && damage.fracture !== 'intact' && !fragmented;
      const crackPoint = JSON.stringify(damage?.point ?? [0, 0]);
      if (spec.material === 'laminated' && pane.crackPoint !== crackPoint) {
        pane.edgeGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(laminateCracks(spec, damage?.point ?? [0, 0]), 3),
        );
        pane.edgeGeometry.computeBoundingSphere();
        pane.crackPoint = crackPoint;
      }
      // Partial damage reveals an increasing subset of cells; a shattered laminate covers the pane.
      pane.edgeGeometry.setDrawRange(
        0,
        Math.floor((pane.edgeGeometry.getAttribute('position').count / 2) * (damage?.damage ?? 0)) *
          2,
      );
      pane.material.opacity = !retained ? 0.65 * Math.max(0, Math.min(1, 8 - age)) : 0.36;
      pane.edgeMaterial.opacity = !retained ? 0.8 * Math.max(0, Math.min(1, 8 - age)) : 0.8;
      const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;
      const fragmentAge = group.visible && !retained && fragmented ? age : -1;
      if (pane.fragmentAge === fragmentAge) continue;
      pane.fragmentAge = fragmentAge;
      array.set(pane.rest);
      if (group.visible && !retained && fragmented) {
        // Decorative separation is capped; inherited crash velocity supplies the main motion.
        for (let i = 0; i < pane.centers.length; i++) {
          const center = pane.centers[i] as THREE.Vector3;
          const dispersion = release?.fragmentSpeed ?? 0;
          offset
            .set(random(i + 17) - 0.5, random(i + 101) - 0.5, random(i + 73) - 0.5)
            .multiplyScalar(age * dispersion);
          spin.setFromAxisAngle(
            new THREE.Vector3(0.4, 0.7, 0.2).normalize(),
            (random(i + 911) - 0.5) * age * dispersion * 7,
          );
          for (let j = 0; j < 6; j++) {
            const at = (i * 6 + j) * 3;
            vertex
              .fromArray(pane.rest, at)
              .sub(center)
              .applyQuaternion(spin)
              .add(center)
              .add(offset);
            vertex.toArray(array, at);
          }
        }
      }
      attribute.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    }
  };
  update(undefined, 0);
  return {
    missingNodes,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pane of panes) {
        pane.sources.forEach((node, i) => {
          node.visible = pane.visible[i] ?? true;
        });
        pane.group.removeFromParent();
        pane.geometry.dispose();
        pane.edgeGeometry.dispose();
        pane.material.dispose();
        pane.edgeMaterial.dispose();
      }
    },
  };
}
