export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
// The index signature allows `undefined` so interfaces with optional properties (e.g. an
// optional `scale` on a transform component) satisfy JsonObject. Undefined-valued keys are
// omitted on serialization, so this stays JSON-pure on the wire.
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}
