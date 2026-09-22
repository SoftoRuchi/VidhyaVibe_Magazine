export type CourseInteractiveVisual =
  | { type: 'diagram'; kind: string }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'html'; html: string }
  | { type: 'none' };

export type CourseInteractiveItem = {
  id: string;
  label: string;
  topic?: string;
  explanation: string;
  visual: CourseInteractiveVisual;
  aliases?: string[];
};

type TextbookLike = {
  chapter?: {
    title?: string;
    blocks?: Array<{
      id?: string;
      type?: string;
      text?: string;
      title?: string;
      label?: string;
      explanation?: string;
      front?: string;
      back?: string;
      src?: string;
      alt_text?: string;
      visual?: string | CourseInteractiveVisual;
      visualKind?: string;
      kind?: string;
      items?: string[];
    }>;
    interactives?: CourseInteractiveItem[];
  };
  interactives?: CourseInteractiveItem[];
};

const SET_PACK: CourseInteractiveItem[] = [
  {
    id: 'set-union',
    label: 'Union',
    topic: 'Set operations',
    aliases: ['A ∪ B', 'A U B', 'union of sets'],
    explanation:
      'The union of two sets A and B is the set of all elements that belong to A, or to B, or to both. Symbol: A ∪ B.',
    visual: { type: 'diagram', kind: 'venn-union' },
  },
  {
    id: 'set-intersection',
    label: 'Intersection',
    topic: 'Set operations',
    aliases: ['A ∩ B', 'A n B', 'intersection of sets'],
    explanation:
      'The intersection of two sets A and B is the set of elements that belong to both A and B. Symbol: A ∩ B.',
    visual: { type: 'diagram', kind: 'venn-intersection' },
  },
  {
    id: 'set-difference',
    label: 'Difference',
    topic: 'Set operations',
    aliases: ['A − B', 'A - B', 'A \\ B', 'set difference'],
    explanation: 'The difference A − B contains elements that are in A but not in B.',
    visual: { type: 'diagram', kind: 'venn-difference' },
  },
  {
    id: 'set-complement',
    label: 'Complement',
    topic: 'Set operations',
    aliases: ["A'", 'Aᶜ', 'A c', 'complement of a set'],
    explanation:
      'The complement of A (relative to universal set U) contains every element of U that is not in A.',
    visual: { type: 'diagram', kind: 'venn-complement' },
  },
  {
    id: 'set-symmetric-difference',
    label: 'Symmetric Difference',
    topic: 'Set operations',
    aliases: ['A Δ B', 'A ⊕ B', 'symmetric difference'],
    explanation:
      'The symmetric difference of A and B contains elements in A or B but not in both. It equals (A − B) ∪ (B − A).',
    visual: { type: 'diagram', kind: 'venn-symmetric' },
  },
  {
    id: 'set-subset',
    label: 'Subset',
    topic: 'Set relations',
    aliases: ['A ⊆ B', 'subset', 'proper subset', 'A ⊂ B'],
    explanation: 'A is a subset of B if every element of A is also an element of B. Written A ⊆ B.',
    visual: { type: 'diagram', kind: 'venn-subset' },
  },
];

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function asVisual(raw: unknown, fallbackKind?: string): CourseInteractiveVisual {
  if (raw && typeof raw === 'object' && 'type' in (raw as object)) {
    return raw as CourseInteractiveVisual;
  }
  if (typeof raw === 'string' && raw.trim()) {
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
      return { type: 'image', src: raw.trim() };
    }
    return { type: 'diagram', kind: raw.trim() };
  }
  if (fallbackKind) return { type: 'diagram', kind: fallbackKind };
  return { type: 'none' };
}

function fromExplicitBlock(
  block: NonNullable<TextbookLike['chapter']>['blocks'] extends (infer B)[] | undefined ? B : never,
): CourseInteractiveItem | null {
  if (!block) return null;
  const type = String(block.type || '').toLowerCase();
  if (type !== 'interactive' && type !== 'concept' && type !== 'diagram') return null;
  const label = String(block.label || block.title || block.front || '').trim();
  const explanation = String(block.explanation || block.back || block.text || '').trim();
  if (!label || !explanation) return null;
  return {
    id: String(block.id || `ix-${slugify(label)}`),
    label,
    topic: block.kind || undefined,
    explanation,
    visual: asVisual(block.visual || block.src, block.visualKind || block.kind),
    aliases: Array.isArray(block.items) ? block.items.map(String) : undefined,
  };
}

