import { createReadStream } from 'fs';
import os from 'os';
import path from 'path';
import type { Env, Logger } from '@magazine/config';
import fs from 'fs-extra';

function apiPackageRoot() {
  return path.resolve(__dirname, '../../..');
}

function canWriteDir(dir: string): boolean {
  try {
    fs.ensureDirSync(dir);
    const probe = path.join(dir, `.write-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function uniqueDirs(dirs: string[]) {
  const seen = new Set<string>();
  return dirs.filter((dir) => {
    const key = path.resolve(dir);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createLocalStorageAdapter(env: Env, ctx: { logger: Logger }) {
  const preferred = path.resolve(
    process.env.STORAGE_PATH || path.join(apiPackageRoot(), 'storage'),
  );
  const fallback = path.join(os.tmpdir(), 'vidhyavibe-storage');
  const bases = uniqueDirs([preferred, path.resolve(process.cwd(), 'storage'), fallback]);
  const writable = bases.filter((dir) => canWriteDir(dir));
  const writeBase = writable[0] || preferred;

  if (!writable.includes(preferred)) {
    ctx.logger.warn(
      { preferred, writeBase },
      'Primary storage folder is not writable; new uploads go to a fallback folder',
    );
  } else {
    ctx.logger.info({ base: preferred }, 'Local storage base directory created/ensured');
  }

  async function writeFile(filePath: string, buffer: Buffer) {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, buffer);
  }

  return {
    async upload(key: string, buffer: Buffer) {
      const intended = path.join(preferred, key);
      try {
        await writeFile(intended, buffer);
        return { url: `/api/assets/serve?key=${key}`, key };
      } catch (e: any) {
        const code = String(e?.code || '');
        if (code !== 'EACCES' && code !== 'EPERM') {
          ctx.logger.error({ err: e, filePath: intended }, 'Local storage write failed');
          throw e;
        }
        const safeName = path.basename(key).replace(/[^\w.-]+/g, '_') || `file-${Date.now()}`;
        const fallbackKey = `uploads/${Date.now()}-${safeName}`;
        const fallbackPath = path.join(writeBase, fallbackKey);
        try {
          await writeFile(fallbackPath, buffer);
          ctx.logger.warn(
            { from: intended, to: fallbackPath },
            'Saved upload in fallback storage path because the original folder is not writable',
          );
          return { url: `/api/assets/serve?key=${fallbackKey}`, key: fallbackKey };
        } catch (fallbackErr: any) {
          ctx.logger.error(
            { err: fallbackErr, preferred, writeBase, fallbackPath },
            'Local storage write failed in fallback path',
          );
          const err: any = new Error(
            'Server cannot save the picture. On the server run: sudo chown -R vidhyavibe-reader:vidhyavibe-reader services/api/storage && sudo chmod -R u+rwX services/api/storage',
          );
          err.code = fallbackErr?.code || code;
          throw err;
        }
      }
    },
    async get(key: string) {
      for (const base of uniqueDirs([preferred, writeBase, ...bases])) {
        const filePath = path.join(base, key);
        if (await fs.pathExists(filePath)) return createReadStream(filePath);
      }
      return null;
    },
    async presignGet(key: string) {
      return { url: `/api/assets/serve?key=${key}`, key };
    },
  };
}
