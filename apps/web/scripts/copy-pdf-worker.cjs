/**
 * Copy pdf.js worker to public/ so it is same-origin (fixes worker load / sendWithPromise errors with CDN workers).
 */
const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'public');
const destMjs = path.join(destDir, 'pdf.worker.min.mjs');
const destJs = path.join(destDir, 'pdf-worker.js');

let src;
try {
  src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
} catch (e) {
  console.warn('copy-pdf-worker: pdfjs-dist worker not found, skip:', e.message);
  process.exit(0);
}

function canUseExisting(dest) {
  try {
    return fs.existsSync(dest) && fs.statSync(dest).size > 1000;
  } catch {
    return false;
  }
}

function copyOrKeep(dest) {
  if (canUseExisting(dest)) {
    console.log('copy-pdf-worker: keeping existing', dest);
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('copy-pdf-worker: copied to', dest);
}

try {
  copyOrKeep(destMjs);
  copyOrKeep(destJs);
} catch (e) {
  if (canUseExisting(destJs) || canUseExisting(destMjs)) {
    console.warn('copy-pdf-worker: copy failed but existing worker file is present, continuing:', e.message);
    process.exit(0);
  }
  console.error('copy-pdf-worker: failed:', e.message);
  console.error('Fix: chown -R vidhyavibe-reader:vidhyavibe-reader apps/web/public');
  process.exit(1);
}
