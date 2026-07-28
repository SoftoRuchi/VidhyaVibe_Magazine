import { getPool, query } from '../db';

export type EmailSettings = {
  id: number;
  /** Sender Email ID — SMTP login + From address */
  emailId: string;
  smtpPass: string;
  smtpHost: string;
  smtpPort: number;
  smtpTls: boolean;
  imapHost: string;
  imapPort: number;
  imapSsl: boolean;
  fromName: string;
  updatedAt?: string | Date | null;
};

const DEFAULTS: Omit<EmailSettings, 'id' | 'updatedAt'> = {
  emailId: 'support@vidhyavibe.in',
  smtpPass: '',
  smtpHost: 'smtp.hostinger.com',
  smtpPort: 587,
  smtpTls: true,
  imapHost: 'imap.hostinger.com',
  imapPort: 993,
  imapSsl: true,
  fromName: 'VidhyaVibe',
};

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id BIGINT NOT NULL PRIMARY KEY DEFAULT 1,
      email_id VARCHAR(255) NOT NULL,
      smtp_pass VARCHAR(512) NULL,
      smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.hostinger.com',
      smtp_port INT NOT NULL DEFAULT 587,
      smtp_tls TINYINT(1) NOT NULL DEFAULT 1,
      imap_host VARCHAR(255) NOT NULL DEFAULT 'imap.hostinger.com',
      imap_port INT NOT NULL DEFAULT 993,
      imap_ssl TINYINT(1) NOT NULL DEFAULT 1,
      from_name VARCHAR(255) NOT NULL DEFAULT 'VidhyaVibe',
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);

  // Migrate older schema (smtp_user / from_email / receiver_email / smtp_secure) if present
  await migrateLegacyColumns();
}

