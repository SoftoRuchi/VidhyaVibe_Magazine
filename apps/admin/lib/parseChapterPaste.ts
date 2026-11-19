import {
  htmlToJson,
  newBlockId,
  parseTableText,
  type TextbookBlock,
  type TextbookBlockType,
} from './textbookContent';

type LabelRule = {
  re: RegExp;
  type: TextbookBlockType;
  extra?: Partial<TextbookBlock>;
};

const LABEL_MAP: LabelRule[] = [
  { re: /^(table of contents|contents|toc)\s*:\s*/i, type: 'toc' },
  { re: /^(table|tabular)\s*:\s*/i, type: 'table' },
  { re: /^(chapter title|chapter)\s*:\s*/i, type: 'heading', extra: { level: 1 } },
  { re: /^(sub-?section|sub heading)\s*:\s*/i, type: 'heading', extra: { level: 3 } },
  { re: /^(section title|section|heading|title)\s*:\s*/i, type: 'heading', extra: { level: 2 } },
  { re: /^(paragraph|para|text)\s*:\s*/i, type: 'paragraph' },
  { re: /^(numbered list|numbers|steps)\s*:\s*/i, type: 'list', extra: { ordered: true } },
  { re: /^(list|bullets?|points?)\s*:\s*/i, type: 'list' },
  { re: /^(text and picture|picture and text|split)\s*:\s*/i, type: 'split' },
  { re: /^(picture|image|photo|figure)\s*:\s*/i, type: 'image' },
  { re: /^(in simple words|simple words|easy words)\s*:\s*/i, type: 'note' },
  { re: /^(flash\s*card|card)\s*:\s*/i, type: 'flashcard' },
  { re: /^(quick\s*check)\s*:\s*/i, type: 'quick_check' },
  { re: /^(quiz|mcq)\s*:\s*/i, type: 'mcq' },
  { re: /^(definition)\s*:\s*/i, type: 'definition' },
  { re: /^(example|worked example)\s*:\s*/i, type: 'example' },
  { re: /^(important|key point)\s*:\s*/i, type: 'important' },
  { re: /^(common mistake|mistake)\s*:\s*/i, type: 'common_mistake' },
  { re: /^(highlight|callout|note)\s*:\s*/i, type: 'callout' },
  { re: /^(formula|equation)\s*:\s*/i, type: 'formula' },
  { re: /^(code snippet|code block|code|program|syntax)\s*:\s*/i, type: 'code' },
  { re: /^(summary|remember)\s*:\s*/i, type: 'summary' },
];

export const CHAPTER_PASTE_LABELS: { label: string; becomes: string }[] = [
  {
    label: 'Table of contents:',
    becomes: 'Contents box — one topic per line, or leave empty to use section titles',
  },
  { label: 'Chapter title:', becomes: 'Big chapter heading' },
  { label: 'Section title:', becomes: 'Heading' },
  { label: 'Sub-section:', becomes: 'Smaller heading' },
  { label: 'Paragraph:', becomes: 'Lesson text' },
  { label: 'List:', becomes: 'Bullet list (one item per line)' },
  { label: 'Numbered list:', becomes: 'Numbered steps (one item per line)' },
  { label: 'Table:', becomes: 'Table — one row per line, cells split by |' },
  { label: 'Picture:', becomes: 'Picture box — then choose the file' },
  { label: 'Text and picture:', becomes: 'Text beside a picture — then choose the file' },
  { label: 'Code:', becomes: 'Code block — preserves indentation and formatting' },
  { label: 'Simple words:', becomes: 'In simple words' },
  { label: 'Definition:', becomes: 'Definition box' },
  { label: 'Example:', becomes: 'Example box' },
  { label: 'Important:', becomes: 'Important box' },
  { label: 'Common mistake:', becomes: 'Common-mistake box' },
  { label: 'Highlight:', becomes: 'Highlight / note box' },
  { label: 'Formula:', becomes: 'Formula or equation' },
  { label: 'Flashcard:', becomes: 'Term = meaning' },
  { label: 'Quick check: / Quiz:', becomes: 'Question + choices, * = correct' },
  { label: 'Summary:', becomes: 'Remember box' },
];

