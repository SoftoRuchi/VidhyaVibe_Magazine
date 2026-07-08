'use client';

import { Spin } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { PostFormShell, SitePostForm, buildFormData } from '../../../../../components/SitePostForm';
import api from '../../../../../lib/api';
import { apiUpload } from '../../../../../lib/upload';

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [item, setItem] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/admin/posts/${id}`)
      .then((r) => setItem(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(
    values: Record<string, unknown>,
    files: { image?: File; mediaFiles?: File[] },
  ) {
    const payload: Record<string, unknown> = { ...values, imageKey: item?.imageKey ?? '' };
    if (
      payload.startsAt &&
      typeof (payload.startsAt as { toISOString?: () => string }).toISOString === 'function'
    ) {
      payload.startsAt = (payload.startsAt as { toISOString: () => string }).toISOString();
    }
    if (
      payload.expiresAt &&
      typeof (payload.expiresAt as { toISOString?: () => string }).toISOString === 'function'
    ) {
      payload.expiresAt = (payload.expiresAt as { toISOString: () => string }).toISOString();
    }
    await apiUpload('PUT', `/admin/posts/${id}`, buildFormData(payload, files));
    router.push('/admin/posts');
  }

  if (loading) {
    return (
      <main style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </main>
    );
  }

  return (
    <PostFormShell title="Edit Post / Carousel">
      <SitePostForm
        initialValues={item}
        onSubmit={onSubmit}
        submitLabel="Save"
        existingImageKey={item?.imageKey}
        existingMedia={item?.media || []}
        postId={item?.id}
        onMediaChange={load}
      />
    </PostFormShell>
  );
}
