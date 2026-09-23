// Minimal ambient declarations for WHATWG globals the kernel uses. These exist in Node 18+,
// browsers, and Web Workers alike; we declare them here instead of pulling in the DOM lib so
// the kernel stays environment-agnostic (no DOM coupling).
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

// Timer globals (WHATWG): present in Node, browsers, and Web Workers. The opaque handle type
// is simplified to number; the real value is passed straight back to clearTimeout.
declare function setTimeout(handler: () => void, timeout?: number): number;
declare function clearTimeout(handle: number): void;

// SES Compartment (added to the global by importing 'ses'). Minimal surface we use.
declare class Compartment {
  constructor(endowments?: Record<string, unknown>);
  evaluate(source: string): unknown;
}

// SES lockdown (also added by importing 'ses'); called only by hardenScripts(). Process-global
// and irreversible, so the kernel never calls it on its own. The option subset mirrors
// HardenScriptsOptions in scripting.ts.
declare function lockdown(options?: {
  errorTaming?: 'safe' | 'unsafe' | 'unsafe-debug';
  overrideTaming?: 'moderate' | 'min' | 'severe';
  stackFiltering?: 'concise' | 'omit-frames' | 'shorten-paths' | 'verbose';
}): void;
