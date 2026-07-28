'use client';

import React from 'react';

type Piece = {
  id: number;
  kind: 'ribbon' | 'curl' | 'spark' | 'dot';
  left: number;
  top: number;
  delay: number;
  duration: number;
  color: string;
  width: number;
  height: number;
  rotate: number;
  sway: number;
  driftX: number;
  driftY: number;
  spin: number;
};

const COLORS = [
  '#ff6b6b',
  '#ffa94d',
  '#ffd43b',
  '#69db7c',
  '#38d9a9',
  '#4dabf7',
  '#748ffc',
  '#da77f2',
  '#f783ac',
  '#ffe066',
];

function makePieces(): Piece[] {
  const pieces: Piece[] = [];
  let id = 0;

  // Center burst sparks
  for (let i = 0; i < 28; i++) {
    const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.2;
    const dist = 120 + Math.random() * 220;
    pieces.push({
      id: id++,
      kind: 'spark',
      left: 50,
      top: 32,
      delay: Math.random() * 0.15,
      duration: 1.1 + Math.random() * 0.6,
      color: COLORS[i % COLORS.length],
      width: 6 + Math.random() * 6,
      height: 6 + Math.random() * 6,
      rotate: Math.random() * 360,
      sway: 0,
      driftX: Math.cos(angle) * dist,
      driftY: Math.sin(angle) * dist * 0.75,
      spin: 180 + Math.random() * 360,
    });
  }

  // Side cannon ribbons (left + right)
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 18; i++) {
      const fromLeft = side === 0;
      pieces.push({
        id: id++,
        kind: 'ribbon',
        left: fromLeft ? 2 + Math.random() * 8 : 90 + Math.random() * 8,
        top: 55 + Math.random() * 20,
        delay: Math.random() * 0.25,
        duration: 1.6 + Math.random() * 1.1,
        color: COLORS[(i + side * 3) % COLORS.length],
        width: 10 + Math.random() * 10,
        height: 34 + Math.random() * 42,
        rotate: Math.random() * 360,
        sway: 0,
        driftX: (fromLeft ? 1 : -1) * (180 + Math.random() * 280),
        driftY: -(220 + Math.random() * 320),
        spin: 200 + Math.random() * 400,
      });
    }
  }

  // Falling curly streamers from top
  for (let i = 0; i < 36; i++) {
    pieces.push({
      id: id++,
      kind: i % 3 === 0 ? 'curl' : 'ribbon',
      left: Math.random() * 100,
      top: -8,
      delay: 0.1 + Math.random() * 0.7,
      duration: 2.2 + Math.random() * 1.5,
      color: COLORS[i % COLORS.length],
      width: 8 + Math.random() * 9,
      height: 30 + Math.random() * 40,
      rotate: Math.random() * 360,
      sway: 50 + Math.random() * 90,
      driftX: 0,
      driftY: 0,
      spin: 0,
    });
  }

  // Soft floating dots
  for (let i = 0; i < 20; i++) {
    pieces.push({
      id: id++,
      kind: 'dot',
      left: 20 + Math.random() * 60,
      top: 20 + Math.random() * 40,
      delay: Math.random() * 0.4,
      duration: 1.4 + Math.random() * 0.8,
      color: COLORS[i % COLORS.length],
      width: 5 + Math.random() * 7,
      height: 5 + Math.random() * 7,
      rotate: 0,
      sway: 0,
      driftX: (Math.random() - 0.5) * 80,
      driftY: -40 - Math.random() * 60,
      spin: Math.random() * 180,
    });
  }

  return pieces;
}

