'use client';

import { useParams, useSearchParams } from 'next/navigation';
import NotesWorkspace from '../../../../../../components/NotesWorkspace';

export default function CourseNotesPage() {
  const params = useParams();
  const search = useSearchParams();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));
  const bookKey = slug && number && subjectSlug ? `${slug}:${number}:${subjectSlug}` : '';

  return (
    <main className="onenote-page">
      <NotesWorkspace
        initialBookKey={bookKey}
        initialChapterSlug={String(search.get('chapter') || '')}
      />
    </main>
  );
}
