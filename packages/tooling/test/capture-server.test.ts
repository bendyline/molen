import { describe, expect, it } from 'vitest';
import { startCaptureResources } from '../src/capture-server';

describe('capture resource startup', () => {
  it('closes the browser if server startup fails', async () => {
    let browserClosed = false;
    await expect(
      startCaptureResources(
        async () => ({
          close: async () => {
            browserClosed = true;
          },
        }),
        '/unused',
        undefined,
        async () => {
          throw new Error('server failed');
        },
      ),
    ).rejects.toThrow(/server failed/);
    expect(browserClosed).toBe(true);
  });

  it('closes the server if browser startup fails', async () => {
    let serverClosed = false;
    await expect(
      startCaptureResources(
        async () => {
          throw new Error('browser failed');
        },
        '/unused',
        undefined,
        async () => ({
          url: 'http://unused',
          close: async () => {
            serverClosed = true;
          },
        }),
      ),
    ).rejects.toThrow(/browser failed/);
    expect(serverClosed).toBe(true);
  });
});
