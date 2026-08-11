'use client';

import React from 'react';
import { ActivityForm } from '../../../../components/ActivityForm';

export default function NewActivityPage() {
  return (
    <main style={{ padding: 24 }}>
      <ActivityForm mode="create" />
    </main>
  );
}