export const CHAPTER_PASTE_EXAMPLE = `Chapter title: The living cell

Table of contents:
What is a cell?
Parts of a cell
How cells work

Section title: What is a cell?

Paragraph: Every living thing is made of cells. A cell is the smallest unit that can carry out life processes on its own.

Simple words: A cell is like a tiny room. Each room has a job.

Definition: A cell is the smallest living unit of an organism.

Flashcard: Cell = The smallest living unit of an organism.

Important: All living things are made of one or more cells.

Section title: Parts of a cell

Paragraph: Most plant and animal cells have a membrane, cytoplasm, and a nucleus. Plant cells also have a cell wall and chloroplasts.

List:
Cell membrane
Cytoplasm
Nucleus

Numbered list:
Find the cell membrane
Find the nucleus
Find the cytoplasm

Table:
Part | Found in | Job
Cell membrane | Animal and plant | Controls what enters and leaves
Cell wall | Plant only | Gives shape and support
Nucleus | Animal and plant | Holds DNA

Picture: Simple diagram of a plant cell

Text and picture: Plant cells keep their shape because of the cell wall around the membrane.

Example: A leaf is made of many cells working together.

Common mistake: A cell is not the same thing as an atom.

Formula: Surface area = 6 × side × side

Highlight: Cells were first seen with a microscope.

Summary: Animal cells have a membrane but no cell wall. Plant cells have both.

Quick check: Which part of the cell holds DNA?
Cytoplasm
Nucleus *
Cell wall

Quiz: Which order is correct?
Organ → tissue → cell
Tissue → cell → organ
Cell → tissue → organ *
`;

export const CHAPTER_PASTE_CONTINUE = `Section title: How cells work

Paragraph: A cell takes in food and oxygen, uses them to make energy, and gets rid of waste. This is how every living thing stays alive.

Sub-section: Making energy

Paragraph: Tiny parts inside the cell, called mitochondria, turn sugar and oxygen into energy the cell can use.

Definition: Mitochondria are the parts of a cell that make energy.

Formula: Glucose + oxygen → energy + carbon dioxide + water

Simple words: Mitochondria are like tiny power stations inside the cell.

Flashcard: Mitochondria = The power stations of the cell.

Section title: Plant cells and animal cells

Paragraph: Plant cells and animal cells share many parts, but they are not the same. Plant cells have extra parts that animals do not need.

Table:
Part | Animal cell | Plant cell
Cell membrane | Yes | Yes
Nucleus | Yes | Yes
Cell wall | No | Yes
Chloroplast | No | Yes
Large vacuole | No | Yes

List:
Plant cells have a cell wall
Plant cells have chloroplasts for making food
Animal cells can change shape more easily

Text and picture: Chloroplasts trap sunlight so the plant can make its own food.

Example: A green leaf looks green because it is full of chloroplasts.

Important: Only plant cells can make food from sunlight. Animals must eat food.

Common mistake: Not every green thing is a plant cell. Some bacteria can also make food.

Highlight: Chloroplasts are found in the green parts of a plant, not in the roots.

Section title: Cells, tissues, and organs

Paragraph: One cell can do a small job. Many cells of the same kind join to make a tissue. Tissues join to make an organ. Organs work together in a system.

Numbered list:
A cell does one small job
Cells of the same kind make a tissue
Tissues make an organ
Organs work together in a system

Definition: A tissue is a group of similar cells that do the same job.

Example: Muscle cells join to make muscle tissue. Muscle tissue helps you move your arm.

Flashcard: Tissue = A group of similar cells doing the same job.

Flashcard: Organ = A body part made of tissues that work together, such as the heart.

Quick check: What do many similar cells make?
An atom
A tissue *
A whole animal

Quiz: Which is the largest?
Cell
Tissue
Organ *

Summary: Cells make tissues. Tissues make organs. Organs work together so the body can live, grow, and move.

Section title: Why cells are small

Paragraph: Cells stay small so materials can move in and out quickly. If a cell grew too large, the middle would not get food and oxygen fast enough.

Formula: Surface area to volume = surface area ÷ volume

Important: A small cell has more surface for its size, so it can feed itself faster.

Common mistake: A bigger cell is not always a stronger cell. Most living cells stay tiny.

Highlight: You cannot see most cells without a microscope.

Simple words: Cells are small so food can reach every part of the cell quickly.

Quick check: Why are most cells small?
So they can hide
So food and oxygen can move in and out quickly *
So they can make a loud sound

Summary: Remember — a cell is a tiny living unit. Plant and animal cells share a membrane, cytoplasm, and nucleus. Plant cells also have a wall and chloroplasts. Cells join to make tissues, then organs.
`;

