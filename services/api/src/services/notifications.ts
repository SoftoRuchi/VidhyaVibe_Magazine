import { resolveSmtpConfig } from './emailSettings';

/**
 * Outbound email + WhatsApp helpers.
 *
 * Email SMTP is loaded from DB table `email_settings` (Admin → Email Settings).
 * Falls back to env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *
 * WhatsApp — Meta Cloud API / Twilio (optional env).
 */

type NotifyChannelResult = {
  channel: 'email' | 'whatsapp' | 'sms';
  ok: boolean;
  detail?: string;
};

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
  contentDisposition?: 'inline' | 'attachment';
};

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function e164(phone: string): string {
  const n = normalizePhone(phone);
  return n.startsWith('+') ? n : `+${n}`;
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  text: string,
  opts?: { html?: string; attachments?: EmailAttachment[] },
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const cfg = await resolveSmtpConfig();
  const from = `${cfg.fromName} <${cfg.fromEmail}>`;
  const attachments = (opts?.attachments || []).map((a) => ({
    filename: a.filename,
    content: a.content.toString('base64'),
  }));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: opts?.html,
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`resend_failed:${res.status}:${body}`);
  }
  return true;
}

async function sendEmailViaSmtp(
  to: string,
  subject: string,
  text: string,
  opts?: { html?: string; attachments?: EmailAttachment[] },
): Promise<boolean> {
  const cfg = await resolveSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure || cfg.port === 465,
      requireTLS: Boolean(cfg.tls) && cfg.port !== 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const from = `${cfg.fromName} <${cfg.fromEmail}>`;
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: opts?.html,
      attachments: opts?.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        cid: a.cid,
        contentType: a.contentType,
        contentDisposition: a.contentDisposition || (a.cid ? 'inline' : 'attachment'),
      })),
    });
    return true;
  } catch (e: any) {
    if (e?.code === 'MODULE_NOT_FOUND') {
      console.warn('[notifications] nodemailer not installed; SMTP skipped');
      return false;
    }
    throw e;
  }
}

/** Meta WhatsApp Cloud API — text body (works inside 24h customer-care window). */
async function sendWhatsAppMetaText(toPhone: string, message: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;

  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const to = normalizePhone(toPhone);
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`whatsapp_meta_text_failed:${res.status}:${err}`);
  }
  return true;
}

/** Meta WhatsApp Cloud API — approved template (for first outreach). */
async function sendWhatsAppMetaTemplate(
  toPhone: string,
  templateName: string,
  bodyParams: string[],
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId || !templateName) return false;

  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const to = normalizePhone(toPhone);
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: lang },
        components:
          bodyParams.length > 0
            ? [
                {
                  type: 'body',
                  parameters: bodyParams.map((text) => ({ type: 'text', text })),
                },
              ]
            : undefined,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`whatsapp_meta_template_failed:${res.status}:${err}`);
  }
  return true;
}

async function sendWhatsAppTwilio(toPhone: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_WHATSAPP_FROM ||
    (process.env.WHATSAPP_FROM
      ? `whatsapp:+91${String(process.env.WHATSAPP_FROM).replace(/\D/g, '').slice(-10)}`
      : '');
  if (!sid || !token || !from) return false;

  const to = `whatsapp:${e164(toPhone)}`;
  const body = new URLSearchParams({
    To: to,
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    Body: message,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`twilio_whatsapp_failed:${res.status}:${err}`);
  }
  return true;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  opts?: { html?: string; attachments?: EmailAttachment[] },
): Promise<NotifyChannelResult> {
  console.info('[notifications:email]', { to, subject, text: text.slice(0, 900) });
  try {
    if (await sendEmailViaSmtp(to, subject, text, opts)) {
      return { channel: 'email', ok: true, detail: 'smtp_db' };
    }
    if (await sendEmailViaResend(to, subject, text, opts)) {
      return { channel: 'email', ok: true, detail: 'resend' };
    }
    console.warn(
      '[notifications:email] NOT SENT — set Password in Admin → Email Configuration (or SMTP_PASS in .env)',
    );
    return { channel: 'email', ok: false, detail: 'not_configured' };
  } catch (e: any) {
    console.error('[notifications:email] failed', e?.message || e);
    return { channel: 'email', ok: false, detail: e?.message || 'email_failed' };
  }
}