function fromCallout(block: {
  id?: string;
  type?: string;
  text?: string;
  title?: string;
}): CourseInteractiveItem | null {
  const type = String(block.type || '').toLowerCase();
  if (!['definition', 'example', 'important', 'summary'].includes(type)) return null;
  const text = String(block.text || '').trim();
  if (text.length < 24) return null;
  const title =
    String(block.title || '').trim() ||
    text
      .split(/[.:—-]/)[0]
      .trim()
      .slice(0, 48) ||
    type;
  if (title.length < 2) return null;
  return {
    id: String(block.id || `callout-${slugify(title)}`),
    label: title,
    topic: type.replace('_', ' '),
    explanation: text,
    visual: { type: 'none' },
  };
}

function chapterLooksLikeSets(title: string, html: string) {
  const hay = `${title}\n${html}`.toLowerCase();
  return (
    /\bset theory\b/.test(hay) ||
    /\bprinciples of set\b/.test(hay) ||
    (/\bunion\b/.test(hay) && /\bintersection\b/.test(hay) && /\bset\b/.test(hay))
  );
}

/** Build chapter interactives from JSON / HTML. Works for any subject. */
export function buildCourseInteractives(opts: {
  contentJson?: TextbookLike | null;
  html?: string;
  chapterTitle?: string;
  subjectTitle?: string;
}): CourseInteractiveItem[] {
  const doc = opts.contentJson || {};
  const chapter = doc.chapter || {};
  const explicit = [
    ...((doc.interactives || []) as CourseInteractiveItem[]),
    ...((chapter.interactives || []) as CourseInteractiveItem[]),
  ].filter((item) => item?.label && item?.explanation);

  const fromBlocks = (chapter.blocks || [])
    .map((block) => fromExplicitBlock(block))
    .filter(Boolean) as CourseInteractiveItem[];

  const callouts = (chapter.blocks || [])
    .map((block) => fromCallout(block))
    .filter(Boolean) as CourseInteractiveItem[];

  const pack = chapterLooksLikeSets(
    `${opts.chapterTitle || ''} ${opts.subjectTitle || ''} ${chapter.title || ''}`,
    opts.html || '',
  )
    ? SET_PACK
    : [];

  const merged: CourseInteractiveItem[] = [];
  const seen = new Set<string>();
  for (const item of [...explicit, ...fromBlocks, ...pack, ...callouts]) {
    const key = item.id || slugify(item.label);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...item, id: key });
    if (merged.length >= 24) break;
  }
  return merged;
}

export function matchInteractive(
  items: CourseInteractiveItem[],
  query: string,
): CourseInteractiveItem | null {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return null;
  return (
    items.find((item) => item.label.toLowerCase() === q) ||
    items.find((item) => (item.aliases || []).some((a) => a.toLowerCase() === q)) ||
    items.find(
      (item) => item.label.toLowerCase().includes(q) || q.includes(item.label.toLowerCase()),
    ) ||
    items.find((item) =>
      (item.aliases || []).some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase())),
    ) ||
    null
  );
}

/** Wrap concept labels in chapter HTML so they become clickable hotspots. */
export function injectConceptHotspots(html: string, items: CourseInteractiveItem[]) {
  if (!html || !items.length) return html;
  const labels = items
    .flatMap((item) =>
      [item.label, ...(item.aliases || [])].map((label) => ({ id: item.id, label })),
    )
    .filter((row) => row.label && row.label.length >= 3)
    .sort((a, b) => b.label.length - a.label.length);

  const parts = String(html).split(/(<[^>]+>)/g);
  let remaining = 40;
  return parts
    .map((part) => {
      if (!part || part.startsWith('<') || remaining <= 0) return part;
      let next = part;
      for (const row of labels) {
        if (remaining <= 0) break;
        const escaped = row.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(^|[^\\w])(${escaped})(?=[^\\w]|$)`, 'i');
        if (!re.test(next)) continue;
        next = next.replace(re, (_m, before, hit) => {
          remaining -= 1;
          return `${before}<button type="button" class="course-concept-hot" data-concept-id="${row.id}">${hit}</button>`;
        });
      }
      return next;
    })
    .join('');
}
