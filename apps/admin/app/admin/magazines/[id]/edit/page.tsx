'use client';
import { PlusOutlined } from '@ant-design/icons';
import { Card, Form, Input, Button, Upload, message, Skeleton, Row, Col } from 'antd';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import api from '../../../../../lib/api';

export default function EditMagazine({ params }: any) {
  const id = params.id;
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fileList, setFileList] = useState<any[]>([]);
  const [magazine, setMagazine] = useState<any>(null);

  React.useEffect(() => {
    return () => {
      fileList.forEach((file: any) => {
        if (file?.thumbUrl) URL.revokeObjectURL(file.thumbUrl);
      });
    };
  }, [fileList]);

  useEffect(() => {
    api
      .get(`/admin/magazines/${id}`)
      .then((r) => {
        const data = r.data;
        setMagazine(data);
        form.setFieldsValue({
          title: data.title,
          slug: data.slug,
          publisher: data.publisher,
          description: data.description,
          category: data.category,
        });
        setFetching(false);
      })
      .catch((err) => {
        console.error(err);
        message.error('Failed to load magazine data');
        setFetching(false);
      });
  }, [id, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('slug', values.slug);
      if (values.publisher) formData.append('publisher', values.publisher);
      if (values.description) formData.append('description', values.description);
      if (values.category) formData.append('category', values.category);

      if (fileList.length > 0) {
        formData.append('cover', fileList[0].originFileObj);
      }

      await api.put(`/admin/magazines/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      message.success('Magazine updated successfully');
      router.push('/admin/magazines');
    } catch (err: any) {
      console.error(err);
      message.error('Failed to update magazine');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    onRemove: (_file: any) => {
      setFileList([]);
    },
    beforeUpload: (file: any) => {
      setFileList([
        {
          uid: file.uid,
          name: file.name,
          status: 'done',
          originFileObj: file,
          thumbUrl: URL.createObjectURL(file),
        },
      ]);
      return false;
    },
    fileList,
  };

  if (fetching) return <Skeleton active />;

  return (
    <main style={{ padding: 24 }}>
      <Card title="Edit Magazine">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="title" label="Title" rules={[{ required: true }]}>
                <Input placeholder="e.g. Science Weekly" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
                <Input placeholder="e.g. science-weekly" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="publisher" label="Publisher">
                <Input placeholder="e.g. VidhyaVibe Media" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="category" label="Category">
                <Input placeholder="e.g. Education / Technology" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={4} placeholder="Short summary about this magazine..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Cover Image">
                <Row gutter={16} align="middle">
                  <Col>
                    {magazine?.coverKey && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ color: '#666', fontSize: 12 }}>Current cover:</span>
                        <img
                          src={`/api/assets/serve?key=${encodeURIComponent(magazine.coverKey)}`}
                          alt="Current cover"
                          style={{
                            width: 92,
                            height: 120,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid #eee',
                          }}
                        />
                      </div>
                    )}
                  </Col>

                  <Col>
                    <Upload
                      {...uploadProps}
                      listType="picture-card"
                      accept="image/*"
                      maxCount={1}
                      showUploadList={{ showPreviewIcon: false }}
                    >
                      {fileList.length >= 1 ? null : (
                        <div>
                          <PlusOutlined />
                          <div style={{ marginTop: 8 }}>Select Cover</div>
                        </div>
                      )}
                    </Upload>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button onClick={() => router.back()}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                Save Changes
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </main>
  );
}
