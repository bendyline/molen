/**
 * Several packs read as one. An app layers its own packs over defaults: when two packs provide
 * the same asset id or path, the pack added later wins.
 */

import type { Pack, ReadOptions } from './pack';

/** The shape of the client's AssetProvider, so this package needs no client dependency. */
export interface AssetProviderLike {
  load(ref: string): Promise<ArrayBuffer>;
  loadText(ref: string): Promise<string>;
}

export interface PackAssetProviderOptions {
  /** Prefer this variant (e.g. "ktx2") when the manifest lists one for the asset. */
  variant?: string;
  /** Refs no pack provides go here; without it they are an error. */
  fallback?: AssetProviderLike;
}

export interface PackSet {
  readonly packs: readonly Pack[];
  add(pack: Pack): void;
  /**
   * Find the pack and path for a ref: `pack:<id>/<path>`, an asset id from a manifest's `ids`,
   * or a bare path. Undefined when no pack has it.
   */
  resolve(ref: string): { pack: Pack; path: string } | undefined;
  /** The paths every pack lists for a role (e.g. `types`), earliest pack first. */
  provided(role: string): { pack: Pack; path: string }[];
  readBytes(ref: string, options?: ReadOptions): Promise<ArrayBuffer>;
  readText(ref: string, options?: ReadOptions): Promise<string>;
  readJson<T = unknown>(ref: string, options?: ReadOptions): Promise<T>;
  /** An asset provider for the client (`assets: { provider }`). */
  assetProvider(options?: PackAssetProviderOptions): AssetProviderLike;
  close(): void;
}

class Packs implements PackSet {
  private readonly list: Pack[] = [];

  constructor(packs: readonly Pack[]) {
    for (const pack of packs) this.add(pack);
  }

  get packs(): readonly Pack[] {
    return this.list;
  }

  add(pack: Pack): void {
    this.list.push(pack);
  }

  resolve(ref: string): { pack: Pack; path: string } | undefined {
    if (ref.startsWith('pack:')) {
      const rest = ref.slice('pack:'.length);
      const slash = rest.indexOf('/');
      if (slash < 0) return undefined;
      const id = rest.slice(0, slash);
      const path = rest.slice(slash + 1);
      for (let i = this.list.length - 1; i >= 0; i--) {
        const pack = this.list[i] as Pack;
        if (pack.manifest.id === id && pack.has(path)) return { pack, path };
      }
      return undefined;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const pack = this.list[i] as Pack;
      const path = pack.manifest.ids[ref];
      if (path !== undefined) return { pack, path };
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const pack = this.list[i] as Pack;
      if (pack.has(ref)) return { pack, path: ref };
    }
    return undefined;
  }

  provided(role: string): { pack: Pack; path: string }[] {
    return this.list.flatMap((pack) =>
      (pack.manifest.provides[role] ?? []).map((path) => ({ pack, path })),
    );
  }

  private found(ref: string): { pack: Pack; path: string } {
    const hit = this.resolve(ref);
    if (hit === undefined) {
      const ids = this.list.map((pack) => `${pack.manifest.id}@${pack.manifest.version}`);
      throw new Error(`no pack provides "${ref}" (loaded: ${ids.join(', ') || 'none'})`);
    }
    return hit;
  }

  async readBytes(ref: string, options?: ReadOptions): Promise<ArrayBuffer> {
    const { pack, path } = this.found(ref);
    return pack.readBytes(path, options);
  }

  async readText(ref: string, options?: ReadOptions): Promise<string> {
    const { pack, path } = this.found(ref);
    return pack.readText(path, options);
  }

  async readJson<T = unknown>(ref: string, options?: ReadOptions): Promise<T> {
    const { pack, path } = this.found(ref);
    return pack.readJson<T>(path, options);
  }

  assetProvider(options: PackAssetProviderOptions = {}): AssetProviderLike {
    const pick = (ref: string): { pack: Pack; path: string } | undefined => {
      const hit = this.resolve(ref);
      if (hit === undefined || options.variant === undefined) return hit;
      const variant = hit.pack.manifest.entries[hit.path]?.variants?.[options.variant];
      return variant !== undefined && hit.pack.has(variant)
        ? { pack: hit.pack, path: variant }
        : hit;
    };
    return {
      load: async (ref) => {
        const hit = pick(ref);
        if (hit !== undefined) return hit.pack.readBytes(hit.path);
        if (options.fallback !== undefined) return options.fallback.load(ref);
        return this.readBytes(ref);
      },
      loadText: async (ref) => {
        const hit = this.resolve(ref);
        if (hit !== undefined) return hit.pack.readText(hit.path);
        if (options.fallback !== undefined) return options.fallback.loadText(ref);
        return this.readText(ref);
      },
    };
  }

  close(): void {
    for (const pack of this.list) pack.close();
  }
}

export function createPackSet(packs: readonly Pack[] = []): PackSet {
  return new Packs(packs);
}
