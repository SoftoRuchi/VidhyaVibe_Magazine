import { pdfjs } from 'react-pdf';

let configured = false;

/**
 * Prefer public/pdf-worker.js (copied by scripts/copy-pdf-worker.cjs).
 * Fallback to pdf.worker.min.mjs — do NOT use an App Router path of the same
 * name as the public file; it shadows static serving and can 500.
 */
export function configurePdfWorker() {
  if (configured || typeof window === 'undefined') return;
  configured = true;
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf-worker.js';
}
