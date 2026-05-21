declare global {
  interface Window {
    __READER_BASE_URL__?: string;
  }
}

const DEFAULT_READER_BASE_URL = 'https://reader.vidhyavibe.in';

/** Reader site URL — prefers runtime value injected by root layout (Server env). */
export function getReaderBaseUrl(): string {
  if (typeof window !== 'undefined' && window.__READER_BASE_URL__) {
    return window.__READER_BASE_URL__.replace(/\/$/, '');
  }
  const fromBuild = process.env.NEXT_PUBLIC_READER_URL;
  if (fromBuild) return fromBuild.replace(/\/$/, '');
  return DEFAULT_READER_BASE_URL;
}

export function getReaderEditionUrl(editionId: number, query = ''): string {
  const base = getReaderBaseUrl();
  const q = query ? (query.startsWith('?') ? query : `?${query}`) : '';
  return `${base}/reader/${editionId}${q}`;
}