async function columnExists(column: string): Promise<boolean> {
  const [rows]: any = await query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_settings' AND COLUMN_NAME = ?`,
    [column],
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function migrateLegacyColumns() {
  try {
    if (!(await columnExists('email_id'))) {
      await query(`ALTER TABLE email_settings ADD COLUMN email_id VARCHAR(255) NULL`);
      // Prefer smtp_user / from_email if those old columns exist
      if (await columnExists('smtp_user')) {
        await query(
          `UPDATE email_settings SET email_id = COALESCE(NULLIF(smtp_user, ''), NULLIF(from_email, ''), ?) WHERE id = 1`,
          [DEFAULTS.emailId],
        );
      } else if (await columnExists('from_email')) {
        await query(
          `UPDATE email_settings SET email_id = COALESCE(NULLIF(from_email, ''), ?) WHERE id = 1`,
          [DEFAULTS.emailId],
        );
      } else {
        await query(`UPDATE email_settings SET email_id = ? WHERE id = 1 AND email_id IS NULL`, [
          DEFAULTS.emailId,
        ]);
      }
      await query(`ALTER TABLE email_settings MODIFY COLUMN email_id VARCHAR(255) NOT NULL`);
    }

    if (!(await columnExists('smtp_tls'))) {
      await query(`ALTER TABLE email_settings ADD COLUMN smtp_tls TINYINT(1) NOT NULL DEFAULT 1`);
      if (await columnExists('smtp_secure')) {
        await query(`UPDATE email_settings SET smtp_tls = smtp_secure WHERE id = 1`);
      }
    }

    if (!(await columnExists('imap_host'))) {
      await query(
        `ALTER TABLE email_settings
           ADD COLUMN imap_host VARCHAR(255) NOT NULL DEFAULT 'imap.hostinger.com',
           ADD COLUMN imap_port INT NOT NULL DEFAULT 993,
           ADD COLUMN imap_ssl TINYINT(1) NOT NULL DEFAULT 1`,
      );
    }

    if (!(await columnExists('from_name'))) {
      await query(
        `ALTER TABLE email_settings ADD COLUMN from_name VARCHAR(255) NOT NULL DEFAULT 'VidhyaVibe'`,
      );
    }
  } catch (e) {
    console.warn('[emailSettings] migrateLegacyColumns:', (e as Error)?.message || e);
  }
}

function mapRow(row: any): EmailSettings {
  const emailId = row.email_id || row.smtp_user || row.from_email || DEFAULTS.emailId;
  const smtpTls =
    row.smtp_tls != null
      ? Boolean(row.smtp_tls)
      : row.smtp_secure != null
        ? Boolean(row.smtp_secure)
        : DEFAULTS.smtpTls;

  return {
    id: Number(row.id),
    emailId,
    smtpPass: row.smtp_pass || '',
    smtpHost: row.smtp_host || DEFAULTS.smtpHost,
    smtpPort: Number(row.smtp_port ?? DEFAULTS.smtpPort),
    smtpTls,
    imapHost: row.imap_host || DEFAULTS.imapHost,
    imapPort: Number(row.imap_port ?? DEFAULTS.imapPort),
    imapSsl: row.imap_ssl != null ? Boolean(row.imap_ssl) : DEFAULTS.imapSsl,
    fromName: row.from_name || DEFAULTS.fromName,
    updatedAt: row.updated_at || null,
  };
}

/** Public shape for admin UI — password is masked unless empty. */
export function toPublicEmailSettings(settings: EmailSettings) {
  return {
    id: settings.id,
    emailId: settings.emailId,
    smtpPassSet: Boolean(settings.smtpPass),
    smtpPass: settings.smtpPass ? '********' : '',
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpTls: settings.smtpTls,
    imapHost: settings.imapHost,
    imapPort: settings.imapPort,
    imapSsl: settings.imapSsl,
    fromName: settings.fromName,
    updatedAt: settings.updatedAt,
  };
}

export async function getEmailSettings(): Promise<EmailSettings> {
  await ensureTable();
  const [rows]: any = await query('SELECT * FROM email_settings WHERE id = 1 LIMIT 1');
  if (rows?.[0]) return mapRow(rows[0]);

  // One-time seed only — later changes go through updateEmailSettings
  const envPass = process.env.SMTP_PASS || process.env.EMAIL_SMTP_PASS || '';
  const emailId = process.env.SMTP_USER || process.env.EMAIL_FROM || DEFAULTS.emailId;

  await query(
    `INSERT INTO email_settings
      (id, email_id, smtp_pass, smtp_host, smtp_port, smtp_tls, imap_host, imap_port, imap_ssl, from_name)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      emailId,
      envPass || null,
      process.env.SMTP_HOST || DEFAULTS.smtpHost,
      Number(process.env.SMTP_PORT || DEFAULTS.smtpPort),
      1,
      DEFAULTS.imapHost,
      DEFAULTS.imapPort,
      1,
      DEFAULTS.fromName,
    ],
  );
  const [seeded]: any = await query('SELECT * FROM email_settings WHERE id = 1 LIMIT 1');
  return mapRow(seeded[0]);
}

export async function updateEmailSettings(input: {
  emailId?: string;
  smtpPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpTls?: boolean;
  imapHost?: string;
  imapPort?: number;
  imapSsl?: boolean;
  fromName?: string;
}): Promise<EmailSettings> {
  const current = await getEmailSettings();
  const next = {
    emailId: (input.emailId ?? current.emailId).trim() || DEFAULTS.emailId,
    smtpPass:
      input.smtpPass && input.smtpPass !== '********' ? String(input.smtpPass) : current.smtpPass,
    smtpHost: (input.smtpHost ?? current.smtpHost).trim() || DEFAULTS.smtpHost,
    smtpPort: Number(input.smtpPort ?? current.smtpPort) || DEFAULTS.smtpPort,
    smtpTls: input.smtpTls ?? current.smtpTls,
    imapHost: (input.imapHost ?? current.imapHost).trim() || DEFAULTS.imapHost,
    imapPort: Number(input.imapPort ?? current.imapPort) || DEFAULTS.imapPort,
    imapSsl: input.imapSsl ?? current.imapSsl,
    fromName: (input.fromName ?? current.fromName).trim() || DEFAULTS.fromName,
  };

  await query(
    `UPDATE email_settings SET
      email_id = ?, smtp_pass = ?, smtp_host = ?, smtp_port = ?, smtp_tls = ?,
      imap_host = ?, imap_port = ?, imap_ssl = ?, from_name = ?,
      updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = 1`,
    [
      next.emailId,
      next.smtpPass || null,
      next.smtpHost,
      next.smtpPort,
      next.smtpTls ? 1 : 0,
      next.imapHost,
      next.imapPort,
      next.imapSsl ? 1 : 0,
      next.fromName,
    ],
  );

  return getEmailSettings();
}

/** Resolve effective SMTP config for sending (DB first). */
export async function resolveSmtpConfig() {
  const s = await getEmailSettings();
  const emailId = s.emailId || DEFAULTS.emailId;
  return {
    host: s.smtpHost || process.env.SMTP_HOST || DEFAULTS.smtpHost,
    port: s.smtpPort || Number(process.env.SMTP_PORT || DEFAULTS.smtpPort),
    /** true = SSL (465) or require TLS on 587 */
    tls: s.smtpTls,
    secure: s.smtpPort === 465,
    user: emailId,
    pass: s.smtpPass || process.env.SMTP_PASS || '',
    fromEmail: emailId,
    fromName: s.fromName || DEFAULTS.fromName,
  };
}

/** Optional: verify DB pool is reachable — used by routes. */
export async function pingEmailSettingsDb() {
  getPool();
}
