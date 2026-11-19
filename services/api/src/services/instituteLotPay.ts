import crypto from 'crypto';
import { query } from '../db';
import { BookAccessError, ensureBookAccessTables } from './bookAccess';
import { mailPublicApiBase, readerSiteBase, resolveUpiVpa } from './emailSettings';
import { sendInstituteLicensePayment } from './notifications';

function n(v: unknown): number {
  return Number(v);
}

export function instituteLotPayUrl(purchaseCode: string) {
  return `${readerSiteBase()}/pay/license/${encodeURIComponent(purchaseCode)}`;
}

export function instituteLotUpi(purchaseCode: string, amount: number, vpa: string) {
  const pa = encodeURIComponent(vpa);
  const pn = encodeURIComponent('VidhyaVibe');
  const tn = encodeURIComponent(`VidhyaVibe ${purchaseCode}`);
  return `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}&am=${Number(amount).toFixed(2)}&cu=INR`;
}

const LOT_PAY_SELECT = `
  SELECT l.id, l.purchase_code AS purchaseCode, l.access_model AS accessModel, l.seat_count AS seatCount,
         l.amount, l.status, l.payment_status AS paymentStatus, l.rp_order_id AS rpOrderId,
         l.discount_pct AS discountPct,
         s.name AS bookName, c.name AS courseName,
         i.id AS instituteId, i.name AS collegeName, i.email AS collegeEmail
  FROM book_license_lots l
  INNER JOIN course_subjects s ON s.id = l.subject_id
  INNER JOIN course_semesters sem ON sem.id = s.semester_id
  INNER JOIN courses c ON c.id = sem.course_id
  LEFT JOIN institutes i ON i.id = l.institute_id
`;

export type InstituteLotPayOffer = {
  lotId: number;
  purchaseCode: string;
  bookName: string;
  courseName: string;
  collegeName: string;
  collegeEmail: string | null;
  accessModel: string;
  seatCount: number;
  amount: number;
  currency: string;
  paymentStatus: string;
  upi: string;
  upiVpa: string;
  qrPngUrl: string;
  payUrl: string;
  razorpayEnabled: boolean;
  razorpayKeyId: string | null;
};

async function mapOffer(row: any): Promise<InstituteLotPayOffer> {
  const amount = Number(row.amount);
  const code = String(row.purchaseCode);
  const vpa = await resolveUpiVpa();
  if (!vpa) {
    console.warn(
      '[instituteLotPay] UPI ID is not set. QR will open the payment page. Set Admin → Email Configuration → VidhyaVibe UPI ID.',
    );
  }
  const qrPngUrl = `${mailPublicApiBase()}/api/payments/institute-lot/${encodeURIComponent(code)}/qr.png`;
  return {
    lotId: n(row.id),
    purchaseCode: code,
    bookName: String(row.bookName || 'Textbook'),
    courseName: String(row.courseName || ''),
    collegeName: String(row.collegeName || 'College'),
    collegeEmail: row.collegeEmail || null,
    accessModel: String(row.accessModel || 'BOOK_BANK'),
    seatCount: n(row.seatCount),
    amount,
    currency: 'INR',
    paymentStatus: String(row.paymentStatus || 'UNPAID'),
    upi: vpa ? instituteLotUpi(code, amount, vpa) : '',
    upiVpa: vpa || '',
    qrPngUrl,
    payUrl: instituteLotPayUrl(code),
    razorpayEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
  };
}

export async function loadInstituteLotPay(code: string): Promise<InstituteLotPayOffer> {
  await ensureBookAccessTables();
  const [rows]: any = await query(`${LOT_PAY_SELECT} WHERE l.purchase_code = ? LIMIT 1`, [code]);
  const row = rows?.[0];
  if (!row) throw new BookAccessError('lot_not_found', 'This payment link is not valid.', 404);
  if (String(row.status) === 'CANCELLED') {
    throw new BookAccessError('lot_cancelled', 'This license was cancelled.', 410);
  }
  if (row.amount == null || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) {
    throw new BookAccessError('amount_missing', 'No payable amount is set on this license.', 400);
  }
  return await mapOffer(row);
}

