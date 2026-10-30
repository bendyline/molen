/** Audits the actual exported models, not just a declared list of supported controls. */

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../content/entities/source/', import.meta.url));
export async function auditAnimationCoverage({ runtime = false } = {}) {
  const rows = [];
  for (const kind of ['aircraft', 'vehicles'])
    for (const slug of (await readdir(resolve(root, kind))).sort()) {
      const directory = resolve(root, kind, slug);
      let source;
      try {
        source = JSON.parse(await readFile(resolve(directory, 'source.json'), 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
      }
      const document = JSON.parse(await readFile(resolve(directory, 'entity.types.json'), 'utf8'));
      for (const [id, { components }] of Object.entries(document.types)) {
        const data = components.aircraft ?? components.vehicle,
          spec = data?.spec;
        if (!spec) continue;
        const asset = source.files.models[0],
          bytes = await readFile(resolve(directory, asset.path));
        const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
        const nodes = gltf.nodes ?? [],
          visual = spec.visual ?? data.visual,
          bindings = visual.animation?.bindings ?? [];
        const issues = [],
          names = nodes.map((n) => n.name);
        const vertices = (i) =>
          (nodes[i].mesh === undefined
            ? 0
            : gltf.meshes[nodes[i].mesh].primitives.reduce(
                (n, p) => n + gltf.accessors[p.attributes.POSITION].count,
                0,
              )) + (nodes[i].children ?? []).reduce((n, j) => n + vertices(j), 0);
        const channels = new Set();
        const sourceOf = (name) => {
          if (channels.has(name)) return;
          channels.add(name);
          const expression = visual.animation?.derived?.[name];
          if (typeof expression === 'string') sourceOf(expression);
          else for (const arg of expression?.args ?? []) if (typeof arg === 'string') sourceOf(arg);
        };
        const destinations = new Set();
        for (const binding of bindings) {
          sourceOf(binding.source);
          const index = names.indexOf(binding.node),
            key = `${binding.node}/${binding.property}/${binding.axis ?? ''}`;
          if (index < 0) issues.push(`Missing node: ${binding.node}`);
          else if (!vertices(index)) issues.push(`Empty mechanism: ${binding.node}`);
          if (destinations.has(key)) issues.push(`Competing bindings: ${key}`);
          destinations.add(key);
        }
        for (const binding of [
          ...(visual.rotors ?? []),
          ...(visual.flaps ?? []),
          ...(visual.ailerons ?? []),
        ]) {
          const index = names.indexOf(binding.node);
          if (index < 0) issues.push(`Missing rotating surface: ${binding.node}`);
          else if (!vertices(index)) issues.push(`Empty rotating surface: ${binding.node}`);
        }
        if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== asset.sha256)
          issues.push('Source hash differs from pin');
        const actuators = Object.keys(spec.actuators ?? {}),
          fixed =
            spec.model === 'helicopter'
              ? spec.helicopter?.fixedGear !== false
              : !!spec.airplane?.fixedGear;
        for (const name of actuators)
          if (!channels.has(name)) issues.push(`Unbound actuator: ${name}`);
        if (runtime) {
          const sidecarPath = resolve(root, '..', asset.output);
          const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
          const imported = await readFile(resolve(dirname(sidecarPath), sidecar.files.main));
          const runtimeGltf = JSON.parse(
            imported.subarray(20, 20 + imported.readUInt32LE(12)).toString(),
          );
          const runtimeNames = new Set((runtimeGltf.nodes ?? []).map((node) => node.name));
          if (sidecar.sourceHash !== asset.sha256) issues.push('Runtime source hash is stale');
          if (`sha256:${createHash('sha256').update(imported).digest('hex')}` !== sidecar.hash)
            issues.push('Runtime hash differs from sidecar');
          for (const name of new Set([
            ...bindings.map((binding) => binding.node),
            ...(visual.rotors ?? []).map((rotor) => rotor.node),
            ...(visual.flaps ?? []).map((flap) => flap.node),
            ...(visual.ailerons ?? []).map((aileron) => aileron.node),
          ]))
            if (!runtimeNames.has(name)) issues.push(`Missing imported node: ${name}`);
        }
        if (kind === 'vehicles')
          for (const key of ['hood', 'trunk', 'headlights', 'wipers'])
            if (!actuators.includes(key) || !channels.has(key)) issues.push(`Missing ${key}`);
        if (kind === 'vehicles' && !actuators.some((n) => n.startsWith('door')))
          issues.push('Missing doors');
        if (kind === 'aircraft') {
          if (!visual.rotors.length) issues.push('Missing propeller/rotor/turbine');
          for (const rotor of visual.rotors)
            if (!names.includes(rotor.node)) issues.push(`Missing rotor: ${rotor.node}`);
          if (!fixed && !channels.has('gear') && !channels.has('gearPosition'))
            issues.push('Missing retractable gear binding');
          if (spec.model === 'airplane') {
            if (!visual.flaps.length && !channels.has('flapPosition') && !channels.has('flaps'))
              issues.push('Missing flaps');
            if (!visual.ailerons.length && !channels.has('rollInput'))
              issues.push('Missing roll controls');
            if (!channels.has('pitchInput') && !channels.has('elevator'))
              issues.push('Missing pitch controls');
            if (!channels.has('yawInput')) issues.push('Missing yaw controls');
          }
        }
        rows.push({
          id,
          slug,
          kind,
          model: spec.model ?? 'road',
          gear: kind === 'aircraft' ? (fixed ? 'fixed' : 'retractable') : undefined,
          actuators,
          rotors: visual.rotors?.length ?? 0,
          bindings: bindings.length,
          issues,
        });
      }
    }
  return rows;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const rows = await auditAnimationCoverage({ runtime: process.argv.includes('--runtime') }),
    failed = rows.filter((r) => r.issues.length);
  if (process.argv.includes('--write'))
    await writeFile(
      resolve(root, 'animation-coverage.json'),
      `${JSON.stringify({ format: 'molen/animation-coverage@1', models: rows }, null, 2)}\n`,
    );
  for (const row of failed) console.error(`${row.id}: ${row.issues.join('; ')}`);
  console.log(
    `Animation coverage: ${rows.filter((r) => r.kind === 'aircraft').length} aircraft, ${rows.filter((r) => r.kind === 'vehicles').length} road vehicles; ${failed.length} failures.`,
  );
  if (failed.length) process.exitCode = 1;
}
