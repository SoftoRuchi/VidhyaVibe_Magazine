'use client';

import React from 'react';
import ChapterBlockEditor from '../../../../../../components/ChapterBlockEditor';
import { useAdminChapter } from '../../../../../../lib/useAdminChapter';

export default function ChapterTextPage() {
  const { chapter, load } = useAdminChapter();
  if (!chapter) return <p className="vv-hint">Loading…</p>;
  return <ChapterBlockEditor chapter={chapter} onSaved={load} />;
}
