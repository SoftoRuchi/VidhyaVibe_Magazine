'use client';

import React from 'react';
import { uploadCourseNoteImage } from '../lib/coursesApi';

const EMPTY_DOC = '<p><br></p>';
const SAVE_MS = 700;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value);
}

function plainToHtml(value: string) {
  const parts = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!parts.length) return EMPTY_DOC;
  return parts.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

export function notesToHtml(
  notes: { content: string; quote?: string | null; pageNumber?: number | null }[],
) {
  if (!notes.length) return EMPTY_DOC;
  return (
    notes
      .map((note) => {
        const quote = note.quote
          ? `<blockquote>“${escapeHtml(String(note.quote))}”</blockquote>`
          : '';
        const page =
          note.pageNumber != null
            ? `<p class="word-note-page">Page ${Number(note.pageNumber)}</p>`
            : '';
        const body = looksLikeHtml(note.content)
          ? note.content
          : plainToHtml(note.content);
        return `${page}${quote}${body}`;
      })
      .join('') || EMPTY_DOC
  );
}

function sanitizeStyle(style: string): string {
  if (!style) return '';
  const kept: string[] = [];
  const parts = style.split(';');
  for (const part of parts) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const val = part.slice(colon + 1).trim();
    if (!val || /javascript:|expression\(|url\(/i.test(val)) continue;

    if (prop === 'text-align' && /^(left|center|right|justify)$/i.test(val)) {
      kept.push(`text-align: ${val.toLowerCase()}`);
    } else if (prop === 'margin-left' && /^(\d+(\.\d+)?(px|em|rem)?|auto)$/i.test(val)) {
      kept.push(`margin-left: ${val}`);
    } else if (prop === 'color' && /^#([0-9a-f]{3,8})|rgb\([^)]+\)|rgba\([^)]+\)|[a-z]+$/i.test(val)) {
      kept.push(`color: ${val}`);
    } else if (
      (prop === 'background-color' || prop === 'background') &&
      /^#([0-9a-f]{3,8})|rgb\([^)]+\)|rgba\([^)]+\)|transparent|[a-z]+$/i.test(val)
    ) {
      kept.push(`background-color: ${val}`);
    } else if (
      prop === 'list-style-type' &&
      /^(disc|circle|square|decimal|lower-alpha|upper-alpha|lower-roman|upper-roman|none)$/i.test(val)
    ) {
      kept.push(`list-style-type: ${val}`);
    } else if (
      ['width', 'height', 'max-width', 'max-height'].includes(prop) &&
      /^(\d+(\.\d+)?(px|%|em|rem)?|auto)$/i.test(val)
    ) {
      kept.push(`${prop}: ${val}`);
    } else if (prop === 'border-radius' && /^\d+(px|%)?$/i.test(val)) {
      kept.push(`border-radius: ${val}`);
    } else if (
      prop === 'font-size' &&
      /^(\d+(\.\d+)?(px|pt|em|rem|%)?|small|medium|large|x-large|xx-large)$/i.test(val)
    ) {
      kept.push(`font-size: ${val}`);
    } else if (
      prop === 'line-height' &&
      /^(\d+(\.\d+)?(px|em|rem|%)?|normal)$/i.test(val)
    ) {
      kept.push(`line-height: ${val}`);
    } else if (prop === 'display' && /^(block|inline-block|inline|flex)$/i.test(val)) {
      kept.push(`display: ${val}`);
    } else if (prop === 'float' && /^(left|right|none)$/i.test(val)) {
      kept.push(`float: ${val.toLowerCase()}`);
    } else if (prop === 'clear' && /^(left|right|both|none)$/i.test(val)) {
      kept.push(`clear: ${val.toLowerCase()}`);
    } else if (prop === 'margin' && /^[\d\s\w.%-]+$/i.test(val)) {
      kept.push(`margin: ${val}`);
    } else if (
      ['margin-top', 'margin-right', 'margin-bottom'].includes(prop) &&
      /^(\d+(\.\d+)?(px|em|rem)?|auto)$/i.test(val)
    ) {
      kept.push(`${prop}: ${val}`);
    } else if (prop === 'box-shadow') {
      kept.push(`box-shadow: ${val}`);
    }
  }
  return kept.join('; ');
}

function sanitizeNoteHtml(html: string) {
  if (typeof window === 'undefined') return html || EMPTY_DOC;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const allowed = new Set([
    'P',
    'BR',
    'DIV',
    'SPAN',
    'BLOCKQUOTE',
    'STRONG',
    'B',
    'EM',
    'I',
    'U',
    'S',
    'STRIKE',
    'UL',
    'OL',
    'LI',
    'H1',
    'H2',
    'H3',
    'H4',
    'IMG',
    'FONT',
    'MARK',
    'INPUT',
    'A',
    'FIGURE',
    'FIGCAPTION',
  ]);

  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'IFRAME') {
        node.removeChild(el);
        return;
      }
      if (!allowed.has(el.tagName)) {
        while (el.firstChild) node.insertBefore(el.firstChild, el);
        node.removeChild(el);
        walk(node);
        return;
      }

      // Convert <font color="..."> to <span style="color: ...">
      if (el.tagName === 'FONT') {
        const color = el.getAttribute('color');
        const span = doc.createElement('span');
        if (color) span.setAttribute('style', `color: ${color}`);
        while (el.firstChild) span.appendChild(el.firstChild);
        node.replaceChild(span, el);
        walk(span);
        return;
      }

      // Handle INPUT (only checkbox allowed)
      if (el.tagName === 'INPUT') {
        if (el.getAttribute('type') === 'checkbox') {
          el.setAttribute('type', 'checkbox');
          if ((el as HTMLInputElement).checked || el.hasAttribute('checked')) {
            el.setAttribute('checked', 'checked');
          } else {
            el.removeAttribute('checked');
          }
        } else {
          node.removeChild(el);
          return;
        }
      }

      Array.from(el.attributes).forEach((attr) => {
        if (attr.name === 'style') {
          const cleaned = sanitizeStyle(el.getAttribute('style') || '');
          if (cleaned) el.setAttribute('style', cleaned);
          else el.removeAttribute('style');
          return;
        }
        if (attr.name === 'class') {
          const allowedClasses = [
            'word-note-page',
            'word-notes-task-list',
            'word-notes-task-item',
            'is-checked',
            'word-note-image',
            'is-active-img',
            'word-notes-clear',
          ];
          const classes = (el.getAttribute('class') || '')
            .split(/\s+/)
            .filter((c) => allowedClasses.includes(c));
          if (classes.length) el.setAttribute('class', classes.join(' '));
          else el.removeAttribute('class');
          return;
        }
        if (el.tagName === 'IMG') {
          if (attr.name === 'src') {
            const src = el.getAttribute('src') || '';
            if (/^(https?:\/\/|\/api\/|data:image\/|blob:)/i.test(src)) {
              return;
            }
          }
          if (['alt', 'title', 'width', 'height'].includes(attr.name)) return;
        }
        if (el.tagName === 'OL' && ['type', 'start'].includes(attr.name)) return;
        if (el.tagName === 'INPUT' && ['type', 'checked'].includes(attr.name)) return;
        if (el.tagName === 'A' && attr.name === 'href') {
          const href = el.getAttribute('href') || '';
          if (/^(https?:\/\/|mailto:)/i.test(href)) {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
            return;
          }
        }
        el.removeAttribute(attr.name);
      });
      walk(el);
    });
  };

  const root = doc.body.firstElementChild || doc.body;
  walk(root);
  const out = (root as HTMLElement).innerHTML.replace(/\u00a0/g, ' ').trim();
  return out || EMPTY_DOC;
}

