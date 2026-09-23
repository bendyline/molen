/**
 * The published package version. Informational metadata only: it rides along in a keyframe so a
 * save file says which build wrote it, and it is NOT compared on load and NOT hashed. Keep it in
 * step with packages/kernel/package.json (a unit test pins the two together).
 */
export const ENGINE_VERSION = '0.0.1';

/**
 * The state-format generation: what actually has to match for a keyframe to be loadable and for
 * two state hashes to be comparable. Bump it ONLY when simulation semantics or the snapshot
 * layout change — never for a release, a docs edit, or a client-only change. Every release on the
 * fixed version line used to invalidate every save file and every recorded *.replay.json because
 * the package version was the gate; this constant is the gate now.
 */
export const STATE_FORMAT = 1;

/**
 * Keyframes record their state format under this reserved key in `plugins` (the one extensible
 * field of `molen/keyframe@1`; `$scripts` is the same kind of reserved name). A keyframe written
 * before the key existed is read as format 1, the layout in use when it was introduced.
 */
export const STATE_FORMAT_KEY = '$format';
