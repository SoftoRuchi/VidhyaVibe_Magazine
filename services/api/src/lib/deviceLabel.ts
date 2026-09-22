function looksLikeUserAgent(value: string) {
  return /mozilla\/|applewebkit|chrome\/|safari\/|firefox\/|edg\/|opr\//i.test(value);
}

function parseUserAgent(ua: string) {
  if (!ua) return '';
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Windows NT|Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(ua)
          ? 'Mac'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : /Safari\//i.test(ua)
            ? 'Safari'
            : '';
  if (browser && os) return `${browser} on ${os}`;
  return browser || os;
}

export function friendlyDeviceLabel(deviceName?: string | null, userAgent?: string | null) {
  const name = String(deviceName || '').trim();
  if (name === 'admin-web') return 'Admin web';
  if (name === 'guest-checkout') return 'Guest checkout';
  if (name && !looksLikeUserAgent(name)) return name;
  return parseUserAgent(userAgent || name) || name || 'Unknown device';
}
