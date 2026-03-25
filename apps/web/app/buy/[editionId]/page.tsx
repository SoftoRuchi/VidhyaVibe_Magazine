'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Card, Button, message } from 'antd';
import axios from 'axios';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import React, { useEffect, useState } from 'react';
import { isChildAudience } from '../../../lib/viewingContext';

interface EditionInfo {
  id: number;
  magazineId: number;
  volume?: number;
  issueNumber?: number;
  publishedAt?: string;
  magazineTitle?: string;
}

export default function BuyPage() {
  const params = useParams();
  // const editionId = params?.editionId as string;
  const editionId = React.useMemo(() => {
    if (!params?.editionId) return null;
    return Array.isArray(params.editionId) ? params.editionId[0] : params.editionId;
  }, [params]);

  const [edition, setEdition] = useState<EditionInfo | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [childMode, setChildMode] = useState(false);

  useEffect(() => {
    setChildMode(isChildAudience());
  }, []);

  useEffect(() => {
    if (childMode) {
      message.info('Buy is not available in child mode.');
      window.location.href = '/dashboard';
      return;
    }
    if (!editionId) return;
    axios
      .get(`/api/editions/${editionId}/info`)
      .then((r) => setEdition(r.data))
      .catch(() => setEdition({ id: Number(editionId), magazineId: 0 }));
  }, [editionId, childMode]);

  const handleBuy = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      message.error('Please login first');
      window.location.href = `/login?redirect=${encodeURIComponent(`/buy/${editionId}`)}`;
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        '/api/payments/purchase-edition',
        { editionId: Number(editionId) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setOrder(res.data);
      message.success('Order created');
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const uploadProof = (file: File) => {
    if (!order) return;
    const fd = new FormData();
    fd.append('proof', file);
    const token = localStorage.getItem('access_token');
    axios
      .post(`/api/payments/edition-order/${order.orderId}/proof`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
      })
      .then((r) => {
        if (r.data?.proofId) message.success('Proof uploaded. Awaiting verification.');
      })
      .catch((_e) => message.error('Upload failed'));
  };

  return (
    <main style={{ padding: '4rem 0', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: 600 }}>
        <Link
          href={`/magazine/${edition?.magazineId || 1}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: '2rem',
            color: '#666',
          }}
        >
          <ArrowLeftOutlined /> Back
        </Link>

        <Card
          title={
            edition
              ? `Buy: ${edition.magazineTitle || ''} - Vol. ${edition.volume || '?'}`
              : 'Buy Edition'
          }
        >
          {edition && (
            <p style={{ marginBottom: '1.5rem' }}>
              {edition.publishedAt
                ? new Date(edition.publishedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : ''}
            </p>
          )}
          {!order ? (
            <Button type="primary" size="large" onClick={handleBuy} loading={loading} block>
              Buy for ₹1.99
            </Button>
          ) : (
            <div style={{ marginTop: 20 }}>
              <h3>Pay via UPI</h3>
              <p>
                Amount: {Number(order.finalAmount ?? order.finalCents ?? 0).toFixed(2)}{' '}
                {order.currency}
              </p>
              <div style={{ display: 'inline-block', padding: 10, background: '#fff' }}>
                <QRCodeCanvas value={String(order.upi || '')} size={220} includeMargin />
              </div>
              <p style={{ wordBreak: 'break-all' }}>UPI: {order.upi}</p>
              <p>
                <label>
                  Upload payment proof:{' '}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])}
                  />
                </label>
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