function matchLabel(line: string) {
  const trimmed = line.trim();
  for (const item of LABEL_MAP) {
    const m = trimmed.match(item.re);
    if (m) {
      return {
        type: item.type,
        extra: item.extra,
        rest: trimmed.slice(m[0].length).trim(),
      };
    }
  }
  return null;
}

function nonempty(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function parseFlashcard(text: string): { front: string; back: string } {
  const lines = nonempty(text.split('\n'));
  const joined = lines.join('\n');
  const pair = joined.split(/\s*(?:=+|→|—+|–+)\s*/, 2);
  if (pair.length === 2 && pair[0].trim() && pair[1].trim() && !pair[0].includes('\n')) {
    return { front: pair[0].trim(), back: pair[1].trim() };
  }
  const frontLine = lines.find((line) => /^(front|term|word)\s*:/i.test(line));
  const backLine = lines.find((line) => /^(back|meaning|definition)\s*:/i.test(line));
  if (frontLine && backLine) {
    return {
      front: frontLine.replace(/^(front|term|word)\s*:/i, '').trim(),
      back: backLine.replace(/^(back|meaning|definition)\s*:/i, '').trim(),
    };
  }
  if (lines.length >= 2) return { front: lines[0], back: lines.slice(1).join(' ') };
  const colon = lines[0]?.split(/:\s+/, 2);
  if (colon && colon.length === 2) return { front: colon[0].trim(), back: colon[1].trim() };
  return { front: lines[0] || '', back: '' };
}

/** A) 1. (B) [C] or a dash. Avoid [] character classes that webpack treats as empty. */
const OPTION_PREFIX = /^(?:[A-Da-d][).:]|[0-9]+[).:]|[-•]|\([A-Da-d0-9]\)|\[[A-Da-d0-9]\])\s+/;
const OPTION_MARK = /[*✓✔]\s*$/;

function stripOption(line: string) {
  return line
    .replace(OPTION_PREFIX, '')
    .replace(OPTION_MARK, '')
    .replace(/\s*\((correct|right|answer)\)\s*$/i, '')
    .trim();
}

function isOptionLine(line: string) {
  return OPTION_PREFIX.test(line) || OPTION_MARK.test(line);
}

