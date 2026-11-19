import React, { Suspense } from 'react';
import CourseDetailClient from './CourseDetailClient';

export default function AdminCourseDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}>Loading course…</div>}>
      <CourseDetailClient />
    </Suspense>
  );
}
