'use client';

import { Spin, Empty } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import React from 'react';
import childImg from '../../components/images/child.png';
import MagazineCard from '../../components/MagazineCard';

interface Magazine {
  id: number;
  title: string;
  description?: string;
  coverKey?: string;
  category?: string;
  createdAt: string;
}

const AGE_PILLS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '8-11', label: '8-11' },
  { value: '12-14', label: '12-14' },
  { value: '15-16', label: '15-16' },
  { value: '17-18', label: '17-18' },
];

export default function BrowseMagazinesPage() {
  const [ageGroup, setAgeGroup] = React.useState<string>('all');
  const [magazines, setMagazines] = React.useState<Magazine[]>([]);
  const [loading, setLoading] = React.useState(true);

  const headingTitle = ageGroup === 'all' ? 'Magazines' : `Magazines for Ages ${ageGroup}`;

  React.useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const url = ageGroup === 'all' ? '/api/magazines' : `/api/magazines?category=${ageGroup}`;
        const res = await axios.get(url);
        setMagazines(res.data || []);
      } catch (e) {
        setMagazines([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [ageGroup]);

  return (
    <main style={{ minHeight: '80vh' }}>
      <div className="container">
        {/* Themed heading */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '84px 1fr 84px',
            alignItems: 'center',
            padding: '0.35rem 0',
          }}
        >
          <div />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Image
              src={childImg}
              alt="Browse"
              width={84}
              height={84}
              style={{ width: 84, height: 84, objectFit: 'contain' }}
              priority
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '2.05rem',
                  fontWeight: 800,
                  color: '#3d2914',
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.2px',
                  textAlign: 'center',
                }}
              >
                {headingTitle}
              </h1>
              <div
                style={{
                  width: '55%',
                  maxWidth: 240,
                  height: 3,
                  backgroundColor: '#3d2914',
                  borderRadius: 999,
                  marginTop: 8,
                  opacity: 0.95,
                }}
              />
            </div>
          </div>
          <div />
        </div>

        <div
          style={{
            padding: '1.0rem 1.0rem',
            borderRadius: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.78)',
            border: '1px solid rgba(61,41,20,0.18)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 14,
              justifyContent: 'center',
            }}
          >
            {AGE_PILLS.map(({ value, label }) => {
              const active = ageGroup === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAgeGroup(value)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    borderRadius: 999,
                    border: `1px solid ${active ? '#3d2914' : 'rgba(61,41,20,0.35)'}`,
                    background: active ? '#3d2914' : 'rgba(255,255,255,0.9)',
                    color: active ? '#fff' : '#3d2914',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Spin size="large" />
            </div>
          ) : magazines.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {magazines.map((m, index) => (
                <MagazineCard
                  key={m.id}
                  id={m.id}
                  title={m.title}
                  description={m.description || ''}
                  date={new Date(m.createdAt).getFullYear().toString()}
                  image={m.coverKey ? `/api/assets/serve?key=${m.coverKey}` : ''}
                  variant="vintage"
                  fullCover={index % 2 === 1}
                />
              ))}
            </div>
          ) : (
            <Empty description="No magazines found." />
          )}
        </div>
      </div>
    </main>
  );
}
