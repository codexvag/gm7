import { getRawDb } from '../db/index';

let initPromise: Promise<void> | null = null;

async function ensureTables(db: any): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        db.prepare('CREATE TABLE IF NOT EXISTS members (room TEXT NOT NULL, user TEXT NOT NULL, PRIMARY KEY(room, user))').run();
        db.prepare('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL, state TEXT NOT NULL, version INTEGER DEFAULT 0 NOT NULL, code TEXT NOT NULL)').run();
        db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_unique ON rooms (code)').run();
        console.log('[room-db] Tables and indexes verified successfully (better-sqlite3).');
      } catch (err) {
        console.error('[room-db] Table verification error:', err);
      }
    })();
  }
  await initPromise;
}

export interface D1PreparedStatement {
  bind: (...params: any[]) => {
    first: <T = any>() => Promise<T | null>;
    all: <T = any>() => Promise<{ results: T[]; success: boolean }>;
    run: () => Promise<any>;
  };
  first: <T = any>() => Promise<T | null>;
  all: <T = any>() => Promise<{ results: T[]; success: boolean }>;
  run: () => Promise<any>;
}

export interface D1Database {
  prepare: (query: string) => D1PreparedStatement;
  batch: (statements: any[]) => Promise<void>;
}

export async function database(): Promise<D1Database> {
  const db = getRawDb();
  await ensureTables(db);
  
  // Wrap better-sqlite3 API slightly to match the D1 API surface used in route.ts
  return {
    prepare: (query: string) => {
      const stmt = db.prepare(query);
      let boundParams: any[] = [];
      return {
        bind: (...params: any[]) => {
          boundParams = params;
          return {
            first: async <T = any>() => ((stmt.get(...boundParams) as T) ?? null),
            all: async <T = any>() => ({ results: stmt.all(...boundParams) as T[], success: true }),
            run: async () => stmt.run(...boundParams)
          };
        },
        first: async <T = any>() => ((stmt.get() as T) ?? null),
        all: async <T = any>() => ({ results: stmt.all() as T[], success: true }),
        run: async () => stmt.run()
      };
    },
    batch: async (statements: any[]) => {
      const runMany = db.transaction((stmts: any[]) => {
        for (const s of stmts) {
          s.run();
        }
      });
      runMany(statements);
    }
  };
}
