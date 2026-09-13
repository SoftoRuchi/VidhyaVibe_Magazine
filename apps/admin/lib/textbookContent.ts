/** Structured textbook JSON (master) → HTML is presentation only. */

export const TEXTBOOK_SCHEMA_VERSION = '1.0';

export type TextbookBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'image'
  | 'split'
  | 'callout'
  | 'important'
  | 'definition'
  | 'example'
  | 'common_mistake'
  | 'summary'
  | 'note'
  | 'flashcard'
  | 'quick_check'
  | 'mcq'
  | 'formula'
  | 'unknown';

export type TextbookBlock = {
  id: string;
  type: TextbookBlockType;
  text?: string;
  level?: 1 | 2 | 3;
  items?: string[];
  ordered?: boolean;
  src?: string;
  asset_id?: string;
  caption?: string;
  alt_text?: string;
  alignment?: string;
  image_right?: boolean;
  title?: string;
  front?: string;
  back?: string;
  question?: string;
  options?: string[];
  answer?: number;
  explanation?: string;
  content?: string;
  original_type?: string;
};

export type TextbookDoc = {
  schema_version: string;
  chapter: { id: string; title: string; blocks: TextbookBlock[] };
};

export function newBlockId(prefix = 'block') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyDoc(id: string, title: string): TextbookDoc {
  return {
    schema_version: TEXTBOOK_SCHEMA_VERSION,
    chapter: { id: String(id), title: title || 'Chapter', blocks: [] },
  };
}

export function decodeText(html: string) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeText(text: string) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return (m?.[2] ?? m?.[3] ?? '').trim();
}

