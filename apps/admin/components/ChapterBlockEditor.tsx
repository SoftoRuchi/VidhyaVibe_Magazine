'use client';

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Input, Modal, Popconfirm, Radio, Select, Space, message } from 'antd';
import React from 'react';
import {
  CHAPTER_PASTE_CONTINUE,
  CHAPTER_PASTE_EXAMPLE,
  CHAPTER_PASTE_LABELS,
  describeDetected,
  parseChapterPaste,
  retargetBlock,
} from '../lib/parseChapterPaste';
import {
  TEXTBOOK_SCHEMA_VERSION,
  asDoc,
  headingTitles,
  newBlockId,
  parseTableText,
  tableRowsOf,
  type TextbookBlock,
  type TextbookBlockType,
  type TextbookDoc,
} from '../lib/textbookContent';
import { apiUpload } from '../lib/upload';
import { saveAdminChapter, type AdminChapter } from '../lib/useAdminChapter';
import ChapterBookPreview from './ChapterBookPreview';

const BLOCK_TYPES: { type: TextbookBlockType; label: string }[] = [
  { type: 'toc', label: 'Table of contents' },
  { type: 'heading', label: 'Section title' },
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'code', label: 'Code' },
  { type: 'list', label: 'List' },
  { type: 'table', label: 'Table' },
  { type: 'image', label: 'Picture' },
  { type: 'split', label: 'Text and picture' },
  { type: 'formula', label: 'Formula' },
  { type: 'note', label: 'Simple words' },
  { type: 'definition', label: 'Definition' },
  { type: 'example', label: 'Example' },
  { type: 'important', label: 'Important' },
  { type: 'common_mistake', label: 'Common mistake' },
  { type: 'callout', label: 'Highlight' },
  { type: 'summary', label: 'Summary' },
  { type: 'flashcard', label: 'Flashcard' },
  { type: 'quick_check', label: 'Quick check' },
  { type: 'mcq', label: 'Quiz' },
];

const ADD_ITEMS: { type: TextbookBlockType; label: string; extra?: Partial<TextbookBlock> }[] = [
  { type: 'toc', label: 'Table of contents' },
  { type: 'heading', label: 'Chapter title', extra: { level: 1 } },
  { type: 'heading', label: 'Section title' },
  { type: 'heading', label: 'Sub-section', extra: { level: 3 } },
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'code', label: 'Code' },
  { type: 'list', label: 'List' },
  { type: 'list', label: 'Numbered list', extra: { ordered: true } },
  { type: 'table', label: 'Table' },
  { type: 'image', label: 'Picture' },
  { type: 'split', label: 'Text and picture' },
  { type: 'formula', label: 'Formula' },
  { type: 'note', label: 'Simple words' },
  { type: 'definition', label: 'Definition' },
  { type: 'example', label: 'Example' },
  { type: 'important', label: 'Important' },
  { type: 'common_mistake', label: 'Common mistake' },
  { type: 'callout', label: 'Highlight' },
  { type: 'summary', label: 'Summary' },
  { type: 'flashcard', label: 'Flashcard' },
  { type: 'quick_check', label: 'Quick check' },
  { type: 'mcq', label: 'Quiz' },
];

function makeBlock(type: TextbookBlockType, extra?: Partial<TextbookBlock>): TextbookBlock {
  const id = newBlockId(type);
  if (type === 'heading')
    return { id, type, level: extra?.level === 1 ? 1 : extra?.level === 3 ? 3 : 2, text: '' };
  if (type === 'list') return { id, type, ordered: extra?.ordered === true, items: [''] };
  if (type === 'toc') return { id, type, items: extra?.items || [] };
  if (type === 'table')
    return {
      id,
      type,
      rows: extra?.rows || [
        ['', ''],
        ['', ''],
      ],
    };
  if (type === 'flashcard') return { id, type, front: '', back: '' };
  if (type === 'quick_check' || type === 'mcq') {
    return { id, type, question: '', options: ['', '', '', ''], answer: 0, explanation: '' };
  }
  if (type === 'image') return { id, type, src: '', caption: '', alt_text: '' };
  if (type === 'split') {
    return { id, type, text: '', src: '', caption: '', alt_text: '', image_right: false };
  }
  return { id, type, text: '' };
}

