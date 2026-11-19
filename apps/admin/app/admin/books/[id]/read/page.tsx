'use client';

import { useParams, useSearchParams } from 'next/navigation';
import React from 'react';
import AdminBookReader from '../../../../../components/AdminBookReader';

export default function AdminBookReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = Number(params?.id);
  const chapterParam = searchParams.get('chapter');
  const fromParam = searchParams.get('from');

  const initialChapterId = chapterParam ? Number(chapterParam) : undefined;
  const backHref = fromParam || '/admin/books';
  const backLabel = fromParam?.includes('/courses') ? 'Back to Course' : 'Back to Books';

  if (!id || Number.isNaN(id)) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p>Invalid Book ID.</p>
      </div>
    );
  }

  return (
    <AdminBookReader
      subjectId={id}
      initialChapterId={initialChapterId}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