function parseQuiz(text: string, type: 'quick_check' | 'mcq'): TextbookBlock {
  const lines = nonempty(text.split('\n'));
  let explanation = '';
  let marked = -1;
  let named = '';
  const working: string[] = [];
  for (const line of lines) {
    if (/^(explanation|because|why)\s*:/i.test(line)) {
      explanation = line.replace(/^(explanation|because|why)\s*:/i, '').trim();
      continue;
    }
    const answer = line.match(/^(answer|correct|ans)\s*:\s*(.+)$/i);
    if (answer) {
      const value = answer[2].trim();
      const token = value
        .replace(/[().:]/g, '')
        .replace(/\[/g, '')
        .replace(/]/g, '')
        .trim();
      if (/^[A-Da-d]$/.test(token)) marked = token.toUpperCase().charCodeAt(0) - 65;
      else if (/^\d+$/.test(token)) marked = Number(token) - 1;
      else named = value;
      continue;
    }
    working.push(line);
  }
  const optionAt = working.findIndex((line, i) => i > 0 && isOptionLine(line));
  const markedOptions = working.filter((line, i) => i > 0 && isOptionLine(line)).length;
  const splitAtOptions = markedOptions >= 2 && optionAt > 0;
  const question = (splitAtOptions ? working.slice(0, optionAt) : working.slice(0, 1)).join(' ');
  const optionLines = splitAtOptions ? working.slice(optionAt) : working.slice(1);
  const options: string[] = [];
  for (const line of optionLines) {
    if (
      /[*✓✔]\s*$/.test(line) ||
      /\((correct|right|answer)\)\s*$/i.test(line) ||
      /^\*\s+/.test(line)
    ) {
      marked = options.length;
    }
    const textOpt = stripOption(line.replace(/^\*\s+/, ''));
    if (textOpt) options.push(textOpt);
  }
  if (named) {
    const idx = options.findIndex((opt) => opt.toLowerCase() === named.toLowerCase());
    if (idx >= 0) marked = idx;
  }
  return {
    id: newBlockId(type),
    type,
    question,
    options,
    answer: marked >= 0 ? marked : 0,
    explanation: explanation || undefined,
  };
}

function parseList(text: string): string[] {
  return nonempty(text.split('\n'))
    .map((line) =>
      line
        .replace(/^[-•*]+(?:\s+|$)/, '')
        .replace(/^[0-9]+[.)]\s*/, '')
        .trim(),
    )
    .filter(Boolean);
}

function parseImage(text: string): TextbookBlock {
  const raw = text.trim();
  const url = raw.match(/https?:\/\/\S+|\S+\.(png|jpe?g|gif|webp|svg)/i)?.[0] || '';
  const caption = raw
    .replace(url, '')
    .replace(/[|,-]+$/, '')
    .trim();
  return {
    id: newBlockId('image'),
    type: 'image',
    src: url,
    caption: caption || undefined,
    alt_text: caption || undefined,
  };
}

