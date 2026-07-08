'use client';

import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Carousel } from 'antd';
import type { CarouselRef } from 'antd/es/carousel';
import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assetUrl } from '../lib/apiBase';
import VideoWithSoundToggle from './VideoWithSoundToggle';

export interface CarouselMediaItem {
  id: number;
  mediaType: 'IMAGE' | 'VIDEO' | string;
  mediaKey: string;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|$)/i;

function isVideo(item: CarouselMediaItem) {
  const type = String(item.mediaType ?? '').toUpperCase();
  if (type === 'VIDEO') return true;
  return VIDEO_EXT.test(item.mediaKey);
}

type PostMediaCarouselProps = {
  items: CarouselMediaItem[];
  title: string;
  mediaFit?: 'contain' | 'cover';
  imageIntervalMs?: number;
  showArrows?: boolean;
  clickToNavigate?: boolean;
  slideHeight?: number | string;
  videoControls?: boolean;
  renderOverlay?: (item: CarouselMediaItem, index: number) => React.ReactNode;
};

export default function PostMediaCarousel({
  items,
  title,
  mediaFit = 'contain',
  imageIntervalMs = 5000,
  showArrows = true,
  clickToNavigate = true,
  slideHeight,
  videoControls = false,
  renderOverlay,
}: PostMediaCarouselProps) {
  const carouselRef = useRef<CarouselRef>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleImageAdvance = useCallback(
    (index: number) => {
      clearTimer();
      if (items.length <= 1) return;
      const item = items[index];
      if (!item || isVideo(item)) return;

      timerRef.current = setTimeout(() => {
        carouselRef.current?.next();
      }, imageIntervalMs);
    },
    [clearTimer, imageIntervalMs, items],
  );

  const handleAfterChange = useCallback(
    (index: number) => {
      setActiveIndex(index);
      clearTimer();
      const item = items[index];
      if (!item || isVideo(item)) return;
      scheduleImageAdvance(index);
    },
    [clearTimer, items, scheduleImageAdvance],
  );

  const goPrev = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    carouselRef.current?.prev();
  }, []);

  const goNext = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    carouselRef.current?.next();
  }, []);

  const handleSlideClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!clickToNavigate || items.length <= 1) return;
      if ((e.target as HTMLElement).closest('video, [data-video-mute]')) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) goPrev();
      else goNext();
    },
    [clickToNavigate, goNext, goPrev, items.length],
  );

  useEffect(() => {
    if (items.length === 0) return;
    setActiveIndex(0);
    clearTimer();
    const first = items[0];
    if (first && !isVideo(first)) {
      scheduleImageAdvance(0);
    }
    return clearTimer;
  }, [items, clearTimer, scheduleImageAdvance]);

  if (items.length === 0) return null;

  const slideStyle: React.CSSProperties = slideHeight
    ? {
        position: 'relative',
        width: '100%',
        height: slideHeight,
        cursor: clickToNavigate ? 'pointer' : undefined,
      }
    : {
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        cursor: clickToNavigate ? 'pointer' : undefined,
      };

  const mediaStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: mediaFit,
    background: '#000',
  };

  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 3,
    border: 'none',
    borderRadius: '50%',
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.92)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    cursor: 'pointer',
    color: '#3d2914',
  };

  return (
    <div style={{ position: 'relative' }}>
      {showArrows && items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            style={{ ...arrowStyle, left: 8 }}
            onClick={goPrev}
          >
            <LeftOutlined />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            style={{ ...arrowStyle, right: 8 }}
            onClick={goNext}
          >
            <RightOutlined />
          </button>
        </>
      )}
      <Carousel
        ref={carouselRef}
        dots
        autoplay={false}
        infinite={false}
        afterChange={handleAfterChange}
      >
        {items.map((item, index) => {
          const active = activeIndex === index;
          const videoSlide = isVideo(item);

          return (
            <div key={`${item.id}-${index}`}>
              <div style={slideStyle} onClick={handleSlideClick} role="presentation">
                {videoSlide ? (
                  active ? (
                    <VideoWithSoundToggle
                      key={`video-${item.id}-${index}`}
                      src={assetUrl(item.mediaKey)}
                      autoPlay
                      controls={videoControls}
                      onEnded={() => {
                        clearTimer();
                        carouselRef.current?.next();
                      }}
                      style={mediaStyle}
                    />
                  ) : (
                    <div
                      style={{
                        ...mediaStyle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: 28,
                      }}
                      aria-hidden
                    >
                      ▶
                    </div>
                  )
                ) : (
                  <Image
                    src={assetUrl(item.mediaKey)}
                    alt={title}
                    fill
                    style={{ objectFit: mediaFit }}
                    unoptimized
                  />
                )}
                {renderOverlay?.(item, index)}
              </div>
            </div>
          );
        })}
      </Carousel>
      {items.length > 1 && clickToNavigate && !renderOverlay && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#888', textAlign: 'center' }}>
          Tap left/right or use arrows · {activeIndex + 1}/{items.length}
        </p>
      )}
    </div>
  );
}