export async function sendWhatsApp(
  phone: string,
  message: string,
  opts?: { templateName?: string; templateParams?: string[] },
): Promise<NotifyChannelResult> {
  const fromDisplay = process.env.WHATSAPP_FROM || '7703992977';
  console.info('[notifications:whatsapp]', {
    from: fromDisplay,
    to: phone,
    message: message.slice(0, 240),
  });

  try {
    // Prefer approved template when configured (Meta requirement for cold outreach)
    if (opts?.templateName) {
      if (await sendWhatsAppMetaTemplate(phone, opts.templateName, opts.templateParams || [])) {
        return { channel: 'whatsapp', ok: true, detail: 'meta_template' };
      }
    }

    if (await sendWhatsAppMetaText(phone, message)) {
      return { channel: 'whatsapp', ok: true, detail: 'meta_text' };
    }
    if (await sendWhatsAppTwilio(phone, message)) {
      return { channel: 'whatsapp', ok: true, detail: 'twilio' };
    }

    console.warn(
      '[notifications:whatsapp] NOT SENT — set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Meta) or Twilio WhatsApp keys in .env. Sender display number:',
      fromDisplay,
    );
    return { channel: 'whatsapp', ok: false, detail: 'not_configured' };
  } catch (e: any) {
    console.error('[notifications:whatsapp] failed', e?.message || e);
    return { channel: 'whatsapp', ok: false, detail: e?.message || 'whatsapp_failed' };
  }
}

export async function sendCheckoutAcknowledgement(params: {
  name: string;
  email: string;
  phone: string;
  /** When a new account was created — 6-digit login password */
  temporaryPassword?: string;
  accountCreated?: boolean;
}): Promise<{ ok: boolean; emailSent: boolean; whatsappSent: boolean; detail?: string }> {
  const firstName = params.name.trim().split(/\s+/)[0] || 'there';
  const loginUrl =
    process.env.READER_BASE_URL ||
    process.env.NEXT_PUBLIC_READER_URL ||
    'https://reader.vidhyavibe.in';

  // 1) Always send checkout acknowledgement
  const ackText =
    `Hi ${firstName},\n\n` +
    `Thank you for starting your VidhyaVibe subscription. We have received your details and you can continue to secure payment.\n\n` +
    `If you did not request this, please ignore this message or contact support@vidhyavibe.in.\n\n` +
    `— VidhyaVibe`;

  const waText =
    `Hi ${firstName} 👋\n\n` +
    `We received your VidhyaVibe checkout details.\n` +
    (params.temporaryPassword
      ? `Login Email: ${params.email}\nLogin Password: ${params.temporaryPassword}\n`
      : `Please log in using this email: ${params.email}\n`) +
    `Please continue to payment to complete your subscription.\n\n` +
    `— VidhyaVibe`;

  const emailTasks: Promise<NotifyChannelResult>[] = [
    sendEmail(params.email, 'VidhyaVibe — checkout started', ackText),
  ];

  // 2) New account → email login + 6-digit OTP. Existing account → remind to log in with this email (no password reset).
  if (params.temporaryPassword && params.accountCreated) {
    const credentialsText =
      `Hi ${firstName},\n\n` +
      `Your VidhyaVibe account has been created. Use these details to log in:\n\n` +
      `----------------------------------------\n` +
      `Email: ${params.email}\n` +
      `Password: ${params.temporaryPassword}\n` +
      `----------------------------------------\n\n` +
      `Login here: ${loginUrl}/login\n\n` +
      `Important:\n` +
      `- This 6-digit password is your current login password.\n` +
      `- After you change your password (Profile → Change password), this code will stop working.\n` +
      `- If you forget your password, use Forgot password on the login page.\n\n` +
      `— VidhyaVibe`;

    emailTasks.push(
      sendEmail(params.email, 'VidhyaVibe — your login email & password', credentialsText),
    );
    console.info('[notifications:email] account credentials queued', {
      to: params.email,
      accountCreated: true,
      passwordLength: params.temporaryPassword.length,
    });
  } else if (!params.accountCreated) {
    const existingLoginText =
      `Hi ${firstName},\n\n` +
      `We received your VidhyaVibe checkout details. An account already exists for this email.\n\n` +
      `Please log in using this email: ${params.email}\n` +
      `Login here: ${loginUrl}/login\n\n` +
      `Your existing password is unchanged. If you forgot it, use Forgot password on the login page.\n\n` +
      `— VidhyaVibe`;

    emailTasks.push(
      sendEmail(params.email, 'VidhyaVibe — log in with this email', existingLoginText),
    );
    console.info('[notifications:email] existing account login reminder queued', {
      to: params.email,
    });
  }

  const [emailResults, waResult] = await Promise.all([
    Promise.all(emailTasks),
    sendWhatsApp(params.phone, waText, {
      templateName: process.env.WHATSAPP_TEMPLATE_ACK || undefined,
      templateParams: [firstName],
    }),
  ]);

  const emailSent = emailResults.some((r) => r.ok);
  const detail =
    emailResults
      .map((r) => r.detail)
      .filter(Boolean)
      .join(',') || undefined;
  if (!emailSent) {
    console.warn('[notifications:email] checkout acknowledgement not delivered', {
      to: params.email,
      detail,
    });
  }

  return {
    ok: emailSent || waResult.ok,
    emailSent,
    whatsappSent: waResult.ok,
    detail,
  };
}

