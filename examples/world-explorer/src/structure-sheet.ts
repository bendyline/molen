import { AssetCache, createGltfLoader, MaterialResolver } from '@bendyline/molen-client';
import { EARTH_EXPOSURE, EARTH_LIGHTING, EARTH_SKY_PALETTE } from '@bendyline/molen-earth/client';
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
    false,
    {},
    content.fonts,
  );
  function createPreview() {
    let yaw = 0.68;
    let renderRevision = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(1);
    renderer.setSize(640, 440);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // The Earth view's own sun, sky fill and tone mapping, so a style reviewed here looks the way
    // it will in the world (see the medium-fi style guide).
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EARTH_EXPOSURE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8ece3');
    scene.add(
      new THREE.HemisphereLight(
        EARTH_SKY_PALETTE.dayHorizon,
        EARTH_SKY_PALETTE.ground,
        EARTH_LIGHTING.dayAmbient,
      ),
    );
    const light = new THREE.DirectionalLight(EARTH_SKY_PALETTE.sun, EARTH_LIGHTING.sunIntensity);
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
      if (textured) await materials.prepare(refs);
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
      metrics.set(entry.style, {
        triangles: output.buildings?.triangleCount ?? 0,
        groups: output.buildings?.groups.length ?? 0,
        hash: output.hash,
      });
      return true;
    }
    return {
      renderer,
      render,
      view,
      setYaw(value: number): void {
        yaw = value;
      },
      rotate(delta: number): void {
        yaw += delta;
        view();
      },
      dispose(): void {
        renderRevision++;
        if (object) disposeWorldgenObject(object);
        ground.geometry.dispose();
        ground.material.dispose();
        light.shadow.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  }
  // Separate scenes: pending thumbnails can never replace an open detail model.
  let preview: ReturnType<typeof createPreview> | undefined;
  let detail: ReturnType<typeof createPreview> | undefined;
  let disposed = false;
  const urls = new Set<string>();
  const nextFrame = (): Promise<void> =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
    card.className = 'card';
    card.dataset.style = entry.style;
    card.dataset.taxonomy = entry.taxonomy;
    const img = document.createElement('img');
    img.alt = ''; // The adjacent title names the card; previews are decorative.
    img.hidden = true;
    const placeholder = document.createElement('span');
    placeholder.className = 'preview-placeholder';
    placeholder.textContent = 'Preview loads on view';
    placeholder.setAttribute('aria-hidden', 'true');
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
    card.append(placeholder, img, copy);
    collection.append(card);
    card.addEventListener('click', () => void openEntry(entry));
    const style = loaded.pack.archstyles[entry.style];
    const searchable =
      `${entry.title} ${entry.description} ${entry.countries.join(' ')} ${entry.style} ${JSON.stringify(style?.materials)}`.toLowerCase();
    return {
      entry,
      card,
      img,
      placeholder,
      searchable,
      pending: undefined as Promise<void> | undefined,
    };
  });
  function filter(): void {
    let count = 0;
    const term = search.value.toLowerCase();
    for (const { entry, card, searchable } of cards) {
      const match =
        (!taxonomy.value || entry.taxonomy === taxonomy.value) && searchable.includes(term);
      card.hidden = !match;
      if (match) count++;
    }
    status.textContent = `${count} / ${cards.length} structures`;
    void drain();
  }
  search.addEventListener('input', filter);
  taxonomy.addEventListener('change', filter);
  let redrawRevision = 0;
  async function redraw(): Promise<void> {
    if (!selected || !detail || disposed) return;
    const revision = ++redrawRevision;
    const entry = selected;
    const width = Number(element<HTMLInputElement>('width').value),
      depth = Number(element<HTMLInputElement>('depth').value),
      levels = Number(element<HTMLInputElement>('levels').value);
    element('width-value').textContent = `${width} m`;
    element('depth-value').textContent = `${depth} m`;
    element('levels-value').textContent = String(levels);
    element('detail-stats').textContent = 'Rendering preview…';
    try {
      const rendered = await detail.render(
        entry,
        width,
        depth,
        levels,
        Number(element<HTMLSelectElement>('tier').value),
        element<HTMLInputElement>('textures').checked,
      );
      if (rendered && revision === redrawRevision && !disposed) {
        detail.view();
        const stats = metrics.get(entry.style);
        element('detail-stats').textContent =
          `${stats?.triangles.toLocaleString()} triangles · ${stats?.groups} material groups · stable identity`;
      }
    } catch (error) {
      errors.push(String(error));
      if (revision === redrawRevision)
        element('detail-stats').textContent =
          `Preview unavailable: ${String(error)}. Change a control to retry.`;
    }
  }
  async function openEntry(entry: Entry): Promise<void> {
    selected = entry;
    detail ??= createPreview();
    detail.setYaw(0.68);
    element('detail-title').textContent = entry.title;
    element('detail-region').textContent =
      `${groupTitles.get(entry.taxonomy)} / ${entry.countries.join(' · ')}`;
    element('detail-description').textContent = entry.description;
    element('detail-id').textContent = entry.style;
    for (const key of ['width', 'depth', 'levels'] as const) {
      element<HTMLInputElement>(key).value = String(entry[key]);
    }
    element<HTMLSelectElement>('view').value = 'quarter';
    element('detail-view').append(detail.renderer.domElement);
    if (!dialog.open) dialog.showModal();
    await redraw();
  }
  let redrawTimer: ReturnType<typeof setTimeout> | undefined;
  for (const id of ['width', 'depth', 'levels', 'tier', 'textures'])
    element(id).addEventListener('input', () => {
      clearTimeout(redrawTimer);
      // Coalesce slider input; each generation and texture preparation has real cost.
      redrawTimer = setTimeout(() => void redraw(), 80);
    });
  element('view').addEventListener('change', () => {
    const v = element<HTMLSelectElement>('view').value;
    detail?.setYaw(v === 'front' ? 0 : v === 'rear' ? Math.PI : 0.68);
    detail?.view();
  });
  element('close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    void drain();
  });
  let dragX: number | undefined;
  let dragPointer: number | undefined;
  const detailView = element('detail-view');
  detailView.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || dragPointer !== undefined) return;
    dragX = e.clientX;
    dragPointer = e.pointerId;
    detailView.setPointerCapture(e.pointerId);
  });
  detailView.addEventListener('pointermove', (e) => {
    if (dragX === undefined || dragPointer !== e.pointerId) return;
    detail?.rotate((e.clientX - dragX) * 0.012);
    dragX = e.clientX;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    detailView.addEventListener(type, () => {
      dragX = undefined;
      dragPointer = undefined;
    });

  type Card = (typeof cards)[number];
  const near = new Set<Card>();
  let draining = false;
  let exporting = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const card = cards.find((c) => c.card === entry.target);
        if (!card) continue;
        if (entry.isIntersecting) near.add(card);
        else near.delete(card);
      }
      void drain();
    },
    { rootMargin: '250px' },
  );
  for (const { card } of cards) observer.observe(card);
  async function thumbnail(card: Card): Promise<void> {
    if (card.img.src || disposed) return;
    if (card.pending) return card.pending;
    card.pending = (async () => {
      try {
        preview ??= createPreview();
        await preview.render(card.entry);
        if (disposed) return;
        preview.view();
        const blob = await new Promise<Blob | null>((resolve) =>
          preview?.renderer.domElement.toBlob(resolve, 'image/png'),
        );
        if (!blob) throw new Error('No preview image was produced');
        if (disposed) return;
        const url = URL.createObjectURL(blob);
        urls.add(url);
        card.img.src = url;
        await card.img.decode();
        card.img.hidden = false;
        card.placeholder.hidden = true;
        card.card.dataset.preview = 'ready';
      } catch (error) {
        errors.push(String(error));
        card.img.removeAttribute('src');
        card.card.dataset.preview = 'error';
        card.placeholder.textContent = 'Preview unavailable · open details';
      }
    })();
    await card.pending;
    card.pending = undefined;
  }
  async function drain(): Promise<void> {
    if (draining || exporting || dialog.open || disposed) return;
    draining = true;
    try {
      while (!dialog.open && !exporting && !disposed) {
        const card = [...near].find((c) => !c.card.hidden && !c.card.dataset.preview);
        if (!card) break;
        // Yield before each generation so filters, focus and the detail dialog respond first.
        await nextFrame();
        if (dialog.open || exporting || disposed) break;
        await thumbnail(card);
      }
    } finally {
      draining = false;
    }
  }
  const download = element<HTMLButtonElement>('download');
  download.disabled = false;
  download.addEventListener('click', async () => {
    exporting = true;
    status.textContent = 'Preparing the complete model sheet…';
    download.disabled = true;
    try {
      // Finish only on an explicit export. Wait for the current lazy preview before sharing
      // its renderer; the independently rendered detail dialog remains usable throughout.
      for (const card of cards) if (card.pending) await card.pending;
      for (const [i, card] of cards.entries()) {
        if (disposed) return;
        download.textContent = `Preparing sheet ${i + 1} / ${cards.length}…`;
        await thumbnail(card);
        await nextFrame();
      }
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
        if (card.img.complete && card.img.naturalWidth) ctx.drawImage(card.img, x, y, 300, 206);
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
        status.textContent = 'Model sheet downloaded.';
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
    } catch (error) {
      errors.push(String(error));
      status.textContent = `Could not export sheet: ${String(error)}. Try again.`;
    } finally {
      exporting = false;
      download.disabled = false;
      download.textContent = 'Download model sheet ↗';
      void drain();
    }
  });
  filter();
  function dispose(): void {
    disposed = true;
    observer.disconnect();
    clearTimeout(redrawTimer);
    preview?.dispose();
    detail?.dispose();
    materials.dispose();
    flat.dispose?.();
    assets.dispose();
    for (const url of urls) URL.revokeObjectURL(url);
  }
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) dispose();
  });
  if (import.meta.hot) import.meta.hot.dispose(dispose);

  Object.assign(window, {
    __structureSheet: {
      ready: true,
      count: cards.length,
      errors,
      get previewsReady() {
        return cards.filter((c) => c.card.dataset.preview === 'ready').length;
      },
      get materialFailures() {
        return [...materials.failures];
      },
      get metrics() {
        return Object.fromEntries(metrics);
      },
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
