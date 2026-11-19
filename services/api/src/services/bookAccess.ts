import crypto from 'crypto';
import { hashPassword } from '../auth/password';
import { getPool, query } from '../db';
import { resolveUpiVpa } from './emailSettings';
import { sendStudentLoginCredentials } from './notifications';

export type AccessModel = 'BOOK_BANK' | 'LIBRARY' | 'INDIVIDUAL' | 'ADMIN' | 'OPEN';

const STALE_SECONDS = 120;

export class BookAccessError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 403) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function n(v: unknown): number {
  return Number(v);
}

let tablesReady = false;
let tablesPromise: Promise<void> | null = null;

export async function ensureBookAccessTables() {
  if (tablesReady) return;
  if (!tablesPromise) {
    tablesPromise = ensureBookAccessTablesInner()
      .then(() => {
        tablesReady = true;
      })
      .catch((err) => {
        tablesPromise = null;
        throw err;
      });
  }
  await tablesPromise;
}

async function columnExists(table: string, column: string) {
  const [cols]: any = await query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return n(cols?.[0]?.c) > 0;
}

async function ensureBookAccessTablesInner() {
  if (tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS institutes (
      id BIGINT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(32) NOT NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(32) NULL,
      city VARCHAR(120) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY institutes_code_key (code)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS institute_members (
      id BIGINT NOT NULL AUTO_INCREMENT,
      institute_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
      class_name VARCHAR(80) NULL,
      roll_number VARCHAR(40) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY institute_members_unique (institute_id, user_id),
      KEY institute_members_user_idx (user_id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS book_license_lots (
      id BIGINT NOT NULL AUTO_INCREMENT,
      subject_id BIGINT NOT NULL,
      access_model VARCHAR(24) NOT NULL,
      institute_id BIGINT NULL,
      user_id BIGINT NULL,
      seat_count INT NOT NULL DEFAULT 1,
      purchase_code VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
      starts_at DATETIME(3) NULL,
      ends_at DATETIME(3) NULL,
      notes VARCHAR(500) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY book_license_lots_code (purchase_code),
      KEY book_license_lots_subject_idx (subject_id, status)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS book_license_seats (
      id BIGINT NOT NULL AUTO_INCREMENT,
      lot_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      member_id BIGINT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY book_license_seats_unique (lot_id, user_id),
      KEY book_license_seats_user_idx (user_id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS book_reading_sessions (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      subject_id BIGINT NOT NULL,
      lot_id BIGINT NULL,
      institute_id BIGINT NULL,
      access_model VARCHAR(24) NOT NULL,
      auth_jti VARCHAR(255) NULL,
      device_key VARCHAR(64) NOT NULL,
      device_name VARCHAR(255) NULL,
      ip_address VARCHAR(100) NULL,
      user_agent VARCHAR(1000) NULL,
      chapter_id BIGINT NULL,
      page_number INT NULL,
      started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      last_heartbeat_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ended_at DATETIME(3) NULL,
      end_reason VARCHAR(32) NULL,
      seconds_active INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY book_reading_sessions_user_subject (user_id, subject_id),
      KEY book_reading_sessions_live (subject_id, ended_at, last_heartbeat_at)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  if (!(await columnExists('course_subjects', 'price'))) {
    try {
      await query('ALTER TABLE course_subjects ADD COLUMN price DECIMAL(10,2) NULL');
    } catch (e) {
      console.warn('[bookAccess] price column ensure failed', e);
    }
  }
  await query(`
    CREATE TABLE IF NOT EXISTS book_orders (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      subject_id BIGINT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      provider VARCHAR(16) NULL,
      rp_order_id VARCHAR(64) NULL,
      rp_payment_id VARCHAR(64) NULL,
      lot_id BIGINT NULL,
      purchase_code VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      paid_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY book_orders_user_subject (user_id, subject_id, status),
      KEY book_orders_rp (rp_order_id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS book_order_proofs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      order_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      file_key VARCHAR(1024) NULL,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      verified_by BIGINT NULL,
      verified_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY book_order_proofs_order (order_id),
      KEY book_order_proofs_pending (verified)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  const extraColumns: Array<[string, string, string]> = [
    ['sessions', 'logged_out_at', 'DATETIME NULL'],
    ['sessions', 'last_seen_at', 'DATETIME NULL'],
    ['course_subjects', 'book_bank_price', 'DECIMAL(10,2) NULL'],
    ['course_subjects', 'library_price', 'DECIMAL(10,2) NULL'],
    ['course_subjects', 'discount_pct', 'DECIMAL(5,2) NULL'],
    ['course_subjects', 'physical_price', 'DECIMAL(10,2) NULL'],
    ['course_subjects', 'both_price', 'DECIMAL(10,2) NULL'],
    ['course_subjects', 'isbn', 'VARCHAR(32) NULL'],
    ['book_license_lots', 'amount', 'DECIMAL(10,2) NULL'],
    ['book_license_lots', 'discount_pct', 'DECIMAL(5,2) NULL'],
    ['book_license_lots', 'payment_status', 'VARCHAR(16) NULL'],
    ['book_license_lots', 'payment_sent_at', 'DATETIME(3) NULL'],
    ['book_license_lots', 'rp_order_id', 'VARCHAR(64) NULL'],
    ['book_orders', 'delivery_format', "VARCHAR(16) NULL"],
    ['book_orders', 'ship_line', 'VARCHAR(500) NULL'],
    ['book_orders', 'ship_city', 'VARCHAR(120) NULL'],
    ['book_orders', 'ship_state', 'VARCHAR(120) NULL'],
    ['book_orders', 'ship_pincode', 'VARCHAR(16) NULL'],
  ];
  for (const [table, column, def] of extraColumns) {
    try {
      if (await columnExists(table, column)) continue;
      await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    } catch {
      // table or column may not exist yet / already exists
    }
  }
  tablesReady = true;
}

export function parseBookPrice(v: unknown): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const amount = Number(v);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function parseDiscountPct(v: unknown): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const pct = Number(v);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round(Math.min(100, pct) * 100) / 100;
}

export function applyListDiscount(list: number | null | undefined, discountPct?: number | null): number | null {
  if (list == null || !Number.isFinite(list)) return null;
  const pct = Number(discountPct);
  if (!Number.isFinite(pct) || pct <= 0) return Math.round(list * 100) / 100;
  const cut = Math.min(100, Math.max(0, pct));
  return Math.round(list * (1 - cut / 100) * 100) / 100;
}

export async function grantIndividualLicense(opts: {
  userId: number;
  subjectId: number;
  notes?: string | null;
}): Promise<{ lotId: number; purchaseCode: string; created: boolean }> {
  await ensureBookAccessTables();
  const [dup]: any = await query(
    `SELECT id, purchase_code AS purchaseCode
     FROM book_license_lots
     WHERE user_id = ? AND subject_id = ? AND access_model = 'INDIVIDUAL' AND status = 'ACTIVE'
     LIMIT 1`,
    [opts.userId, opts.subjectId],
  );
  if (dup?.[0]) {
    return { lotId: n(dup[0].id), purchaseCode: String(dup[0].purchaseCode || ''), created: false };
  }
  const purchaseCode = makePurchaseCode('INDIVIDUAL', null, opts.subjectId);
  const [ins]: any = await query(
    `INSERT INTO book_license_lots
      (subject_id, access_model, user_id, seat_count, purchase_code, status, notes, created_at, updated_at)
     VALUES (?, 'INDIVIDUAL', ?, 1, ?, 'ACTIVE', ?, NOW(3), NOW(3))`,
    [opts.subjectId, opts.userId, purchaseCode, opts.notes || null],
  );
  const lotId = n(ins.insertId);
  await query(
    `INSERT INTO book_license_seats (lot_id, user_id, created_at) VALUES (?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [lotId, opts.userId],
  );
  return { lotId, purchaseCode, created: true };
}

export type BookCheckout = {
  needsPayment: true;
  orderId: number;
  amount: number;
  currency: string;
  provider: 'razorpay' | 'upi';
  status: string;
  rpOrderId?: string | null;
  razorpayKeyId?: string | null;
  upi?: string | null;
};

async function bookUpiLink(orderId: number, amount: number, currency: string) {
  const vpa = await resolveUpiVpa();
  if (!vpa) return null;
  const pa = encodeURIComponent(vpa);
  const pn = encodeURIComponent('VidhyaVibe');
  const tn = encodeURIComponent(`Book ${orderId}`);
  return `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}&am=${amount.toFixed(2)}&cu=${currency}`;
}

async function checkoutPayload(row: any): Promise<BookCheckout> {
  const amount = Number(row.amount);
  const currency = String(row.currency || 'INR');
  const provider = row.provider === 'razorpay' && row.rp_order_id ? 'razorpay' : 'upi';
  return {
    needsPayment: true,
    orderId: n(row.id),
    amount,
    currency,
    provider,
    status: String(row.status || 'PENDING'),
    rpOrderId: row.rp_order_id || null,
    razorpayKeyId: provider === 'razorpay' ? process.env.RAZORPAY_KEY_ID || null : null,
    upi: provider === 'upi' ? await bookUpiLink(n(row.id), amount, currency) : null,
  };
}

async function createRazorpayBookOrder(amount: number, currency: string, receipt: string) {
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
      currency,
      receipt,
    }),
  });
  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.id) return null;
  return { id: String(data.id), keyId };
}

export type BookOrderShipping = {
  line1: string;
  city: string;
  state?: string;
  pincode: string;
};

async function saveBookOrderFulfillment(
  orderId: number,
  format: 'EBOOK' | 'POD' | 'BOTH',
  shipping?: BookOrderShipping | null,
) {
  await query(
    `UPDATE book_orders
     SET delivery_format = ?, ship_line = ?, ship_city = ?, ship_state = ?, ship_pincode = ?
     WHERE id = ?`,
    [
      format,
      shipping?.line1 || null,
      shipping?.city || null,
      shipping?.state || null,
      shipping?.pincode || null,
      orderId,
    ],
  );
}

export async function createBookCheckout(opts: {
  userId: number;
  subjectId: number;
  price: number;
  currency?: string;
  format?: 'EBOOK' | 'POD' | 'BOTH';
  shipping?: BookOrderShipping | null;
}): Promise<BookCheckout> {
  await ensureBookAccessTables();
  const currency = opts.currency || 'INR';
  const [existing]: any = await query(
    `SELECT id, amount, currency, status, provider, rp_order_id
     FROM book_orders
     WHERE user_id = ? AND subject_id = ? AND status = 'PENDING'
     ORDER BY id DESC LIMIT 1`,
    [opts.userId, opts.subjectId],
  );
  const format = opts.format === 'POD' ? 'POD' : 'EBOOK';
  if (existing?.[0]) {
    const row = existing[0];
    await saveBookOrderFulfillment(n(row.id), format, opts.shipping);
    if (row.provider === 'razorpay' && row.rp_order_id) return await checkoutPayload(row);
    const rp = await createRazorpayBookOrder(
      Number(row.amount),
      String(row.currency || currency),
      `book-${n(row.id)}`,
    );
    if (rp) {
      await query(`UPDATE book_orders SET provider = 'razorpay', rp_order_id = ? WHERE id = ?`, [
        rp.id,
        n(row.id),
      ]);
      row.provider = 'razorpay';
      row.rp_order_id = rp.id;
    }
    return await checkoutPayload(row);
  }

  const [ins]: any = await query(
    `INSERT INTO book_orders (user_id, subject_id, amount, currency, status, provider, created_at)
     VALUES (?, ?, ?, ?, 'PENDING', 'upi', NOW(3))`,
    [opts.userId, opts.subjectId, opts.price, currency],
  );
  const orderId = n(ins.insertId);
  const rp = await createRazorpayBookOrder(opts.price, currency, `book-${orderId}`);
  if (rp) {
    await query(`UPDATE book_orders SET provider = 'razorpay', rp_order_id = ? WHERE id = ?`, [
      rp.id,
      orderId,
    ]);
  }
  await saveBookOrderFulfillment(orderId, format, opts.shipping);
  const [rows]: any = await query(
    `SELECT id, amount, currency, status, provider, rp_order_id FROM book_orders WHERE id = ? LIMIT 1`,
    [orderId],
  );
  return await checkoutPayload(rows[0]);
}

export async function confirmBookRazorpayPayment(opts: {
  userId: number;
  subjectId: number;
  orderId: number;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}) {
  await ensureBookAccessTables();
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret)
    throw new BookAccessError('razorpay_credentials_missing', 'Payment is not configured.', 400);

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows]: any = await conn.query(
      `SELECT * FROM book_orders WHERE id = ? AND user_id = ? AND subject_id = ? LIMIT 1 FOR UPDATE`,
      [opts.orderId, opts.userId, opts.subjectId],
    );
    const order = rows?.[0];
    if (!order) throw new BookAccessError('order_not_found', 'Order not found.', 404);
    if (order.status === 'PAID') {
      await conn.commit();
      return { alreadyPaid: true, purchaseCode: order.purchase_code, lotId: order.lot_id };
    }
    if (!order.rp_order_id || String(order.rp_order_id) !== String(opts.razorpay_order_id)) {
      throw new BookAccessError('rp_order_mismatch', 'Payment does not match this order.', 400);
    }
    const payload = `${opts.razorpay_order_id}|${opts.razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');
    if (expected !== opts.razorpay_signature) {
      throw new BookAccessError('invalid_signature', 'Could not verify the payment.', 400);
    }
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    conn.release();
  }

  const granted = await grantIndividualLicense({
    userId: opts.userId,
    subjectId: opts.subjectId,
    notes: `Razorpay ${opts.razorpay_payment_id}`,
  });
  await query(
    `UPDATE book_orders
     SET status = 'PAID', rp_payment_id = ?, lot_id = ?, purchase_code = ?, paid_at = NOW(3)
     WHERE id = ?`,
    [opts.razorpay_payment_id, granted.lotId, granted.purchaseCode, opts.orderId],
  );
  return { alreadyPaid: false, purchaseCode: granted.purchaseCode, lotId: granted.lotId };
}

export async function attachBookOrderProof(opts: {
  userId: number;
  subjectId: number;
  orderId: number;
  fileKey: string;
}) {
  await ensureBookAccessTables();
  const [rows]: any = await query(
    `SELECT id, status FROM book_orders WHERE id = ? AND user_id = ? AND subject_id = ? LIMIT 1`,
    [opts.orderId, opts.userId, opts.subjectId],
  );
  if (!rows?.[0]) throw new BookAccessError('order_not_found', 'Order not found.', 404);
  if (rows[0].status === 'PAID')
    throw new BookAccessError('already_paid', 'This order is already paid.', 409);
  const [ins]: any = await query(
    `INSERT INTO book_order_proofs (order_id, user_id, file_key, created_at) VALUES (?, ?, ?, NOW(3))`,
    [opts.orderId, opts.userId, opts.fileKey],
  );
  return n(ins.insertId);
}

export async function verifyBookOrderProof(proofId: number, adminId: number) {
  await ensureBookAccessTables();
  const [pRows]: any = await query(
    `SELECT p.id, p.order_id AS orderId, p.verified, o.user_id AS userId, o.subject_id AS subjectId, o.status
     FROM book_order_proofs p
     INNER JOIN book_orders o ON o.id = p.order_id
     WHERE p.id = ? LIMIT 1`,
    [proofId],
  );
  const proof = pRows?.[0];
  if (!proof) throw new BookAccessError('proof_not_found', 'Proof not found.', 404);
  if (proof.verified) return { alreadyVerified: true };
  if (proof.status === 'PAID') {
    await query(
      `UPDATE book_order_proofs SET verified = 1, verified_by = ?, verified_at = NOW(3) WHERE id = ?`,
      [adminId, proofId],
    );
    return { alreadyPaid: true };
  }
  const granted = await grantIndividualLicense({
    userId: n(proof.userId),
    subjectId: n(proof.subjectId),
    notes: `UPI proof ${proofId}`,
  });
  await query(
    `UPDATE book_orders
     SET status = 'PAID', lot_id = ?, purchase_code = ?, paid_at = NOW(3)
     WHERE id = ?`,
    [granted.lotId, granted.purchaseCode, n(proof.orderId)],
  );
  await query(
    `UPDATE book_order_proofs SET verified = 1, verified_by = ?, verified_at = NOW(3) WHERE id = ?`,
    [adminId, proofId],
  );
  return { purchaseCode: granted.purchaseCode, lotId: granted.lotId };
}

export function makePurchaseCode(
  model: AccessModel,
  instituteCode: string | null,
  subjectId: number,
) {
  const prefix = model === 'BOOK_BANK' ? 'BB' : model === 'LIBRARY' ? 'LB' : 'IN';
  const inst =
    (instituteCode || 'PRIV')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase() || 'PRIV';
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VV-${prefix}-${inst}-${subjectId}-${rand}`;
}

export function randomPassword() {
  return `Vv${crypto.randomBytes(4).toString('hex')}`;
}

const LOT_ACTIVE = `l.status = 'ACTIVE' AND (l.starts_at IS NULL OR l.starts_at <= NOW(3)) AND (l.ends_at IS NULL OR l.ends_at >= NOW(3))`;

export type Entitlement = {
  allowed: boolean;
  accessModel: AccessModel;
  lotId?: number;
  instituteId?: number | null;
  seatCount?: number;
};

export async function expireStaleSessions() {
  await ensureBookAccessTables();
  await query(
    `UPDATE book_reading_sessions
     SET ended_at = NOW(3), end_reason = 'TIMEOUT'
     WHERE ended_at IS NULL AND last_heartbeat_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
    [STALE_SECONDS],
  );
}

export async function touchUserLastSeen(userId: number) {
  if (!userId) return;
  try {
    const [r]: any = await query(
      `UPDATE sessions SET last_seen_at = NOW() WHERE user_id = ? AND logged_out_at IS NULL`,
      [userId],
    );
    if (r?.affectedRows) return;
  } catch {
    // snake-case session columns may not exist
  }
  try {
    await query(
      `UPDATE sessions SET last_seen_at = NOW() WHERE userId = ? AND loggedOutAt IS NULL`,
      [userId],
    );
  } catch {
    try {
      await query(`UPDATE sessions SET last_seen_at = NOW() WHERE userId = ?`, [userId]);
    } catch {
      // last_seen_at may be missing on older databases
    }
  }
}

export async function resolveEntitlement(
  userId: number,
  subjectId: number,
  isAdmin?: boolean,
): Promise<Entitlement> {
  await ensureBookAccessTables();
  if (isAdmin) return { allowed: true, accessModel: 'ADMIN' };

  const [lotCount]: any = await query(
    `SELECT COUNT(*) AS c FROM book_license_lots l WHERE l.subject_id = ? AND ${LOT_ACTIVE}`,
    [subjectId],
  );
  if (!n(lotCount?.[0]?.c)) return { allowed: true, accessModel: 'OPEN' };

  const [bank]: any = await query(
    `SELECT l.id, l.institute_id AS instituteId, l.seat_count AS seatCount
     FROM book_license_seats s
     INNER JOIN book_license_lots l ON l.id = s.lot_id
     WHERE s.user_id = ? AND l.subject_id = ? AND l.access_model = 'BOOK_BANK' AND ${LOT_ACTIVE}
     ORDER BY s.id ASC LIMIT 1`,
    [userId, subjectId],
  );
  if (bank?.[0]) {
    return {
      allowed: true,
      accessModel: 'BOOK_BANK',
      lotId: n(bank[0].id),
      instituteId: bank[0].instituteId != null ? n(bank[0].instituteId) : null,
      seatCount: n(bank[0].seatCount),
    };
  }

  const [individual]: any = await query(
    `SELECT id, seat_count AS seatCount
     FROM book_license_lots
     WHERE user_id = ? AND subject_id = ? AND access_model = 'INDIVIDUAL' AND status = 'ACTIVE'
       AND (starts_at IS NULL OR starts_at <= NOW(3)) AND (ends_at IS NULL OR ends_at >= NOW(3))
     LIMIT 1`,
    [userId, subjectId],
  );
  if (individual?.[0]) {
    return {
      allowed: true,
      accessModel: 'INDIVIDUAL',
      lotId: n(individual[0].id),
      seatCount: n(individual[0].seatCount) || 1,
    };
  }

  const [library]: any = await query(
    `SELECT l.id, l.institute_id AS instituteId, l.seat_count AS seatCount
     FROM institute_members m
     INNER JOIN book_license_lots l ON l.institute_id = m.institute_id
     WHERE m.user_id = ? AND l.subject_id = ? AND l.access_model = 'LIBRARY' AND ${LOT_ACTIVE}
     ORDER BY l.id ASC LIMIT 1`,
    [userId, subjectId],
  );
  if (library?.[0]) {
    return {
      allowed: true,
      accessModel: 'LIBRARY',
      lotId: n(library[0].id),
      instituteId: library[0].instituteId != null ? n(library[0].instituteId) : null,
      seatCount: n(library[0].seatCount),
    };
  }

  return { allowed: false, accessModel: 'OPEN' };
}

export async function assertCanReadSubject(userId: number, subjectId: number, isAdmin?: boolean) {
  const ent = await resolveEntitlement(userId, subjectId, isAdmin);
  if (!ent.allowed) {
    throw new BookAccessError(
      'no_license',
      'You do not have a license to read this book. Ask your institute or purchase access.',
    );
  }
  return ent;
}

export type EntitledBook = {
  id: number;
  name: string;
  slug: string;
  coverKey?: string | null;
  courseName: string;
  courseSlug: string;
  semesterNumber: number;
  accessModel: AccessModel;
  instituteName?: string | null;
  purchaseCode?: string | null;
  href: string;
  lastChapterTitle?: string | null;
  lastPageNumber?: number | null;
  lastReadAt?: string | null;
};

export async function listEntitledBooks(userId: number): Promise<EntitledBook[]> {
  await ensureBookAccessTables();
  const bookSql = `
    SELECT s.id, s.name, s.slug, s.cover_key AS coverKey, c.name AS courseName, c.slug AS courseSlug, sem.number AS semesterNumber,
           l.access_model AS accessModel, i.name AS instituteName, l.purchase_code AS purchaseCode
    FROM book_license_lots l
    INNER JOIN course_subjects s ON s.id = l.subject_id
    INNER JOIN course_semesters sem ON sem.id = s.semester_id
    INNER JOIN courses c ON c.id = sem.course_id
    LEFT JOIN institutes i ON i.id = l.institute_id
  `;
  const [bank]: any = await query(
    `${bookSql}
     INNER JOIN book_license_seats st ON st.lot_id = l.id
     WHERE st.user_id = ? AND l.access_model = 'BOOK_BANK' AND ${LOT_ACTIVE}`,
    [userId],
  );
  const [individual]: any = await query(
    `${bookSql}
     WHERE l.user_id = ? AND l.access_model = 'INDIVIDUAL' AND ${LOT_ACTIVE}`,
    [userId],
  );
  const [library]: any = await query(
    `${bookSql}
     INNER JOIN institute_members m ON m.institute_id = l.institute_id AND m.user_id = ?
     WHERE l.access_model = 'LIBRARY' AND ${LOT_ACTIVE}`,
    [userId],
  );
  const rank: Record<string, number> = { BOOK_BANK: 3, INDIVIDUAL: 2, LIBRARY: 1 };
  const byId = new Map<number, EntitledBook>();
  for (const row of [...(bank || []), ...(individual || []), ...(library || [])]) {
    const id = n(row.id);
    const next: EntitledBook = {
      id,
      name: row.name,
      slug: row.slug,
      coverKey: row.coverKey || null,
      courseName: row.courseName,
      courseSlug: row.courseSlug,
      semesterNumber: n(row.semesterNumber),
      accessModel: row.accessModel,
      instituteName: row.instituteName || null,
      purchaseCode: row.purchaseCode || null,
      href: `/courses/${row.courseSlug}/sem-${n(row.semesterNumber)}/${row.slug}`,
    };
    const prev = byId.get(id);
    if (!prev || (rank[next.accessModel] || 0) > (rank[prev.accessModel] || 0)) {
      byId.set(id, next);
    }
  }
  const books = Array.from(byId.values());
  if (books.length) {
    try {
      const ids = books.map((b) => b.id);
      const [latest]: any = await query(
        `SELECT rs.subject_id AS subjectId, ch.title AS chapterTitle, rs.page_number AS pageNumber,
                rs.last_heartbeat_at AS lastReadAt
         FROM book_reading_sessions rs
         LEFT JOIN course_chapters ch ON ch.id = rs.chapter_id
         INNER JOIN (
           SELECT subject_id, MAX(id) AS id
           FROM book_reading_sessions
           WHERE user_id = ? AND subject_id IN (${ids.map(() => '?').join(',')})
           GROUP BY subject_id
         ) latest ON latest.id = rs.id`,
        [userId, ...ids],
      );
      const lastBy = new Map<number, any>((latest || []).map((r: any) => [n(r.subjectId), r]));
      for (const book of books) {
        const last = lastBy.get(book.id);
        if (!last) continue;
        book.lastChapterTitle = last.chapterTitle || null;
        book.lastPageNumber = last.pageNumber != null ? n(last.pageNumber) : null;
        book.lastReadAt = last.lastReadAt || null;
      }
    } catch {
      // reading history is optional on this list
    }
  }
  return books.sort(
    (a, b) => a.courseName.localeCompare(b.courseName) || a.name.localeCompare(b.name),
  );
}

export async function subjectIdForChapter(chapterId: number): Promise<number | null> {
  const [rows]: any = await query(
    'SELECT subject_id AS subjectId FROM course_chapters WHERE id = ? LIMIT 1',
    [chapterId],
  );
  return rows?.[0]?.subjectId != null ? n(rows[0].subjectId) : null;
}

async function liveCount(lotId: number, subjectId: number) {
  const [rows]: any = await query(
    `SELECT COUNT(*) AS c FROM book_reading_sessions
     WHERE subject_id = ? AND lot_id = ? AND ended_at IS NULL
       AND last_heartbeat_at >= DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
    [subjectId, lotId, STALE_SECONDS],
  );
  return n(rows?.[0]?.c);
}

export async function acquireReadingSession(opts: {
  userId: number;
  subjectId: number;
  isAdmin?: boolean;
  deviceKey: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  chapterId?: number | null;
  pageNumber?: number | null;
  authJti?: string | null;
}) {
  await expireStaleSessions();
  const ent = await assertCanReadSubject(opts.userId, opts.subjectId, opts.isAdmin);
  const deviceKey = String(opts.deviceKey || '').slice(0, 64) || 'unknown';

  const [mine]: any = await query(
    `SELECT id FROM book_reading_sessions
     WHERE user_id = ? AND subject_id = ? AND device_key = ? AND ended_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    [opts.userId, opts.subjectId, deviceKey],
  );
  if (mine?.[0]) {
    await query(
      `UPDATE book_reading_sessions
       SET last_heartbeat_at = NOW(3), chapter_id = COALESCE(?, chapter_id), page_number = COALESCE(?, page_number),
           device_name = COALESCE(?, device_name)
       WHERE id = ?`,
      [opts.chapterId || null, opts.pageNumber || null, opts.deviceName || null, mine[0].id],
    );
    await touchUserLastSeen(opts.userId);
    return { sessionId: n(mine[0].id), accessModel: ent.accessModel, resumed: true };
  }

  if (ent.accessModel === 'INDIVIDUAL') {
    await query(
      `UPDATE book_reading_sessions
       SET ended_at = NOW(3), end_reason = 'KICKED'
       WHERE user_id = ? AND subject_id = ? AND ended_at IS NULL AND device_key <> ?`,
      [opts.userId, opts.subjectId, deviceKey],
    );
  }

  if (ent.accessModel === 'LIBRARY' && ent.lotId) {
    const used = await liveCount(ent.lotId, opts.subjectId);
    if (used >= (ent.seatCount || 0)) {
      throw new BookAccessError(
        'library_full',
        'All library licenses for this book are in use. Try again when another student closes the book.',
      );
    }
  }

  const [ins]: any = await query(
    `INSERT INTO book_reading_sessions
      (user_id, subject_id, lot_id, institute_id, access_model, auth_jti, device_key, device_name,
       ip_address, user_agent, chapter_id, page_number, started_at, last_heartbeat_at, seconds_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), 0)`,
    [
      opts.userId,
      opts.subjectId,
      ent.lotId || null,
      ent.instituteId || null,
      ent.accessModel,
      opts.authJti || null,
      deviceKey,
      opts.deviceName || null,
      opts.ipAddress || null,
      opts.userAgent ? String(opts.userAgent).slice(0, 1000) : null,
      opts.chapterId || null,
      opts.pageNumber || null,
    ],
  );
  await touchUserLastSeen(opts.userId);
  return { sessionId: n(ins.insertId), accessModel: ent.accessModel, resumed: false };
}

export async function heartbeatReadingSession(opts: {
  sessionId: number;
  userId: number;
  chapterId?: number | null;
  pageNumber?: number | null;
}) {
  const [rows]: any = await query(
    `SELECT id, ended_at AS endedAt, end_reason AS endReason, last_heartbeat_at AS lastHeartbeatAt
     FROM book_reading_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
    [opts.sessionId, opts.userId],
  );
  const row = rows?.[0];
  if (!row) throw new BookAccessError('session_not_found', 'Reading session not found.', 404);
  if (row.endedAt) {
    throw new BookAccessError(
      row.endReason === 'KICKED' ? 'session_replaced' : 'session_ended',
      row.endReason === 'KICKED'
        ? 'This book was opened on another device. This session has been signed out.'
        : 'This reading session has ended.',
      409,
    );
  }
  const last = row.lastHeartbeatAt ? new Date(row.lastHeartbeatAt).getTime() : Date.now();
  const delta = Math.max(0, Math.min(60, Math.round((Date.now() - last) / 1000)));
  await query(
    `UPDATE book_reading_sessions
     SET last_heartbeat_at = NOW(3),
         seconds_active = seconds_active + ?,
         chapter_id = COALESCE(?, chapter_id),
         page_number = COALESCE(?, page_number)
     WHERE id = ?`,
    [delta, opts.chapterId || null, opts.pageNumber || null, opts.sessionId],
  );
  await touchUserLastSeen(opts.userId);
  return { ok: true };
}

export async function releaseReadingSession(sessionId: number, userId: number, reason = 'LOGOUT') {
  await query(
    `UPDATE book_reading_sessions
     SET ended_at = NOW(3), end_reason = ?
     WHERE id = ? AND user_id = ? AND ended_at IS NULL`,
    [reason, sessionId, userId],
  );
}

export async function adminEndReadingSession(sessionId: number, reason = 'ADMIN') {
  await expireStaleSessions();
  const [rows]: any = await query(
    `SELECT id, ended_at AS endedAt FROM book_reading_sessions WHERE id = ? LIMIT 1`,
    [sessionId],
  );
  if (!rows?.[0]) throw new BookAccessError('session_not_found', 'Reading session not found.', 404);
  if (rows[0].endedAt) return { alreadyEnded: true };
  await query(
    `UPDATE book_reading_sessions SET ended_at = NOW(3), end_reason = ? WHERE id = ? AND ended_at IS NULL`,
    [reason, sessionId],
  );
  return { alreadyEnded: false };
}

export async function endReadingSessionsForUser(userId: number, reason = 'LOGOUT') {
  await ensureBookAccessTables();
  await query(
    `UPDATE book_reading_sessions
     SET ended_at = NOW(3), end_reason = ?
     WHERE user_id = ? AND ended_at IS NULL`,
    [reason, userId],
  );
}

export async function upsertUserByEmail(opts: { email: string; name?: string; password?: string }) {
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new BookAccessError('invalid_email', 'A valid email is required.', 400);
  }
  const [existing]: any = await query('SELECT id, email, name FROM users WHERE email = ? LIMIT 1', [
    email,
  ]);
  if (existing?.[0]) {
    if (opts.password) {
      const hash = await hashPassword(opts.password);
      await query(
        'CREATE TABLE IF NOT EXISTS user_auth (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNIQUE, password_hash VARCHAR(255), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      );
      const [auth]: any = await query('SELECT user_id FROM user_auth WHERE user_id = ? LIMIT 1', [
        existing[0].id,
      ]);
      if (auth?.[0]) {
        await query('UPDATE user_auth SET password_hash = ? WHERE user_id = ?', [
          hash,
          existing[0].id,
        ]);
      } else {
        await query('INSERT INTO user_auth (user_id, password_hash) VALUES (?, ?)', [
          existing[0].id,
          hash,
        ]);
      }
    }
    return {
      id: n(existing[0].id),
      email: existing[0].email,
      name: existing[0].name,
      created: false,
      password: opts.password || undefined,
    };
  }
  const password = opts.password || randomPassword();
  const [ins]: any = await query(
    'INSERT INTO users (email, name, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP(3))',
    [email, (opts.name || email.split('@')[0]).trim()],
  );
  const userId = n(ins.insertId);
  const hash = await hashPassword(password);
  await query(
    'CREATE TABLE IF NOT EXISTS user_auth (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNIQUE, password_hash VARCHAR(255), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  await query('INSERT INTO user_auth (user_id, password_hash) VALUES (?, ?)', [userId, hash]);
  return { id: userId, email, name: opts.name || email.split('@')[0], created: true, password };
}

export async function emailStudentLogin(opts: {
  email: string;
  name?: string | null;
  password?: string | null;
  accountCreated?: boolean;
  bookName?: string | null;
  collegeName?: string | null;
}) {
  try {
    const result = await sendStudentLoginCredentials(opts);
    return Boolean(result?.ok);
  } catch (e) {
    console.error('[bookAccess] login email failed', opts.email, e);
    return false;
  }
}

export type InstituteAdminCampus = {
  id: number;
  name: string;
  code: string;
  city: string | null;
  status: string;
};

export async function listInstituteAdminInstitutes(
  userId: number,
): Promise<InstituteAdminCampus[]> {
  await ensureBookAccessTables();
  const [rows]: any = await query(
    `SELECT i.id, i.name, i.code, i.city, i.status
     FROM institute_members m
     INNER JOIN institutes i ON i.id = m.institute_id
     WHERE m.user_id = ? AND m.role = 'INSTITUTE_ADMIN'
     ORDER BY i.name ASC`,
    [userId],
  );
  return (rows || []).map((r: any) => ({
    id: n(r.id),
    name: r.name,
    code: r.code,
    city: r.city || null,
    status: r.status,
  }));
}

export async function assertInstituteAdmin(userId: number, instituteId: number) {
  const institutes = await listInstituteAdminInstitutes(userId);
  const found = institutes.find((campus) => campus.id === instituteId);
  if (!found) {
    throw new BookAccessError(
      'institute_admin_required',
      'You must be an institute admin for this college.',
      403,
    );
  }
  return found;
}

export async function assignStudentsToLot(
  lotId: number,
  students: Array<{
    email?: string;
    name?: string;
    className?: string;
    rollNumber?: string;
    password?: string;
  }>,
) {
  await ensureBookAccessTables();
  const [lots]: any = await query(
    `SELECT l.id, l.institute_id AS instituteId, l.seat_count AS seatCount, l.access_model AS accessModel,
            s.name AS subjectName, i.name AS instituteName
     FROM book_license_lots l
     LEFT JOIN course_subjects s ON s.id = l.subject_id
     LEFT JOIN institutes i ON i.id = l.institute_id
     WHERE l.id = ? LIMIT 1`,
    [lotId],
  );
  const lot = lots?.[0];
  if (!lot) throw new BookAccessError('lot_not_found', 'License lot not found.', 404);
  const [usedRows]: any = await query(
    'SELECT COUNT(*) AS c FROM book_license_seats WHERE lot_id = ?',
    [lotId],
  );
  const used = n(usedRows?.[0]?.c);
  const remaining = n(lot.seatCount) - used;
  if (lot.accessModel === 'BOOK_BANK' && students.length > remaining) {
    throw new BookAccessError(
      'seats_exceeded',
      `This purchase has ${remaining} seat(s) left of ${n(lot.seatCount)}.`,
      400,
    );
  }

  const created: Array<{
    userId: number;
    email: string;
    name?: string | null;
    created: boolean;
    password?: string;
  }> = [];
  for (const row of students) {
    const email = String(row.email || '').trim();
    if (!email) continue;
    const user = await upsertUserByEmail({
      email,
      name: row.name,
      password: row.password,
    });
    let memberId: number | null = null;
    if (lot.instituteId) {
      const [mem]: any = await query(
        `INSERT INTO institute_members (institute_id, user_id, role, class_name, roll_number, created_at)
         VALUES (?, ?, 'STUDENT', ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE class_name = VALUES(class_name), roll_number = VALUES(roll_number)`,
        [lot.instituteId, user.id, row.className || null, row.rollNumber || null],
      );
      const [found]: any = await query(
        'SELECT id FROM institute_members WHERE institute_id = ? AND user_id = ? LIMIT 1',
        [lot.instituteId, user.id],
      );
      memberId = found?.[0]?.id != null ? n(found[0].id) : n(mem.insertId) || null;
    }
    if (lot.accessModel === 'BOOK_BANK' || lot.accessModel === 'INDIVIDUAL') {
      await query(
        `INSERT INTO book_license_seats (lot_id, user_id, member_id, created_at)
         VALUES (?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE member_id = VALUES(member_id)`,
        [lotId, user.id, memberId],
      );
    }
    created.push({
      userId: user.id,
      email: user.email,
      name: user.name,
      created: user.created,
      password: user.password || row.password || undefined,
    });
  }
  const emailedFlags = await Promise.all(
    created.map((u) =>
      emailStudentLogin({
        email: u.email,
        name: u.name,
        password: u.password || null,
        accountCreated: u.created,
        bookName: lot.subjectName || null,
        collegeName: lot.instituteName || null,
      }),
    ),
  );
  return {
    assigned: created.length,
    emailed: emailedFlags.filter(Boolean).length,
    students: created.map((u) => ({ userId: u.userId, email: u.email, created: u.created })),
    instituteId: lot.instituteId ? n(lot.instituteId) : null,
  };
}
