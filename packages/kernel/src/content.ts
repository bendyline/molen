import type { ContentIdentity, JsonValue, Keyframe } from '@bendyline/molen-schema';

// Content identity: which content (entity types, places, ...) a world was built from. It rides
// next to the state hash, never inside it. Content that affects the simulation already reaches the
// hash through the components written at spawn; the identity exists to turn "diverged at tick 0"
// into a named error before a save or replay runs against different content.

/** Keyframes record content identity under this reserved `plugins` key, beside `$format`. */
export const CONTENT_KEY = '$content';

/** The identity a keyframe recorded, or undefined for one written without content. */
export function keyframeContent(keyframe: Keyframe): ContentIdentity | undefined {
  const value = keyframe.plugins?.[CONTENT_KEY];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as unknown as ContentIdentity;
}

/** Store identity in keyframe plugins; empty identities are left out. */
export function contentPlugin(content: ContentIdentity): JsonValue | undefined {
  return Object.keys(content).length === 0 ? undefined : (content as unknown as JsonValue);
}

function describe(entry: ContentIdentity[string]): string {
  return entry.packs !== undefined && entry.packs.length > 0
    ? `${entry.hash} (${entry.packs.join(', ')})`
    : entry.hash;
}

/**
 * Differences between recorded and loaded content, one message per domain present in both with a
 * different hash. Domains only one side has are not compared: a replay recorded before a domain
 * existed, or a host that loads extra content, is not a mismatch.
 */
export function contentDrift(recorded: ContentIdentity, loaded: ContentIdentity): string[] {
  const drift: string[] = [];
  for (const [domain, entry] of Object.entries(recorded)) {
    const current = loaded[domain];
    if (current === undefined || current.hash === entry.hash) continue;
    drift.push(
      `content "${domain}" was ${describe(entry)} but the loaded content is ${describe(current)}`,
    );
  }
  return drift;
}

/** Freeze a copy of an identity for storage on a World. */
export function freezeContent(content: ContentIdentity | undefined): Readonly<ContentIdentity> {
  const copy: ContentIdentity = {};
  for (const [domain, entry] of Object.entries(content ?? {})) {
    copy[domain] = Object.freeze({
      hash: entry.hash,
      ...(entry.packs !== undefined ? { packs: Object.freeze([...entry.packs]) as string[] } : {}),
    });
  }
  return Object.freeze(copy);
}
