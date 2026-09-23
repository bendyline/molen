// Emits the registered Zod schemas as JSON Schema (draft 2020-12) files into dist/schemas/.
// These are the published interchange representation; Zod source remains the source of truth.
// Field `.describe()` calls in src/ become `description` keys here, so every emitted schema is
// self-documenting (units, axis conventions).
//
// dist/schemas/ is reachable from outside the package: package.json maps the subpath pattern
// "./schemas/*" onto "./dist/schemas/*", so a consumer imports
// `@bendyline/molen-schema/schemas/scene.schema.json`. Every `$id` is absolute
// (jsonSchemaId(): https://molen.dev/schemas/<kind>@<n>.json) so a `"$schema"` line in an
// authored document resolves and one emitted schema can `$ref` another.
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import {
  componentNames,
  getComponent,
  getSchema,
  jsonSchemaId,
  schemaKinds,
} from '../dist/index.mjs';

mkdirSync('dist/schemas', { recursive: true });
mkdirSync('dist/schemas/components', { recursive: true });

let emitted = 0;
for (const kind of schemaKinds()) {
  const entry = getSchema(kind);
  const jsonSchema = z.toJSONSchema(entry.zod, { io: 'input' });
  jsonSchema.$id = jsonSchemaId(entry.meta.id);
  jsonSchema.title = entry.meta.title;
  jsonSchema.description = entry.meta.description;
  jsonSchema.examples = entry.meta.examples;
  writeFileSync(`dist/schemas/${kind}.schema.json`, `${JSON.stringify(jsonSchema, null, 2)}\n`);
  emitted++;
  // Previous accepted versions, e.g. scene.v1.schema.json (still validated via auto-upgrade).
  for (const legacy of entry.legacy) {
    const versionMatch = /@(\d+)$/.exec(legacy.id);
    const legacySchema = z.toJSONSchema(legacy.zod, { io: 'input' });
    legacySchema.$id = jsonSchemaId(legacy.id);
    legacySchema.title = `${entry.meta.title} (previous version)`;
    legacySchema.examples = legacy.examples;
    writeFileSync(
      `dist/schemas/${kind}.v${versionMatch?.[1] ?? '0'}.schema.json`,
      `${JSON.stringify(legacySchema, null, 2)}\n`,
    );
    emitted++;
  }
}

// One JSON Schema per registered core component (the vocabulary `molen component <name>` and
// get_component describe), so consumers can validate component data without the Zod runtime.
let components = 0;
for (const name of componentNames()) {
  const entry = getComponent(name);
  const jsonSchema = z.toJSONSchema(entry.zod, { io: 'input' });
  jsonSchema.$id = jsonSchemaId(`molen/component/${name}@1`);
  jsonSchema.title = name;
  jsonSchema.description = entry.meta.description;
  jsonSchema.examples = entry.meta.examples;
  writeFileSync(
    `dist/schemas/components/${name}.schema.json`,
    `${JSON.stringify(jsonSchema, null, 2)}\n`,
  );
  components++;
}

console.log(`emitted ${emitted} JSON Schemas + ${components} component schemas to dist/schemas/`);
