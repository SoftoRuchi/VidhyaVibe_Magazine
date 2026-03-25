'use client';
import { UploadOutlined, ReadOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Card,
  Button,
  Upload,
  message,
  Form,
  Divider,
  Table,
  Tag,
  Collapse,
  Row,
  Col,
  InputNumber,
  DatePicker,
  Switch,
  Input,
  Modal,
} from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useState } from 'react';
import api from '../../../../lib/api';

const READER_BASE_URL = process.env.NEXT_PUBLIC_READER_URL || 'http://localhost:3000';

function MagazinePricingTable({
  planPrices,
  onSave,
  loading,
}: {
  planPrices: any[];
  onSave: (u: any[]) => Promise<void>;
  loading: boolean;
}) {
  const [edits, setEdits] = React.useState<Record<string, number>>({});
  const key = (planId: number, mode: string) => `${planId}:${mode}`;
  const priceFor = (p: any, mode: 'ELECTRONIC' | 'PHYSICAL' | 'BOTH') => {
    const k = key(p.planId, mode);
    if (edits[k] !== undefined) return edits[k];
    return p.prices?.[mode]?.price ?? p.defaultPrice ?? 0;
  };
  const setPrice = (planId: number, mode: string, v: number) => {
    setEdits((prev) => ({ ...prev, [key(planId, mode)]: v }));
  };
  const hasChanges = Object.keys(edits).length > 0;
  const handleSave = () => {
    const updates: {
      planId: number;
      deliveryMode: string;
      price: number;
      currency: string;
    }[] = [];
    for (const p of planPrices) {
      for (const mode of ['ELECTRONIC', 'PHYSICAL', 'BOTH'] as const) {
        const k = key(p.planId, mode);
        if (edits[k] !== undefined) {
          updates.push({
            planId: p.planId,
            deliveryMode: mode,
            price: edits[k],
            currency: p.prices?.[mode]?.currency || p.currency || 'INR',
          });
        }
      }
    }
    onSave(updates).then(() => setEdits({}));
  };
  return (
    <div>
      <Table
        dataSource={planPrices}
        rowKey="planId"
        size="small"
        pagination={false}
        columns={[
          { title: 'Plan', dataIndex: 'name', width: 140 },
          {
            title: 'Default (fallback)',
            key: 'default',
            width: 100,
            render: (_: any, r: any) =>
              r.defaultCurrency === 'INR'
                ? `₹${Number(r.defaultPrice || 0).toFixed(2)}`
                : `${Number(r.defaultPrice || 0).toFixed(2)} ${r.defaultCurrency}`,
          },
          {
            title: 'E-Magazine',
            key: 'electronic',
            width: 120,
            render: (_: any, r: any) => (
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                addonBefore={r.currency === 'INR' ? '₹' : undefined}
                value={priceFor(r, 'ELECTRONIC')}
                onChange={(v) => setPrice(r.planId, 'ELECTRONIC', v ?? 0)}
                style={{ width: 110 }}
              />
            ),
          },
          {
            title: 'Physical',
            key: 'physical',
            width: 120,
            render: (_: any, r: any) => (
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                addonBefore={r.currency === 'INR' ? '₹' : undefined}
                value={priceFor(r, 'PHYSICAL')}
                onChange={(v) => setPrice(r.planId, 'PHYSICAL', v ?? 0)}
                style={{ width: 110 }}
              />
            ),
          },
          {
            title: 'Both',
            key: 'both',
            width: 120,
            render: (_: any, r: any) => (
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                addonBefore={r.currency === 'INR' ? '₹' : undefined}
                value={priceFor(r, 'BOTH')}
                onChange={(v) => setPrice(r.planId, 'BOTH', v ?? 0)}
                style={{ width: 110 }}
              />
            ),
          },
        ]}
      />
      <p style={{ color: '#666', marginTop: 8, fontSize: 12 }}>
        Set different prices for E-magazine only, Physical only, or Both. Users choose their
        preferred option at checkout.
      </p>
      {hasChanges && (
        <Button type="primary" onClick={handleSave} loading={loading} style={{ marginTop: 12 }}>
          Save Pricing
        </Button>
      )}
    </div>
  );
}

