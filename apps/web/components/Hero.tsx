import { Button } from 'antd';
import Link from 'next/link';
import React from 'react';

const Hero = () => {
  return (
    <section
      style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        backgroundColor: 'var(--accent-color)',
        borderRadius: '0 0 50% 50% / 4%',
        marginBottom: '3rem',
      }}
    >
      <div className="container">
        <h1
          style={{
            fontSize: '3.5rem',
            marginBottom: '1.5rem',
            color: 'var(--text-color)',
            fontWeight: '800',
          }}
        >
          Discover the World with{' '}
          <span style={{ color: 'var(--primary-color)' }}>VidhyaVibe Magazine</span>
        </h1>
        <p
          style={{
            fontSize: '1.2rem',
            marginBottom: '2rem',
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6',
          }}
        >
          Explore inspiring stories, thoughtful articles, and fresh perspectives tailored to your
          interests. Browse by age group or topic and start reading today.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="#age-groups">
            <Button
              type="primary"
              size="large"
              style={{
                backgroundColor: 'var(--primary-color)',
                borderColor: 'var(--primary-color)',
                height: '50px',
                padding: '0 40px',
                fontSize: '1.1rem',
              }}
            >
              Start Reading
            </Button>
          </Link>
          <Link href="/about">
            <Button
              size="large"
              style={{
                height: '50px',
                padding: '0 40px',
                fontSize: '1.1rem',
              }}
            >
              Learn More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;