function isBlankHtml(html: string) {
  if (/<img\b[^>]*>/i.test(html)) return false;
  const text = sanitizeNoteHtml(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return !text;
}

function compressImageFile(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(e.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(format, quality));
      };
      img.onerror = () => resolve(String(e.target?.result || ''));
      img.src = String(e.target?.result || '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function pickPrimaryId(notes: { id: number }[]) {
  if (!notes.length) return null;
  return [...notes].sort((a, b) => a.id - b.id)[0].id;
}

const TEXT_COLORS = [
  { label: 'Black', value: '#201f1e' },
  { label: 'Slate Gray', value: '#605e5c' },
  { label: 'Royal Blue', value: '#0078d4' },
  { label: 'Navy Blue', value: '#004e8c' },
  { label: 'Emerald Green', value: '#107c10' },
  { label: 'Forest Green', value: '#2d7a3e' },
  { label: 'Crimson Red', value: '#d13438' },
  { label: 'Dark Crimson', value: '#a80000' },
  { label: 'Warm Orange', value: '#ca5010' },
  { label: 'Amber Gold', value: '#b27d00' },
  { label: 'Vidhya Purple', value: '#7719aa' },
  { label: 'Deep Purple', value: '#5c2e91' },
  { label: 'Teal', value: '#038387' },
  { label: 'Magenta', value: '#c239b3' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fff59d', bg: '#fff59d', text: '#201f1e' },
  { label: 'Green', value: '#c8e6c9', bg: '#c8e6c9', text: '#201f1e' },
  { label: 'Cyan', value: '#b3e5fc', bg: '#b3e5fc', text: '#201f1e' },
  { label: 'Pink', value: '#f8bbd0', bg: '#f8bbd0', text: '#201f1e' },
  { label: 'Orange', value: '#ffe0b2', bg: '#ffe0b2', text: '#201f1e' },
  { label: 'Purple', value: '#e1bee7', bg: '#e1bee7', text: '#201f1e' },
];

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type MenuType = 'color' | 'highlight' | 'bullet' | 'number' | 'size' | null;

const FONT_SIZES = [
  { size: 12, label: '12', desc: 'Small' },
  { size: 14, label: '14', desc: 'Compact' },
  { size: 16, label: '16', desc: 'Normal' },
  { size: 18, label: '18', desc: 'Medium' },
  { size: 20, label: '20', desc: 'Large' },
  { size: 24, label: '24', desc: 'Heading 2' },
  { size: 28, label: '28', desc: 'Heading 1' },
  { size: 32, label: '32', desc: 'Title' },
  { size: 36, label: '36', desc: 'Extra Large' },
];

export default function WordNotesEditor({
  notes,
  quote = '',
  onQuoteChange,
  compact = false,
  onSave,
  onUpdate,
  onDelete,
}: {
  notes: { id: number; content: string; quote?: string | null; pageNumber?: number | null }[];
  quote?: string;
  onQuoteChange?: (value: string) => void;
  compact?: boolean;
  onSave: (content: string, quote?: string) => Promise<{ id: number } | void>;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const paperRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const docIdRef = React.useRef<number | null>(pickPrimaryId(notes));
  const extraIdsRef = React.useRef<number[]>(
    notes.filter((note) => note.id !== docIdRef.current).map((note) => note.id),
  );
  const htmlRef = React.useRef(notesToHtml(notes));
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingRef = React.useRef<Promise<number | null> | null>(null);
  const savedRangeRef = React.useRef<Range | null>(null);

  const [status, setStatus] = React.useState<SaveStatus>(notes.length ? 'saved' : 'idle');
  const [blank, setBlank] = React.useState(() => isBlankHtml(notesToHtml(notes)));
  const [formats, setFormats] = React.useState({ bold: false, italic: false, underline: false });

  // Custom toolbar state
  const [textColor, setTextColor] = React.useState('#201f1e');
  const [highlightColor, setHighlightColor] = React.useState('#fff59d');
  const [currentFontSize, setCurrentFontSize] = React.useState<number>(16);
  const [openMenu, setOpenMenu] = React.useState<MenuType>(null);

  // Image modal state
  const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);
  const [imageTab, setImageTab] = React.useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = React.useState<string>('');
  const [urlInput, setUrlInput] = React.useState('');
  const [imgAlt, setImgAlt] = React.useState('');
  const [imgWidth, setImgWidth] = React.useState<number>(45);
  const [imgAlign, setImgAlign] = React.useState<'left' | 'center' | 'right'>('left');
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Floating image controls in editor
  const [selectedImg, setSelectedImg] = React.useState<HTMLImageElement | null>(null);
  const [imgToolbarPos, setImgToolbarPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const saveRef = React.useRef(onSave);
  const updateRef = React.useRef(onUpdate);
  const deleteRef = React.useRef(onDelete);
  saveRef.current = onSave;
  updateRef.current = onUpdate;
  deleteRef.current = onDelete;

  // Selection save/restore helpers
  const saveSelection = React.useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = React.useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  // Close menus when clicking outside
  React.useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setSelectedImg(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (!quote.trim() || !editorRef.current) return;
    const block = document.createElement('blockquote');
    block.textContent = `“${quote.trim()}”`;
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (sel?.rangeCount && editor.contains(sel.anchorNode)) {
      sel.getRangeAt(0).insertNode(block);
    } else {
      editor.appendChild(block);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      editor.appendChild(p);
    }
    onQuoteChange?.('');
    scheduleSave();
  }, [quote]);

  const readHtml = () => sanitizeNoteHtml(editorRef.current?.innerHTML || '');

  const persist = React.useCallback(async () => {
    const html = readHtml();
    htmlRef.current = html;
    setBlank(isBlankHtml(html));
    if (isBlankHtml(html) && !docIdRef.current) {
      setStatus('idle');
      return;
    }
    setStatus('saving');
    try {
      const existed = Boolean(docIdRef.current);
      if (!docIdRef.current) {
        if (!creatingRef.current) {
          creatingRef.current = saveRef
            .current(html)
            .then((created) => {
              const id =
                created && typeof created === 'object' ? Number((created as { id?: number }).id) : null;
              if (id) docIdRef.current = id;
              return id;
            })
            .finally(() => {
              creatingRef.current = null;
            });
        }
        await creatingRef.current;
      }
      if (docIdRef.current) {
        const latest = readHtml();
        htmlRef.current = latest;
        if (existed || latest !== html) {
          await updateRef.current(docIdRef.current, latest);
        }
        const extras = extraIdsRef.current;
        const remove = deleteRef.current;
        if (extras.length && remove) {
          extraIdsRef.current = [];
          await Promise.all(extras.map((id) => remove(id).catch(() => undefined)));
        }
      }
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, []);

  const scheduleSave = React.useCallback(() => {
    setBlank(isBlankHtml(editorRef.current?.innerHTML || ''));
    setStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist();
    }, SAVE_MS);
  }, [persist]);

  React.useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = sanitizeNoteHtml(htmlRef.current);

    // Normalize any legacy images in loaded note to ensure text wrapping works
    const imgs = Array.from(el.querySelectorAll('img'));
    let changed = false;
    imgs.forEach((img) => {
      const isCentered =
        (img.style.margin?.includes('auto') || img.parentElement?.style.textAlign === 'center') &&
        (img.style.float === 'none' || !img.style.float);
      if (!isCentered) {
        if (!img.style.float || img.style.float === 'none') {
          img.style.float = 'left';
          img.style.display = 'inline-block';
          img.style.clear = 'none';
          img.style.margin = '6px 20px 14px 0';
          changed = true;
        }
        const widthVal = parseInt(img.style.width || '100', 10);
        if (widthVal >= 65 || !img.style.width || img.style.width === '100%') {
          img.style.width = '45%';
          changed = true;
        }
        if (img.parentElement && img.parentElement !== el) {
          img.parentElement.style.clear = 'none';
        }
        if (!img.nextSibling && !img.previousSibling) {
          img.parentNode?.appendChild(document.createTextNode('\u00a0'));
          changed = true;
        }
      }
    });
    if (changed) scheduleSave();
  }, [persist, scheduleSave]);

  React.useEffect(() => {
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void persist();
      }
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
      flush();
    };
  }, [persist]);

  const syncFormats = () => {
    saveSelection();
    try {
      setFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const el =
          sel.anchorNode.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as HTMLElement)
            : sel.anchorNode.parentElement;
        if (el && editorRef.current?.contains(el)) {
          const computed = window.getComputedStyle(el).fontSize;
          const parsed = parseInt(computed, 10);
          if (parsed && !isNaN(parsed)) {
            setCurrentFontSize(parsed);
          }
        }
      }
    } catch {
      /* ignore */
    }
  };

  const run = (command: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false);
    scheduleSave();
    syncFormats();
  };

  const toggleMenu = (menu: MenuType) => {
    saveSelection();
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  // Font size action
  const applyFontSize = (sizePx: number) => {
    editorRef.current?.focus();
    restoreSelection();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = `${sizePx}px`;
      span.innerHTML = '&#8203;';
      range.insertNode(span);
      range.selectNodeContents(span);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('fontSize', false, '7');
      const fontEls = editorRef.current?.querySelectorAll('font[size="7"]');
      fontEls?.forEach((font) => {
        const span = document.createElement('span');
        span.style.fontSize = `${sizePx}px`;
        while (font.firstChild) {
          span.appendChild(font.firstChild);
        }
        font.parentNode?.replaceChild(span, font);
      });
    }

    setCurrentFontSize(sizePx);
    setOpenMenu(null);
    scheduleSave();
    syncFormats();
  };

  // Text color action
  const applyTextColor = (color: string) => {
    editorRef.current?.focus();
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      // ignore
    }
    document.execCommand('foreColor', false, color);
    setTextColor(color);
    setOpenMenu(null);
    scheduleSave();
    syncFormats();
  };

  // Highlighter action
  const applyHighlightColor = (color: string) => {
    editorRef.current?.focus();
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      // ignore
    }
    if (color === 'transparent') {
      try {
        document.execCommand('hiliteColor', false, 'transparent');
      } catch {
        try {
          document.execCommand('backColor', false, 'transparent');
        } catch {
          // ignore
        }
      }
    } else {
      try {
        document.execCommand('hiliteColor', false, color);
      } catch {
        try {
          document.execCommand('backColor', false, color);
        } catch {
          // ignore
        }
      }
      setHighlightColor(color);
    }
    setOpenMenu(null);
    scheduleSave();
    syncFormats();
  };

  // List actions (Bullet / Numbered with styles)
  const applyList = (type: 'unordered' | 'ordered', listStyle?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    const command = type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);
    if (listStyle) {
      const sel = window.getSelection();
      if (sel?.anchorNode) {
        const parent = (sel.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : sel.anchorNode.parentElement)?.closest(type === 'ordered' ? 'ol' : 'ul');
        if (parent) {
          (parent as HTMLElement).style.listStyleType = listStyle;
        }
      }
    }
    setOpenMenu(null);
    scheduleSave();
    syncFormats();
  };

  // Checklist insertion
  const insertChecklist = () => {
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    const html = `<ul class="word-notes-task-list"><li class="word-notes-task-item"><input type="checkbox" /> <span>Task item</span></li></ul><p><br></p>`;
    if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
      document.execCommand('insertHTML', false, html);
    } else if (editorRef.current) {
      editorRef.current.insertAdjacentHTML('beforeend', html);
    }
    setOpenMenu(null);
    scheduleSave();
  };

  // Helper to place caret beside a floated image for seamless typing
  const placeCaretBesideImage = (img: HTMLImageElement, side: 'after' | 'before' = 'after') => {
    const editor = editorRef.current;
    if (!editor) return;

    if (side === 'after') {
      img.style.float = 'left';
      img.style.display = 'inline-block';
      img.style.clear = 'none';
      img.style.margin = '6px 20px 14px 0';
      const widthVal = parseInt(img.style.width || '100', 10);
      if (widthVal >= 65 || !img.style.width || img.style.width === '100%') {
        img.style.width = '45%';
      }
    } else {
      img.style.float = 'right';
      img.style.display = 'inline-block';
      img.style.clear = 'none';
      img.style.margin = '6px 0 14px 20px';
      const widthVal = parseInt(img.style.width || '100', 10);
      if (widthVal >= 65 || !img.style.width || img.style.width === '100%') {
        img.style.width = '45%';
      }
    }

    let parent = img.parentElement;
    if (!parent || parent === editor) {
      const p = document.createElement('p');
      p.style.clear = 'none';
      img.parentNode?.insertBefore(p, img);
      p.appendChild(img);
      parent = p;
    } else {
      parent.style.clear = 'none';
      parent.style.textAlign = 'left';
    }

    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();

    if (side === 'after') {
      let next = img.nextSibling;
      if (!next) {
        next = document.createTextNode('\u00a0');
        parent.appendChild(next);
      }
      if (next.nodeType === Node.TEXT_NODE) {
        range.setStart(next, next.textContent ? next.textContent.length : 0);
      } else {
        range.selectNodeContents(next);
      }
      range.collapse(false);
    } else {
      let prev = img.previousSibling;
      if (!prev) {
        prev = document.createTextNode('\u00a0');
        parent.insertBefore(prev, img);
      }
      if (prev.nodeType === Node.TEXT_NODE) {
        range.setStart(prev, 0);
      } else {
        range.selectNodeContents(prev);
      }
      range.collapse(true);
    }

    sel?.removeAllRanges();
    sel?.addRange(range);
    scheduleSave();
  };

  // Image insertion helper with left/right text wrapping support
  const insertImageHtml = (
    src: string,
    alt = '',
    widthPercent = 45,
    align: 'left' | 'center' | 'right' = 'left',
  ) => {
    editorRef.current?.focus();
    restoreSelection();

    let style = '';
    if (align === 'left') {
      style = `float: left; clear: none; display: inline-block; width: ${widthPercent}%; max-width: 60%; margin: 6px 20px 14px 0; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);`;
    } else if (align === 'right') {
      style = `float: right; clear: none; display: inline-block; width: ${widthPercent}%; max-width: 60%; margin: 6px 0 14px 20px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);`;
    } else {
      style = `float: none; clear: both; display: block; width: ${widthPercent}%; max-width: 100%; margin: 16px auto; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);`;
    }

    const imgTag = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${style}" />`;
    const imgHtml =
      align === 'center'
        ? `<p style="text-align: center; clear: both;">${imgTag}</p><p><br></p>`
        : `<p style="clear: none;">${imgTag}&nbsp;</p>`;

    const sel = window.getSelection();
    if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = imgHtml;
      const frag = document.createDocumentFragment();
      let node: Node | null;
      let insertedImg: HTMLImageElement | null = null;
      while ((node = tempDiv.firstChild)) {
        if ((node as HTMLElement).querySelector) {
          const found = (node as HTMLElement).querySelector('img');
          if (found) insertedImg = found;
        } else if ((node as HTMLElement).tagName === 'IMG') {
          insertedImg = node as HTMLImageElement;
        }
        frag.appendChild(node);
      }
      range.insertNode(frag);

      if (insertedImg && align !== 'center') {
        placeCaretBesideImage(insertedImg, align === 'right' ? 'before' : 'after');
      } else if (insertedImg) {
        const nextP = insertedImg.closest('p')?.nextElementSibling;
        if (nextP) placeCaretIn(nextP);
      }
    } else if (editorRef.current) {
      editorRef.current.insertAdjacentHTML('beforeend', imgHtml);
      const allImgs = editorRef.current.querySelectorAll('img');
      const lastImg = allImgs[allImgs.length - 1];
      if (lastImg && align !== 'center') {
        placeCaretBesideImage(lastImg, align === 'right' ? 'before' : 'after');
      }
    }
    scheduleSave();
  };

  const handleSelectFile = (file: File) => {
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);
  };

  const handleModalSubmit = async () => {
    if (imageTab === 'upload') {
      if (!selectedFile) return;
      setIsUploading(true);
      try {
        let finalUrl = '';
        try {
          const res = await uploadCourseNoteImage(selectedFile);
          if (res?.url) finalUrl = res.url;
        } catch {
          // Fallback to compressed base64 if server upload fails
          finalUrl = await compressImageFile(selectedFile);
        }
        if (finalUrl) {
          insertImageHtml(finalUrl, imgAlt, imgWidth, imgAlign);
          setIsImageModalOpen(false);
          setSelectedFile(null);
          setPreviewSrc('');
          setImgAlt('');
        }
      } finally {
        setIsUploading(false);
      }
    } else {
      if (!urlInput.trim()) return;
      insertImageHtml(urlInput.trim(), imgAlt, imgWidth, imgAlign);
      setIsImageModalOpen(false);
      setUrlInput('');
      setImgAlt('');
    }
  };

  // Direct editor paste & drop of images
  const handleEditorPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        let finalUrl = '';
        try {
          const res = await uploadCourseNoteImage(file);
          if (res?.url) finalUrl = res.url;
        } catch {
          finalUrl = await compressImageFile(file);
        }
        if (finalUrl) {
          insertImageHtml(finalUrl, file.name || 'image', 45, 'left');
        }
        return;
      }
    }
  };

  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        let finalUrl = '';
        try {
          const res = await uploadCourseNoteImage(file);
          if (res?.url) finalUrl = res.url;
        } catch {
          finalUrl = await compressImageFile(file);
        }
        if (finalUrl) {
          insertImageHtml(finalUrl, file.name || 'image', 45, 'left');
        }
      }
    }
  };

  // In-editor image floating toolbar updates
  const updateImgToolbarPos = (img: HTMLImageElement) => {
    const paper = paperRef.current;
    if (!paper) return;
    const imgRect = img.getBoundingClientRect();
    const paperRect = paper.getBoundingClientRect();
    const toolbarWidth = 360;
    const idealLeft = imgRect.left - paperRect.left + paper.scrollLeft + imgRect.width / 2 - toolbarWidth / 2;
    const clampedLeft = Math.min(paperRect.width - toolbarWidth - 16, Math.max(8, idealLeft));
    setImgToolbarPos({
      top: Math.max(8, imgRect.top - paperRect.top + paper.scrollTop - 44),
      left: clampedLeft,
    });
  };

  const resizeSelectedImg = (percent: number) => {
    if (!selectedImg) return;
    selectedImg.style.width = `${percent}%`;
    scheduleSave();
    setTimeout(() => updateImgToolbarPos(selectedImg), 50);
  };

  const alignSelectedImg = (align: 'left' | 'center' | 'right') => {
    if (!selectedImg) return;
    const parentP = selectedImg.closest('p, div, figure');
    if (align === 'left') {
      selectedImg.style.float = 'left';
      selectedImg.style.clear = 'none';
      selectedImg.style.display = 'inline-block';
      selectedImg.style.margin = '6px 20px 14px 0';
      const currentWidth = parseInt(selectedImg.style.width || '100', 10);
      if (currentWidth >= 65 || !selectedImg.style.width) {
        selectedImg.style.width = '45%';
      }
      if (parentP && parentP !== editorRef.current) {
        (parentP as HTMLElement).style.clear = 'none';
        (parentP as HTMLElement).style.textAlign = 'left';
      }
      if (!selectedImg.nextSibling) {
        selectedImg.parentNode?.appendChild(document.createTextNode('\u00a0'));
      }
    } else if (align === 'right') {
      selectedImg.style.float = 'right';
      selectedImg.style.clear = 'none';
      selectedImg.style.display = 'inline-block';
      selectedImg.style.margin = '6px 0 14px 20px';
      const currentWidth = parseInt(selectedImg.style.width || '100', 10);
      if (currentWidth >= 65 || !selectedImg.style.width) {
        selectedImg.style.width = '45%';
      }
      if (parentP && parentP !== editorRef.current) {
        (parentP as HTMLElement).style.clear = 'none';
        (parentP as HTMLElement).style.textAlign = 'left';
      }
      if (!selectedImg.previousSibling) {
        selectedImg.parentNode?.insertBefore(document.createTextNode('\u00a0'), selectedImg);
      }
    } else {
      selectedImg.style.float = 'none';
      selectedImg.style.clear = 'both';
      selectedImg.style.display = 'block';
      selectedImg.style.margin = '16px auto';
      if (parentP && parentP !== editorRef.current) {
        (parentP as HTMLElement).style.textAlign = 'center';
      }
    }
    scheduleSave();
    setTimeout(() => updateImgToolbarPos(selectedImg), 50);
  };

  const startTypingBesideImg = () => {
    if (!selectedImg) return;
    const isRight = selectedImg.style.float === 'right';
    alignSelectedImg(isRight ? 'right' : 'left');
    placeCaretBesideImage(selectedImg, isRight ? 'before' : 'after');
    setSelectedImg(null);
  };

  const insertLineBreakBelow = () => {
    if (!selectedImg) return;
    const parentP = selectedImg.closest('p, div, figure') || selectedImg;
    const newP = document.createElement('p');
    newP.style.clear = 'both';
    newP.className = 'word-notes-clear';
    newP.innerHTML = '<br>';
    if (parentP.nextSibling) {
      parentP.parentNode?.insertBefore(newP, parentP.nextSibling);
    } else {
      parentP.parentNode?.appendChild(newP);
    }
    placeCaretIn(newP);
    setSelectedImg(null);
    scheduleSave();
  };

  const deleteSelectedImg = () => {
    if (!selectedImg) return;
    const p = selectedImg.closest('p, div, figure') || selectedImg;
    selectedImg.remove();
    if (p && p !== editorRef.current && !p.textContent?.trim() && !p.querySelector('img')) {
      p.remove();
    }
    setSelectedImg(null);
    scheduleSave();
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Handle checklist checkbox toggle
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      const checkbox = target as HTMLInputElement;
      const li = checkbox.closest('li');
      if (checkbox.checked) {
        checkbox.setAttribute('checked', 'checked');
        li?.classList.add('is-checked');
      } else {
        checkbox.removeAttribute('checked');
        li?.classList.remove('is-checked');
      }
      scheduleSave();
      return;
    }

    // Handle image selection
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      setSelectedImg(img);
      updateImgToolbarPos(img);
      return;
    }

    if (selectedImg && target !== selectedImg) {
      setSelectedImg(null);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // If Tab pressed inside list, indent / outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      run(e.shiftKey ? 'outdent' : 'indent');
      return;
    }

    // If Enter pressed inside a task list item
    if (e.key === 'Enter') {
      setTimeout(() => {
        const sel = window.getSelection();
        const node = sel?.anchorNode;
        const currentLi = (
          node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
        )?.closest('li.word-notes-task-item');
        if (currentLi) {
          const input = currentLi.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
          if (input) {
            input.checked = false;
            input.removeAttribute('checked');
            currentLi.classList.remove('is-checked');
          }
          scheduleSave();
        }
      }, 10);
    }
  };

  const placeCaretIn = (node: Node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const handlePaperPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    const paper = paperRef.current;
    if (!editor || !paper) return;
    const hit = e.target as HTMLElement;

    // Direct clicks on images are handled by handleEditorClick
    if (hit.tagName === 'IMG') return;

    // Check if clicking beside any image in the document
    const images = Array.from(editor.querySelectorAll('img'));
    for (const img of images) {
      const rect = img.getBoundingClientRect();
      const isLeft =
        img.style.float === 'left' ||
        (!img.style.float && !img.style.margin?.includes('auto'));
      const isRight = img.style.float === 'right';

      if (e.clientY >= rect.top - 6 && e.clientY <= rect.bottom + 10) {
        if (isLeft && e.clientX > rect.right) {
          e.preventDefault();
          placeCaretBesideImage(img, 'after');
          return;
        }
        if (isRight && e.clientX < rect.left) {
          e.preventDefault();
          placeCaretBesideImage(img, 'before');
          return;
        }
      }
    }

    // If clicking directly on an element with text inside editor, let native caret take over
    if (
      hit !== paper &&
      hit !== editor &&
      editor.contains(hit) &&
      hit.closest('p, li, blockquote, h1, h2, h3, div, input, ul, ol, figure, span, a')
    ) {
      return;
    }

    // Try standard caretRangeFromPoint / caretPositionFromPoint if available
    const docWithCaret = document as unknown as {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };

    if (docWithCaret.caretRangeFromPoint) {
      const range = docWithCaret.caretRangeFromPoint(e.clientX, e.clientY);
      if (range && editor.contains(range.startContainer)) {
        const container =
          range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : (range.startContainer as HTMLElement);
        if (container && container !== editor) {
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          editor.focus();
          return;
        }
      }
    } else if (docWithCaret.caretPositionFromPoint) {
      const pos = docWithCaret.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos && editor.contains(pos.offsetNode)) {
        const container =
          pos.offsetNode.nodeType === Node.TEXT_NODE
            ? pos.offsetNode.parentElement
            : (pos.offsetNode as HTMLElement);
        if (container && container !== editor) {
          const range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          editor.focus();
          return;
        }
      }
    }

    // Calculate true visual bottom of all content in the editor (including floated images)
    let contentBottom = editor.getBoundingClientRect().top;
    const allChildren = Array.from(
      editor.querySelectorAll('p, li, blockquote, h1, h2, h3, div, img, input, ul, ol, figure')
    );
    for (const child of allChildren) {
      const b = child.getBoundingClientRect().bottom;
      if (b > contentBottom) contentBottom = b;
    }

    e.preventDefault();
    editor.focus();

    // Only append new lines if the click is clearly BELOW all content on the page
    if (e.clientY > contentBottom + 12) {
      const lineHeight = 28;
      const extra = Math.max(1, Math.min(10, Math.round((e.clientY - contentBottom) / lineHeight)));
      for (let i = 0; i < extra; i += 1) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editor.appendChild(p);
      }
    } else if (!editor.childElementCount) {
      editor.innerHTML = EMPTY_DOC;
    }

    const para = (editor.lastElementChild as HTMLElement) || editor;
    placeCaretIn(para);
    scheduleSave();
  };

  const label =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved'
        ? 'Saved'
        : status === 'error'
          ? 'Could not save'
          : status === 'dirty'
            ? 'Saving…'
            : 'Saves as you type';

  return (
    <div className={`word-notes${compact ? ' is-compact' : ''}`}>
      <div
        ref={toolbarRef}
        className="word-notes-toolbar"
        role="toolbar"
        aria-label="Note formatting"
      >
        {/* Bold */}
        <button
          type="button"
          className={`word-notes-btn-bold ${formats.bold ? 'is-on' : ''}`}
          aria-pressed={formats.bold}
          title="Bold (Ctrl+B)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('bold')}
        >
          B
        </button>

        {/* Italic */}
        <button
          type="button"
          className={`word-notes-btn-italic ${formats.italic ? 'is-on' : ''}`}
          aria-pressed={formats.italic}
          title="Italic (Ctrl+I)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('italic')}
        >
          I
        </button>

        {/* Underline */}
        <button
          type="button"
          className={`word-notes-btn-underline ${formats.underline ? 'is-on' : ''}`}
          aria-pressed={formats.underline}
          title="Underline (Ctrl+U)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('underline')}
        >
          U
        </button>

        {/* Font Size Selector */}
        <div className="word-notes-tool-wrap">
          <button
            type="button"
            className={`word-notes-btn-with-chevron ${openMenu === 'size' ? 'is-on' : ''}`}
            title="Text size"
            aria-label="Text size"
            style={{ minWidth: 46 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('size')}
          >
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {currentFontSize || 16}
            </span>
            <span className="word-notes-chevron">▼</span>
          </button>
          {openMenu === 'size' && (
            <div
              className="word-notes-dropdown"
              style={{ minWidth: 175, maxHeight: 270, overflowY: 'auto' }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="word-notes-dropdown-header">Text size</div>
              {FONT_SIZES.map((f) => (
                <button
                  key={f.size}
                  type="button"
                  className={`word-notes-menu-item ${currentFontSize === f.size ? 'is-active-item' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyFontSize(f.size)}
                >
                  <span style={{ fontWeight: currentFontSize === f.size ? 800 : 600, width: 26 }}>
                    {f.label}
                  </span>
                  <span
                    style={{
                      fontSize: `${Math.min(f.size, 18)}px`,
                      color: currentFontSize === f.size ? '#2d7a3e' : '#605e5c',
                    }}
                  >
                    {f.desc}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="word-notes-divider" />

        {/* Text Color Picker */}
        <div className="word-notes-tool-wrap">
          <button
            type="button"
            className={`word-notes-btn-with-chevron ${openMenu === 'color' ? 'is-on' : ''}`}
            title="Text color"
            aria-label="Text color"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('color')}
          >
            <span className="word-notes-btn-content">
              <span style={{ fontWeight: 800 }}>A</span>
              <span className="word-notes-color-bar" style={{ background: textColor }} />
            </span>
            <span className="word-notes-chevron">▼</span>
          </button>
          {openMenu === 'color' && (
            <div className="word-notes-dropdown" onMouseDown={(e) => e.preventDefault()}>
              <div className="word-notes-dropdown-header">Text color</div>
              <div className="word-notes-color-grid">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`word-notes-color-swatch ${textColor === c.value ? 'is-active' : ''}`}
                    style={{ background: c.value }}
                    title={c.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(c.value)}
                  />
                ))}
              </div>
              <div className="word-notes-color-custom">
                <span>Custom:</span>
                <input
                  type="color"
                  value={textColor.startsWith('#') && textColor.length === 7 ? textColor : '#0078d4'}
                  onChange={(e) => applyTextColor(e.target.value)}
                />
                <span style={{ fontSize: '0.74rem', color: '#8a8886' }}>{textColor}</span>
              </div>
              <button
                type="button"
                className="word-notes-color-reset"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTextColor('#201f1e')}
              >
                Default (Black)
              </button>
            </div>
          )}
        </div>

        {/* Highlighter Tool */}
        <div className="word-notes-tool-wrap">
          <button
            type="button"
            className={`word-notes-btn-with-chevron ${openMenu === 'highlight' ? 'is-on' : ''}`}
            title="Highlighter"
            aria-label="Highlighter"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('highlight')}
          >
            <span className="word-notes-btn-content">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 11-6 6v3h3l6-6" />
                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
              </svg>
              <span className="word-notes-color-bar" style={{ background: highlightColor }} />
            </span>
            <span className="word-notes-chevron">▼</span>
          </button>
          {openMenu === 'highlight' && (
            <div className="word-notes-dropdown" style={{ minWidth: 200 }} onMouseDown={(e) => e.preventDefault()}>
              <div className="word-notes-dropdown-header">Highlight color</div>
              <div className="word-notes-highlight-grid">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className="word-notes-highlight-item"
                    style={{ background: c.bg, color: c.text }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlightColor(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="word-notes-highlight-clear"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyHighlightColor('transparent')}
              >
                ✕ Clear Highlight
              </button>
            </div>
          )}
        </div>

        <span className="word-notes-divider" />

        {/* Bullet List with styles */}
        <div className="word-notes-tool-wrap">
          <button
            type="button"
            className={`word-notes-btn-with-chevron ${openMenu === 'bullet' ? 'is-on' : ''}`}
            title="Bulleted list options"
            aria-label="Bulleted list options"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('bullet')}
          >
            <span style={{ fontWeight: 800 }}>•≡</span>
            <span className="word-notes-chevron">▼</span>
          </button>
          {openMenu === 'bullet' && (
            <div className="word-notes-dropdown" style={{ minWidth: 170 }} onMouseDown={(e) => e.preventDefault()}>
              <div className="word-notes-dropdown-header">Bullet styles</div>
              <button
                type="button"
                className="word-notes-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyList('unordered', 'disc')}
              >
                <span className="menu-item-icon">●</span> Standard Disc
              </button>
              <button
                type="button"
                className="word-notes-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyList('unordered', 'circle')}
              >
                <span className="menu-item-icon">○</span> Hollow Circle
              </button>
              <button
                type="button"
                className="word-notes-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyList('unordered', 'square')}
              >
                <span className="menu-item-icon">■</span> Filled Square
              </button>
            </div>
          )}
        </div>

        {/* Numbered List with styles */}
        <div className="word-notes-tool-wrap">
          <button
            type="button"
            className={`word-notes-btn-with-chevron ${openMenu === 'number' ? 'is-on' : ''}`}
            title="Numbered list options"
            aria-label="Numbered list options"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleMenu('number')}
          >
            <span style={{ fontWeight: 800 }}>1≡</span>
            <span className="word-notes-chevron">▼</span>
          </button>
          {openMenu === 'number' && (
            <div className="word-notes-dropdown" style={{ minWidth: 190 }} onMouseDown={(e) => e.preventDefault()}>
              <div className="word-notes-dropdown-header">Numbered styles</div>
              <button
                type="button"
                className="word-notes-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyList('ordered', 'decimal')}
              >
                <span className="menu-item-icon">1.</span> 1, 2, 3 (Standard)
              </button>
              <button
                type="button"
                className="word-notes-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyList('ordered', 'lower-alpha')}
              >
                <span className="menu-item-icon">a.</span> a, b, c (Lower Alpha)
              </button>
              <button
                type="button"
                className="word-notes-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyList('ordered', 'upper-alpha')}
              >
                <span className="menu-item-icon">A.</span> A, B, C (Upper Alpha)
              </button>
              <button
                type="button"
                className="word-notes-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyList('ordered', 'lower-roman')}
              >
                <span className="menu-item-icon">i.</span> i, ii, iii (Roman)
              </button>
            </div>
          )}
        </div>

        {/* Checklist / Task List */}
        <button
          type="button"
          title="Insert checklist / to-do item"
          aria-label="Checklist"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertChecklist}
        >
          <span style={{ fontSize: '0.95rem' }}>☑</span>
        </button>

        {/* Outdent / Indent */}
        <button
          type="button"
          title="Decrease indent (Shift+Tab)"
          aria-label="Decrease indent"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('outdent')}
        >
          ⇤
        </button>
        <button
          type="button"
          title="Increase indent (Tab)"
          aria-label="Increase indent"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('indent')}
        >
          ⇥
        </button>

        <span className="word-notes-divider" />

        {/* Insert Image Button */}
        <button
          type="button"
          className="word-notes-btn-with-chevron"
          style={{ gap: 5, padding: '0 8px' }}
          title="Insert image from file or URL"
          aria-label="Insert image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            saveSelection();
            setIsImageModalOpen(true);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Image</span>
        </button>

        {/* Save Status */}
        <span className={`word-notes-status is-${status}`}>{label}</span>
      </div>

      <div
        ref={paperRef}
        className="word-notes-paper"
        onMouseDown={handlePaperPointer}
        onScroll={() => {
          if (selectedImg) updateImgToolbarPos(selectedImg);
        }}
      >
        {blank ? (
          <p className="word-notes-placeholder">
            Click anywhere on the page and start typing. Your notes save automatically.
          </p>
        ) : null}

        {/* Floating action pill on selected image */}
        {selectedImg && (
          <div
            className="word-notes-img-toolbar"
            style={{
              top: `${imgToolbarPos.top}px`,
              left: `${imgToolbarPos.left}px`,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              type="button"
              className="is-active-btn"
              onClick={startTypingBesideImg}
              title="Start typing notes next to this image"
            >
              ✎ Type beside
            </button>

            <span className="img-tb-sep" />

            <span className="img-tb-label">Wrap:</span>
            <button
              type="button"
              className={selectedImg.style.float === 'left' ? 'is-active-btn' : ''}
              onClick={() => alignSelectedImg('left')}
              title="Float image left so text types on the right"
            >
              ⇱ Text on right
            </button>
            <button
              type="button"
              className={!selectedImg.style.float || selectedImg.style.float === 'none' ? 'is-active-btn' : ''}
              onClick={() => alignSelectedImg('center')}
              title="Center image with no text wrap"
            >
              ↔ Center
            </button>
            <button
              type="button"
              className={selectedImg.style.float === 'right' ? 'is-active-btn' : ''}
              onClick={() => alignSelectedImg('right')}
              title="Float image right so text types on the left"
            >
              ⇲ Text on left
            </button>

            <span className="img-tb-sep" />

            <span className="img-tb-label">Size:</span>
            <button type="button" onClick={() => resizeSelectedImg(25)}>25%</button>
            <button type="button" onClick={() => resizeSelectedImg(40)}>40%</button>
            <button type="button" onClick={() => resizeSelectedImg(45)}>45%</button>
            <button type="button" onClick={() => resizeSelectedImg(50)}>50%</button>
            <button type="button" onClick={() => resizeSelectedImg(75)}>75%</button>
            <button type="button" onClick={() => resizeSelectedImg(100)}>100%</button>

            <span className="img-tb-sep" />

            <button
              type="button"
              onClick={insertLineBreakBelow}
              title="Start a new paragraph below the image"
            >
              ↵ Line below
            </button>

            <span className="img-tb-sep" />

            <button
              type="button"
              className="is-delete"
              onClick={deleteSelectedImg}
              title="Remove image"
            >
              Delete
            </button>
          </div>
        )}

        <div
          ref={editorRef}
          className="word-notes-editor"
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Notes document"
          spellCheck
          onInput={scheduleSave}
          onPaste={handleEditorPaste}
          onDrop={handleEditorDrop}
          onClick={handleEditorClick}
          onKeyDown={handleEditorKeyDown}
          onBlur={() => {
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
            void persist();
          }}
          onKeyUp={syncFormats}
          onMouseUp={syncFormats}
          suppressContentEditableWarning
        />
      </div>

      {/* Insert Image Modal */}
      {isImageModalOpen && (
        <div
          className="word-notes-modal-overlay"
          onClick={() => {
            if (!isUploading) setIsImageModalOpen(false);
          }}
        >
          <div
            className="word-notes-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Insert Image"
          >
            <div className="word-notes-modal-header">
              <h3>Insert Image</h3>
              <button
                type="button"
                className="word-notes-modal-close"
                onClick={() => setIsImageModalOpen(false)}
                disabled={isUploading}
              >
                ✕
              </button>
            </div>

            <div className="word-notes-modal-tabs">
              <button
                type="button"
                className={`word-notes-modal-tab ${imageTab === 'upload' ? 'is-active' : ''}`}
                onClick={() => setImageTab('upload')}
              >
                Upload from device
              </button>
              <button
                type="button"
                className={`word-notes-modal-tab ${imageTab === 'url' ? 'is-active' : ''}`}
                onClick={() => setImageTab('url')}
              >
                Web Image URL
              </button>
            </div>

            <div className="word-notes-modal-body">
              {imageTab === 'upload' ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleSelectFile(e.target.files[0]);
                    }}
                  />
                  {!selectedFile ? (
                    <div
                      className={`word-notes-dropzone ${isDragOver ? 'is-dragover' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files?.[0]) handleSelectFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2d7a3e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" x2="12" y1="3" y2="15" />
                      </svg>
                      <p>
                        <strong>Click to browse</strong> or drag & drop image here
                      </p>
                      <span style={{ fontSize: '0.74rem', color: '#8a8886' }}>
                        PNG, JPG, WEBP, GIF, SVG
                      </span>
                    </div>
                  ) : (
                    <div className="word-notes-preview-box">
                      {previewSrc && (
                        <img src={previewSrc} alt="Preview" className="word-notes-preview-thumb" />
                      )}
                      <div className="word-notes-preview-info">
                        <div className="word-notes-preview-name">{selectedFile.name}</div>
                        <div className="word-notes-preview-size">
                          {(selectedFile.size / 1024).toFixed(1)} KB ·{' '}
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2d7a3e',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              padding: 0,
                              font: 'inherit',
                            }}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Change file
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="word-notes-option-group">
                  <label htmlFor="note-img-url">Image URL</label>
                  <input
                    id="note-img-url"
                    type="text"
                    placeholder="https://example.com/image.png"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  {urlInput.trim() && (
                    <div style={{ marginTop: 8, maxHeight: 120, overflow: 'hidden', borderRadius: 4, textAlign: 'center' }}>
                      <img
                        src={urlInput.trim()}
                        alt="URL Preview"
                        style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="word-notes-modal-options">
                <div className="word-notes-option-group">
                  <label htmlFor="note-img-align">Alignment & Wrap</label>
                  <select
                    id="note-img-align"
                    value={imgAlign}
                    onChange={(e) => {
                      const nextAlign = e.target.value as 'left' | 'center' | 'right';
                      setImgAlign(nextAlign);
                      if (nextAlign !== 'center' && imgWidth === 100) {
                        setImgWidth(50);
                      }
                    }}
                  >
                    <option value="left">Left (Text wraps on right side)</option>
                    <option value="center">Centered (No text wrap)</option>
                    <option value="right">Right (Text wraps on left side)</option>
                  </select>
                </div>

                <div className="word-notes-option-group">
                  <label htmlFor="note-img-size">Size</label>
                  <select
                    id="note-img-size"
                    value={imgWidth}
                    onChange={(e) => setImgWidth(Number(e.target.value))}
                  >
                    <option value={25}>Small (25%)</option>
                    <option value={40}>Medium-Small (40%)</option>
                    <option value={45}>Standard wrap (45%)</option>
                    <option value={50}>Half width (50%)</option>
                    <option value={75}>Large (75%)</option>
                    <option value={100}>Full width (100%)</option>
                  </select>
                </div>
              </div>

              <div className="word-notes-option-group">
                <label htmlFor="note-img-alt">Alt text / caption (optional)</label>
                <input
                  id="note-img-alt"
                  type="text"
                  placeholder="e.g. Figure 1.2: Set Venn Diagram"
                  value={imgAlt}
                  onChange={(e) => setImgAlt(e.target.value)}
                />
              </div>
            </div>

            <div className="word-notes-modal-footer">
              <button
                type="button"
                className="word-notes-btn-secondary"
                onClick={() => setIsImageModalOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="word-notes-btn-primary"
                onClick={handleModalSubmit}
                disabled={
                  isUploading ||
                  (imageTab === 'upload' && !selectedFile) ||
                  (imageTab === 'url' && !urlInput.trim())
                }
              >
                {isUploading ? 'Uploading…' : 'Insert Image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
