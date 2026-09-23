export function verifyAssets(options?: { root?: string; builtDir?: string }): Promise<{
  ok: boolean;
  count: number;
  runtimeBytes: number;
  errors: string[];
}>;
