'use client';

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Input, Modal, Popconfirm, Radio, Select, Space, message } from 'antd';
import React from 'react';
import {
  CHAPTER_PASTE_EXAMPLE,
  describeDetected,
  parseChapterPaste,
  retargetBlock,
} from '../lib/parseChapterPaste';
import {
  TEXTBOOK_SCHEMA_VERSION,
  asDoc,
  newBlockId,
  type TextbookBlock,
  type TextbookBlockType,
  type TextbookDoc,
} from '../lib/textbookContent';
import { apiUpload } from '../lib/upload';
import { saveAdminChapter, type AdminChapter } from '../lib/useAdminChapter';

const ADD_ITEMS: { type: TextbookBlockType; label: string }[] = [
  { type: 'heading', label: 'Section title' },
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'list', label: 'List' },
  { type: 'image', label: 'Picture' },
  { type: 'note', label: 'Simple words' },
  { type: 'flashcard', label: 'Flashcard' },
  { type: 'quick_check', label: 'Quick check' },
  { type: 'mcq', label: 'Quiz' },
  { type: 'summary', label: 'Summary' },
];

function makeBlock(type: TextbookBlockType): TextbookBlock {
  const id = newBlockId(type);
  if (type === 'heading') return { id, type, level: 2, text: '' };
  if (type === 'list') return { id, type, items: [''] };
  if (type === 'flashcard') return { id, type, front: '', back: '' };
  if (type === 'quick_check' || type === 'mcq') {
    return { id, type, question: '', options: ['', '', '', ''], answer: 0, explanation: '' };
  }
  if (type === 'image') return { id, type, src: '', caption: '', alt_text: '' };
  return { id, type, text: '' };
}

function optionsOf(block: TextbookBlock) {
  const options = [...(block.options || [])];
  while (options.length < 4) options.push('');
  return options.slice(0, 4);
}

