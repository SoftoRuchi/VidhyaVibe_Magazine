import { Router } from 'express';
import multer from 'multer';
import { getPool } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { getStorageAdapter } from '../providers/storage';
import {
  createOrder,
  attachProof,
  createEditionOrder,
  attachEditionProof,
  confirmRazorpayPayment,
} from '../services/payments';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

// create order (user-facing)
router.post('/create-order', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { planId, months, readerId, deliveryMode, addressId, couponCode, magazineId } = req.body;
  try {
    const result = await createOrder({
      userId,
      planId: Number(planId),
      months: Number(months),
      readerId,
      deliveryMode,
      addressId,
      couponCode,
      magazineId,
    });
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'create_order_failed', message: e.message });
  }
});

// confirm Razorpay payment + update order status (user-facing)
router.post('/razorpay/confirm', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    const result = await confirmRazorpayPayment({
      userId,
      orderId: Number(orderId),
      razorpay_payment_id: String(razorpay_payment_id),
      razorpay_order_id: String(razorpay_order_id),
      razorpay_signature: String(razorpay_signature),
    });
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'confirm_failed', message: e.message });
  }
});

// purchase single edition
router.post('/purchase-edition', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { editionId } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!editionId) return res.status(400).json({ error: 'editionId_required' });
  try {
    const result = await createEditionOrder(userId, Number(editionId));
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'purchase_failed', message: e.message });
  }
});

// upload payment proof for edition order
router.post(
  '/edition-order/:orderId/proof',
  upload.single('proof'),
  async (req: AuthRequest, res) => {
    const userId = Number(req.user?.id);
    const orderId = Number(req.params.orderId);
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    try {
      const storage = getStorageAdapter();
      let fileKey: string | undefined = undefined;
      if (req.file) {
        const key = `payments/edition/${orderId}/${Date.now()}-${req.file.originalname}`;
        const up = await storage.upload(key, req.file.buffer, req.file.mimetype);
        fileKey = up.key;
      } else if (req.body?.url) {
        return res.status(400).json({ error: 'file_required' });
      } else {
        return res.status(400).json({ error: 'file_or_url_required' });
      }
      const proofId = await attachEditionProof(orderId, userId, fileKey);
      res.status(201).json({ proofId });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'attach_proof_failed', message: e.message });
    }
  },
);

// upload payment proof (multipart) - for subscription orders
router.post('/:orderId/proof', upload.single('proof'), async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const orderId = Number(req.params.orderId);
  try {
    const storage = getStorageAdapter();
    let fileKey: string | undefined = undefined;
    let url: string | undefined = undefined;
    if (req.file) {
      const key = `payments/${orderId}/${Date.now()}-${req.file.originalname}`;
      const up = await storage.upload(key, req.file.buffer, req.file.mimetype);
      fileKey = up.key;
      url = up.url;
    } else if (req.body.url) {
      url = req.body.url;
    } else {
      return res.status(400).json({ error: 'file_or_url_required' });
    }
    const proofId = await attachProof(orderId, userId, fileKey, url);
    res.status(201).json({ proofId });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'attach_proof_failed', message: e.message });
  }
});

export default router;
