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
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key_required' });

  const storage = getStorageAdapter();
  if (!storage.get) return res.status(400).json({ error: 'get_not_supported' });

  try {
    const data = await storage.get(String(key));
    const contentType = mimeForKey(String(key));
    const cacheControl =
      contentType.startsWith('image/') || contentType.startsWith('video/')
        ? 'public, max-age=86400'
        : undefined;
    if (Buffer.isBuffer(data) && contentType.startsWith('video/')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', String(data.length));
    }
    sendStorageBody(res, data, { contentType, cacheControl });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'serve_failed' });
  }
});

export default router;
