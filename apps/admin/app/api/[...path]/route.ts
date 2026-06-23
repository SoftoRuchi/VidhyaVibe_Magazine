import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getApiProxyBase } from '../../../lib/apiProxyBase';

export const runtime = 'nodejs';

const FORWARD_HEADERS = [
  'authorization',
  'x-access-token',
  'x-refresh-token',
  'content-type',
  'content-length',
  'cookie',
  'accept',
];

async function proxy(req: NextRequest, pathSegments: string[]) {
  const apiBase = getApiProxyBase();
  const path = pathSegments.join('/');
  const url = `${apiBase}/api/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  FORWARD_HEADERS.forEach((name) => {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  });

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
      init.duplex = 'half';
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    console.error('[admin api proxy] fetch failed:', url, e);
    return NextResponse.json(
      { error: 'api_unreachable', message: 'Cannot reach API. Is it running on port 2034?' },
      { status: 502 },
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    resHeaders.append(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

type Ctx = { params: { path: string[] } };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
