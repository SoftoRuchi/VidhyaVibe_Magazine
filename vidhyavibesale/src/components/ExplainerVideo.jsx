import React, { useRef, useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import { SALES_MEDIA } from '../config/salesMedia';
import { CTA_LABEL } from '../config/salesPageConfig';

/**
 * F5 — poster + play; muted autoplay OFF; lazy iframe/video when played.
 * If no MP4/YouTube yet, keep the poster visible (no developer-path error state).
 */
export default function ExplainerVideo({ onCtaClick, ctaLoading }) {
  const { mp4, posterJpg, youtubeId } = SALES_MEDIA.explainer;
  const hasVideo = Boolean(youtubeId || mp4);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  const startPlayback = () => {
    if (!hasVideo) return;
    setPlaying(true);
    window.setTimeout(() => {
      videoRef.current?.play?.().catch(() => {});
    }, 50);
  };

  return (
    <section className="vv-sale-section vv-sale-explainer">
      <div className="container">
        <div className="vv-sale-explainerFrame">
          {!playing || !hasVideo ? (
            <button
              type="button"
              className="vv-sale-videoPoster"
              onClick={startPlayback}
              aria-label={hasVideo ? 'Play explainer video' : 'Explainer video coming soon'}
            >
              <img
                src={posterJpg}
                alt="VidhyaVibe explainer video"
                loading="lazy"
                decoding="async"
              />
              {hasVideo ? (
                <span className="vv-sale-playBtn" aria-hidden>
                  <FaPlay />
                </span>
              ) : (
                <span className="vv-sale-videoSoon">Video coming soon</span>
              )}
            </button>
          ) : youtubeId ? (
            <iframe
              title="VidhyaVibe explainer"
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <video ref={videoRef} controls playsInline preload="metadata" poster={posterJpg}>
              <source src={mp4} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
        <div className="vv-sale-explainerCta">
          <button
            type="button"
            className="vv-sale-btn vv-sale-ctaPrimary"
            disabled={ctaLoading}
            onClick={onCtaClick}
          >
            {ctaLoading ? 'Please wait…' : CTA_LABEL}
          </button>
        </div>
      </div>
    </section>
  );
}
