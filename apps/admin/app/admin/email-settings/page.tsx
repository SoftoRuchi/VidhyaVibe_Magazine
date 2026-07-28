'use client';

import { MailOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Row, Switch, message } from 'antd';
import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';

type EmailSettingsForm = {
  emailId: string;
  smtpPass: string;
  smtpHost: string;
  smtpPort: number;
  smtpTls: boolean;
  imapHost: string;
  imapPort: number;
  imapSsl: boolean;
  fromName: string;
};

export default function EmailSettingsPage() {
  const [form] = Form.useForm<EmailSettingsForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passSet, setPassSet] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/email-settings')
      .then((r) => {
        const d = r.data || {};
        setPassSet(Boolean(d.smtpPassSet));
        form.setFieldsValue({
          emailId: d.emailId || 'support@vidhyavibe.in',
          smtpPass: '',
          smtpHost: d.smtpHost || 'smtp.hostinger.com',
          smtpPort: d.smtpPort || 587,
          smtpTls: d.smtpTls !== false,
          imapHost: d.imapHost || 'imap.hostinger.com',
          imapPort: d.imapPort || 993,
          imapSsl: d.imapSsl !== false,
          fromName: d.fromName || 'VidhyaVibe',
        });
      })
      .catch((e: any) => {
        message.error(e.response?.data?.message || 'Failed to load email settings');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: Record<string, unknown> = {
        emailId: values.emailId,
        smtpHost: values.smtpHost,
        smtpPort: Number(values.smtpPort),
        smtpTls: values.smtpTls,
        imapHost: values.imapHost,
        imapPort: Number(values.imapPort),
        imapSsl: values.imapSsl,
        fromName: values.fromName,
      };
      if (values.smtpPass && values.smtpPass.trim() && values.smtpPass !== '********') {
        payload.smtpPass = values.smtpPass.trim();
      }
      const { data } = await api.put('/admin/email-settings', payload);
      setPassSet(Boolean(data?.smtpPassSet));
      form.setFieldValue('smtpPass', '');
      message.success('Email configuration saved');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.response?.data?.message || e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <Card
        title={
          <span>
            <MailOutlined style={{ marginRight: 8 }} />
            Email Configuration
          </span>
        }
        loading={loading}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            Save Email Configuration
          </Button>
        }
      >
        <Form form={form} layout="vertical" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="emailId"
                label="Email ID"
                rules={[
                  { required: true, message: 'Email ID is required' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input placeholder="support@vidhyavibe.in" autoComplete="username" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="smtpPass"
                label="Password"
                extra={
                  passSet
                    ? 'Leave blank to keep the current password'
                    : 'Enter the mailbox password'
                }
                rules={passSet ? [] : [{ required: true, message: 'Password is required' }]}
              >
                <Input.Password
                  placeholder={
                    passSet ? '•••••••• (leave blank to keep)' : 'Enter mailbox password'
                  }
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="fromName" label="From name" rules={[{ required: true }]}>
                <Input placeholder="VidhyaVibe" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="smtpHost"
                label="SMTP Server"
                rules={[{ required: true, message: 'SMTP server is required' }]}
              >
                <Input placeholder="smtp.hostinger.com" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="smtpPort"
                label="SMTP Port"
                rules={[{ required: true, message: 'SMTP port is required' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={65535} placeholder="587" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="smtpTls" label="SMTP TLS" valuePropName="checked">
                <Switch checkedChildren="On" unCheckedChildren="Off" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="imapHost"
                label="IMAP Server"
                rules={[{ required: true, message: 'IMAP server is required' }]}
              >
                <Input placeholder="imap.hostinger.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="imapPort"
                label="IMAP Port"
                rules={[{ required: true, message: 'IMAP port is required' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={65535} placeholder="993" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="imapSsl" label="IMAP SSL" valuePropName="checked">
                <Switch checkedChildren="On" unCheckedChildren="Off" />
              </Form.Item>
            </Col>
          </Row>

          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            Save Email Configuration
          </Button>
        </Form>
      </Card>
    </main>
  );
}
