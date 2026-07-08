'use client';

import { Spin } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { SaleOfferForm, SalesOfferFormShell } from '../../../../../components/SaleOfferForm';
import api from '../../../../../lib/api';

export default function EditSaleOfferPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [offer, setOffer] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    api
      .get(`/admin/sales/${id}`)
      .then((r) => setOffer(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  async function onFinish(values: any) {
    const payload = { ...values };
    if (payload.startsAt?.toISOString) payload.startsAt = payload.startsAt.toISOString();
    if (payload.expiresAt?.toISOString) payload.expiresAt = payload.expiresAt.toISOString();
    await api.put(`/admin/sales/${id}`, payload);
    router.push('/admin/sales');
  }

  if (loading) {
    return (
      <main style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </main>
    );
  }

  return (
    <SalesOfferFormShell title="Edit Sales Offer">
      <SaleOfferForm initialValues={offer} onSubmit={onFinish} submitLabel="Save" />
    </SalesOfferFormShell>
  );
}
