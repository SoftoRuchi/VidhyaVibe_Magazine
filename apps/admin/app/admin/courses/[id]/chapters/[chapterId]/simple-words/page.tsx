'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Popconfirm, Select, Space, message } from 'antd';
import React from 'react';
import {
  asDoc,
  headingAnchors,
  insertAfterHeading,
  newBlockId,
  sectionTitleFor,
  studyBlocks,
  type TextbookDoc,
} from '../../../../../../../lib/textbookContent';
import { saveAdminChapter, useAdminChapter } from '../../../../../../../lib/useAdminChapter';

export default function SimpleWordsPage() {
  const { chapter, load } = useAdminChapter();
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState<number | null>(null);
  const [text, setText] = React.useState('');
  const [afterHeading, setAfterHeading] = React.useState<number | null>(null);

  if (!chapter) return <p className="vv-hint">Loading…</p>;
  const doc = asDoc(chapter.contentJson, {
    id: String(chapter.id),
    title: chapter.title,
    html: chapter.content || '',
  });
  const items = studyBlocks(doc, 'note');
  const headings = headingAnchors(doc);

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
          Write a short easy explanation. It appears in the book as “In simple words”. You can also
          add these on Write chapter.
        </p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setIndex(null);
            setText('');
            setAfterHeading(headings.length ? headings.length - 1 : null);
            setOpen(true);
          }}
        >
          Add note
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="vv-empty-box">No simple-words notes in this chapter yet.</div>
      ) : (
        items.map((item, i) => (
          <article key={item.block.id} className="vv-study-item">
            <p className="vv-hint" style={{ margin: '0 0 4px' }}>
              After: {sectionTitleFor(doc, item.blockIndex)}
            </p>
            <p>{item.block.text}</p>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setIndex(i);
                  setText(item.block.text || '');
                  setOpen(true);
                }}
              >
                Edit
              </Button>
              <Popconfirm
                title="Delete this note?"
                onConfirm={() => {
                  const next = structuredClone(doc) as TextbookDoc;
                  next.chapter.blocks.splice(item.blockIndex, 1);
                  saveDoc(next, 'Note deleted');
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
      <Modal
        title={index == null ? 'Add simple words' : 'Edit simple words'}
        open={open}
        onOk={() => {
          if (!text.trim()) return;
          const next = structuredClone(doc) as TextbookDoc;
          if (index != null && items[index]) {
            const target = next.chapter.blocks[items[index].blockIndex];
            if (target) target.text = text.trim();
          } else {
            insertAfterHeading(next, afterHeading, {
              id: newBlockId('note'),
              type: 'note',
              text: text.trim(),
            });
          }
          saveDoc(next, index == null ? 'Note added' : 'Note saved');
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
        okButtonProps={{ disabled: !text.trim() }}
        okText={index == null ? 'Add' : 'Save'}
      >
        {index == null && headings.length ? (
          <Select
            style={{ width: '100%', marginBottom: 8 }}
            placeholder="Place after this section"
            value={afterHeading}
            onChange={setAfterHeading}
            options={headings.map((h) => ({ value: h.index, label: `After: ${h.title}` }))}
          />
        ) : null}
        <Input.TextArea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </>
  );
}
