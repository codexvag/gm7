type CloudflareEnv = { DB?: D1Database };

let resolvedEnv: CloudflareEnv | undefined;
let initPromise: Promise<void> | null = null;

async function ensureTables(db: D1Database): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await db.prepare('CREATE TABLE IF NOT EXISTS members (room TEXT NOT NULL, user TEXT NOT NULL, PRIMARY KEY(room, user))').run();
        await db.prepare('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL, state TEXT NOT NULL, version INTEGER DEFAULT 0 NOT NULL, code TEXT NOT NULL)').run();
        await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_unique ON rooms (code)').run();
        console.log('[room-db] Tables and indexes verified successfully.');
      } catch (err) {
        console.error('[room-db] Table verification error:', err);
      }
    })();
  }
  await initPromise;
}

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
  await ensureTables(env.DB);
  return env.DB;
}