function looksLikeHeading(text: string) {
  const line = text.trim();
  if (!line || line.includes('\n')) return false;
  if (/^#{1,3}\s+\S/.test(line)) return true;
  if (line.length > 80) return false;
  if (/https?:\/\//i.test(line)) return false;
  if (/\s(is|are|was|were|the|and|with|from|that)\s/i.test(line) && /[.!]$/.test(line))
    return false;
  return !/[.!:]$/.test(line) || /^(what|why|how|when|where)\b/i.test(line);
}

function looksLikeList(text: string) {
  const lines = nonempty(text.split('\n'));
  return lines.length >= 2 && lines.every((line) => /^[-•*]\s+\S|^\d+[.)]\s+\S/.test(line));
}

function looksLikeQuiz(text: string) {
  const lines = nonempty(text.split('\n'));
  if (lines.length < 3) return false;
  const optionCount = lines.filter(
    (line, i) => i > 0 && (isOptionLine(line) || line.length < 60),
  ).length;
  return /\?/.test(lines[0]) && optionCount >= 2;
}

function looksLikeTable(text: string) {
  const lines = nonempty(text.split('\n')).filter((line) => !/^\|?[\s:|-]+\|?$/.test(line));
  if (lines.length < 2) return false;
  const widths = lines.map((line) => {
    const cells = line.split(/\t|\s*\|\s*/).map((cell) => cell.trim());
    if (cells[0] === '') cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    return cells.filter(Boolean).length;
  });
  return widths.every((n) => n >= 2) && new Set(widths).size === 1;
}

function looksLikeFlashcard(text: string) {
  const line = text.trim();
  if (line.includes('\n')) {
    const lines = nonempty(line.split('\n'));
    return lines.length === 2 && lines[0].length < 40 && lines[1].length < 160;
  }
  return /^.+\s*(=+|→|—)\s+.+$/.test(line) && line.length < 180;
}

function classifyUnlabeled(text: string): TextbookBlock[] {
  const chunks = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.map((chunk) => typedFromGuess(chunk)).filter(Boolean) as TextbookBlock[];
}

function typedFromGuess(chunk: string): TextbookBlock | null {
  const md = chunk.match(/^#{1,3}\s+(.+)/);
  if (md) {
    const level = Math.min(chunk.replace(/[^#].*$/, '').length, 3) as 1 | 2 | 3;
    return {
      id: newBlockId('heading'),
      type: 'heading',
      level: level === 1 ? 2 : level,
      text: md[1].trim(),
    };
  }
  if (/^(in simple words|simple words)\b/i.test(chunk)) {
    return {
      id: newBlockId('note'),
      type: 'note',
      text: chunk.replace(/^(in simple words|simple words)\s*:?\s*/i, '').trim(),
    };
  }
  if (/^(summary|remember)\b/i.test(chunk)) {
    return {
      id: newBlockId('summary'),
      type: 'summary',
      text: chunk.replace(/^(summary|remember)\s*:?\s*/i, '').trim(),
    };
  }
  if (/^```/m.test(chunk)) {
    const code = chunk.replace(/^```[a-z0-9_-]*\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const lang = chunk.match(/^```([a-z0-9_-]+)/i)?.[1];
    return { id: newBlockId('code'), type: 'code', text: code, language: lang };
  }
  if (looksLikeQuiz(chunk)) return parseQuiz(chunk, 'quick_check');
  if (looksLikeTable(chunk)) {
    return { id: newBlockId('table'), type: 'table', rows: parseTableText(chunk) };
  }
  if (looksLikeList(chunk))
    return { id: newBlockId('list'), type: 'list', items: parseList(chunk) };
  if (looksLikeFlashcard(chunk)) {
    const { front, back } = parseFlashcard(chunk);
    return { id: newBlockId('flashcard'), type: 'flashcard', front, back };
  }
  if (looksLikeHeading(chunk)) {
    return {
      id: newBlockId('heading'),
      type: 'heading',
      level: 2,
      text: chunk.replace(/^#+\s*/, ''),
    };
  }
  return { id: newBlockId('paragraph'), type: 'paragraph', text: chunk.replace(/\s*\n\s*/g, ' ') };
}

function parseTyped(
  type: TextbookBlockType,
  text: string,
  extra?: Partial<TextbookBlock>,
): TextbookBlock | null {
  const body = text.trim();
  if (!body && type !== 'image' && type !== 'toc' && type !== 'split' && type !== 'table')
    return null;
  if (type === 'heading') {
    return {
      id: newBlockId('heading'),
      type,
      level: extra?.level === 1 ? 1 : extra?.level === 3 ? 3 : 2,
      text: nonempty(body.split('\n'))[0] || body,
    };
  }
  if (
    type === 'paragraph' ||
    type === 'note' ||
    type === 'summary' ||
    type === 'callout' ||
    type === 'important' ||
    type === 'definition' ||
    type === 'example' ||
    type === 'common_mistake' ||
    type === 'formula' ||
    type === 'code'
  ) {
    return { id: newBlockId(type), type, text: body, language: extra?.language };
  }
  if (type === 'list') {
    return {
      id: newBlockId('list'),
      type,
      ordered: extra?.ordered === true,
      items: parseList(body),
    };
  }
  if (type === 'toc') return { id: newBlockId('toc'), type, items: parseList(body) };
  if (type === 'table') {
    const lines = nonempty(body.split('\n'));
    const captionLine = lines.find((line) => /^(caption|title)\s*:/i.test(line));
    const rest = lines.filter((line) => !/^(caption|title)\s*:/i.test(line)).join('\n');
    return {
      id: newBlockId('table'),
      type,
      rows: parseTableText(rest || body),
      caption: captionLine ? captionLine.replace(/^(caption|title)\s*:/i, '').trim() : undefined,
    };
  }
  if (type === 'image') return parseImage(body);
  if (type === 'split') {
    const picture = parseImage(body);
    const textOnly = body
      .replace(picture.src || '', '')
      .replace(/[|,-]+$/, '')
      .trim();
    return {
      id: newBlockId('split'),
      type,
      text: textOnly || body,
      src: picture.src || undefined,
      caption: picture.caption || undefined,
      alt_text: picture.alt_text || undefined,
    };
  }
  if (type === 'flashcard') {
    const { front, back } = parseFlashcard(body);
    return { id: newBlockId('flashcard'), type, front, back };
  }
  if (type === 'quick_check' || type === 'mcq') return parseQuiz(body, type);
  return { id: newBlockId('paragraph'), type: 'paragraph', text: body };
}

export function parseChapterPaste(raw: string): TextbookBlock[] {
  const text = String(raw || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!text) return [];
  if (/<(p|h[1-3]|ul|ol|div|details|aside|article|table)\b/i.test(text)) {
    return htmlToJson(text, { id: 'paste', title: 'Chapter' }).chapter.blocks;
  }

  const lines = text.split('\n');
  const segments: {
    type: TextbookBlockType | null;
    extra?: Partial<TextbookBlock>;
    lines: string[];
  }[] = [];
  let current: {
    type: TextbookBlockType | null;
    extra?: Partial<TextbookBlock>;
    lines: string[];
  } = { type: null, lines: [] };
  const push = () => {
    if (current.lines.some((line) => line.trim()) || current.type) segments.push(current);
    current = { type: null, lines: [] };
  };

  for (const line of lines) {
    const labeled = matchLabel(line);
    if (labeled) {
      push();
      current = {
        type: labeled.type,
        extra: labeled.extra,
        lines: labeled.rest ? [labeled.rest] : [],
      };
    } else {
      current.lines.push(line);
    }
  }
  push();

  const blocks: TextbookBlock[] = [];
  for (const segment of segments) {
    const body = segment.lines.join('\n').trim();
    if (segment.type) {
      const block = parseTyped(segment.type, body, segment.extra);
      if (block) blocks.push(block);
    } else if (body) {
      blocks.push(...classifyUnlabeled(body));
    }
  }
  return blocks;
}

export function retargetBlock(block: TextbookBlock, type: TextbookBlockType): TextbookBlock {
  if (block.type === type) return block;
  const text =
    block.text ||
    block.question ||
    [block.front, block.back].filter(Boolean).join(' = ') ||
    (block.items || []).join('\n') ||
    (block.rows || []).map((row) => row.join(' | ')).join('\n') ||
    block.caption ||
    '';
  const converted = parseTyped(type, text, {
    level: type === 'heading' ? block.level : undefined,
    ordered: type === 'list' ? block.ordered : undefined,
  }) || {
    id: block.id,
    type,
    text,
    front: block.front,
    back: block.back,
    question: block.question,
    options: block.options,
    answer: block.answer,
    items: block.items,
    src: block.src,
    caption: block.caption,
  };
  return {
    ...converted,
    id: block.id,
    type,
    src: converted.src || block.src,
    caption: converted.caption || block.caption,
    alt_text: converted.alt_text || block.alt_text,
    items:
      (converted.items && converted.items.some(Boolean) ? converted.items : block.items) ||
      converted.items,
    rows: converted.rows?.length ? converted.rows : block.rows,
  };
}

export function describeDetected(blocks: TextbookBlock[]) {
  const counts: Record<string, number> = {};
  for (const block of blocks) {
    const key = block.type;
    counts[key] = (counts[key] || 0) + 1;
  }
  const names: Record<string, string> = {
    heading: 'section title',
    paragraph: 'paragraph',
    list: 'list',
    image: 'picture',
    split: 'text and picture',
    toc: 'table of contents',
    table: 'table',
    note: 'simple words',
    flashcard: 'flashcard',
    quick_check: 'quick check',
    mcq: 'quiz',
    summary: 'summary',
    definition: 'definition',
    example: 'example',
    important: 'important',
    common_mistake: 'common mistake',
    callout: 'highlight',
    formula: 'formula',
    code: 'code block',
  };
  return Object.entries(counts)
    .map(([type, n]) => `${n} ${names[type] || type}${n === 1 ? '' : 's'}`)
    .join(', ');
}
