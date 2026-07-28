import React, { useState } from 'react';

/**
 * F6 — WebP with JPG fallback when webp is provided; lazy by default unless priority.
 */
export default function SalesPicture({
  jpg,
  webp,
  alt,
  className = '',
  priority = false,
  width,
  height,
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !jpg) {
    return (
      <div className={`vv-sale-imgPlaceholder ${className}`} role="img" aria-label={alt}>
        <span>{alt}</span>
      </div>
    );
  }

  const img = (
    <img
      src={jpg}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  );

  if (!webp) {
    return <div className={className}>{img}</div>;
  }

  return (
    <picture className={className}>
      <source srcSet={webp} type="image/webp" />
      {img}
    </picture>
  );
}
