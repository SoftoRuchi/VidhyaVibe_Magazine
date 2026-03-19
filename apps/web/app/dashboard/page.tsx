'use client';

import { Button, Empty, Spin } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import libraryImg from '../../components/images/library.png';
import MagazineCard from '../../components/MagazineCard';

interface LibraryItem {
  type: string;
  magazineId: number;
  title: string;
  slug: string;
  coverKey: string | null;
  editionId: number | null;
  volume?: number;
  issueNumber?: number;
  publishedAt?: string;
  accessType: string;
}

export default function DashboardPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLibrary = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get('/api/library', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(res.data?.items || []);
      } catch (err) {
        console.error('Failed to fetch library:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const formatDate = (publishedAt?: string) => {
    if (!publishedAt) return '';
    const d = new Date(publishedAt);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <main style={{ minHeight: '80vh' }}>
      <div className="container">
        {/* Themed heading (matches Subscribe/Profile) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '84px 1fr 84px',
            alignItems: 'center',
          }}
        >
          <div />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Image
              src={libraryImg}
              alt="My Library"
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
                My Library
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

        <section style={{ marginBottom: '4rem' }}>
          <div
            style={{
              padding: '1.4rem 1.6rem',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            <h2
              style={{
                fontSize: '1.4rem',
                margin: 0,
                marginBottom: '1rem',
                color: '#3d2914',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              My Subscriptions & Purchases
            </h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Spin size="large" />
              </div>
            ) : items.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {items.map((item, index) => (
                  <MagazineCard
                    key={`${item.accessType}-${item.magazineId}-${item.editionId || index}`}
                    title={item.title}
                    date={
                      formatDate(item.publishedAt) || (item.volume ? `Vol. ${item.volume}` : '')
                    }
                    description={item.accessType === 'subscription' ? 'Subscribed' : 'Purchased'}
                    image={item.coverKey ? `/api/assets/serve?key=${item.coverKey}` : ''}
                    editionId={item.editionId || undefined}
                  />
                ))}
              </div>
            ) : (
              <Empty description="You haven't subscribed to or purchased any magazines yet. Browse and subscribe to get started!" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
