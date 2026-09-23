import { AssetCache, createGltfLoader, MaterialResolver } from '@bendyline/molen-client';
import {
  buffersToObject3D,
  createInstancedPlacements,
  createResolvedMaterialSet,
  createVertexColorMaterialSet,
  disposeWorldgenObject,
  ModelLibrary,
  unitBoxGeometry,
} from '@bendyline/molen-worldgen/client';
import {
  type BuildingRequest,
  generateWorldgenBatch,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { loadExplorerContent } from './content';

interface Entry {
  style: string;
  title: string;
  taxonomy: string;
  region: string;
  countries: string[];
  type: string;
  description: string;
  width: number;
  depth: number;
  levels: number;
  shape: string;
  classes: string[];
}
interface Catalog {
  entries: Entry[];
  taxonomies: Array<{ id: string; title: string }>;
}
function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const status = element('status');
const collection = element('collection');
const dialog = element<HTMLDialogElement>('detail');
const search = element<HTMLInputElement>('search');
const taxonomy = element<HTMLSelectElement>('taxonomy');
const metrics = new Map<string, { triangles: number; groups: number; hash: string }>();
const errors: string[] = [];
let selected: Entry | undefined;
let yaw = 0.68;
let renderRevision = 0;

function requestFor(
  entry: Entry,
  width = entry.width,
  depth = entry.depth,
  levels = entry.levels,
): BuildingRequest {
  let points: Vec2[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  if (entry.shape === 'l')
    points = [
      [0, 0],
      [1, 0],
      [1, 0.48],
      [0.46, 0.48],
      [0.46, 1],
      [0, 1],
    ];
  if (entry.shape === 'u')
    points = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0.72, 1],
      [0.72, 0.38],
      [0.28, 0.38],
      [0.28, 1],
      [0, 1],
    ];
  if (entry.shape === 't')
    points = [
      [0, 0],
      [1, 0],
      [1, 0.4],
      [0.65, 0.4],
      [0.65, 1],
      [0.35, 1],
      [0.35, 0.4],
      [0, 0.4],
    ];
  const map = ([x, z]: Vec2): Vec2 => [(x - 0.5) * width, (z - 0.5) * depth];
  return {
    identity: `catalog:${entry.style}`,
    style: entry.style,
    labels: entry.classes,
    outline: points.map(map),
    levels,
    ...(entry.shape === 'courtyard'
      ? {
          holes: [
            [
              [0.3, 0.3],
              [0.3, 0.7],
              [0.7, 0.7],
              [0.7, 0.3],
            ].map((p) => map(p as Vec2)),
          ],
        }
      : {}),
  };
}

