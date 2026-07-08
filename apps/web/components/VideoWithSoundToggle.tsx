'use client';

import { AudioMutedOutlined, SoundOutlined } from '@ant-design/icons';
import React, { useCallback, useRef, useState } from 'react';

type VideoWithSoundToggleProps = {
  src: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  style?: React.CSSProperties;
};

export default function VideoWithSoundToggle({
  src,
  autoPlay = true,
  controls = false,
  loop = false,
  onEnded,
  style,
}: VideoWithSoundToggleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !muted;
      setMuted(next);
      const v = videoRef.current;
      if (v) {
        v.muted = next;
        if (!next && v.paused) v.play().catch(() => {});
      }
    },
    [muted],
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        controls={controls}
        loop={loop}
        onLoadedData={(e) => {
          const v = e.currentTarget;
          v.muted = muted;
          if (autoPlay && v.paused) v.play().catch(() => {});
        }}
        onEnded={onEnded}
        style={style}
      />
      <button
        type="button"
        data-video-mute
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        title={muted ? 'Unmute' : 'Mute'}
        onClick={toggleMute}
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          zIndex: 5,
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 16,
        }}
      >
        {muted ? <AudioMutedOutlined /> : <SoundOutlined />}
      </button>
    </div>
  );
}