export function CouponCelebration({
  active,
  title = 'Coupon unlocked!',
  subtitle,
  durationMs = 3400,
}: {
  active: boolean;
  title?: string;
  subtitle?: string;
  durationMs?: number;
}) {
  const [pieces, setPieces] = React.useState<Piece[]>([]);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      setVisible(false);
      setPieces([]);
      return;
    }
    setPieces(makePieces());
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      setPieces([]);
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [active, durationMs]);

  if (!visible || pieces.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes vv-flash {
          0% { opacity: 0; }
          12% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes vv-ring {
          0% { transform: translate(-50%, -50%) scale(0.35); opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes vv-burst {
          0% { transform: translate(-50%, -50%) translate(0,0) scale(0.4) rotate(0deg); opacity: 0; }
          14% { opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(1) rotate(var(--spin)); opacity: 0; }
        }
        @keyframes vv-fall {
          0% {
            transform: translate3d(0, -10vh, 0) rotate(var(--rot)) scaleY(0.9);
            opacity: 0;
          }
          10% { opacity: 1; }
          100% {
            transform: translate3d(var(--sway), 115vh, 0) rotate(calc(var(--rot) + 640deg));
            opacity: 0.75;
          }
        }
        @keyframes vv-card {
          0% { transform: translate(-50%, -46%) scale(0.55) rotate(-4deg); opacity: 0; }
          16% { transform: translate(-50%, -50%) scale(1.08) rotate(1deg); opacity: 1; }
          28% { transform: translate(-50%, -50%) scale(0.98) rotate(-0.5deg); }
          40%, 72% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, -42%) scale(0.92); opacity: 0; }
        }
        @keyframes vv-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
      `}</style>

      {/* Soft celebration flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 32%, rgba(255,230,150,0.55), rgba(255,255,255,0) 55%)',
          animation: 'vv-flash 1.1s ease-out both',
        }}
      />

      {/* Expanding rings */}
      {[0, 1, 2].map((i) => (
        <span
          key={`ring-${i}`}
          style={{
            position: 'absolute',
            top: '32%',
            left: '50%',
            width: 120 + i * 40,
            height: 120 + i * 40,
            borderRadius: '50%',
            border: `2px solid ${COLORS[i * 2]}`,
            opacity: 0.5,
            animation: `vv-ring ${1.2 + i * 0.25}s ease-out ${i * 0.08}s both`,
          }}
        />
      ))}

      {pieces.map((p) => {
        if (p.kind === 'spark' || p.kind === 'dot' || (p.kind === 'ribbon' && p.driftY < 0)) {
          const isSpark = p.kind === 'spark' || p.kind === 'dot';
          return (
            <span
              key={p.id}
              style={
                {
                  position: 'absolute',
                  top: `${p.top}%`,
                  left: `${p.left}%`,
                  width: p.width,
                  height: isSpark ? p.width : p.height,
                  borderRadius: isSpark ? (p.kind === 'spark' ? 2 : '50%') : 4,
                  background: isSpark
                    ? p.color
                    : `linear-gradient(180deg, #fff8, ${p.color}, ${p.color}99)`,
                  boxShadow: isSpark ? `0 0 10px ${p.color}` : `0 2px 6px ${p.color}55`,
                  ['--dx' as string]: `${p.driftX}px`,
                  ['--dy' as string]: `${p.driftY}px`,
                  ['--spin' as string]: `${p.spin}deg`,
                  animation: `vv-burst ${p.duration}s cubic-bezier(0.16, 0.84, 0.44, 1) ${p.delay}s both`,
                  willChange: 'transform, opacity',
                } as React.CSSProperties
              }
            />
          );
        }

        return (
          <span
            key={p.id}
            style={
              {
                position: 'absolute',
                top: 0,
                left: `${p.left}%`,
                width: p.width,
                height: p.height,
                borderRadius: p.kind === 'curl' ? '40% 60% 40% 60%' : 4,
                background:
                  p.kind === 'curl'
                    ? `repeating-linear-gradient(90deg, ${p.color}, ${p.color} 4px, #fff6 4px, #fff6 7px)`
                    : `linear-gradient(180deg, #ffffffaa, ${p.color} 35%, ${p.color})`,
                boxShadow: `0 3px 8px ${p.color}44`,
                ['--rot' as string]: `${p.rotate}deg`,
                ['--sway' as string]: `${p.id % 2 === 0 ? p.sway : -p.sway}px`,
                animation: `vv-fall ${p.duration}s cubic-bezier(0.22, 0.61, 0.36, 1) ${p.delay}s both`,
                willChange: 'transform, opacity',
              } as React.CSSProperties
            }
          />
        );
      })}

      {/* Hero card */}
      <div
        style={{
          position: 'absolute',
          top: '32%',
          left: '50%',
          minWidth: 260,
          maxWidth: '86vw',
          padding: '22px 28px 20px',
          borderRadius: 22,
          textAlign: 'center',
          color: '#3d2914',
          background: 'linear-gradient(135deg, #fff9ef 0%, #ffffff 45%, #f3fff6 100%)',
          border: '1px solid rgba(61,41,20,0.12)',
          boxShadow:
            '0 22px 50px rgba(0,0,0,0.22), 0 0 0 6px rgba(255,255,255,0.35), inset 0 1px 0 rgba(255,255,255,0.9)',
          animation: 'vv-card 3.1s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            marginBottom: 10,
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: '#fff',
            background: 'linear-gradient(90deg, #e85d4c, #f4a261, #2d7a3e, #3d7ea6, #e85d4c)',
            backgroundSize: '200% 100%',
            animation: 'vv-shimmer 1.8s linear infinite',
          }}
        >
          Great savings
        </div>
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 28,
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: subtitle ? 8 : 0,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2d7a3e' }}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