async function main(): Promise<void> {
  const content = await loadExplorerContent(new URL('./', location.href), { styleId: 'default' });
  if (content.worldgen === undefined) throw new Error(content.worldgenError ?? 'no style pack');
  const catalog = await content.packs.readJson<Catalog>(
    'pack:molen.worldgen.default/structures/catalog.json',
  );
  if (catalog.entries.length !== 120)
    throw new Error(`Expected120 catalog entries; got ${catalog.entries.length}`);
  const loaded = { pack: content.worldgen.pack };
  const provider = content.assets;
  const resolver = new MaterialResolver(provider);
  const materials = createResolvedMaterialSet(resolver);
  const flat = createVertexColorMaterialSet();
  const assets = new AssetCache(provider, createGltfLoader());
  const models = new ModelLibrary(
    async (ref) => (await assets.instance(ref)).scene,
    content.worldgen.places.landmarks.definitions,
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(640, 440);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8ece3');
  scene.add(new THREE.HemisphereLight('#fff9eb', '#9ba99b', 1.3));
  const light = new THREE.DirectionalLight('#fff3dd', 2);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0003;
  light.shadow.normalBias = 0.08;
  scene.add(light, light.target);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: '#e8ece3', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = -0.05;
  scene.add(ground);
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 1000);
  let object: THREE.Group | undefined;
  let currentBounds = new THREE.Box3();
  function view(): void {
    const center = currentBounds.getCenter(new THREE.Vector3());
    const size = currentBounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z, 4);
    const direction = new THREE.Vector3(Math.sin(yaw), 0.68, Math.cos(yaw)).normalize();
    camera.position.copy(center).addScaledVector(direction, extent * 3.5);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const projected = new THREE.Box3();
    for (const x of [currentBounds.min.x, currentBounds.max.x])
      for (const y of [currentBounds.min.y, currentBounds.max.y])
        for (const z of [currentBounds.min.z, currentBounds.max.z])
          projected.expandByPoint(
            new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse),
          );
    const projectedSize = projected.getSize(new THREE.Vector3());
    const halfHeight = Math.max(projectedSize.y / 2, projectedSize.x / 2 / (640 / 440)) * 1.22;
    camera.left = (-halfHeight * 640) / 440;
    camera.right = -camera.left;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.far = extent * 10;
    camera.updateProjectionMatrix();
    light.position.copy(center).add(new THREE.Vector3(-extent, extent * 1.8, extent * 0.9));
    light.target.position.copy(center);
    light.shadow.camera.left = -extent;
    light.shadow.camera.right = extent;
    light.shadow.camera.top = extent;
    light.shadow.camera.bottom = -extent;
    light.shadow.camera.far = extent * 6;
    light.shadow.camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  async function render(
    entry: Entry,
    width = entry.width,
    depth = entry.depth,
    levels = entry.levels,
    tier = 0,
    textured = true,
  ): Promise<boolean> {
    const revision = ++renderRevision;
    const output = generateWorldgenBatch({
      buildings: [requestFor(entry, width, depth, levels)],
      pack: loaded.pack,
      tier,
      interiors: false,
      budgets: { maxBuildingVertices: 250000, maxMaterialGroups: 64 },
    });
    const refs = output.buildings?.groups.map((g) => g.materialRef) ?? [];
    await materials.prepare(textured ? refs : []);
    const group = new THREE.Group();
    if (output.buildings)
      group.add(buffersToObject3D(output.buildings, textured ? materials : flat));
    for (const set of output.placements) {
      const model =
        set.modelRef === 'builtin:box'
          ? { geometry: unitBoxGeometry(), material: flat.materialFor('wall', 'palette:#ffffff') }
          : await models.prepare(set.modelRef);
      const mesh = createInstancedPlacements(set, model.geometry, model.material);
      mesh.castShadow = true;
      group.add(mesh);
    }
    if (revision !== renderRevision) {
      disposeWorldgenObject(group);
      return false;
    }
    if (object) {
      scene.remove(object);
      disposeWorldgenObject(object);
    }
    object = group;
    scene.add(group);
    currentBounds = new THREE.Box3().setFromObject(group);
    if (currentBounds.isEmpty()) throw new Error(`Empty structure: ${entry.style}`);
    ground.position.y = currentBounds.min.y - 0.035;
    view();
    metrics.set(entry.style, {
      triangles: output.buildings?.triangleCount ?? 0,
      groups: output.buildings?.groups.length ?? 0,
      hash: output.hash,
    });
    return true;
  }
  const groupTitles = new Map(catalog.taxonomies.map((t) => [t.id, t.title]));
  for (const tax of catalog.taxonomies) {
    const option = document.createElement('option');
    option.value = tax.id;
    option.textContent = tax.title;
    taxonomy.append(option);
  }
  const cards = catalog.entries.map((entry, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.disabled = true;
    card.className = 'card';
    card.dataset.style = entry.style;
    card.dataset.taxonomy = entry.taxonomy;
    const img = document.createElement('img');
    img.alt = `${entry.title}, rendered three-quarter view`;
    img.width = 640;
    img.height = 440;
    const copy = document.createElement('div');
    copy.className = 'card-copy';
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(3, '0');
    const tax = document.createElement('span');
    tax.textContent = groupTitles.get(entry.taxonomy) ?? entry.taxonomy;
    meta.append(number, tax);
    const title = document.createElement('h2');
    title.textContent = entry.title;
    const info = document.createElement('p');
    info.textContent = `${entry.countries.join(' / ')} · ${entry.width} × ${entry.depth} m · ${entry.levels}F`;
    const id = document.createElement('div');
    id.className = 'card-id';
    id.textContent = entry.style.replace('molen.worldgen.', '');
    copy.append(meta, title, info, id);
    card.append(img, copy);
    collection.append(card);
    card.addEventListener('click', () => void openEntry(entry));
    return { entry, card, img };
  });
  function filter(): void {
    let count = 0;
    const term = search.value.toLowerCase();
    for (const { entry, card } of cards) {
      const style = loaded.pack.archstyles[entry.style];
      const match =
        (!taxonomy.value || entry.taxonomy === taxonomy.value) &&
        `${entry.title} ${entry.description} ${entry.countries.join(' ')} ${entry.style} ${JSON.stringify(style?.materials)}`
          .toLowerCase()
          .includes(term);
      card.hidden = !match;
      if (match) count++;
    }
    status.textContent = `${count} / 120 structures`;
  }
  search.addEventListener('input', filter);
  taxonomy.addEventListener('change', filter);
  async function redraw(): Promise<void> {
    if (!selected) return;
    const width = Number(element<HTMLInputElement>('width').value),
      depth = Number(element<HTMLInputElement>('depth').value),
      levels = Number(element<HTMLInputElement>('levels').value);
    element('width-value').textContent = `${width} m`;
    element('depth-value').textContent = `${depth} m`;
    element('levels-value').textContent = String(levels);
    if (
      await render(
        selected,
        width,
        depth,
        levels,
        Number(element<HTMLSelectElement>('tier').value),
        element<HTMLInputElement>('textures').checked,
      )
    ) {
      const stats = metrics.get(selected.style);
      element('detail-stats').textContent =
        `${stats?.triangles.toLocaleString()} triangles · ${stats?.groups} material groups · stable identity`;
    }
  }
  async function openEntry(entry: Entry): Promise<void> {
    selected = entry;
    yaw = 0.68;
    element('detail-title').textContent = entry.title;
    element('detail-region').textContent =
      `${groupTitles.get(entry.taxonomy)} / ${entry.countries.join(' · ')}`;
    element('detail-description').textContent = entry.description;
    element('detail-id').textContent = entry.style;
    for (const key of ['width', 'depth', 'levels'] as const) {
      element<HTMLInputElement>(key).value = String(entry[key]);
    }
    element<HTMLSelectElement>('view').value = 'quarter';
    element('detail-view').append(renderer.domElement);
    if (!dialog.open) dialog.showModal();
    await redraw();
  }
  for (const id of ['width', 'depth', 'levels', 'tier', 'textures'])
    element(id).addEventListener('input', () => void redraw());
  element('view').addEventListener('change', () => {
    const v = element<HTMLSelectElement>('view').value;
    yaw = v === 'front' ? 0 : v === 'rear' ? Math.PI : 0.68;
    view();
  });
  element('close').addEventListener('click', () => dialog.close());
  let dragX: number | undefined;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    dragX = e.clientX;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (dragX === undefined) return;
    yaw += (e.clientX - dragX) * 0.012;
    dragX = e.clientX;
    view();
  });
  renderer.domElement.addEventListener('pointerup', () => {
    dragX = undefined;
  });
  for (const [index, { entry, img }] of cards.entries()) {
    status.textContent = `Rendering ${index + 1} / 120…`;
    await render(entry);
    const png = renderer.domElement.toDataURL('image/png');
    img.src = png;
    if (index % 4 === 0)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  const download = element<HTMLButtonElement>('download');
  for (const { card } of cards) card.disabled = false;
  download.disabled = false;
  download.addEventListener('click', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2560;
    canvas.height = 380 + 15 * 310;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#f4f1e9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#293b39';
    ctx.font = '80px Georgia';
    ctx.fillText('Molen · Atlas of structures', 60, 130);
    ctx.font = '22px Arial';
    ctx.fillText(
      '120 procedural structures / Default resource collection / World architecture',
      64,
      188,
    );
    ctx.font = '17px Arial';
    ctx.fillText(
      'Each study is generated by the production world renderer. Representative dimensions in meters.',
      64,
      233,
    );
    for (const [i, card] of cards.entries()) {
      const x = 40 + (i % 8) * 310,
        y = 300 + Math.floor(i / 8) * 310;
      ctx.drawImage(card.img, x, y, 300, 206);
      ctx.fillStyle = '#293b39';
      ctx.font = '18px Georgia';
      ctx.fillText(`${String(i + 1).padStart(3, '0')}  ${card.entry.title}`, x + 5, y + 230, 290);
      ctx.fillStyle = '#6c7b6b';
      ctx.font = '12px Arial';
      ctx.fillText(card.entry.countries.join(' / '), x + 5, y + 251, 290);
      ctx.fillText(
        `${card.entry.width} × ${card.entry.depth} m · ${card.entry.levels}F`,
        x + 5,
        y + 270,
      );
      ctx.fillText(card.entry.style.replace('molen.worldgen.', ''), x + 5, y + 288, 290);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'molen-120-structures.png';
      link.href = href;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
  });
  status.textContent = '120 / 120 structures';
  Object.assign(window, {
    __structureSheet: {
      ready: true,
      count: cards.length,
      errors,
      materialFailures: [...materials.failures],
      metrics: Object.fromEntries(metrics),
      entries: catalog.entries,
      open: async (style: string) => {
        const entry = catalog.entries.find((e) => e.style === style);
        if (!entry) throw new Error(style);
        await openEntry(entry);
      },
      resize: async (width: number, depth: number, levels: number) => {
        element<HTMLInputElement>('width').value = String(width);
        element<HTMLInputElement>('depth').value = String(depth);
        element<HTMLInputElement>('levels').value = String(levels);
        await redraw();
      },
      view: (angle: string) => {
        element<HTMLSelectElement>('view').value = angle;
        element('view').dispatchEvent(new Event('change'));
      },
    },
  });
}
void main().catch((error) => {
  errors.push(String(error));
  status.textContent = `Could not render collection: ${String(error)}`;
  Object.assign(window, { __structureSheet: { ready: false, errors } });
  console.error(error);
});