function optionsOf(block: TextbookBlock) {
  const options = [...(block.options || [])];
  while (options.length < 4) options.push('');
  return options.slice(0, 4);
}

function matchesQuery(query: string, haystack: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = haystack.toLowerCase();
  return words.every((word) => text.includes(word));
}

function blockSearchLabel(block: TextbookBlock) {
  const parts = [BLOCK_TYPES.find((item) => item.type === block.type)?.label || block.type];
  if (block.type === 'heading') {
    if (block.level === 1) parts.push('Chapter title');
    else if (block.level === 3) parts.push('Sub-section');
    else parts.push('Section');
  }
  if (block.type === 'list') parts.push(block.ordered ? 'Numbered list' : 'Bullets');
  return parts.join(' ');
}

function blockSearchContent(block: TextbookBlock) {
  const bits: string[] = [];
  const add = (value?: string | null) => {
    const text = String(value ?? '').trim();
    if (text) bits.push(text);
  };
  add(block.text);
  add(block.content);
  add(block.caption);
  add(block.alt_text);
  add(block.front);
  add(block.back);
  add(block.question);
  add(block.explanation);
  add(block.title);
  (block.items || []).forEach(add);
  (block.options || []).forEach(add);
  (block.rows || []).forEach((row) => (row || []).forEach((cell) => add(cell)));
  return bits.join('\n');
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
  const [labelQuery, setLabelQuery] = React.useState('');
  const [contentQuery, setContentQuery] = React.useState('');
  const [labelsOpen, setLabelsOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

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

  React.useEffect(() => {
    setLabelQuery('');
    setContentQuery('');
    setLabelsOpen(false);
  }, [chapter.id]);

  React.useEffect(() => {
    if (labelQuery.trim()) setLabelsOpen(true);
  }, [labelQuery]);

  const searching = Boolean(labelQuery.trim() || contentQuery.trim());
  const titleHit =
    searching && matchesQuery(labelQuery, 'Chapter title') && matchesQuery(contentQuery, title);
  const pasteHit = Boolean(contentQuery.trim()) && !labelQuery.trim() && matchesQuery(contentQuery, paste);
  const pasteLabels = CHAPTER_PASTE_LABELS.filter((item) =>
    matchesQuery(labelQuery, item.label.replace(/:$/, '')),
  );
  const visibleBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter(
      ({ block }) =>
        matchesQuery(labelQuery, blockSearchLabel(block)) &&
        matchesQuery(contentQuery, blockSearchContent(block)),
    );

  const mark = (next: TextbookBlock[]) => {
    setBlocks(next);
    setDirty(true);
  };

  const patch = (index: number, partial: Partial<TextbookBlock>) => {
    mark(blocks.map((block, i) => (i === index ? { ...block, ...partial } : block)));
  };

  const addBlock = (type: TextbookBlockType, after?: number, extra?: Partial<TextbookBlock>) => {
    const block = makeBlock(type, extra);
    if (type === 'toc' && !(block.items || []).some((item) => item.trim())) {
      block.items = headingTitles({
        schema_version: TEXTBOOK_SCHEMA_VERSION,
        chapter: { id: String(chapter.id), title, blocks },
      });
    }
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

  const applyPaste = (mode: 'append' | 'replace') => {
    const found = parseChapterPaste(paste);
    if (!found.length) {
      message.warning(
        'Nothing was detected. Start each piece with Section title:, Paragraph:, Simple words:, Flashcard:, and so on.',
      );
      return;
    }
    const apply = () => {
      mark(mode === 'append' && blocks.length ? [...blocks, ...found] : found);
      setPaste('');
      message.success(
        mode === 'append' && blocks.length
          ? `Added ${describeDetected(found)} after the existing content. Save when you are done.`
          : `Detected ${describeDetected(found)}. Check the type on each box if one is wrong, then save.`,
      );
    };
    if (mode === 'replace' && blocks.length) {
      Modal.confirm({
        title: 'Replace the existing chapter?',
        content: `This removes the ${blocks.length} pieces already in this chapter and loads ${found.length} new ones.`,
        okText: 'Replace',
        okButtonProps: { danger: true },
        onOk: apply,
      });
      return;
    }
    apply();
  };

  const cleanedBlocks = () =>
    blocks.map((block) => {
      if (block.type === 'table') {
        const rows = tableRowsOf(block)
          .map((row) => row.map((cell) => cell.trim()))
          .filter((row) => row.some(Boolean));
        return { ...block, rows };
      }
      if (block.type === 'list' || block.type === 'toc') {
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

  const currentDoc = (): TextbookDoc => ({
    schema_version: TEXTBOOK_SCHEMA_VERSION,
    chapter: {
      id: String(chapter.id),
      title: title.trim() || chapter.title,
      blocks: cleanedBlocks(),
    },
  });

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
        patch(index, { src: r.url });
        message.success('Picture added');
      } catch (e: any) {
        message.error(e?.response?.data?.message || e?.message || 'Upload failed');
      }
    };
    input.click();
  };

  const save = () => {
    const doc = currentDoc();
    if (!doc.chapter.blocks.length) return;
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
      key: `${item.type}-${item.label}`,
      label: item.label,
      onClick: () => addBlock(item.type, after, item.extra),
    })),
  });

  return (
    <>
      <label htmlFor="chapter-title" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        Chapter title
      </label>
      <Input
        id="chapter-title"
        className={titleHit ? 'vv-search-hit' : undefined}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        style={{ marginBottom: 16 }}
      />

      <label htmlFor="chapter-paste" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        {blocks.length ? 'Paste the next part of the chapter' : 'Paste the chapter'}
      </label>
      <p className="vv-hint">
        {blocks.length
          ? 'Paste only the new part. Detect and add keeps what is already here and puts the new pieces at the end.'
          : 'Paste everything in one go. Start each piece with a label so the system can tell them apart.'}{' '}
        Put a <strong>*</strong> after the correct quiz choice.
      </p>
      <details
        className="vv-label-help"
        open={labelsOpen}
        onToggle={(event) => setLabelsOpen(event.currentTarget.open)}
      >
        <summary>Labels you can paste</summary>
        {pasteLabels.length ? (
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>What it becomes</th>
              </tr>
            </thead>
            <tbody>
              {pasteLabels.map((item) => (
                <tr key={item.label}>
                  <td>
                    <code>{item.label}</code>
                  </td>
                  <td>{item.becomes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="vv-hint" style={{ margin: '8px 0 0' }}>
            No labels match “{labelQuery.trim()}”.
          </p>
        )}
      </details>
      <Input.TextArea
        id="chapter-paste"
        className={pasteHit ? 'vv-search-hit' : undefined}
        rows={12}
        value={paste}
        placeholder={CHAPTER_PASTE_EXAMPLE}
        onChange={(e) => setPaste(e.target.value)}
      />
      <Space style={{ margin: '10px 0 18px' }} wrap>
        <Button type="primary" onClick={() => applyPaste('append')}>
          {blocks.length ? 'Detect and add' : 'Detect and fill'}
        </Button>
        {blocks.length ? (
          <Button danger onClick={() => applyPaste('replace')}>
            Replace chapter
          </Button>
        ) : null}
        <Button onClick={() => setPaste(CHAPTER_PASTE_EXAMPLE)}>Load example</Button>
        {blocks.length ? (
          <Button onClick={() => setPaste(CHAPTER_PASTE_CONTINUE)}>Load next part</Button>
        ) : null}
      </Space>

      <p className="vv-hint">
        After detect, each box shows its type. Change the type if it guessed wrong. Pictures: choose
        a file on that box.
      </p>

      {blocks.length ? (
        <div className="vv-block-search">
          <div>
            <label htmlFor="search-block-label">Search label</label>
            <Input
              id="search-block-label"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Chapter title, Table, Simple words"
              value={labelQuery}
              onChange={(e) => setLabelQuery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="search-block-content">Search content</label>
            <Input
              id="search-block-content"
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Words inside a piece"
              value={contentQuery}
              onChange={(e) => setContentQuery(e.target.value)}
            />
          </div>
          {searching ? (
            <p className="vv-hint vv-block-search-status">
              {visibleBlocks.length
                ? `Showing ${visibleBlocks.length} of ${blocks.length} pieces.`
                : `No pieces match. All ${blocks.length} pieces are still in the chapter.`}
              {titleHit ? ' The chapter title matches.' : ''}
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setLabelQuery('');
                  setContentQuery('');
                }}
              >
                Clear both
              </Button>
            </p>
          ) : null}
        </div>
      ) : null}

      {blocks.length === 0 ? (
        <div className="vv-empty-box">
          Paste the chapter above, then click Detect and fill.
          <div style={{ marginTop: 12 }}>
            <Dropdown menu={addMenu()} trigger={['click']}>
              <Button icon={<PlusOutlined />}>Add a piece</Button>
            </Dropdown>
          </div>
        </div>
      ) : visibleBlocks.length === 0 ? (
        <div className="vv-empty-box">Nothing matches this search.</div>
      ) : (
        visibleBlocks.map(({ block, index }) => (
          <article key={block.id} className={`vv-block-card is-${block.type}`}>
            <header className="vv-block-head">
              <Select
                size="small"
                value={block.type}
                style={{ minWidth: 180 }}
                options={BLOCK_TYPES.map((item) => ({ value: item.type, label: item.label }))}
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
              headings={blocks
                .filter((item) => item.type === 'heading')
                .map((item) => item.text || '')
                .filter(Boolean)}
              onChange={(partial) => patch(index, partial)}
              onPicture={() => pickPicture(index)}
            />
          </article>
        ))
      )}

      <Space style={{ marginTop: 16 }} wrap>
        <Dropdown menu={addMenu()} trigger={['click']}>
          <Button icon={<PlusOutlined />}>Add a piece</Button>
        </Dropdown>
        <Button
          icon={<EyeOutlined />}
          onClick={() => setPreviewOpen(true)}
          disabled={!blocks.length}
        >
          Preview book
        </Button>
        <Button type="primary" onClick={save} loading={saving} disabled={!blocks.length}>
          Save chapter
        </Button>
        {dirty ? (
          <span className="vv-hint" style={{ margin: 0 }}>
            Unsaved changes
          </span>
        ) : null}
      </Space>
      <Modal
        title="Book preview"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width="96vw"
        style={{ top: 12, maxWidth: 1400 }}
        wrapClassName="vv-book-preview-modal"
        destroyOnClose
      >
        <p className="vv-hint">
          This is the current chapter, including unsaved changes. Students see this after you save.
        </p>
        <ChapterBookPreview
          doc={currentDoc()}
          header={`${chapter.courseName} · ${chapter.semesterTitle || `Semester ${chapter.semesterNumber}`}`}
          chapterTitle={title.trim() || chapter.title}
          startPage={chapter.startPage || 1}
          frontCoverUrl={chapter.frontCoverUrl}
          backCoverUrl={chapter.backCoverUrl}
          fit="modal"
        />
      </Modal>
    </>
  );
}

function BlockFields({
  block,
  headings,
  onChange,
  onPicture,
}: {
  block: TextbookBlock;
  headings: string[];
  onChange: (partial: Partial<TextbookBlock>) => void;
  onPicture: () => void;
}) {
  if (block.type === 'heading') {
    return (
      <>
        <Radio.Group
          value={block.level === 1 ? 1 : block.level === 3 ? 3 : 2}
          onChange={(e) => onChange({ level: e.target.value })}
          style={{ marginBottom: 8 }}
        >
          <Radio value={1}>Chapter title</Radio>
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

  if (block.type === 'toc') {
    return (
      <>
        <p className="vv-hint" style={{ marginBottom: 6 }}>
          One topic per line. Leave empty to use section titles automatically.
        </p>
        <Input.TextArea
          rows={5}
          value={(block.items || []).join('\n')}
          placeholder={headings.join('\n') || 'What is a cell?\nParts of a cell'}
          onChange={(e) => onChange({ items: e.target.value.split('\n') })}
        />
        <Button
          size="small"
          style={{ marginTop: 8 }}
          onClick={() => onChange({ items: headings })}
          disabled={!headings.length}
        >
          Fill from section titles
        </Button>
      </>
    );
  }

  if (block.type === 'table') {
    const rows = tableRowsOf(block);
    return (
      <>
        <p className="vv-hint" style={{ marginBottom: 6 }}>
          One row per line. Separate cells with <strong>|</strong>. The first row is the header.
        </p>
        <Input.TextArea
          rows={6}
          value={rows.map((row) => row.join(' | ')).join('\n')}
          placeholder={
            'Set | Meaning | Example\nUnion | In A or in B | A ∪ B\nIntersection | In A and B | A ∩ B'
          }
          onChange={(e) => onChange({ rows: parseTableText(e.target.value) })}
        />
        <Input
          style={{ marginTop: 8 }}
          value={block.caption || ''}
          placeholder="Optional caption (what the table shows)"
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </>
    );
  }

  if (block.type === 'code') {
    return (
      <>
        <Input.TextArea
          rows={6}
          value={block.text || block.content || ''}
          placeholder="Paste or type code snippet here..."
          style={{ fontFamily: 'monospace', fontSize: 13, background: '#fafafa' }}
          onChange={(e) => onChange({ text: e.target.value, content: e.target.value })}
        />
        <Input
          style={{ marginTop: 8 }}
          value={block.language || ''}
          placeholder="Optional: programming language (e.g. python, cpp, java, html, sql)"
          onChange={(e) => onChange({ language: e.target.value })}
        />
      </>
    );
  }

  if (block.type === 'paragraph' || block.type === 'formula' || block.type === 'unknown') {
    return (
      <Input.TextArea
        rows={block.type === 'formula' ? 2 : 4}
        value={block.text || block.content || ''}
        placeholder={
          block.type === 'formula'
            ? 'e.g. Area = length × width'
            : 'Write the lesson in plain language.'
        }
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
    const placeholder =
      block.type === 'note'
        ? 'Explain this in easy words.'
        : block.type === 'definition'
          ? 'Write the definition in one or two sentences.'
          : block.type === 'example'
            ? 'Give a short example from the lesson.'
            : block.type === 'important'
              ? 'The point students must not miss.'
              : block.type === 'common_mistake'
                ? 'The mistake students often make, and the right idea.'
                : block.type === 'callout'
                  ? 'A short highlight box in the book.'
                  : 'A short remember-this box in the book.';
    return (
      <Input.TextArea
        rows={4}
        value={block.text || ''}
        placeholder={placeholder}
        onChange={(e) => onChange({ text: e.target.value })}
      />
    );
  }

  if (block.type === 'list') {
    return (
      <>
        <Radio.Group
          value={block.ordered ? 'numbered' : 'bullets'}
          onChange={(e) => onChange({ ordered: e.target.value === 'numbered' })}
          style={{ marginBottom: 8 }}
        >
          <Radio value="bullets">Bullets</Radio>
          <Radio value="numbered">Numbered</Radio>
        </Radio.Group>
        <Input.TextArea
          rows={5}
          value={(block.items || []).join('\n')}
          placeholder="One point per line"
          onChange={(e) => onChange({ items: e.target.value.split('\n') })}
        />
      </>
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

  if (block.type === 'image' || block.type === 'split') {
    return (
      <>
        {block.type === 'split' ? (
          <Input.TextArea
            rows={3}
            value={block.text || ''}
            placeholder="Write the text that sits beside the picture."
            style={{ marginBottom: 8 }}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        ) : null}
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
        {block.type === 'split' ? (
          <Radio.Group
            value={block.image_right ? 'right' : 'left'}
            onChange={(e) => onChange({ image_right: e.target.value === 'right' })}
            style={{ display: 'block', marginBottom: 8 }}
          >
            <Radio value="left">Picture on the left</Radio>
            <Radio value="right">Picture on the right</Radio>
          </Radio.Group>
        ) : null}
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
