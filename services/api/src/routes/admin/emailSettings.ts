import { Router } from 'express';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';
import {
  getEmailSettings,
  toPublicEmailSettings,
  updateEmailSettings,
} from '../../services/emailSettings';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/admin/email-settings */
router.get('/', async (_req, res) => {
  try {
    const settings = await getEmailSettings();
    res.json(toPublicEmailSettings(settings));
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'email_settings_load_failed', message: e?.message });
  }
});

/** PUT /api/admin/email-settings — update the single sender mailbox config */
router.put('/', async (req, res) => {
  try {
    const {
      emailId,
      smtpPass,
      smtpHost,
      smtpPort,
      smtpTls,
      imapHost,
      imapPort,
      imapSsl,
      fromName,
    } = req.body || {};

    if (emailId && !EMAIL_RE.test(String(emailId).trim())) {
      return res.status(400).json({ error: 'invalid_email_id' });
    }

    const settings = await updateEmailSettings({
      emailId,
      smtpPass,
      smtpHost,
      smtpPort: smtpPort != null ? Number(smtpPort) : undefined,
      smtpTls,
      imapHost,
      imapPort: imapPort != null ? Number(imapPort) : undefined,
      imapSsl,
      fromName,
    });
    res.json(toPublicEmailSettings(settings));
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'email_settings_update_failed', message: e?.message });
  }
});

export default router;
