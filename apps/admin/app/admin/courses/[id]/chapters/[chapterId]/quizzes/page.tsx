'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, message } from 'antd';
import React from 'react';
import api from '../../../../../../../lib/api';
import {
  asDoc,
  headingAnchors,
  insertAfterHeading,
  newBlockId,
  sectionTitleFor,
  type TextbookBlock,
  type TextbookDoc,
} from '../../../../../../../lib/textbookContent';
import { saveAdminChapter, useAdminChapter } from '../../../../../../../lib/useAdminChapter';

type QuizLink = {
  id: number;
  title: string;
  activityType: string;
  placement: string;
  pageNumber?: number | null;
};
type ActivityOpt = { id: number; title: string; activityType: string };

export default function QuizzesPage() {
  const { chapter, load } = useAdminChapter();
  const [quizzes, setQuizzes] = React.useState<QuizLink[]>([]);
  const [activities, setActivities] = React.useState<ActivityOpt[]>([]);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [blockIndex, setBlockIndex] = React.useState<number | null>(null);
  const [attachForm] = Form.useForm();
  const [blockForm] = Form.useForm();

  const loadQuizzes = React.useCallback(() => {
    if (!chapter?.id) return;
    api
      .get(`/admin/courses/chapters/${chapter.id}/activities`)
      .then((r) => setQuizzes(r.data || []))
      .catch(() => setQuizzes([]));
  }, [chapter?.id]);

  React.useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  React.useEffect(() => {
    api
      .get('/admin/activities', { params: { status: 'PUBLISHED' } })
      .then((r) => setActivities(r.data?.items || []))
      .catch(() => setActivities([]));
  }, []);

  if (!chapter) return <p className="vv-hint">Loading…</p>;
  const doc = asDoc(chapter.contentJson, {
    id: String(chapter.id),
    title: chapter.title,
    html: chapter.content || '',
  });
  const inline = doc.chapter.blocks
    .map((block, blockIndex) => ({ block, blockIndex }))
    .filter((item) => item.block.type === 'quick_check' || item.block.type === 'mcq');
  const headings = headingAnchors(doc);
  const practice = quizzes.filter((item) => item.placement !== 'INLINE');

  const saveDoc = (next: TextbookDoc, ok: string) => {
    saveAdminChapter(chapter, { title: chapter.title, contentJson: next })
      .then(() => {
        message.success(ok);
        load();
      })
      .catch((e) => message.error(e.response?.data?.error || 'Save failed'));
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <p className="vv-hint" style={{ margin: 0 }}>
          Quick check and Quiz are one question in the book. Practice is a full quiz at the end. You
          can also add in-page questions on Write chapter.
        </p>
        <Space>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setBlockIndex(null);
              blockForm.setFieldsValue({
                type: 'quick_check',
                afterHeading: headings.length ? headings.length - 1 : -1,
                question: '',
                option0: '',
                option1: '',
                option2: '',
                option3: '',
                answer: 0,
                explanation: '',
              });
              setBlockOpen(true);
            }}
          >
            Add quick check
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAttachOpen(true)}>
            Attach practice quiz
          </Button>
        </Space>
      </div>

      <h3>In the chapter</h3>
      {inline.length === 0 ? (
        <div className="vv-empty-box">No quick check or MCQ in this chapter yet.</div>
      ) : (
        inline.map((item, i) => (
          <article key={item.block.id} className="vv-study-item">
            <p className="vv-hint" style={{ margin: '0 0 4px' }}>
              {item.block.type === 'mcq' ? 'MCQ' : 'Quick check'} · After:{' '}
              {sectionTitleFor(doc, item.blockIndex)}
            </p>
            <p>
              <strong>{item.block.question}</strong>
            </p>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setBlockIndex(i);
                  const opts = item.block.options || [];
                  blockForm.setFieldsValue({
                    type: item.block.type,
                    question: item.block.question,
                    option0: opts[0] || '',
                    option1: opts[1] || '',
                    option2: opts[2] || '',
                    option3: opts[3] || '',
                    answer: item.block.answer ?? 0,
                    explanation: item.block.explanation || '',
                  });
                  setBlockOpen(true);
                }}
              >
                Edit
              </Button>
              <Popconfirm
                title="Delete this question?"
                onConfirm={() => {
                  const next = structuredClone(doc) as TextbookDoc;
                  next.chapter.blocks.splice(item.blockIndex, 1);
                  saveDoc(next, 'Question deleted');
                }}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            </Space>
          </article>
        ))
      )}

      <h3 style={{ marginTop: 24 }}>Practice quiz</h3>
      {practice.length === 0 ? (
        <div className="vv-empty-box">No practice quiz attached yet.</div>
      ) : (
        practice.map((item) => (
          <article key={item.id} className="vv-study-item">
            <p>
              <strong>{item.title}</strong>
              <span>{item.pageNumber ? ` · page ${item.pageNumber}` : ''}</span>
            </p>
            <Popconfirm
              title="Detach this quiz from the chapter?"
              onConfirm={() =>
                api.delete(`/admin/courses/chapter-activities/${item.id}`).then(() => {
                  message.success('Quiz removed');
                  loadQuizzes();
                })
              }
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          </article>
        ))
      )}

      <Modal
        title={blockIndex == null ? 'Add in-chapter question' : 'Edit question'}
        open={blockOpen}
        onOk={() => {
          blockForm.validateFields().then((values) => {
            const options = [values.option0, values.option1, values.option2, values.option3]
              .map((item: string) => String(item || '').trim())
              .filter(Boolean);
            if (options.length < 2) {
              message.error('Add at least two options');
              return;
            }
            const payload: TextbookBlock = {
              id: newBlockId(values.type),
              type: values.type,
              question: String(values.question || '').trim(),
              options,
              answer: Number(values.answer) || 0,
              explanation: String(values.explanation || '').trim() || undefined,
            };
            const next = structuredClone(doc) as TextbookDoc;
            if (blockIndex != null && inline[blockIndex]) {
              payload.id = inline[blockIndex].block.id;
              next.chapter.blocks[inline[blockIndex].blockIndex] = payload;
            } else {
              insertAfterHeading(next, values.afterHeading, payload);
            }
            saveDoc(next, blockIndex == null ? 'Question added' : 'Question saved');
            setBlockOpen(false);
          });
        }}
        onCancel={() => setBlockOpen(false)}
        okText={blockIndex == null ? 'Add' : 'Save'}
      >
        <Form form={blockForm} layout="vertical">
          <Form.Item name="type" label="Type">
            <Select
              options={[
                { value: 'quick_check', label: 'Quick check' },
                { value: 'mcq', label: 'MCQ / quiz' },
              ]}
            />
          </Form.Item>
          {blockIndex == null ? (
            <Form.Item name="afterHeading" label="Place after section">
              <Select
                options={
                  headings.length
                    ? headings.map((h) => ({ value: h.index, label: h.title }))
                    : [{ value: -1, label: 'End of chapter' }]
                }
              />
            </Form.Item>
          ) : null}
          <Form.Item name="question" label="Question" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="option0" label="Option A" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="option1" label="Option B" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="option2" label="Option C">
            <Input />
          </Form.Item>
          <Form.Item name="option3" label="Option D">
            <Input />
          </Form.Item>
          <Form.Item name="answer" label="Correct option">
            <Select
              options={[
                { value: 0, label: 'A' },
                { value: 1, label: 'B' },
                { value: 2, label: 'C' },
                { value: 3, label: 'D' },
              ]}
            />
          </Form.Item>
          <Form.Item name="explanation" label="Explanation">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Attach practice quiz"
        open={attachOpen}
        onOk={() => {
          attachForm.validateFields().then((values) => {
            api
              .post(`/admin/courses/chapters/${chapter.id}/activities`, {
                ...values,
                placement: 'PRACTICE',
              })
              .then(() => {
                message.success('Quiz attached');
                setAttachOpen(false);
                attachForm.resetFields();
                loadQuizzes();
              })
              .catch((e) => message.error(e.response?.data?.error || 'Attach failed'));
          });
        }}
        onCancel={() => setAttachOpen(false)}
        okText="Attach"
      >
        <Form form={attachForm} layout="vertical">
          <Form.Item name="activityId" label="Quiz" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={activities.map((a) => ({
                value: a.id,
                label: `${a.title} (${a.activityType})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="pageNumber" label="Show on printed page (optional)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
