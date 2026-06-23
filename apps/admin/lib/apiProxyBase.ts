/** API origin for server-side proxy (Route Handler). */
export function getApiProxyBase(): string {
  const fromEnv = process.env.INTERNAL_API_URL || process.env.API_PROXY_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'http://127.0.0.1:2034';
}
