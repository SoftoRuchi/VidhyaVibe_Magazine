import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { invalidateMagazineCatalog } from '../catalogCache';
import { getPool } from '../db';
import { getStorageAdapter } from '../providers/storage';

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

type EditionFiles = {
  editionPdf?: UploadedFile[];
  samplePdf?: UploadedFile[];
  cover?: UploadedFile[];
};

export async function createAdminEdition(req: Request, res: Response) {
  const magazineId = Number(req.params.magazineId ?? req.params.id);
  const files = req.files as EditionFiles | undefined;
  const { volume, issueNumber, description, pages, publishedAt, sku, publishNow } = req.body;

  if (!magazineId) return res.status(400).json({ error: 'magazine_id_required' });
  if (!files?.editionPdf?.[0]) return res.status(400).json({ error: 'edition_pdf_required' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [mRows]: any = await conn.query('SELECT slug FROM magazines WHERE id = ? LIMIT 1', [
      magazineId,
    ]);
    const mag = mRows[0];
    if (!mag) return res.status(404).json({ error: 'magazine_not_found' });

    const storage = getStorageAdapter();
    const uploaded = await storage.upload(
      `magazines/${mag.slug}/editions/${uuidv4()}.pdf`,
      files.editionPdf[0].buffer as Buffer,
      files.editionPdf[0].mimetype,
    );
    const fileKey = uploaded.key;

    let sampleKey: string | null = null;
    if (files?.samplePdf?.[0]) {
      const sampleUploaded = await storage.upload(
        `magazines/${mag.slug}/editions/${uuidv4()}-sample.pdf`,
        files.samplePdf[0].buffer as Buffer,
        files.samplePdf[0].mimetype,
      );
      sampleKey = sampleUploaded.key;
    }

    let editionCoverKey: string | null = null;
    if (files?.cover?.[0]) {
      const ext = (files.cover[0].originalname || 'jpg').split('.').pop() || 'jpg';
      const coverUploaded = await storage.upload(
        `magazines/${mag.slug}/editions/cover-${uuidv4()}.${ext}`,
        files.cover[0].buffer as Buffer,
        files.cover[0].mimetype,
      );
      editionCoverKey = coverUploaded.key;
    }

    const vol = volume != null && volume !== '' ? Number(volume) : null;
    const issue = issueNumber != null && issueNumber !== '' ? Number(issueNumber) : null;
    const pageCount = pages != null && pages !== '' ? Number(pages) : null;
    const desc = typeof description === 'string' && description.trim() ? description.trim() : null;
    const skuVal =
      typeof sku === 'string' && sku.trim()
        ? sku.trim()
        : vol != null && issue != null
          ? `${mag.slug}-v${vol}-i${issue}`
          : `SKU-${Date.now()}`;

    let pubAt: Date | null = null;
    if (publishNow === 'true' || publishNow === true) {
      pubAt = new Date();
    } else if (publishedAt && typeof publishedAt === 'string') {
      const parsed = new Date(publishedAt);
      if (!isNaN(parsed.getTime())) pubAt = parsed;
    }

    const [ins]: any = await conn.query(
      `INSERT INTO magazine_editions (magazineId, volume, issueNumber, sku, description, publishedAt, pages, coverKey, fileKey, sampleKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [magazineId, vol, issue, skuVal, desc, pubAt, pageCount, editionCoverKey, fileKey, sampleKey],
    );

    res.status(201).json({
      id: ins.insertId,
      fileKey,
      sampleKey,
      coverKey: editionCoverKey,
    });
    await invalidateMagazineCatalog(magazineId, mag.slug);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'upload_failed', details: e.message });
  } finally {
    conn.release();
  }
}

export async function updateAdminEdition(req: Request, res: Response) {
  const magazineId = Number(req.params.magazineId ?? req.params.id);
  const editionId = Number(req.params.editionId);
  const files = req.files as EditionFiles | undefined;
  const { volume, issueNumber, description, pages, publishedAt, sku, publishNow } = req.body;

  if (!magazineId || !editionId) {
    return res.status(400).json({ error: 'magazine_and_edition_id_required' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [mRows]: any = await conn.query('SELECT slug FROM magazines WHERE id = ? LIMIT 1', [
      magazineId,
    ]);
    if (!mRows[0]) return res.status(404).json({ error: 'magazine_not_found' });
    const mag = mRows[0];

    const [curRows]: any = await conn.query(
      'SELECT id, sku, fileKey, sampleKey, coverKey, publishedAt FROM magazine_editions WHERE id = ? AND magazineId = ? LIMIT 1',
      [editionId, magazineId],
    );
    if (!curRows[0]) return res.status(404).json({ error: 'edition_not_found' });
    const current = curRows[0];

    const storage = getStorageAdapter();
    let fileKey: string | null = current.fileKey;
    let sampleKey: string | null = current.sampleKey;
    let editionCoverKey: string | null = current.coverKey;

    if (files?.editionPdf?.[0]) {
      const uploaded = await storage.upload(
        `magazines/${mag.slug}/editions/${uuidv4()}.pdf`,
        files.editionPdf[0].buffer as Buffer,
        files.editionPdf[0].mimetype,
      );
      fileKey = uploaded.key;
    }
    if (files?.samplePdf?.[0]) {
      const sampleUploaded = await storage.upload(
        `magazines/${mag.slug}/editions/${uuidv4()}-sample.pdf`,
        files.samplePdf[0].buffer as Buffer,
        files.samplePdf[0].mimetype,
      );
      sampleKey = sampleUploaded.key;
    }
    if (files?.cover?.[0]) {
      const ext = (files.cover[0].originalname || 'jpg').split('.').pop() || 'jpg';
      const coverUploaded = await storage.upload(
        `magazines/${mag.slug}/editions/cover-${uuidv4()}.${ext}`,
        files.cover[0].buffer as Buffer,
        files.cover[0].mimetype,
      );
      editionCoverKey = coverUploaded.key;
    }

    const vol = volume != null && volume !== '' ? Number(volume) : null;
    const issue = issueNumber != null && issueNumber !== '' ? Number(issueNumber) : null;
    const pageCount = pages != null && pages !== '' ? Number(pages) : null;
    const desc = typeof description === 'string' && description.trim() ? description.trim() : null;
    let skuVal: string | null = current.sku;
    if (typeof sku === 'string' && sku.trim()) {
      skuVal = sku.trim();
    }

    let pubAt: Date | null = current.publishedAt ? new Date(current.publishedAt) : null;
    if (publishNow === 'true' || publishNow === true) {
      pubAt = current.publishedAt ? new Date(current.publishedAt) : new Date();
    } else if (publishedAt && typeof publishedAt === 'string') {
      const parsed = new Date(publishedAt);
      if (!isNaN(parsed.getTime())) pubAt = parsed;
    }

    await conn.query(
      `UPDATE magazine_editions SET volume = ?, issueNumber = ?, sku = ?, description = ?, publishedAt = ?, pages = ?, coverKey = ?, fileKey = ?, sampleKey = ?
       WHERE id = ? AND magazineId = ?`,
      [
        vol,
        issue,
        skuVal,
        desc,
        pubAt,
        pageCount,
        editionCoverKey,
        fileKey,
        sampleKey,
        editionId,
        magazineId,
      ],
    );

    res.json({ ok: true, id: editionId, fileKey, sampleKey, coverKey: editionCoverKey });
    await invalidateMagazineCatalog(magazineId, mag.slug);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed', details: e.message });
  } finally {
    conn.release();
  }
}
