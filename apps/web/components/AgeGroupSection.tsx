'use client';

import Link from 'next/link';
import React from 'react';
import type { AgeGroup } from '../lib/ageGroups';

const AgeGroupCard = React.memo(function AgeGroupCard({
  name,
  color,
  link,
}: {
  name: string;
  color: string;
  link: string;
}) {
  return (
    <Link href={link} style={{ display: 'block', width: '100%' }}>
      <div
        style={{
          backgroundColor: color,
          padding: '2rem',
          borderRadius: '15px',
          textAlign: 'center',
          color: 'white',
          transition: 'transform 0.3s ease',
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
        }}
        className="age-card"
      >
        <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{name}</h3>
        <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>Years Old</p>
      </div>
    </Link>
  );
});

const AgeGroupSection = ({ groups }: { groups: AgeGroup[] }) => {
  if (groups.length === 0) return null;

  return (
    <section id="age-groups" style={{ padding: '4rem 0' }}>
      <div className="container">
        <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2.5rem' }}>
          Choose Your Age Group
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '2rem',
          }}
        >
          {groups.map((g) => (
            <AgeGroupCard
              key={g.id}
              name={g.name}
              color={g.color || '#4ECDC4'}
              link={`/magazines/${g.slug}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default React.memo(AgeGroupSection);
