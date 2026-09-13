/** Public URL that Flutter/Android can load (path, not ?key= with encoded slashes). */
export function publicFileUrlForKey(key: string): string {
  const safe = String(key || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .map((p) => encodeURIComponent(p))
    .join('/');
  return `/api/assets/file/${safe}`;
}

export function rewriteCourseAssetUrls(html: string): string {
  if (!html) return html;
  return html.replace(/<img\b([^>]*?)(\/?)>/gi, (_full, attrs: string, slash: string) => {
    const next = String(attrs).replace(
      /src\s*=\s*(["'])([^"']*)\1/i,
      (_a, q: string, src: string) => {
        return `src=${q}${toPublicAssetUrl(src)}${q}`;
      },
    );
    return `<img${next}${slash}>`;
  });
}

export function toPublicAssetUrl(src: string): string {
  const raw = String(src || '')
    .replace(/&amp;/g, '&')
    .trim();
  if (!raw) return raw;

  const fromQuery = (path: string, search: string): string | null => {
    if (!/\/assets\/serve\/?$/i.test(path.replace(/\/+$/, ''))) return null;
    const key = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('key');
    return key ? publicFileUrlForKey(key) : null;
  };

  if (raw.startsWith('/api/assets/serve')) {
    const qIndex = raw.indexOf('?');
    const converted = fromQuery(
      raw.slice(0, qIndex >= 0 ? qIndex : raw.length),
      qIndex >= 0 ? raw.slice(qIndex) : '',
    );
    if (converted) return converted;
  }

  try {
    const u = new URL(raw, 'http://local.invalid');
    const converted = fromQuery(u.pathname, u.search);
    if (converted) return converted;
  } catch {
    /* keep original */
  }
  return raw;
}