export default function MagazineDetail({ params }: any) {
  const id = params.id;
  const [mag, setMag] = useState<any>(null);
  const [editions, setEditions] = useState<any[]>([]);
  const [planPrices, setPlanPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [editionModalOpen, setEditionModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = () => {
    api.get(`/admin/magazines/${id}`).then((r) => setMag(r.data));
    api
      .get(`/admin/magazines/${id}/editions`)
      .then((r) => setEditions(r.data || []))
      .catch(() => setEditions([]));
    api
      .get(`/admin/magazines/${id}/plans`)
      .then((r) => setPlanPrices(r.data || []))
      .catch(() => setPlanPrices([]));
  };

  React.useEffect(() => {
    loadData();
  }, [id]);

  const handleSavePricing = async (
    updates: { planId: number; deliveryMode: string; price: number; currency: string }[],
  ) => {
    setPricingLoading(true);
    try {
      await api.put(`/admin/magazines/${id}/plans`, { planPrices: updates });
      message.success('Pricing updated');
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Failed to update pricing');
    } finally {
      setPricingLoading(false);
    }
  };

  const onFinishEdition = async (values: any) => {
    if (!values.editionPdf?.[0]?.originFileObj) {
      message.error('Please upload the edition PDF');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('editionPdf', values.editionPdf[0].originFileObj);
      if (values.samplePdf?.[0]?.originFileObj)
        fd.append('samplePdf', values.samplePdf[0].originFileObj);
      if (values.cover?.[0]?.originFileObj) fd.append('cover', values.cover[0].originFileObj);
      if (values.volume != null) fd.append('volume', String(values.volume));
      if (values.issueNumber != null) fd.append('issueNumber', String(values.issueNumber));
      if (values.description) fd.append('description', values.description);
      if (values.pages != null) fd.append('pages', String(values.pages));
      if (values.sku) fd.append('sku', values.sku);
      fd.append('publishNow', values.publishNow ? 'true' : 'false');
      if (values.publishedAt && !values.publishNow) {
        fd.append('publishedAt', (values.publishedAt as Dayjs).format('YYYY-MM-DD'));
      }

      await api.post(`/admin/magazines/${id}/editions`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.loaded / (evt.total || 1)) * 100);
          message.loading({ content: `Uploading... ${pct}%`, key: 'upload' });
        },
      });
      message.success({ content: 'Edition created successfully', key: 'upload' });
      form.resetFields();
      loadData();
    } catch (err: any) {
      console.error(err);
      message.error({ content: err.response?.data?.error || 'Upload failed', key: 'upload' });
    } finally {
      setLoading(false);
    }
  };

  const normFile = (e: any) => (Array.isArray(e) ? e : e?.fileList);

  const editionFormContent = (
    <Form form={form} layout="vertical" onFinish={onFinishEdition} style={{ maxWidth: 900 }}>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="volume" label="Volume">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 1" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="issueNumber" label="Issue Number">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 3" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="pages" label="Number of Pages">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 32" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="sku" label="SKU (optional)">
            <Input placeholder="Auto-generated if left blank" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={3}
              placeholder="What's in this edition? Highlights, themes, special features..."
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="cover"
            label="Cover Image"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              listType="picture-card"
              accept="image/*"
            >
              <div>
                <UploadOutlined />
              </div>
            </Upload>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="editionPdf"
            label="Magazine PDF (required)"
            valuePropName="fileList"
            getValueFromEvent={normFile}
            rules={[{ required: true, message: 'Please upload the edition PDF' }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
              <Button icon={<UploadOutlined />}>Select PDF</Button>
            </Upload>
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="samplePdf"
            label="Sample PDF (optional)"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
              <Button icon={<UploadOutlined />}>Select Sample</Button>
            </Upload>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="publishNow" label="Publish immediately" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.publishNow !== curr.publishNow}>
            {({ getFieldValue }) =>
              !getFieldValue('publishNow') && (
                <Form.Item name="publishedAt" label="Publish Date (when not publishing now)">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  return (
    <main>
      <Card
        title={mag?.title || 'Magazine'}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditionModalOpen(true)}>
            Add New Edition
          </Button>
        }
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div />
        </div>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div>
            {mag?.coverKey && (
              <img
                src={`/api/assets/serve?key=${encodeURIComponent(mag.coverKey)}`}
                alt="Cover"
                style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 8 }}
              />
            )}
          </div>
          <div>
            <p>
              <strong>Slug:</strong> {mag?.slug}
            </p>
            <p>
              <strong>Publisher:</strong> {mag?.publisher}
            </p>
            {mag?.description && (
              <p>
                <strong>Description:</strong> {mag.description}
              </p>
            )}
            {mag?.category && (
              <p>
                <strong>Category:</strong> {mag.category}
              </p>
            )}
          </div>
        </div>
        <Divider />
        <Collapse
          items={[
            {
              key: 'editions',
              label: (
                <span>
                  <strong>Editions</strong>{' '}
                  <span style={{ color: '#666' }}>({editions.length})</span>
                </span>
              ),
              children:
                editions.length > 0 ? (
                  <Table
                    dataSource={editions}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: 'S/N',
                        key: 'serial',
                        width: 60,
                        render: (_: any, __: any, i: number) => i + 1,
                      },
                      {
                        title: 'Cover',
                        key: 'cover',
                        width: 60,
                        render: (_: any, ed: any) =>
                          ed.coverUrl ? (
                            <img
                              src={ed.coverUrl}
                              alt=""
                              style={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 4 }}
                            />
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          ),
                      },
                      { title: 'Vol', dataIndex: 'volume', width: 60 },
                      { title: 'Issue', dataIndex: 'issueNumber', width: 60 },
                      { title: 'SKU', dataIndex: 'sku', ellipsis: true },
                      { title: 'Pages', dataIndex: 'pages', width: 70 },
                      {
                        title: 'Description',
                        dataIndex: 'description',
                        ellipsis: true,
                        render: (d: string) =>
                          d ? (d.length > 40 ? d.slice(0, 40) + '…' : d) : '-',
                      },
                      {
                        title: 'Published',
                        dataIndex: 'publishedAt',
                        width: 100,
                        render: (d: any) => (d ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
                      },
                      {
                        title: 'Files',
                        key: 'files',
                        render: (_: any, ed: any) => (
                          <span style={{ display: 'flex', gap: 8 }}>
                            {ed.fileUrl && (
                              <a href={ed.fileUrl} target="_blank" rel="noopener noreferrer">
                                <FilePdfOutlined /> PDF
                              </a>
                            )}
                            {ed.sampleUrl && (
                              <a href={ed.sampleUrl} target="_blank" rel="noopener noreferrer">
                                Sample
                              </a>
                            )}
                          </span>
                        ),
                      },
                      {
                        title: 'Actions',
                        key: 'actions',
                        width: 100,
                        render: (_: any, ed: any) => {
                          const handleRead = () => {
                            const token =
                              typeof window !== 'undefined'
                                ? localStorage.getItem('access_token')
                                : null;
                            const url = token
                              ? `${READER_BASE_URL}/reader/${ed.id}?token=${encodeURIComponent(token)}`
                              : `${READER_BASE_URL}/reader/${ed.id}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                          };
                          return (
                            <Button
                              type="link"
                              size="small"
                              icon={<ReadOutlined />}
                              onClick={handleRead}
                            >
                              Read
                            </Button>
                          );
                        },
                      },
                    ]}
                  />
                ) : (
                  <p style={{ color: '#888', margin: 0 }}>
                    No editions yet. Add one using the form below.
                  </p>
                ),
            },
          ]}
          defaultActiveKey={['editions']}
          style={{ marginTop: 8 }}
        />
        <Divider />
        <h3>Pricing</h3>
        <p style={{ color: '#666', marginBottom: 16 }}>
          Set subscription plan prices for this magazine. Users will see these when subscribing.
        </p>
        {planPrices.length > 0 ? (
          <MagazinePricingTable
            planPrices={planPrices}
            onSave={handleSavePricing}
            loading={pricingLoading}
          />
        ) : (
          <p style={{ color: '#888' }}>No plans available. Create plans in Admin → Plans first.</p>
        )}
        <Modal
          title="Add New Edition"
          open={editionModalOpen}
          onCancel={() => setEditionModalOpen(false)}
          width={980}
          destroyOnClose={false}
          footer={[
            <Button key="cancel" onClick={() => setEditionModalOpen(false)}>
              Cancel
            </Button>,
            <Button
              key="create"
              type="primary"
              loading={loading}
              onClick={() => form.submit()}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              Create Edition
            </Button>,
          ]}
        >
          {editionFormContent}
        </Modal>
      </Card>
    </main>
  );
}
