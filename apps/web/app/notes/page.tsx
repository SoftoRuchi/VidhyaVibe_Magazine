'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import NotesWorkspace from '../../components/NotesWorkspace';
import { useAuth } from '../../lib/authContext';
import { isChildAudience } from '../../lib/viewingContext';

export default function NotesHubPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { loading: authLoading } = useAuth();

  React.useEffect(() => {
    if (authLoading) return;
    if (isChildAudience()) router.replace('/dashboard');
  }, [authLoading, router]);

  if (!authLoading && isChildAudience()) return null;

  return (
    <main className="onenote-page">
      <NotesWorkspace
        initialBookKey={search.get('book') || ''}
        initialChapterSlug={search.get('chapter') || ''}
      />
    </main>
  );
}
