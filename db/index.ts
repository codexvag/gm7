import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database.Database | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqliteInstance = new Database(path.join(dataDir, 'sqlite.db'));
  sqliteInstance.pragma('journal_mode = WAL');
  
  dbInstance = drizzle(sqliteInstance, { schema });
  return dbInstance;
}

export function getRawDb() {
  if (!sqliteInstance) getDb();
  return sqliteInstance!;
}
