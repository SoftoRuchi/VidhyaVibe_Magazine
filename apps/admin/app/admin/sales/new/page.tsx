'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { SaleOfferForm, SalesOfferFormShell } from '../../../../components/SaleOfferForm';
import api from '../../../../lib/api';

export default function NewSaleOfferPage() {
  const router = useRouter();

  async function onFinish(values: any) {
    const payload = { ...values };
    if (payload.startsAt?.toISOString) payload.startsAt = payload.startsAt.toISOString();
    if (payload.expiresAt?.toISOString) payload.expiresAt = payload.expiresAt.toISOString();
    await api.post('/admin/sales', payload);
    router.push('/admin/sales');
  }

  return (
    <SalesOfferFormShell title="New Sales Offer">
      <SaleOfferForm onSubmit={onFinish} submitLabel="Create" />
    </SalesOfferFormShell>
  );
}
