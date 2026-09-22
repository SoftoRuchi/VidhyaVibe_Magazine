'use client';

import React from 'react';
import type { CourseInteractiveItem } from '../../../../../../lib/courseInteractives';

function VennSvg({
  kind,
}: {
  kind:
    | 'venn-union'
    | 'venn-intersection'
    | 'venn-difference'
    | 'venn-complement'
    | 'venn-symmetric'
    | 'venn-subset';
}) {
  const fillA = 'rgba(46, 160, 90, 0.28)';
  const fillB = 'rgba(46, 160, 90, 0.18)';
  const stroke = '#6a9a74';
  const both = 'rgba(32, 120, 70, 0.55)';
  const onlyA = 'rgba(46, 160, 90, 0.5)';
  const onlyB = 'rgba(46, 160, 90, 0.32)';
  const outside = 'rgba(46, 160, 90, 0.18)';

  return (
    <svg viewBox="0 0 280 180" className="course-ix-svg" role="img" aria-label={kind}>
      <rect x="8" y="8" width="264" height="164" rx="12" fill="#f4faf5" stroke={stroke} />
      <text x="20" y="28" fill="#2d7a3e" fontSize="11">
        U
      </text>
      {kind === 'venn-complement' ? (
        <rect x="8" y="8" width="264" height="164" rx="12" fill={outside} />
      ) : null}
      {kind === 'venn-union' || kind === 'venn-symmetric' ? (
        <>
          <circle cx="110" cy="95" r="52" fill={onlyA} stroke={stroke} />
          <circle cx="170" cy="95" r="52" fill={onlyB} stroke={stroke} />
        </>
      ) : null}
      {kind === 'venn-intersection' ? (
        <>
          <circle cx="110" cy="95" r="52" fill={fillA} stroke={stroke} />
          <circle cx="170" cy="95" r="52" fill={fillB} stroke={stroke} />
          <clipPath id="ix-a">
            <circle cx="110" cy="95" r="52" />
          </clipPath>
          <circle cx="170" cy="95" r="52" fill={both} clipPath="url(#ix-a)" />
        </>
      ) : null}
      {kind === 'venn-difference' ? (
        <>
          <circle cx="170" cy="95" r="52" fill={fillB} stroke={stroke} />
          <circle cx="110" cy="95" r="52" fill={onlyA} stroke={stroke} />
        </>
      ) : null}
      {kind === 'venn-complement' ? (
        <circle cx="140" cy="95" r="52" fill="#f4faf5" stroke={stroke} />
      ) : null}
      {kind === 'venn-subset' ? (
        <>
          <circle cx="140" cy="95" r="62" fill={fillB} stroke={stroke} />
          <circle cx="140" cy="95" r="34" fill={both} stroke={stroke} />
        </>
      ) : null}
      {kind === 'venn-union' ||
      kind === 'venn-intersection' ||
      kind === 'venn-difference' ||
      kind === 'venn-symmetric' ? (
        <>
          <text x="78" y="100" fill="#1f3d28" fontSize="16" fontWeight="700">
            A
          </text>
          <text x="178" y="100" fill="#1f3d28" fontSize="16" fontWeight="700">
            B
          </text>
        </>
      ) : null}
      {kind === 'venn-complement' ? (
        <text x="132" y="100" fill="#1f3d28" fontSize="16" fontWeight="700">
          A
        </text>
      ) : null}
      {kind === 'venn-subset' ? (
        <>
          <text x="128" y="88" fill="#1f3d28" fontSize="13" fontWeight="700">
            A
          </text>
          <text x="198" y="70" fill="#1f3d28" fontSize="13" fontWeight="700">
            B
          </text>
        </>
      ) : null}
    </svg>
  );
}

function Visual({ item }: { item: CourseInteractiveItem }) {
  const visual = item.visual;
  if (visual.type === 'image' && visual.src) {
    return <img className="course-ix-image" src={visual.src} alt={visual.alt || item.label} />;
  }
  if (visual.type === 'html' && visual.html) {
    return <div className="course-ix-html" dangerouslySetInnerHTML={{ __html: visual.html }} />;
  }
  if (visual.type === 'diagram') {
    const kind = visual.kind as
      | 'venn-union'
      | 'venn-intersection'
      | 'venn-difference'
      | 'venn-complement'
      | 'venn-symmetric'
      | 'venn-subset';
    if (String(kind).startsWith('venn-')) {
      return <VennSvg kind={kind} />;
    }
    return (
      <div className="course-ix-placeholder">
        <strong>{item.label}</strong>
        <span>Visual: {visual.kind}</span>
      </div>
    );
  }
  return (
    <div className="course-ix-placeholder">
      <strong>{item.label}</strong>
      <span>Explanation focus</span>
    </div>
  );
}

export default function CourseInteractives({
  items,
  activeId,
  onSelect,
  variant = 'panel',
}: {
  items: CourseInteractiveItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  variant?: 'panel' | 'page';
}) {
  const active = items.find((item) => item.id === activeId) || items[0] || null;

  if (!items.length) {
    return (
      <p className="course-notes-empty">
        Open a chapter with named concepts, definitions, or formulas. Tap a concept to see its
        visual and explanation.
      </p>
    );
  }

  const list = (
    <div className={variant === 'page' ? 'course-ix-concepts' : 'course-ix-chips'} role="list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          className={`${variant === 'page' ? 'course-ix-concept' : 'course-ix-chip'}${
            active?.id === item.id ? ' is-on' : ''
          }`}
          onClick={() => onSelect(item.id)}
        >
          {variant === 'page' ? (
            <>
              <strong>{item.label}</strong>
              {item.topic ? <span>{item.topic}</span> : null}
            </>
          ) : (
            item.label
          )}
        </button>
      ))}
    </div>
  );

  const card = active ? (
    <article className="course-ix-card">
      {active.topic ? <p className="course-ix-topic">{active.topic}</p> : null}
      <h3>{active.label}</h3>
      <div className="course-ix-visual">
        <Visual item={active} />
      </div>
      <p className="course-ix-explain">{active.explanation}</p>
    </article>
  ) : null;

  if (variant === 'page') {
    return (
      <div className="course-explain-split">
        <section className="course-explain-concepts">
          <h2>Concepts</h2>
          <p className="course-notes-kicker">Tap a concept to change the diagram</p>
          <div className="course-explain-concepts-body">{list}</div>
        </section>
        <section className="course-explain-stage">
          <h2>Visual & explanation</h2>
          {card}
        </section>
      </div>
    );
  }

  return (
    <div className="course-ix-panel">
      <p className="course-notes-kicker">Tap a concept to change the visual</p>
      {list}
      {card}
    </div>
  );
}