export async function sendPasswordResetOtp(params: {
  name?: string | null;
  email: string;
  otp: string;
}) {
  const firstName = (params.name || '').trim().split(/\s+/)[0] || 'there';
  const loginUrl =
    process.env.READER_BASE_URL ||
    process.env.NEXT_PUBLIC_READER_URL ||
    'https://reader.vidhyavibe.in';
  const text =
    `Hi ${firstName},\n\n` +
    `You requested a password reset for your VidhyaVibe account.\n\n` +
    `Your OTP code: ${params.otp}\n` +
    `This code expires in 15 minutes.\n\n` +
    `Reset your password here: ${loginUrl}/forgot-password\n\n` +
    `If you did not request this, you can ignore this email.\n\n` +
    `— VidhyaVibe`;
  return sendEmail(params.email, 'VidhyaVibe — password reset OTP', text);
}

export async function sendLoginOtp(params: { name?: string | null; email: string; otp: string }) {
  const firstName = (params.name || '').trim().split(/\s+/)[0] || 'there';
  const text =
    `Hi ${firstName},\n\n` +
    `Use this code to log in to your VidhyaVibe account. Your password is unchanged.\n\n` +
    `Your OTP code: ${params.otp}\n` +
    `This code expires in 15 minutes.\n\n` +
    `If you did not request this, you can ignore this email.\n\n` +
    `— VidhyaVibe`;
  return sendEmail(params.email, 'VidhyaVibe — login OTP', text);
}

