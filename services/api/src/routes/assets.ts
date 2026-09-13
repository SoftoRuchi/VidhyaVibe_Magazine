import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getStorageAdapter } from '../providers/storage';
import { sendStorageBody } from '../utils/sendStorage';

const router = Router();

function mimeForKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/mp4';
  if (ext === 'ogg' || ext === 'ogv') return 'video/ogg';
  return 'application/octet-stream';
}

function sniffImageMime(data: unknown): string | null {
  if (!Buffer.isBuffer(data) || data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
    return 'image/png';
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function safeAssetKey(raw: string): string | null {
  const key = String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!key || key.includes('..')) return null;
  return key;
}

async function serveAsset(req: Request, res: Response, rawKey: string) {
  const key = safeAssetKey(rawKey);
  if (!key) return res.status(400).json({ error: 'key_required' });

  const storage = getStorageAdapter();
  if (!storage.get) return res.status(400).json({ error: 'get_not_supported' });

  const data = await storage.get(key);
  const contentType = sniffImageMime(data) || mimeForKey(key);
  const cacheControl =
    contentType.startsWith('image/') || contentType.startsWith('video/')
      ? 'public, max-age=86400'
      : undefined;
  if (Buffer.isBuffer(data) && contentType.startsWith('video/')) {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(data.length));
  }
  sendStorageBody(res, data, { contentType, cacheControl });
}

// Presign GET URL for a storage key (requires auth)
router.get('/presign', requireAuth, async (req, res) => {
  const { key, expires } = req.query;
  if (!key) return res.status(400).json({ error: 'key_required' });
  const storage = getStorageAdapter();
  if (!storage.presignGet) return res.status(400).json({ error: 'presign_not_supported' });
  try {
    const { url, key: k } = await storage.presignGet(String(key), Number(expires || 900));
    res.json({ url, key: k });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'presign_failed';
    res.status(500).json({ error: 'presign_failed', message });
  }
});

// Serve files — streams from disk/S3/MinIO instead of loading into memory
router.get('/serve', async (req, res) => {
  try {
    await serveAsset(req, res, String(req.query.key || ''));
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'serve_failed' });
  }
});

/** Path-style URL for mobile Image/http clients that mishandle ?key=courses%2F... */
router.get(/^\/file\/(.+)$/, async (req, res) => {
  try {
    await serveAsset(
      req,
      res,
      decodeURIComponent(String(req.params[0] || String(req.path).replace(/^.*\/file\//, ''))),
    );
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'serve_failed' });
  }
});

export default router;
