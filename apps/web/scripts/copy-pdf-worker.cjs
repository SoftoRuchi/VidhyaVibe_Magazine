/**
 * Copy pdf.js worker to public/ so it is same-origin (fixes worker load / sendWithPromise errors with CDN workers).
 */
const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

let src;
try {
  src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
} catch (e) {
  console.warn('copy-pdf-worker: pdfjs-dist worker not found, skip:', e.message);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('copy-pdf-worker: copied to', dest);
