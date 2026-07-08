'use client';

import { UploadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Switch,
  Upload,
  message,
} from 'antd';
import React from 'react';
import api from '../lib/api';

const TYPE_OPTIONS = [
  { label: 'Post (article / announcement)', value: 'POST' },
  { label: 'Carousel post (multiple images/videos)', value: 'CAROUSEL' },
];

export interface PostMediaItem {
  id: number;
  postId?: number;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaKey: string;
  sortOrder?: number;
}

export function buildFormData(
  values: Record<string, unknown>,
  options?: { image?: File; mediaFiles?: File[] },
) {
  const fd = new FormData();
  Object.entries(values).forEach(([key, val]) => {
    if (val === undefined || val === null) return;
    if (typeof val === 'boolean') fd.append(key, val ? '1' : '0');
    else if (val instanceof Date) fd.append(key, val.toISOString());
    else fd.append(key, String(val));
  });
  if (options?.image) fd.append('image', options.image);
  options?.mediaFiles?.forEach((file) => fd.append('media', file));
  return fd;
}

export function SitePostForm({
  initialValues,
  onSubmit,
  submitLabel,
  existingImageKey,
  existingMedia = [],
  postId,
  onMediaChange,
}: {
  initialValues?: Record<string, unknown>;
  onSubmit: (
    values: Record<string, unknown>,
    files: { image?: File; mediaFiles?: File[] },
  ) => Promise<void>;
  submitLabel: string;
  existingImageKey?: string | null;
  existingMedia?: PostMediaItem[];
  postId?: number;
  onMediaChange?: () => void;
}) {
  const [form] = Form.useForm();
  const postType = Form.useWatch('type', form) ?? initialValues?.type ?? 'POST';
  const [imageFileList, setImageFileList] = React.useState<any[]>([]);
  const [mediaFileList, setMediaFileList] = React.useState<any[]>([]);
  const [mediaItems, setMediaItems] = React.useState<PostMediaItem[]>(existingMedia);

  React.useEffect(() => {
    if (initialValues) form.setFieldsValue(initialValues);
  }, [initialValues, form]);

  React.useEffect(() => {
    setMediaItems(existingMedia);
  }, [existingMedia]);

  async function removeMedia(mediaId: number) {
    if (!postId) return;
    try {
      await api.delete(`/admin/posts/${postId}/media/${mediaId}`);
      setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
      message.success('Media removed');
      onMediaChange?.();
    } catch {
      message.error('Failed to remove media');
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ type: 'POST', sortOrder: 0, active: true, ...initialValues }}
      onFinish={async (values) => {
        const image = imageFileList[0]?.originFileObj as File | undefined;
        const mediaFiles = mediaFileList
          .map((f) => f.originFileObj as File | undefined)
          .filter(Boolean) as File[];
        await onSubmit(values, { image, mediaFiles });
      }}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select options={TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        {postType === 'CAROUSEL' && (
          <>
            <Form.Item name="subtitle" label="Subtitle">
              <Input placeholder="Shown on each carousel slide" />
            </Form.Item>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>
              Upload multiple images and/or videos for one carousel. They rotate together on the
              homepage.
            </p>
          </>
        )}

        {postType === 'POST' && (
          <Form.Item name="body" label="Body">
            <Input.TextArea rows={6} placeholder="Post content" />
          </Form.Item>
        )}

        {postType === 'POST' && (
          <Form.Item label="Cover image (optional)">
            <Upload
              listType="picture"
              maxCount={1}
              accept="image/*"
              beforeUpload={() => false}
              fileList={imageFileList}
              onChange={({ fileList: fl }) => setImageFileList(fl)}
            >
              <Button icon={<UploadOutlined />}>Upload image</Button>
            </Upload>
            {existingImageKey && imageFileList.length === 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#666' }}>
                Current image saved. Upload to replace.
              </p>
            )}
          </Form.Item>
        )}

        {postType === 'CAROUSEL' && (
          <>
            {mediaItems.length > 0 && (
              <Form.Item label="Current media">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mediaItems.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                        background: '#fafafa',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        {m.mediaType === 'VIDEO' ? '🎬 Video' : '🖼 Image'} —{' '}
                        {m.mediaKey.split('/').pop()}
                      </span>
                      {postId && (
                        <Popconfirm title="Remove this file?" onConfirm={() => removeMedia(m.id)}>
                          <Button size="small" danger>
                            Remove
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  ))}
                </div>
              </Form.Item>
            )}
            <Form.Item
              label="Carousel media (images & videos)"
              required={!postId && mediaItems.length === 0}
            >
              <Upload
                listType="picture"
                multiple
                accept="image/*,video/*"
                beforeUpload={() => false}
                fileList={mediaFileList}
                onChange={({ fileList: fl }) => setMediaFileList(fl)}
              >
                <Button icon={<UploadOutlined />}>Add images / videos</Button>
              </Upload>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#888' }}>
                Select multiple files at once. Order follows upload list (use sort order on post for
                carousel position vs other posts).
              </p>
            </Form.Item>
          </>
        )}

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="ctaLabel" label="Button label (optional)">
              <Input placeholder={postType === 'CAROUSEL' ? 'Learn more' : 'Read more'} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="ctaHref" label="Button link (optional)">
              <Input placeholder="/magazines or /sales" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="sortOrder" label="Sort order">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="startsAt" label="Starts at (optional)">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="expiresAt" label="Expires at (optional)">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 16,
          borderTop: '1px solid #f0f0f0',
        }}
      >
        <Button type="primary" htmlType="submit" size="large">
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}

export function PostFormShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main
      style={{
        padding: 16,
        height: 'calc(100vh - 88px)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Card
        title={title}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        styles={{
          body: {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {children}
      </Card>
    </main>
  );
}
