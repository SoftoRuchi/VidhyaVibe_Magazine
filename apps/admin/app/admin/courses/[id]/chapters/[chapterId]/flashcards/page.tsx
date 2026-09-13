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

export default function FlashcardsPage() {
  const { chapter, load } = useAdminChapter();
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState<number | null>(null);
  const [front, setFront] = React.useState('');
  const [back, setBack] = React.useState('');
  const [afterHeading, setAfterHeading] = React.useState<number | null>(null);

  if (!chapter) return <p className="vv-hint">Loading…</p>;
  const doc = asDoc(chapter.contentJson, {
    id: String(chapter.id),
    title: chapter.title,
    html: chapter.content || '',
  });
  const items = studyBlocks(doc, 'flashcard');
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
          Front is the word, back is the meaning. Students tap the card to flip it. You can also add
          these on Write chapter.
        </p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setIndex(null);
            setFront('');
            setBack('');
            setAfterHeading(headings.length ? headings.length - 1 : null);
            setOpen(true);
          }}
        >
          Add flashcard
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="vv-empty-box">
          No flashcards in this chapter yet. Add a card and choose the section it follows.
        </div>
      ) : (
        items.map((item, i) => (
          <article key={item.block.id} className="vv-study-item">
            <p className="vv-hint" style={{ margin: '0 0 4px' }}>
              After: {sectionTitleFor(doc, item.blockIndex)}
            </p>
            <p>
              <strong>{item.block.front}</strong>
              <span> — {item.block.back}</span>
            </p>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setIndex(i);
                  setFront(item.block.front || '');
                  setBack(item.block.back || '');
                  setOpen(true);
                }}
              >
                Edit
              </Button>
              <Popconfirm
                title="Delete this flashcard?"
                onConfirm={() => {
                  const next = structuredClone(doc) as TextbookDoc;
                  next.chapter.blocks.splice(item.blockIndex, 1);
                  saveDoc(next, 'Flashcard deleted');
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
        title={index == null ? 'Add flashcard' : 'Edit flashcard'}
        open={open}
        onOk={() => {
          if (!front.trim() || !back.trim()) return;
          const next = structuredClone(doc) as TextbookDoc;
          if (index != null && items[index]) {
            const target = next.chapter.blocks[items[index].blockIndex];
            if (target) {
              target.front = front.trim();
              target.back = back.trim();
            }
          } else {
            insertAfterHeading(next, afterHeading, {
              id: newBlockId('flashcard'),
              type: 'flashcard',
              front: front.trim(),
              back: back.trim(),
            });
          }
          saveDoc(next, index == null ? 'Flashcard added' : 'Flashcard saved');
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
        okButtonProps={{ disabled: !front.trim() || !back.trim() }}
        okText={index == null ? 'Add' : 'Save'}
      >
        {index == null ? (
          <Select
            style={{ width: '100%', marginBottom: 8 }}
            placeholder="Place after this section"
            value={afterHeading}
            onChange={setAfterHeading}
            options={
              headings.length
                ? headings.map((h) => ({ value: h.index, label: `After: ${h.title}` }))
                : [{ value: -1, label: 'End of chapter' }]
            }
          />
        ) : (
          <p className="vv-hint">Editing keeps the card in the same place in the chapter.</p>
        )}
        <Input
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Term"
          style={{ marginBottom: 8 }}
        />
        <Input.TextArea
          rows={4}
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Meaning"
        />
      </Modal>
    </>
  );
}