export default function ChapterBlockEditor({
  chapter,
  onSaved,
}: {
  chapter: AdminChapter;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(chapter.title);
  const [blocks, setBlocks] = React.useState<TextbookBlock[]>([]);
  const [paste, setPaste] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const doc = asDoc(chapter.contentJson, {
      id: String(chapter.id),
      title: chapter.title,
      html: chapter.content || '',
    });
    setTitle(chapter.title);
    setBlocks(
      doc.chapter.blocks.map((block) => ({
        ...block,
        options: block.options ? [...block.options] : block.options,
      })),
    );
    setDirty(false);
  }, [chapter.id, chapter.title, chapter.content, chapter.contentJson]);

  const mark = (next: TextbookBlock[]) => {
    setBlocks(next);
    setDirty(true);
  };

  const patch = (index: number, partial: Partial<TextbookBlock>) => {
    mark(blocks.map((block, i) => (i === index ? { ...block, ...partial } : block)));
  };

  const addBlock = (type: TextbookBlockType, after?: number) => {
    const block = makeBlock(type);
    const next = [...blocks];
    if (after == null || after < 0 || after >= next.length) next.push(block);
    else next.splice(after + 1, 0, block);
    mark(next);
  };

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    mark(next);
  };

  const applyPaste = () => {
    const found = parseChapterPaste(paste);
    if (!found.length) {
      message.warning(
        'Nothing was detected. Start each piece with Section title:, Paragraph:, Simple words:, Flashcard:, and so on.',
      );
      return;
    }
    const apply = () => {
      mark(found);
      message.success(
        `Detected ${describeDetected(found)}. Check the type on each box if one is wrong, then save.`,
      );
    };
    if (blocks.length) {
      Modal.confirm({
        title: 'Replace this chapter with the pasted content?',
        content: `This will load ${found.length} detected pieces.`,
        okText: 'Replace',
        onOk: apply,
      });
    } else apply();
  };

  const pickPicture = (index: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const fd = new FormData();
        fd.append('image', file);
        const r = await apiUpload<{ url: string }>('POST', '/admin/courses/images', fd);
        const caption =
          file.name
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .trim() || 'Figure';
        patch(index, {
          src: r.url,
          caption: blocks[index].caption || caption,
          alt_text: blocks[index].alt_text || caption,
        });
        message.success('Picture added');
      } catch (e: any) {
        message.error(e?.response?.data?.message || e?.message || 'Upload failed');
      }
    };
    input.click();
  };

  const save = () => {
    const cleaned = blocks.map((block) => {
      if (block.type === 'list') {
        return { ...block, items: (block.items || []).map((item) => item.trim()).filter(Boolean) };
      }
      if (block.type === 'quick_check' || block.type === 'mcq') {
        const options = (block.options || []).map((item) => item.trim()).filter(Boolean);
        return {
          ...block,
          options,
          answer: Math.min(Number(block.answer) || 0, Math.max(0, options.length - 1)),
        };
      }
      return block;
    });
    const doc: TextbookDoc = {
      schema_version: TEXTBOOK_SCHEMA_VERSION,
      chapter: { id: String(chapter.id), title: title.trim() || chapter.title, blocks: cleaned },
    };
    setSaving(true);
    saveAdminChapter(chapter, { title: doc.chapter.title, contentJson: doc })
      .then(() => {
        message.success('Chapter saved');
        setDirty(false);
        onSaved();
      })
      .catch((e) => message.error(e.response?.data?.error || 'Save failed'))
      .finally(() => setSaving(false));
  };

  const addMenu = (after?: number) => ({
    items: ADD_ITEMS.map((item) => ({
      key: item.type,
      label: item.label,
      onClick: () => addBlock(item.type, after),
    })),
  });

  return (
    <>
      <label htmlFor="chapter-title" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        Chapter title
      </label>
      <Input
        id="chapter-title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        style={{ marginBottom: 16 }}
      />

      <label htmlFor="chapter-paste" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        Paste the whole chapter
      </label>
      <p className="vv-hint">
        Paste everything in one go. Start each piece with a label so the system can tell them apart.
        Put a <strong>*</strong> after the correct quiz choice.
      </p>
      <Input.TextArea
        id="chapter-paste"
        rows={12}
        value={paste}
        placeholder={CHAPTER_PASTE_EXAMPLE}
        onChange={(e) => setPaste(e.target.value)}
      />
      <Space style={{ margin: '10px 0 18px' }} wrap>
        <Button type="primary" onClick={applyPaste}>
          Detect and fill
        </Button>
        <Button onClick={() => setPaste(CHAPTER_PASTE_EXAMPLE)}>Load example</Button>
      </Space>

      <p className="vv-hint">
        After detect, each box shows its type. Change the type if it guessed wrong. Pictures: choose
        a file on that box.
      </p>

      {blocks.length === 0 ? (
        <div className="vv-empty-box">Paste the chapter above, then click Detect and fill.</div>
      ) : (
        blocks.map((block, index) => (
          <article key={block.id} className={`vv-block-card is-${block.type}`}>
            <header className="vv-block-head">
              <Select
                size="small"
                value={
                  ['callout', 'important', 'definition', 'example', 'common_mistake'].includes(
                    block.type,
                  )
                    ? 'summary'
                    : block.type
                }
                style={{ minWidth: 150 }}
                options={ADD_ITEMS.map((item) => ({ value: item.type, label: item.label }))}
                onChange={(type) =>
                  mark(
                    blocks.map((item, i) =>
                      i === index ? retargetBlock(item, type as TextbookBlockType) : item,
                    ),
                  )
                }
              />
              <Space size={6} wrap>
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={index === blocks.length - 1}
                  onClick={() => move(index, 1)}
                />
                <Dropdown menu={addMenu(index)} trigger={['click']}>
                  <Button size="small" icon={<PlusOutlined />}>
                    Add below
                  </Button>
                </Dropdown>
                <Popconfirm
                  title="Remove this block?"
                  onConfirm={() => mark(blocks.filter((_, i) => i !== index))}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </header>
            <BlockFields
              block={block}
              onChange={(partial) => patch(index, partial)}
              onPicture={() => pickPicture(index)}
            />
          </article>
        ))
      )}

      <Space style={{ marginTop: 16 }}>
        <Button type="primary" onClick={save} loading={saving} disabled={!blocks.length}>
          Save chapter
        </Button>
        {dirty ? (
          <span className="vv-hint" style={{ margin: 0 }}>
            Unsaved changes
          </span>
        ) : null}
      </Space>
    </>
  );
}

