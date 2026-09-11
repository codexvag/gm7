type CloudflareEnv = { DB?: D1Database };

let resolvedEnv: CloudflareEnv | undefined;

async function cfEnv(): Promise<CloudflareEnv> {
  if (!resolvedEnv) {
    try {
      const mod = (await import('cloudflare:workers')) as { env?: CloudflareEnv };
      resolvedEnv = mod.env ?? {};
    } catch {
      resolvedEnv = {};
    }
  }
  return resolvedEnv;
}

export async function database(): Promise<D1Database> {
  const env = await cfEnv();
  if (!env.DB) throw Error('O armazenamento está temporariamente indisponível. Tente novamente.');
  return env.DB;
}
