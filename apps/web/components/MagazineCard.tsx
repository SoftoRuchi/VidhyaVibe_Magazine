import { Button, message } from 'antd';
import axios from 'axios';
import Link from 'next/link';
import React from 'react';

interface MagazineCardProps {
  id?: number;
  title: string;
  image: string;
  date: string;
  description: string;
  /** When provided (e.g. from library), Read Now goes directly to reader without subscription check */
  editionId?: number;
  /** Show "FULL COVER" tag on card (vintage magazine style) */
  fullCover?: boolean;
  /** Use vintage leather-bound style (for magazines age-group page) */
  variant?: 'default' | 'vintage';
}

const MagazineCard = ({
  id,
  title,
  image,
  date,
  description,
  editionId,
  fullCover = false,
  variant = 'default',
}: MagazineCardProps) => {
  const [loading, setLoading] = React.useState(false);

  const handleReadNow = async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      message.info('Please login to read the magazine');
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      return;
    }

    if (editionId) {
      window.location.href = `/reader/${editionId}`;
      return;
    }

    if (!id) return;
    setLoading(true);
    try {
      const response = await axios.get(`/api/subscriptions/check/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.subscribed) {
        if (response.data.editionId) {
          window.location.href = `/reader/${response.data.editionId}`;
        } else {
          message.warning('No editions found for this magazine yet.');
        }
      } else {
        message.error('You have not subscribed to this edition or magazine.');
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        message.error('Session expired. Please login again.');
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      } else {
        message.error('Failed to check subscription. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const bookStyle = {
    position: 'relative' as const,
    maxWidth: 280,
    minWidth: 220,
    flex: '1 1 220px',
    // Square on spine side (left), rounded on cover side (right)
    borderRadius: '0 16px 16px 0',
    overflow: 'visible' as const,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  if (variant === 'vintage') {
    // Browns matched to the provided reference (warm leather)
    const leather = {
      base: '#8b4f2a',
      mid: '#77401f',
      dark: '#4b250f',
      edge: '#2a1408',
    };

    return (
      <div
        style={{
          ...bookStyle,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-6px)';
          e.currentTarget.style.boxShadow = '0 18px 40px rgba(0,0,0,0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.28)';
        }}
      >
        <div
          style={{
            position: 'relative',
            background: `linear-gradient(180deg, ${leather.base} 0%, ${leather.mid} 45%, ${leather.dark} 100%)`,
            borderRadius: '0 16px 16px 0',
            overflow: 'hidden',
            padding: 10,
            boxShadow: '0 10px 26px rgba(0,0,0,0.28)',
            border: `3px solid ${leather.edge}`,
          }}
        >
          {/* Year badge */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 18,
              zIndex: 3,
              background: '#fff',
              color: '#2a1c0e',
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 4,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            {date}
          </div>

          {/* FULL COVER tag */}
          {fullCover && (
            <div
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                zIndex: 3,
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 6,
                letterSpacing: '0.6px',
              }}
            >
              FULL COVER
            </div>
          )}

          {/* Cover */}
          <div
            style={{
              borderRadius: '0 14px 14px 0',
              overflow: 'hidden',
              marginLeft: 0,
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.10)',
            }}
          >
            <div style={{ height: 160, backgroundColor: 'rgba(0,0,0,0.22)' }}>
              {image ? (
                <img
                  src={image}
                  alt={title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 14,
                  }}
                >
                  Cover
                </div>
              )}
            </div>
          </div>

          {/* Bottom info panel (like screenshot) */}
          <div
            style={{
              marginLeft: 0,
              marginTop: 10,
              padding: '10px 10px 12px',
              borderRadius: '0 14px 14px 0',
              background: 'rgba(0,0,0,0.58)',
              border: '1px dashed rgba(255,255,255,0.22)',
            }}
          >
            <h3
              style={{
                fontSize: '1.05rem',
                margin: '0 0 4px',
                color: '#fff',
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                color: 'rgba(255,255,255,0.88)',
                fontSize: '0.8rem',
                margin: '0 0 10px',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {id && (
                <Link href={`/magazine/${id}`} style={{ flex: 1 }}>
                  <Button
                    block
                    size="small"
                    style={{
                      width: '100%',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: 'var(--btn-view-green, #2d7a3e)',
                      borderColor: 'var(--btn-view-green, #2d7a3e)',
                      color: '#fff',
                    }}
                  >
                    View
                  </Button>
                </Link>
              )}
              <Button
                block
                size="small"
                onClick={handleReadNow}
                loading={loading}
                style={{
                  flex: id ? 1 : undefined,
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: 'var(--btn-read-red, #c0392b)',
                  borderColor: 'var(--btn-read-red, #c0392b)',
                  color: '#fff',
                }}
              >
                Read Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default (existing) card style
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #f1f5f9',
        maxWidth: 250,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 18px rgba(15, 23, 42, 0.06)';
      }}
    >
      <div
        style={{
          height: 140,
          backgroundColor: '#e2f3ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
        }}
      >
        {image ? (
          <img
            src={image}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          'Cover Image'
        )}
      </div>
      <div
        style={{
          padding: '1rem 1.1rem 1.1rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#0f172a',
              padding: '2px 8px',
              borderRadius: 999,
              background: '#e0f2fe',
            }}
          >
            {date}
          </span>
        </div>
        <h3
          style={{ fontSize: '1rem', margin: 0, color: '#0f172a', lineHeight: 1.3, minHeight: 30 }}
        >
          {title}
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0, flex: 1 }}>{description}</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {id && (
            <Link href={`/magazine/${id}`} style={{ flex: 1 }}>
              <Button block size="middle" style={{ width: '100%', fontSize: '0.8rem' }}>
                View
              </Button>
            </Link>
          )}
          <Button
            type="primary"
            block
            size="middle"
            onClick={handleReadNow}
            loading={loading}
            style={{ flex: id ? 1 : undefined, fontSize: '0.8rem' }}
          >
            Read Now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MagazineCard;
