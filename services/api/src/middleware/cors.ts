import type { RequestHandler } from 'express';

const DEFAULT_ORIGINS = [
  'https://readeradmin.vidhyavibe.in',
  'https://reader.vidhyavibe.in',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function allowedOrigins(): string[] {
  const extra = [process.env.ADMIN_ORIGIN, process.env.READER_ORIGIN].filter(Boolean) as string[];
  return [...new Set([...DEFAULT_ORIGINS, ...extra])];
}

/** Browser calls from readeradmin / reader when NEXT_PUBLIC_API_BASE_URL points at this API. */
export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization,Content-Type,X-Access-Token,X-Refresh-Token,Accept',
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
};