export function asDoc(
  raw: unknown,
  fallback: { id: string; title: string; html?: string },
): TextbookDoc {
  let value = raw;
  if (typeof value === 'string' && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (value && typeof value === 'object') {
    const obj = value as TextbookDoc & { blocks?: TextbookBlock[] };
    const blocks = Array.isArray(obj.chapter?.blocks)
      ? obj.chapter.blocks
      : Array.isArray(obj.blocks)
        ? obj.blocks
        : null;
    if (blocks) {
      return {
        schema_version: obj.schema_version || TEXTBOOK_SCHEMA_VERSION,
        chapter: {
          id: String(obj.chapter?.id || fallback.id),
          title: String(obj.chapter?.title || fallback.title || 'Chapter'),
          blocks: blocks.filter((b) => b && typeof b === 'object' && b.type).map(normalizeBlock),
        },
      };
    }
  }
  return htmlToJson(fallback.html || '', fallback);
}

function normalizeBlock(block: TextbookBlock): TextbookBlock {
  const type = String(block.type || 'unknown') as TextbookBlockType;
  return { ...block, id: block.id || newBlockId(type), type };
}

export function headingAnchors(doc: TextbookDoc) {
  return doc.chapter.blocks
    .map((block, index) =>
      block.type === 'heading' && decodeText(block.text || '')
        ? { index, blockIndex: index, id: block.id, title: decodeText(block.text || '') }
        : null,
    )
    .filter(
      (item): item is { index: number; blockIndex: number; id: string; title: string } => !!item,
    )
    .map((item, index) => ({ ...item, index }));
}

export function insertAfterHeading(
  doc: TextbookDoc,
  headingIndex: number | null,
  block: TextbookBlock,
) {
  const headings = doc.chapter.blocks
    .map((item, i) => (item.type === 'heading' ? i : -1))
    .filter((i) => i >= 0);
  if (headingIndex == null || headingIndex < 0 || headings[headingIndex] == null) {
    doc.chapter.blocks.push(block);
    return;
  }
  const next = headings[headingIndex + 1] ?? doc.chapter.blocks.length;
  doc.chapter.blocks.splice(next, 0, block);
}

export function studyBlocks(doc: TextbookDoc, type: TextbookBlockType) {
  return doc.chapter.blocks
    .map((block, blockIndex) => ({ block, blockIndex }))
    .filter((item) => item.block.type === type);
}

export function sectionTitleFor(doc: TextbookDoc, blockIndex: number) {
  for (let i = blockIndex; i >= 0; i -= 1) {
    const block = doc.chapter.blocks[i];
    if (block?.type === 'heading' && block.text) return decodeText(block.text);
  }
  return 'Start of chapter';
}

export function htmlToJson(html: string, meta: { id: string; title: string }): TextbookDoc {
  const doc = emptyDoc(meta.id, meta.title);
  const cleaned = String(html || '')
    .replace(/<\/?article[^>]*>/gi, '')
    .trim();
  if (!cleaned) return doc;
  const re = new RegExp(
    [
      '<img\\b[^>]*>',
      '<figure\\b[^>]*>[\\s\\S]*?<\\/figure>',
      '<details\\b[^>]*>[\\s\\S]*?<\\/details>',
      '<aside\\b[^>]*>[\\s\\S]*?<\\/aside>',
      '<h1[^>]*>[\\s\\S]*?<\\/h1>',
      '<h2[^>]*>[\\s\\S]*?<\\/h2>',
      '<h3[^>]*>[\\s\\S]*?<\\/h3>',
      '<p[^>]*>[\\s\\S]*?<\\/p>',
      '<li[^>]*>[\\s\\S]*?<\\/li>',
      '<ul[^>]*>[\\s\\S]*?<\\/ul>',
      '<ol[^>]*>[\\s\\S]*?<\\/ol>',
      '<div[^>]*>[\\s\\S]*?<\\/div>',
    ].join('|'),
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const raw = m[0] || '';
    const open = raw.match(/^<([a-z0-9]+)\b([^>]*)>/i);
    const tag = (open?.[1] || '').toLowerCase();
    const attrs = open?.[2] || '';
    const inner = raw.replace(/^<[^>]+>/, '').replace(/<\/[a-z0-9]+>\s*$/i, '');
    const cls = `${attrs} ${attr(raw, 'class')}`;
    if (/course-flash/i.test(cls) || /course-flash/i.test(raw)) {
      const strong = inner.match(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/i);
      const front = decodeText(strong?.[2] || attr(raw, 'data-front'));
      const back = decodeText(strong ? inner.replace(strong[0], ' ') : inner);
      if (front)
        doc.chapter.blocks.push({ id: newBlockId('flashcard'), type: 'flashcard', front, back });
      continue;
    }
    if (/course-explain/i.test(cls) || tag === 'details') {
      const body = inner.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, ' ');
      const text = decodeText(body);
      if (text) doc.chapter.blocks.push({ id: newBlockId('note'), type: 'note', text });
      continue;
    }
    if (/course-quick-block/i.test(cls)) {
      const kind = attr(raw, 'data-kind') === 'mcq' ? 'mcq' : 'quick_check';
      const question = decodeText(
        inner.match(/course-quick-prompt[^>]*>([\s\S]*?)<\//i)?.[1] || inner,
      );
      const options = Array.from(inner.matchAll(/data-opt=["'](\d+)["'][^>]*>([\s\S]*?)<\//gi)).map(
        (p) => decodeText(p[2] || ''),
      );
      const answer = Number(attr(raw, 'data-answer'));
      const explanation = decodeText(
        inner.match(/course-quick-explain[^>]*>([\s\S]*?)<\//i)?.[1] || '',
      );
      if (question && options.length >= 2) {
        doc.chapter.blocks.push({
          id: newBlockId(kind),
          type: kind,
          question,
          options,
          answer: Number.isFinite(answer) ? answer : 0,
          explanation: explanation || undefined,
        });
      }
      continue;
    }
    if (/course-split/i.test(cls)) {
      const img = inner.match(/<img\b[^>]*>/i)?.[0] || '';
      doc.chapter.blocks.push({
        id: newBlockId('split'),
        type: 'split',
        text: decodeText(inner.replace(/<figure[\s\S]*?<\/figure>|<img\b[^>]*>/gi, ' ')),
        src: attr(img, 'src') || undefined,
        caption: attr(img, 'alt') || undefined,
        image_right: /course-split-rtl|image-right/i.test(cls),
      });
      continue;
    }
    if (/course-callout/i.test(cls)) {
      const text = decodeText(inner);
      if (text) doc.chapter.blocks.push({ id: newBlockId('callout'), type: 'callout', text });
      continue;
    }
    if (tag === 'img' || tag === 'figure') {
      const imgTag = tag === 'img' ? raw : inner.match(/<img\b[^>]*>/i)?.[0] || '';
      const src = attr(imgTag, 'src');
      const caption =
        decodeText(inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || '') ||
        attr(imgTag, 'alt');
      if (src || caption) {
        doc.chapter.blocks.push({
          id: newBlockId('image'),
          type: 'image',
          src: src || undefined,
          caption: caption || undefined,
          alt_text: attr(imgTag, 'alt') || caption || undefined,
        });
      }
      continue;
    }
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const text = decodeText(inner);
      if (text) {
        doc.chapter.blocks.push({
          id: newBlockId('heading'),
          type: 'heading',
          level: Number(tag[1]) as 1 | 2 | 3,
          text,
        });
      }
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
        .map((item) => decodeText(item[1] || ''))
        .filter(Boolean);
      if (items.length) {
        doc.chapter.blocks.push({
          id: newBlockId('list'),
          type: 'list',
          ordered: tag === 'ol',
          items,
        });
      }
      continue;
    }
    if (tag === 'li') {
      const text = decodeText(inner);
      if (text)
        doc.chapter.blocks.push({
          id: newBlockId('paragraph'),
          type: 'paragraph',
          text: `• ${text}`,
        });
      continue;
    }
    if (tag === 'p') {
      if (/course-kicker/i.test(cls)) continue;
      const text = decodeText(inner);
      if (text) doc.chapter.blocks.push({ id: newBlockId('paragraph'), type: 'paragraph', text });
    }
  }
  return doc;
}

export function jsonToHtml(doc: TextbookDoc) {
  return (doc.chapter.blocks || [])
    .map((block) => {
      switch (block.type) {
        case 'heading': {
          const level = block.level === 1 ? 1 : block.level === 3 ? 3 : 2;
          return `<h${level}>${escapeText(block.text || '')}</h${level}>`;
        }
        case 'paragraph':
          return `<p>${escapeText(block.text || '')}</p>`;
        case 'list': {
          const tag = block.ordered ? 'ol' : 'ul';
          const items = (block.items || []).map((item) => `<li>${escapeText(item)}</li>`).join('');
          return `<${tag}>${items}</${tag}>`;
        }
        case 'image': {
          const src = escapeText(block.src || '');
          const alt = escapeText(block.alt_text || block.caption || '');
          const img = `<img src="${src}" alt="${alt}" />`;
          return block.caption
            ? `<figure>${img}<figcaption>${escapeText(block.caption)}</figcaption></figure>`
            : img;
        }
        case 'split': {
          const side = block.image_right ? ' course-split-rtl' : '';
          const img = block.src
            ? `<img src="${escapeText(block.src)}" alt="${escapeText(block.caption || '')}" />`
            : '';
          return `<div class="course-split${side}"><p>${escapeText(block.text || '')}</p>${img}</div>`;
        }
        case 'callout':
        case 'important':
        case 'definition':
        case 'example':
        case 'common_mistake':
        case 'summary':
          return `<div class="course-callout" data-kind="${block.type}"><p>${escapeText(block.text || '')}</p></div>`;
        case 'note':
          return `<details class="course-explain"><summary>In simple words</summary><p>${escapeText(block.text || '')}</p></details>`;
        case 'flashcard':
          return `<div class="course-flash"><strong>${escapeText(block.front || '')}</strong><p>${escapeText(block.back || '')}</p></div>`;
        case 'quick_check':
        case 'mcq':
          return quickHtml(block);
        case 'formula':
          return `<p class="course-formula">${escapeText(block.content || block.text || '')}</p>`;
        default:
          return block.text ? `<p>${escapeText(block.text)}</p>` : '';
      }
    })
    .filter(Boolean)
    .join('\n');
}

function quickHtml(block: TextbookBlock) {
  const kind = block.type === 'mcq' ? 'mcq' : 'quick_check';
  const label = kind === 'mcq' ? 'Quiz' : 'Quick check';
  const options = (block.options || [])
    .map((opt, i) => `<button type="button" data-opt="${i}">${escapeText(opt)}</button>`)
    .join('');
  const explain = block.explanation
    ? `<p class="course-quick-explain">${escapeText(block.explanation)}</p>`
    : '';
  return `<aside class="course-quick-block" data-kind="${kind}" data-answer="${Number(block.answer) || 0}">
  <p class="course-kicker">${label}</p>
  <p class="course-quick-prompt">${escapeText(block.question || '')}</p>
  <div class="course-quick-options">${options}</div>
  ${explain}
</aside>`;
}

export function flashcardsFromDoc(doc: TextbookDoc) {
  return doc.chapter.blocks
    .filter((block) => block.type === 'flashcard' && (block.front || '').trim())
    .map((block) => ({ front: String(block.front).trim(), back: String(block.back || '').trim() }));
}

export function quickChecksFromDoc(doc: TextbookDoc) {
  return doc.chapter.blocks
    .filter(
      (block) =>
        (block.type === 'quick_check' || block.type === 'mcq') && (block.question || '').trim(),
    )
    .map((block, i) => ({
      id: block.id || `json-${i}`,
      title: block.type === 'mcq' ? 'Quiz' : 'Quick check',
      pageNumber: null as number | null,
      questions: [
        {
          prompt: String(block.question),
          options: block.options || [],
          correctIndex: Number(block.answer) || 0,
          explanation: block.explanation || undefined,
        },
      ],
    }))
    .filter((item) => item.questions[0].options.length >= 2);
}
