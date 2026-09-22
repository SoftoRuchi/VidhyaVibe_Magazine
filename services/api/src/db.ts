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
      connectionLimit: Number(process.env.DB_POOL_SIZE || 25),
      queueLimit: Number(process.env.DB_QUEUE_LIMIT || 50),
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      connectTimeout: 60_000,
      // DATETIME/NOW() are UTC. mysql2 otherwise treats them as the Windows local zone
      // (IST), so JSON becomes 5.5 hours behind and the UI shows 10:04 instead of 15:34.
      timezone: 'Z',
      typeCast(field: any, next: () => unknown) {
        const type = String(field.type || '').toUpperCase();
        const isDateTime =
          type === 'DATETIME' ||
          type === 'TIMESTAMP' ||
          field.type === 7 ||
          field.type === 12 ||
          field.type === 17 ||
          field.type === 18;
        if (isDateTime) {
          const raw = field.string();
          if (raw == null || raw === '') return null;
          const normalized = String(raw).includes('T')
            ? String(raw)
            : String(raw).replace(' ', 'T');
          return /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
        }
        return next();
      },
    });
    pool.on('connection', (connection) => {
      connection.query("SET time_zone = '+00:00'");
      connection.on('error', (err) => {
        console.error('MySQL pool connection error:', err.message);
      });
    });
    return pool;
  } catch (e: any) {
    throw new Error(`Invalid DATABASE_URL: ${e?.message || e}`);
  }
}

/** Run queries without holding a connection across slow CPU work (e.g. bcrypt). */
export async function query<T = any>(
  sql: string,
  params?: unknown[],
): Promise<[T, mysql.FieldPacket[]]> {
  const p = getPool();
  return p.query(sql, params) as Promise<[T, mysql.FieldPacket[]]>;
}
