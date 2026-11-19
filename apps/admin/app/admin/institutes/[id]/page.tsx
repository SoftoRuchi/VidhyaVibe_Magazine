import { Suspense } from 'react';
import InstituteDetailClient from './InstituteDetailClient';

export default function AdminInstituteDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}>Loading…</div>}>
      <InstituteDetailClient />
    </Suspense>
  );
}
