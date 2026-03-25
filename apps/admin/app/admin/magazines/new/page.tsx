'use client';
import { PlusOutlined } from '@ant-design/icons';
import { Card, Form, Input, Button, Upload, message, Row, Col } from 'antd';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import api from '../../../../lib/api';

export default function NewMagazine() {
  const router = useRouter();
  const [fileList, setFileList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    return () => {
      fileList.forEach((file: any) => {
        if (file?.thumbUrl) URL.revokeObjectURL(file.thumbUrl);
      });
    };
  }, [fileList]);

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

      await api.post('/admin/magazines', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      message.success('Magazine created successfully');
      router.push('/admin/magazines');
    } catch (err: any) {
      console.error(err);
      message.error('Failed to create magazine');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    onRemove: (file: any) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
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

  return (
    <main style={{ padding: 24 }}>
      <Card title="New Magazine" style={{ borderRadius: 12 }}>
        <Form layout="vertical" onFinish={onFinish}>
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
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                Create
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </main>
  );
}
