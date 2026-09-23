/**
 * PMTiles over a local file for Node ops. The `pmtiles` package ships fetch and browser File
 * sources only; this range source reads through one file handle so the terrain package
 * adapters (elevation pyramid, semantic sidecars) work unchanged off disk.
 */

import { type FileHandle, open } from 'node:fs/promises';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';

export class NodeFileRangeSource implements Source {
  private handle: Promise<FileHandle> | undefined;

  constructor(private readonly path: string) {}

  getKey(): string {
    return this.path;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    this.handle ??= open(this.path, 'r');
    const handle = await this.handle;
    const buffer = new Uint8Array(length);
    const { bytesRead } = await handle.read(buffer, 0, length, offset);
    return { data: buffer.buffer.slice(0, bytesRead) };
  }

  async close(): Promise<void> {
    if (this.handle === undefined) return;
    const handle = await this.handle;
    this.handle = undefined;
    await handle.close();
  }
}

export interface NodePmtilesArchive {
  archive: PMTiles;
  source: NodeFileRangeSource;
  close(): Promise<void>;
}

/** Open a local PMTiles archive; `archive` satisfies the terrain `TerrainTileArchive` seam. */
export function openNodePmtiles(path: string): NodePmtilesArchive {
  const source = new NodeFileRangeSource(path);
  return { archive: new PMTiles(source), source, close: () => source.close() };
}
