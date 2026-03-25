import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4001'),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().optional(),
  STORAGE_PROVIDER: z.enum(['local', 'minio', 's3']).default('local'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  // JWT and auth
  JWT_ACCESS_SECRET: z.string().min(10).optional(),
  JWT_REFRESH_SECRET: z.string().min(10).optional(),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.string().default('10'),
  RATE_LIMIT_WINDOW_MS: z.string().default(String(15 * 60 * 1000)), // 15 minutes
  RATE_LIMIT_MAX: z.string().default('1000'),
  // Dispatch scheduler worker
  RUN_DISPATCH_WORKER: z.string().optional(),
  DISPATCH_WORKER_INTERVAL_MS: z.string().default(String(10 * 60 * 1000)), // 10 minutes
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse({
    NODE_ENV: raw.NODE_ENV,
    PORT: raw.PORT,
    DATABASE_URL: raw.DATABASE_URL,
    REDIS_URL: raw.REDIS_URL,
    STORAGE_PROVIDER: raw.STORAGE_PROVIDER,
    STORAGE_ENDPOINT: raw.STORAGE_ENDPOINT,
    STORAGE_BUCKET: raw.STORAGE_BUCKET,
    STORAGE_ACCESS_KEY: raw.STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY: raw.STORAGE_SECRET_KEY,
    JWT_ACCESS_SECRET: raw.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: raw.JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES: raw.JWT_ACCESS_EXPIRES,
    JWT_REFRESH_EXPIRES: raw.JWT_REFRESH_EXPIRES,
    BCRYPT_SALT_ROUNDS: raw.BCRYPT_SALT_ROUNDS,
    RATE_LIMIT_WINDOW_MS: raw.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX: raw.RATE_LIMIT_MAX,
  });
}
