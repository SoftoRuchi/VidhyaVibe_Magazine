import { getEnv } from '@magazine/config';
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (pool) return pool;
  const env = getEnv();
  if (!env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is not set. Check your .env file.');
  }
  try {
    const u = new URL(env.DATABASE_URL);
    pool = mysql.createPool({
      host: u.hostname,
      port: Number(u.port || 3306),
      user: u.username,
      password: u.password ? decodeURIComponent(u.password) : '',
      database: u.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: 10,
    });
    return pool;
  } catch (e: any) {
    throw new Error(`Invalid DATABASE_URL: ${e?.message || e}`);
  }
}
