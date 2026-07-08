import multer from 'multer';

/** Cap in-memory upload size — multer memoryStorage holds full file in RAM. */
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024);

export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 8 },
});
