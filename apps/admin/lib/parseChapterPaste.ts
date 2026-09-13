import {
  htmlToJson,
  newBlockId,
  type TextbookBlock,
  type TextbookBlockType,
} from './textbookContent';

const LABEL_MAP: { re: RegExp; type: TextbookBlockType }[] = [
  { re: /^(section title|section|heading|title)\s*:\s*/i, type: 'heading' },
  { re: /^(paragraph|para|text)\s*:\s*/i, type: 'paragraph' },
  { re: /^(list|bullets?|points?)\s*:\s*/i, type: 'list' },
  { re: /^(picture|image|photo|figure)\s*:\s*/i, type: 'image' },
  { re: /^(in simple words|simple words|easy words)\s*:\s*/i, type: 'note' },
  { re: /^(flash\s*card|card)\s*:\s*/i, type: 'flashcard' },
  { re: /^(quick\s*check)\s*:\s*/i, type: 'quick_check' },
  { re: /^(quiz|mcq)\s*:\s*/i, type: 'mcq' },
  { re: /^(summary|remember|highlight)\s*:\s*/i, type: 'summary' },
];

export const CHAPTER_PASTE_EXAMPLE = `Section title: What is a cell?

Paragraph: Every living thing is made of cells. A cell is the smallest unit that can carry out life processes on its own.

Simple words: A cell is like a tiny room. Each room has a job.

Flashcard: Cell = The smallest living unit of an organism.

Section title: Parts of a cell

Paragraph: Most plant and animal cells have a membrane, cytoplasm, and a nucleus. Plant cells also have a cell wall and chloroplasts.

List:
Cell membrane
Cytoplasm
Nucleus

Picture: Simple diagram of a plant cell

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

function matchLabel(line: string) {
  const trimmed = line.trim();
  for (const item of LABEL_MAP) {
    const m = trimmed.match(item.re);
    if (m) return { type: item.type, rest: trimmed.slice(m[0].length).trim() };
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

function stripOption(line: string) {
  return line
    .replace(/^(?:[[(]?[A-Da-d0-9][]).:]|\d+[]).:]|[-•])\s+/, '')
    .replace(/\s*[*✓✔]\s*$/, '')
    .replace(/\s*\((correct|right|answer)\)\s*$/i, '')
    .trim();
}

function isOptionLine(line: string) {
  return /^(?:[[(]?[A-Da-d][]).:]|\d+[]).:]|[-•])\s+\S/.test(line) || /[*✓✔]\s*$/.test(line);
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
      const letter = value.match(/^[[(]?([A-Da-d])[]).:]?$/);
      if (letter) marked = letter[1].toUpperCase().charCodeAt(0) - 65;
      else if (/^\d+$/.test(value)) marked = Number(value) - 1;
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
    .map((line) => line.replace(/^[-•*\d.)\]]+\s*/, '').trim())
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
  if (looksLikeQuiz(chunk)) return parseQuiz(chunk, 'quick_check');
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

function parseTyped(type: TextbookBlockType, text: string): TextbookBlock | null {
  const body = text.trim();
  if (!body && type !== 'image') return null;
  if (type === 'heading') {
    return {
      id: newBlockId('heading'),
      type,
      level: 2,
      text: nonempty(body.split('\n'))[0] || body,
    };
  }
  if (type === 'paragraph' || type === 'note' || type === 'summary') {
    return { id: newBlockId(type), type, text: body };
  }
  if (type === 'list') return { id: newBlockId('list'), type, items: parseList(body) };
  if (type === 'image') return parseImage(body);
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
  if (/<(p|h[1-3]|ul|ol|div|details|aside|article)\b/i.test(text)) {
    return htmlToJson(text, { id: 'paste', title: 'Chapter' }).chapter.blocks;
  }

  const lines = text.split('\n');
  const segments: { type: TextbookBlockType | null; lines: string[] }[] = [];
  let current: { type: TextbookBlockType | null; lines: string[] } = { type: null, lines: [] };
  const push = () => {
    if (current.lines.some((line) => line.trim()) || current.type) segments.push(current);
    current = { type: null, lines: [] };
  };

  for (const line of lines) {
    const labeled = matchLabel(line);
    if (labeled) {
      push();
      current = { type: labeled.type, lines: labeled.rest ? [labeled.rest] : [] };
    } else {
      current.lines.push(line);
    }
  }
  push();

  const blocks: TextbookBlock[] = [];
  for (const segment of segments) {
    const body = segment.lines.join('\n').trim();
    if (segment.type) {
      const block = parseTyped(segment.type, body);
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
    block.caption ||
    '';
  const converted = parseTyped(type, text) || {
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
  return { ...converted, id: block.id, type };
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
    note: 'simple words',
    flashcard: 'flashcard',
    quick_check: 'quick check',
    mcq: 'quiz',
    summary: 'summary',
  };
  return Object.entries(counts)
    .map(([type, n]) => `${n} ${names[type] || type}${n === 1 ? '' : 's'}`)
    .join(', ');
}