export async function sendStudentLoginCredentials(params: {
  email: string;
  name?: string | null;
  password?: string | null;
  accountCreated?: boolean;
  bookName?: string | null;
  collegeName?: string | null;
}) {
  const firstName = (params.name || '').trim().split(/\s+/)[0] || 'there';
  const loginUrl =
    process.env.READER_BASE_URL ||
    process.env.NEXT_PUBLIC_READER_URL ||
    'https://reader.vidhyavibe.in';
  const bookLine = params.bookName ? `Book: ${params.bookName}\n` : '';
  const collegeLine = params.collegeName ? `College: ${params.collegeName}\n` : '';
  if (params.password) {
    const text =
      `Hi ${firstName},\n\n` +
      `Your VidhyaVibe course login is ready.\n` +
      collegeLine +
      bookLine +
      `\n` +
      `----------------------------------------\n` +
      `Email: ${params.email}\n` +
      `Password: ${params.password}\n` +
      `----------------------------------------\n\n` +
      `Log in here: ${loginUrl}/login\n\n` +
      `Please change your password after you sign in (Profile → Change password).\n\n` +
      `— VidhyaVibe`;
    return sendEmail(params.email, 'VidhyaVibe — your course login', text);
  }
  const text =
    `Hi ${firstName},\n\n` +
    `You now have access to your VidhyaVibe course book.\n` +
    collegeLine +
    bookLine +
    `\nLog in with this email and your existing password:\n${params.email}\n\n` +
    `Login: ${loginUrl}/login\n\n` +
    `If you forgot your password, use Forgot password on the login page.\n\n` +
    `— VidhyaVibe`;
  return sendEmail(params.email, 'VidhyaVibe — your course access', text);
}

export async function sendPurchaseConfirmation(params: {
  name: string;
  email: string;
  phone: string;
  orderId: number;
  amount: number;
  currency: string;
  months: number;
  magazineTitle?: string | null;
  /** Razorpay payment id, e.g. pay_TlyBas... */
  paymentId?: string | null;
}) {
  const firstName = params.name.trim().split(/\s+/)[0] || 'there';
  const amountLabel = `${params.currency === 'INR' ? '₹' : ''}${Number(params.amount).toFixed(2)} ${params.currency}`;
  const mag = params.magazineTitle ? ` for ${params.magazineTitle}` : '';
  const loginUrl =
    process.env.READER_BASE_URL ||
    process.env.NEXT_PUBLIC_READER_URL ||
    'https://reader.vidhyavibe.in';
  const emailText =
    `Hi ${firstName},\n\n` +
    `Your VidhyaVibe purchase was successful.\n\n` +
    `Order ID: ${params.orderId}\n` +
    (params.paymentId ? `Payment ID: ${params.paymentId}\n` : '') +
    `Plan duration: ${params.months} month(s)${mag}\n` +
    `Amount paid: ${amountLabel}\n\n` +
    `Log in with your email (${params.email}) to access your magazine:\n` +
    `${loginUrl}/login\n\n` +
    `Thank you for choosing VidhyaVibe!\n` +
    `— Team VidhyaVibe`;
  const waText =
    `VidhyaVibe ✅ Payment successful\n` +
    `Order #${params.orderId}\n` +
    (params.paymentId ? `Payment ID: ${params.paymentId}\n` : '') +
    `${amountLabel} · ${params.months} month(s)${mag}\n` +
    `Thank you for your purchase!`;

  const tasks: Promise<unknown>[] = [];
  if (params.email) {
    tasks.push(sendEmail(params.email, 'VidhyaVibe — purchase confirmation', emailText));
  }
  if (params.phone) {
    tasks.push(
      sendWhatsApp(params.phone, waText, {
        templateName: process.env.WHATSAPP_TEMPLATE_CONFIRM || undefined,
        templateParams: [firstName, String(params.orderId), amountLabel],
      }),
    );
  }
  await Promise.all(tasks);
  return { ok: true };
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function upiQrPng(upi: string): Promise<Buffer | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const QRCode = require('qrcode');
    return await QRCode.toBuffer(upi, { type: 'png', width: 280, margin: 1, errorCorrectionLevel: 'M' });
  } catch (e) {
    console.error('[notifications] QR PNG failed', (e as Error)?.message || e);
    return null;
  }
}

