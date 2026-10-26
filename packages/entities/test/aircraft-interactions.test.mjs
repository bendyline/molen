import { readdir, readFile } from 'node:fs/promises';
import { Box3, Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

it.each([
  'source',
  'runtime',
])('models every supported control across all 53 %s cockpits, with reachable additions and independent throttles', async (version) => {
  const root = new URL('../../../content/entities/source/aircraft/', import.meta.url);
  let count = 0;
  for (const slug of await readdir(root)) {
    const directory = new URL(`${slug}/`, root);
    const document = JSON.parse(await readFile(new URL('entity.types.json', directory), 'utf8'));
    const components = Object.values(document.types)[0].components;
    const spec = components.aircraft.spec;
    const source = JSON.parse(await readFile(new URL('source.json', directory), 'utf8'));
    const assetUrl = new URL(
      `../../../content/entities/${source.files.models[0].output}`,
      import.meta.url,
    );
    const asset = JSON.parse(await readFile(assetUrl, 'utf8'));
    const bytes = await readFile(
      version === 'source'
        ? new URL('models/source.glb', directory)
        : new URL(asset.files.main, assetUrl),
    );
    const model = (
      await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      )
    ).scene;
    const visual = createAircraftVisual(model, spec);
    const controls = visual.cockpit.controls;
    const bank = spec.engines ?? [{ ...spec.engine, id: 'main' }];
    for (const action of ['mixture', 'propeller']) {
      const supported = bank.filter((e) =>
        action === 'mixture' ? e.mixtureControl : e.propellerControl,
      );
      expect(
        controls.filter((c) => c.action === action).length,
        `${slug}: ${action} capability`,
      ).toBe(supported.length);
      if (bank.length > 1)
        expect(
          controls
            .filter((c) => c.action === action)
            .map((c) => c.engine)
            .sort(),
          slug,
        ).toEqual(supported.map((e) => e.id).sort());
    }
    for (const control of controls)
      expect(
        control.nodes.length,
        `${slug}: ${control.label} has physical geometry`,
      ).toBeGreaterThan(0);
    expect(controls.find((c) => c.action === 'stick')?.nodes.length, slug).toBeGreaterThan(0);
    expect(
      controls.some((c) => c.action === 'engine' && !c.engine),
      slug,
    ).toBe(true);
    expect(
      controls.some((c) => c.action === 'power' && !c.engine),
      slug,
    ).toBe(true);
    if (spec.engines?.length > 1) {
      expect(
        controls
          .filter((c) => c.action === 'power' && c.engine)
          .map((c) => c.engine)
          .sort(),
        slug,
      ).toEqual(spec.engines.map((engine) => engine.id).sort());
      for (const control of controls.filter(
        (c) => c.action === 'power' && c.engine && c.nodes.length,
      )) {
        expect(
          visual.cockpit.interior.bindings.some(
            (b) => control.nodes.includes(b.node) && b.source === `engines.${control.engine}.power`,
          ),
          slug,
        ).toBe(true);
      }
    }
    expect(
      controls.some((c) => c.action === 'gear'),
      slug,
    ).toBe(spec.model === 'airplane' && !spec.airplane?.fixedGear);
    visual.update(components.aircraftState, components.aircraftInput, 0);
    expect(visual.interior?.missingNodes, slug).toEqual([]);
    const authored = controls.filter((control) =>
      control.nodes.some((name) => model.getObjectByName(name)?.userData.aircraftControl),
    );
    const eye = new Vector3(...spec.pilotEye);
    for (const control of authored) {
      for (const setting of ['mixture', 'propeller'].includes(control.action)
        ? [0, 1]
        : [undefined]) {
        if (setting !== undefined) {
          const pilot = { ...components.aircraftInput };
          if (control.engine)
            pilot.engines = {
              ...pilot.engines,
              [control.engine]: { ...pilot.engines?.[control.engine], [control.action]: setting },
            };
          else pilot[control.action] = setting;
          visual.update(components.aircraftState, pilot, 0);
        }
        let reachable = false;
        for (const name of control.nodes) {
          const node = model.getObjectByName(name);
          const centers = [new Box3().setFromObject(node).getCenter(new Vector3())];
          node.traverse((part) => {
            if (part.isMesh) centers.push(new Box3().setFromObject(part).getCenter(new Vector3()));
          });
          for (const center of centers)
            for (const x of [0, -0.01, 0.01])
              for (const y of [0, -0.01, 0.01]) {
                if (reachable) continue;
                const target = center.clone().add(new Vector3(x, y, 0));
                if (visual.cockpit.pick(new Ray(eye, target.sub(eye).normalize())) === control)
                  reachable = true;
              }
        }
        expect
          .soft(
            reachable,
            `${slug}: ${control.label} at ${setting ?? 'rest'} reachable from pilot eye`,
          )
          .toBe(true);
      }
    }
    visual.dispose();
    count++;
  }
  expect(count).toBe(53);
}, 30000);