export async function emailInstituteLotPayment(opts: { lotId: number; to?: string | null }) {
  await ensureBookAccessTables();
  const [rows]: any = await query(`${LOT_PAY_SELECT} WHERE l.id = ? LIMIT 1`, [opts.lotId]);
  const row = rows?.[0];
  if (!row) throw new BookAccessError('lot_not_found', 'License not found.', 404);
  if (row.amount == null || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) {
    throw new BookAccessError(
      'amount_missing',
      'Set book-bank or library prices on the subject before sending a payment request.',
      400,
    );
  }
  const offer = await mapOffer(row);
  const to = String(opts.to || offer.collegeEmail || '').trim();
  if (!to || !to.includes('@')) {
    throw new BookAccessError(
      'email_required',
      'Add an institute email, or type an email to send the payment request to.',
      400,
    );
  }
  const sent = await sendInstituteLicensePayment({
    to,
    collegeName: offer.collegeName,
    bookName: offer.bookName,
    courseName: offer.courseName,
    accessModel: offer.accessModel,
    seatCount: offer.seatCount,
    amount: offer.amount,
    payUrl: offer.payUrl,
    upi: offer.upi,
    upiVpa: offer.upiVpa,
    qrPngUrl: offer.qrPngUrl,
    purchaseCode: offer.purchaseCode,
  });
  await query(
    `UPDATE book_license_lots
     SET payment_status = COALESCE(NULLIF(payment_status, 'PAID'), 'UNPAID'),
         payment_sent_at = NOW(3),
         updated_at = NOW(3)
     WHERE id = ?`,
    [opts.lotId],
  );
  return { ...sent, to, payUrl: offer.payUrl, upiSet: Boolean(offer.upiVpa) };
}

async function createRazorpayOrder(amount: number, receipt: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const resp = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt,
    }),
  });
  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.id) return null;
  return { id: String(data.id), keyId };
}

export async function startInstituteLotRazorpay(code: string) {
  const offer = await loadInstituteLotPay(code);
  if (offer.paymentStatus === 'PAID') {
    return { alreadyPaid: true, ...offer, rpOrderId: null };
  }
  const [rows]: any = await query(
    'SELECT id, rp_order_id AS rpOrderId FROM book_license_lots WHERE purchase_code = ? LIMIT 1',
    [code],
  );
  let rpOrderId = rows?.[0]?.rpOrderId ? String(rows[0].rpOrderId) : '';
  if (!rpOrderId) {
    const rp = await createRazorpayOrder(offer.amount, `lot-${offer.purchaseCode}`.slice(0, 40));
    if (!rp) {
      throw new BookAccessError(
        'razorpay_unavailable',
        'Card payment is not configured. Use UPI on this page.',
        400,
      );
    }
    rpOrderId = rp.id;
    await query(`UPDATE book_license_lots SET rp_order_id = ?, updated_at = NOW(3) WHERE id = ?`, [
      rpOrderId,
      offer.lotId,
    ]);
  }
  return {
    alreadyPaid: false,
    rpOrderId,
    razorpayKeyId: offer.razorpayKeyId,
    amount: offer.amount,
    currency: offer.currency,
  };
}

export async function confirmInstituteLotRazorpay(opts: {
  code: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}) {
  const offer = await loadInstituteLotPay(opts.code);
  if (offer.paymentStatus === 'PAID') return { alreadyPaid: true };
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new BookAccessError('razorpay_credentials_missing', 'Payment is not configured.', 400);
  }
  const [rows]: any = await query(
    'SELECT rp_order_id AS rpOrderId FROM book_license_lots WHERE id = ? LIMIT 1',
    [offer.lotId],
  );
  const stored = rows?.[0]?.rpOrderId ? String(rows[0].rpOrderId) : '';
  if (!stored || stored !== String(opts.razorpay_order_id)) {
    throw new BookAccessError('rp_order_mismatch', 'Payment does not match this license.', 400);
  }
  const payload = `${opts.razorpay_order_id}|${opts.razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');
  if (expected !== opts.razorpay_signature) {
    throw new BookAccessError('invalid_signature', 'Could not verify the payment.', 400);
  }
  await query(
    `UPDATE book_license_lots SET payment_status = 'PAID', updated_at = NOW(3) WHERE id = ?`,
    [offer.lotId],
  );
  return { alreadyPaid: false };
}

export async function instituteLotQrPng(code: string): Promise<Buffer> {
  const offer = await loadInstituteLotPay(code);
  const payload = offer.upi || offer.payUrl;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const QRCode = require('qrcode');
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: 280,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export async function markInstituteLotPaid(lotId: number) {
  await ensureBookAccessTables();
  await query(
    `UPDATE book_license_lots SET payment_status = 'PAID', updated_at = NOW(3) WHERE id = ?`,
    [lotId],
  );
}
