import { fileURLToPath } from 'node:url';

export default {
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  server: {
    host: '127.0.0.1',
    port: 4322,
    strictPort: true,
    watch: { ignored: ['**/.artifacts/**', '**/__output__/**'] },
  },
  // The repository contains hundreds of unrelated HTML samples; review only this entry.
  optimizeDeps: { noDiscovery: true, include: [] },
};