function BlockFields({
  block,
  onChange,
  onPicture,
}: {
  block: TextbookBlock;
  onChange: (partial: Partial<TextbookBlock>) => void;
  onPicture: () => void;
}) {
  if (block.type === 'heading') {
    return (
      <>
        <Radio.Group
          value={block.level === 3 ? 3 : 2}
          onChange={(e) => onChange({ level: e.target.value })}
          style={{ marginBottom: 8 }}
        >
          <Radio value={2}>Section</Radio>
          <Radio value={3}>Sub-section</Radio>
        </Radio.Group>
        <Input
          value={block.text || ''}
          placeholder="e.g. What is a cell?"
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </>
    );
  }

  if (
    block.type === 'paragraph' ||
    block.type === 'split' ||
    block.type === 'formula' ||
    block.type === 'unknown'
  ) {
    return (
      <Input.TextArea
        rows={4}
        value={block.text || block.content || ''}
        placeholder="Write the lesson in plain language."
        onChange={(e) => onChange({ text: e.target.value, content: e.target.value })}
      />
    );
  }

  if (
    block.type === 'note' ||
    block.type === 'summary' ||
    block.type === 'callout' ||
    block.type === 'important' ||
    block.type === 'definition' ||
    block.type === 'example' ||
    block.type === 'common_mistake'
  ) {
    return (
      <Input.TextArea
        rows={4}
        value={block.text || ''}
        placeholder={
          block.type === 'note'
            ? 'Explain this in easy words.'
            : 'A short remember-this box in the book.'
        }
        onChange={(e) => onChange({ text: e.target.value })}
      />
    );
  }

  if (block.type === 'list') {
    return (
      <Input.TextArea
        rows={5}
        value={(block.items || []).join('\n')}
        placeholder="One point per line"
        onChange={(e) => onChange({ items: e.target.value.split('\n') })}
      />
    );
  }

  if (block.type === 'flashcard') {
    return (
      <>
        <Input
          value={block.front || ''}
          placeholder="Front — the word or term"
          style={{ marginBottom: 8 }}
          onChange={(e) => onChange({ front: e.target.value })}
        />
        <Input.TextArea
          rows={3}
          value={block.back || ''}
          placeholder="Back — the meaning"
          onChange={(e) => onChange({ back: e.target.value })}
        />
      </>
    );
  }

  if (block.type === 'quick_check' || block.type === 'mcq') {
    const options = optionsOf(block);
    return (
      <>
        <Input.TextArea
          rows={2}
          value={block.question || ''}
          placeholder="Ask one question"
          style={{ marginBottom: 8 }}
          onChange={(e) => onChange({ question: e.target.value })}
        />
        <p className="vv-hint" style={{ marginBottom: 6 }}>
          Tick the correct choice.
        </p>
        {options.map((opt, i) => (
          <div key={i} className="vv-option-row">
            <Radio checked={Number(block.answer) === i} onChange={() => onChange({ answer: i })} />
            <Input
              value={opt}
              placeholder={`Choice ${i + 1}`}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                onChange({ options: next });
              }}
            />
          </div>
        ))}
        <Input.TextArea
          rows={2}
          value={block.explanation || ''}
          placeholder="Optional: why that answer is right"
          onChange={(e) => onChange({ explanation: e.target.value })}
        />
      </>
    );
  }

  if (block.type === 'image') {
    return (
      <>
        {block.src ? (
          <img
            src={block.src}
            alt={block.alt_text || block.caption || ''}
            className="vv-block-preview"
          />
        ) : (
          <p className="vv-hint">No picture yet.</p>
        )}
        <Button onClick={onPicture} style={{ marginBottom: 8 }}>
          {block.src ? 'Change picture' : 'Choose picture'}
        </Button>
        <Input
          value={block.caption || ''}
          placeholder="Caption (what the picture shows)"
          onChange={(e) => onChange({ caption: e.target.value, alt_text: e.target.value })}
        />
      </>
    );
  }

  return (
    <Input.TextArea
      rows={3}
      value={block.text || ''}
      onChange={(e) => onChange({ text: e.target.value })}
    />
  );
}