export async function sendInstituteLicensePayment(params: {
  to: string;
  collegeName: string;
  bookName: string;
  courseName: string;
  accessModel: string;
  seatCount: number;
  amount: number;
  payUrl: string;
  upi: string;
  upiVpa: string;
  qrPngUrl?: string;
  purchaseCode: string;
}) {
  const amountLabel = `₹${Number(params.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const model = params.accessModel === 'LIBRARY' ? 'Library (concurrent seats)' : 'Book bank (named students)';
  const hasUpi = Boolean(params.upiVpa && params.upi && !/^merchant@/i.test(params.upiVpa));
  const qrPayload = hasUpi ? params.upi : params.payUrl;
  const qr = qrPayload ? await upiQrPng(qrPayload) : null;
  const qrRemote =
    params.qrPngUrl && params.qrPngUrl.startsWith('https://') ? params.qrPngUrl : '';
  const text =
    `Hello ${params.collegeName},\n\n` +
    `Please pay ${amountLabel} to VidhyaVibe for textbook licenses.\n\n` +
    `Book: ${params.bookName}\n` +
    (params.courseName ? `Course: ${params.courseName}\n` : '') +
    `Access: ${model}\n` +
    `Licenses: ${params.seatCount}\n` +
    `Reference: ${params.purchaseCode}\n\n` +
    `Pay here:\n${params.payUrl}\n\n` +
    (hasUpi ? `VidhyaVibe UPI ID: ${params.upiVpa}\nUPI app: ${params.upi}\n\n` : '') +
    `Scan the attached VidhyaVibe-QR.png to pay.\n\n` +
    `— VidhyaVibe`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:560px;color:#111">` +
    `<p>Hello ${escapeHtml(params.collegeName)},</p>` +
    `<p>Please pay <strong>${escapeHtml(amountLabel)}</strong> to <strong>VidhyaVibe</strong> for textbook licenses.</p>` +
    `<p>` +
    `Book: ${escapeHtml(params.bookName)}<br/>` +
    (params.courseName ? `Course: ${escapeHtml(params.courseName)}<br/>` : '') +
    `Access: ${escapeHtml(model)}<br/>` +
    `Licenses: ${params.seatCount}<br/>` +
    `Reference: ${escapeHtml(params.purchaseCode)}` +
    `</p>` +
    `<p><a href="${escapeHtml(params.payUrl)}" style="display:inline-block;background:#2d7a3e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Pay on VidhyaVibe</a></p>` +
    `<p style="word-break:break-all;font-size:13px">${escapeHtml(params.payUrl)}</p>` +
    (hasUpi ? `<p>VidhyaVibe UPI ID: <strong>${escapeHtml(params.upiVpa)}</strong></p>` : '') +
    `<p>Scan this VidhyaVibe QR:</p>` +
    (qrRemote
      ? `<p><img src="${escapeHtml(qrRemote)}" alt="VidhyaVibe QR" width="220" height="220" style="display:block;border:0" /></p>`
      : '') +
    (qr
      ? `<p><img src="cid:vv-qr" alt="VidhyaVibe QR" width="220" height="220" style="display:block;border:0" /></p>`
      : '') +
    `<p>If the QR is hidden, open the attached <strong>VidhyaVibe-QR.png</strong>.</p>` +
    `<p>— VidhyaVibe</p></div>`;
  const attachments = qr
    ? [
        {
          filename: 'VidhyaVibe-QR.png',
          content: qr,
          cid: 'vv-qr',
          contentType: 'image/png',
          contentDisposition: 'inline' as const,
        },
        {
          filename: 'VidhyaVibe-QR-scan.png',
          content: qr,
          contentType: 'image/png',
          contentDisposition: 'attachment' as const,
        },
      ]
    : undefined;
  return sendEmail(params.to, `VidhyaVibe — pay ${amountLabel} for ${params.bookName}`, text, {
    html,
    attachments,
  });
}
