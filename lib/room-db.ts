type CloudflareEnv = { DB?: D1Database };

let resolvedEnv: CloudflareEnv | undefined;
let initPromise: Promise<void> | null = null;

async function ensureTables(db: D1Database): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS members (
            room text NOT NULL,
            user text NOT NULL,
            PRIMARY KEY(room, user)
          );
          CREATE TABLE IF NOT EXISTS rooms (
            id text PRIMARY KEY NOT NULL,
            owner text NOT NULL,
            name text NOT NULL,
            state text NOT NULL,
            version integer DEFAULT 0 NOT NULL,
            code text NOT NULL
          );
          CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_unique ON rooms (code);
        `);
      } catch (err) {
        console.warn('Auto table migration warning (may already exist):', err);
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

