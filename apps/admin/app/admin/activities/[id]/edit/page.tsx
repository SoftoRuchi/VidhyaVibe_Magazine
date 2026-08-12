'use client';

import { Spin, message } from 'antd';
import { useParams } from 'next/navigation';
import React from 'react';
import { ActivityForm } from '../../../../../components/ActivityForm';
import api from '../../../../../lib/api';

export default function EditActivityPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [loading, setLoading] = React.useState(true);
  const [initial, setInitial] = React.useState<any>(null);

  React.useEffect(() => {
    if (!id) return;
    api
      .get(`/admin/activities/${id}`)
      .then((r) => setInitial(r.data))
      .catch(() => message.error('Failed to load activity'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <ActivityForm mode="edit" activityId={id} initial={initial} />
    </main>
  );
}
