'use client';

import axios from 'axios';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import childImg from '../../../components/images/child.png';
import MagazineCard from '../../../components/MagazineCard';

interface Magazine {
  id: number;
  title: string;
  description: string;
  coverKey?: string;
  category: string;
  createdAt: string;
  sampleEditionId?: number | null;
}

export default function AgeGroupPage({ params }: { params: { ageGroup: string } }) {
  const { ageGroup } = params;
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`/api/magazines?category=${ageGroup}`);
        setMagazines(response.data || []);
      } catch (err) {
        console.error('Failed to fetch age group magazines:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ageGroup]);

  return (
    <main className="parchment-page" style={{ minHeight: '80vh' }}>
      <div className="container">
        {/* "Magazines for Ages X-Y" banner with child image */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            //  marginBottom: '1rem',
          }}
        >
          <Image
            src={childImg}
            alt="Reading child"
            width={100}
            height={100}
            style={{ width: 120, height: 120, objectFit: 'contain' }}
            priority
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '2.25rem',
                fontWeight: 800,
                color: '#3d2914',
                fontFamily: 'Georgia, serif',
                letterSpacing: '0.2px',
              }}
            >
              Magazines for Ages {ageGroup}
            </h1>
            <div
              style={{
                width: 320,
                height: 3,
                backgroundColor: '#3d2914',
                borderRadius: 999,
                marginTop: 10,
                opacity: 0.95,
              }}
            />
          </div>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              color: '#5c4a3a',
              fontSize: '1.1rem',
            }}
          >
            Loading...
          </div>
        ) : magazines.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1.5rem',
              justifyContent: 'center',
              maxWidth: 1200,
              margin: '0 auto',
            }}
          >
            {magazines.map((mag, index) => (
              <MagazineCard
                key={mag.id}
                id={mag.id}
                title={mag.title}
                description={mag.description}
                date={new Date(mag.createdAt).getFullYear().toString()}
                image={mag.coverKey ? `/api/assets/serve?key=${mag.coverKey}` : ''}
                sampleEditionId={mag.sampleEditionId ?? undefined}
                variant="vintage"
                fullCover={index % 2 === 1}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              fontSize: '1.2rem',
              color: '#5c4a3a',
              padding: '3rem 1rem',
              background: 'rgba(245,238,221,0.8)',
              borderRadius: 12,
              border: '1px dashed var(--parchment-border, #b8956a)',
            }}
          >
            <p style={{ margin: 0 }}>
              No magazines found for this age group at the moment. Check back soon!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
