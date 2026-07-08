'use client';

import { message } from 'antd';
import { useRouter } from 'next/navigation';
import React from 'react';
import { PostFormShell, SitePostForm, buildFormData } from '../../../../components/SitePostForm';
import { apiUpload } from '../../../../lib/upload';

export default function NewPostPage() {
  const router = useRouter();

  async function onSubmit(
    values: Record<string, unknown>,
    files: { image?: File; mediaFiles?: File[] },
  ) {
    const payload: Record<string, unknown> = { ...values };
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
    if (values.type === 'CAROUSEL' && (!files.mediaFiles || files.mediaFiles.length === 0)) {
      message.error('Add at least one image or video for the carousel');
      return;
    }
    await apiUpload('POST', '/admin/posts', buildFormData(payload, files));
    router.push('/admin/posts');
  }

  return (
    <PostFormShell title="New Post / Carousel">
      <SitePostForm onSubmit={onSubmit} submitLabel="Create" />
    </PostFormShell>
  );
}
